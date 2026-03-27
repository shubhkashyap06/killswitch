"use client";

import { useEffect } from "react";
import { useAccount, useReadContracts, useWatchContractEvent } from "wagmi";
import { useVultraStore } from "@/lib/store";
import VaultABI from "@/lib/abis/LiquidityVault.json";

const VAULT_ADDRESS = process.env.NEXT_PUBLIC_VAULT_ADDRESS as `0x${string}`;

export default function BlockchainSync() {
  const { address } = useAccount();

  // Read state from contract
  const { data } = useReadContracts({
    contracts: [
      {
        address: VAULT_ADDRESS,
        abi: VaultABI.abi,
        functionName: "totalDeposits",
      },
      {
        address: VAULT_ADDRESS,
        abi: VaultABI.abi,
        functionName: "isFrozen",
      },
      {
        address: VAULT_ADDRESS,
        abi: VaultABI.abi,
        functionName: "balances",
        args: address ? [address] : undefined,
      },
    ],
    query: { refetchInterval: 3000 } // Poll every 3 seconds for live state sync
  });

  // Sync reads to Zustand
  useEffect(() => {
    if (data) {
      const newTotal = Number(data[0].result || BigInt(0)) / 1e18;
      const newFrozen = Boolean(data[1].result);
      const newBalance = Number(data[2].result || BigInt(0)) / 1e18;

      useVultraStore.setState((state) => ({
        totalLiquidity: newTotal,
        isFrozen: newFrozen,
        userBalance: newBalance,
        systemStatus: newFrozen ? "FROZEN" : "NORMAL",
        walletAddress: address || "",
        isConnected: !!address,
      }));
    }
  }, [data, address]);

  // Watch for smart contract events
  useWatchContractEvent({
    address: VAULT_ADDRESS,
    abi: VaultABI.abi,
    eventName: "Deposit",
    onLogs(logs) {
      logs.forEach((log) => {
        const amount = Number((log as any).args.amount) / 1e18;
        const ts = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        useVultraStore.setState((state) => {
          const newTotal = state.totalLiquidity + amount;
          const tx = {
            id: log.transactionHash as string,
            type: "DEPOSIT" as const,
            amount: amount,
            timestamp: new Date(),
            status: "SUCCESS" as const,
            note: "On-chain Deposit Confirmed",
          };
          
          return {
            totalLiquidity: newTotal,
            availableLiquidity: newTotal - state.frozenLiquidity,
            transactions: [tx, ...state.transactions].slice(0, 30),
            liquidityHistory: [
              ...state.liquidityHistory.slice(-11),
              { time: ts, liquidity: newTotal, locked: state.frozenLiquidity }
            ],
            txActivity: [
              ...state.txActivity.slice(-11),
              { time: ts, deposits: (state.txActivity[state.txActivity.length-1]?.deposits || 0) + 1, withdrawals: 0, attacks: 0 }
            ]
          };
        });
      });
    },
  });

  useWatchContractEvent({
    address: VAULT_ADDRESS,
    abi: VaultABI.abi,
    eventName: "Withdraw",
    onLogs(logs) {
      logs.forEach((log) => {
        const amount = Number((log as any).args.amount) / 1e18;
        const ts = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        useVultraStore.setState((state) => {
          const newTotal = Math.max(0, state.totalLiquidity - amount);
          const tx = {
            id: log.transactionHash as string,
            type: "WITHDRAW" as const,
            amount: amount,
            timestamp: new Date(),
            status: "SUCCESS" as const,
            note: "On-chain Withdraw Confirmed",
          };

          return {
            totalLiquidity: newTotal,
            availableLiquidity: newTotal - state.frozenLiquidity,
            transactions: [tx, ...state.transactions].slice(0, 30),
            liquidityHistory: [
              ...state.liquidityHistory.slice(-11),
              { time: ts, liquidity: newTotal, locked: state.frozenLiquidity }
            ],
            txActivity: [
              ...state.txActivity.slice(-11),
              { time: ts, deposits: 0, withdrawals: (state.txActivity[state.txActivity.length-1]?.withdrawals || 0) + 1, attacks: 0 }
            ]
          };
        });
      });
    },
  });

  useWatchContractEvent({
    address: VAULT_ADDRESS,
    abi: VaultABI.abi,
    eventName: "Freeze",
    onLogs() {
      useVultraStore.setState({ isFrozen: true, systemStatus: "FROZEN" });
    },
  });

  useWatchContractEvent({
    address: VAULT_ADDRESS,
    abi: VaultABI.abi,
    eventName: "Unfreeze",
    onLogs() {
      useVultraStore.setState({ isFrozen: false, systemStatus: "NORMAL" });
    },
  });

  return null; // Invisible component
}
