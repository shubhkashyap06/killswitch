"use client";

import { useEffect, useRef } from "react";
import { useAccount } from "wagmi";
import { ethers } from "ethers";
import { useVultraStore } from "@/lib/store";
import VaultABI from "@/lib/abis/LiquidityVault.json";

const VAULT_ADDRESS = process.env.NEXT_PUBLIC_VAULT_ADDRESS as string;
const RPC_URL = "http://127.0.0.1:8545";
const POLL_MS = 800;

// Known attacker address from Hardhat signers[5]
const ATTACKER_ADDRESS = "0x9965507d1a55bcc2695c58ba16fb37d819b0a4dc";

// ─── Minimal provider singleton ───────────────────────────────────────────────
let _provider: ethers.JsonRpcProvider | null = null;
function getProvider() {
  if (!_provider) _provider = new ethers.JsonRpcProvider(RPC_URL);
  return _provider;
}

// ─── Global dedup set — persists across React StrictMode double-invocations ───
// StrictMode runs every useEffect twice in dev; without this the same tx
// gets added twice, causing the "duplicate key" React error.
const processedTxIds = new Set<string>();

export default function BlockchainSync() {
  const { address } = useAccount();
  // Shared across the two polling effects so they advance the same cursor
  const lastBlockRef = useRef<number>(-1);
  const pollingRef   = useRef<ReturnType<typeof setInterval> | null>(null);

  // ─── Immediately sync wallet connection state to the Zustand store ────────
  // The dashboard guard reads from wagmi directly, but other components (Navbar,
  // ActionPanel) read from the store — keep them in sync without polling delay.
  useEffect(() => {
    useVultraStore.setState({
      isConnected: !!address,
      walletAddress: address ?? null,
    });
  }, [address]);


  // ─── State polling: frozen, totalDeposits, userBalance ───────────────────
  useEffect(() => {
    let mounted = true;

    const pollState = async () => {
      try {
        const provider = getProvider();
        const vault = new ethers.Contract(VAULT_ADDRESS, VaultABI.abi, provider);

        const [totalRaw, frozenRaw, userBalRaw] = await Promise.all([
          vault.totalDeposits(),
          vault.frozen(),                       // correct function name
          address ? vault.balances(address) : Promise.resolve(BigInt(0)),
        ]);

        if (!mounted) return;

        const newTotal  = Number(ethers.formatEther(totalRaw));
        const newFrozen = Boolean(frozenRaw);
        const newBal    = Number(ethers.formatEther(typeof userBalRaw === "bigint" ? userBalRaw : BigInt(userBalRaw)));

        useVultraStore.setState((state) => ({
          totalLiquidity:    newTotal,
          isFrozen:          newFrozen,
          userBalance:       newBal,
          systemStatus:      newFrozen ? "FROZEN" : "NORMAL",
          walletAddress:     address || "",
          isConnected:       !!address,
          // Update threat score to match frozen state immediately
          ...(newFrozen && !state.isFrozen
            ? { alertMessage: "⚠ Vault frozen by Guardian — circuit breaker active" }
            : {}),
        }));
      } catch {
        // Silently swallow transient RPC errors (e.g. Hardhat restarting)
      }
    };

    const stateInterval = setInterval(pollState, 2000);
    pollState(); // run immediately on mount

    return () => {
      mounted = false;
      clearInterval(stateInterval);
    };
  }, [address]);

  // ─── Event log polling: Deposit, Withdraw, Freeze, Unfreeze ──────────────
  useEffect(() => {
    let mounted = true;

    const iface = new ethers.Interface(VaultABI.abi);
    const DEPOSIT_TOPIC  = iface.getEvent("Deposit")!.topicHash;
    const WITHDRAW_TOPIC = iface.getEvent("Withdraw")!.topicHash;
    const FREEZE_TOPIC   = iface.getEvent("Freeze")!.topicHash;
    const UNFREEZE_TOPIC = iface.getEvent("Unfreeze")!.topicHash;
    const EMERGENCY_TOPIC = iface.getEvent("EmergencyUnfreeze")!.topicHash;

    // Track rapid-withdraw cadence per address for attack detection
    const recentWithdrawals: Record<string, number[]> = {};

    const pollLogs = async () => {
      try {
        const provider = getProvider();
        const currentBlock = await provider.getBlockNumber();

        if (lastBlockRef.current < 0) {
          // First run — start from a few blocks back to catch recent events
          lastBlockRef.current = Math.max(0, currentBlock - 5);
        }

        if (currentBlock <= lastBlockRef.current) return;

        const logs = await provider.getLogs({
          address: VAULT_ADDRESS,
          fromBlock: lastBlockRef.current + 1,
          toBlock: currentBlock,
        });

        lastBlockRef.current = currentBlock;
        if (!mounted || logs.length === 0) return;

        for (const log of logs) {
          const topic = log.topics[0];
          let parsed: ethers.LogDescription | null = null;
          try {
            parsed = iface.parseLog({ topics: [...log.topics], data: log.data });
          } catch { continue; }
          if (!parsed) continue;

          const ts = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

          // ── Deduplication: skip events already seen (StrictMode runs effects twice)
          const logId = `${log.transactionHash}-${log.index}-${topic.slice(0, 10)}`;
          if (processedTxIds.has(logId)) continue;
          processedTxIds.add(logId);

          // ── DEPOSIT ──────────────────────────────────────────────────────
          if (topic === DEPOSIT_TOPIC) {
            const amount = Number(ethers.formatEther(parsed.args[1] as bigint));
            useVultraStore.setState((state) => {
              const newTotal = state.totalLiquidity + amount;
              return {
                totalLiquidity: newTotal,
                transactions: [
                  {
                    id: log.transactionHash + "-dep",
                    type: "DEPOSIT" as const,
                    amount,
                    timestamp: new Date(),
                    status: "SUCCESS" as const,
                    note: `On-chain Deposit — ${(parsed!.args[0] as string).slice(0, 10)}…`,
                  },
                  ...state.transactions,
                ].slice(0, 30),
                liquidityHistory: [
                  ...state.liquidityHistory.slice(-11),
                  { time: ts, liquidity: newTotal, locked: state.frozenLiquidity },
                ],
                txActivity: [
                  ...state.txActivity.slice(-11),
                  { time: ts, deposits: 1, withdrawals: 0, attacks: 0 },
                ],
              };
            });
          }


          // ── WITHDRAW — detect if this is an attack ────────────────────────
          if (topic === WITHDRAW_TOPIC) {
            const user   = (parsed.args[0] as string).toLowerCase();
            const amount = Number(ethers.formatEther(parsed.args[1] as bigint));
            const now    = Date.now();

            // Track withdrawals per address in rolling 90s window
            if (!recentWithdrawals[user]) recentWithdrawals[user] = [];
            recentWithdrawals[user] = recentWithdrawals[user].filter(t => now - t < 90_000);
            recentWithdrawals[user].push(now);

            const count = recentWithdrawals[user].length;

            // 3+ rapid withdrawals from same address OR from known attacker = ATTACK
            const isAttack = count >= 2 ||
              user === ATTACKER_ADDRESS ||
              (address && user !== address.toLowerCase());

            const txType  = isAttack ? "ATTACK"   : "WITHDRAW";
            const txStatus = isAttack ? "ATTACK"   : "SUCCESS";
            const txNote  = isAttack
              ? `⚠ Rapid drain #${count} — attacker: ${user.slice(0, 10)}…`
              : `On-chain Withdraw — ${user.slice(0, 10)}…`;

            useVultraStore.setState((state) => {
              const newTotal = Math.max(0, state.totalLiquidity - amount);

              // Bump threat score for attack transactions
              const threatDelta = isAttack ? (count >= 3 ? 40 : 20) : 0;
              const newThreat   = Math.min(state.threatScore + threatDelta, 100);

              return {
                totalLiquidity: newTotal,
                threatScore: newThreat,
                transactions: [
                  {
                    id: log.transactionHash + "-wd",
                    type: txType as any,
                    amount,
                    timestamp: new Date(),
                    status: txStatus as any,
                    note: txNote,
                  },
                  ...state.transactions,
                ].slice(0, 30),
                liquidityHistory: [
                  ...state.liquidityHistory.slice(-11),
                  { time: ts, liquidity: newTotal, locked: state.frozenLiquidity },
                ],
                txActivity: [
                  ...state.txActivity.slice(-11),
                  {
                    time: ts,
                    deposits: 0,
                    withdrawals: isAttack ? 0 : 1,
                    attacks: isAttack ? 1 : 0,
                  },
                ],
                // Push to attackLogs if it's an attack
                attackLogs: isAttack
                  ? [
                      {
                        id: log.transactionHash + "-atk",
                        attackType: "RAPID_TX" as any,
                        label: "Rapid Drain Detected",
                        impact: (count >= 3 ? "CRITICAL" : "HIGH") as "CRITICAL" | "HIGH",
                        threatDelta,
                        timestamp: new Date(),
                        result: `Withdrawal #${count} — ${amount.toFixed(1)} VLT exfiltrated by ${user.slice(0, 10)}…`,
                      },
                      ...state.attackLogs,
                    ].slice(0, 50)
                  : state.attackLogs,
              };
            });
          }

          // ── FREEZE ───────────────────────────────────────────────────────
          if (topic === FREEZE_TOPIC) {
            useVultraStore.setState((state) => ({
              isFrozen:     true,
              systemStatus: "FROZEN",
              threatScore:  Math.max(state.threatScore, 80),
              alertMessage: "🚨 CIRCUIT BREAKER — Vault frozen by Guardian",
              frozenLiquidity: state.totalLiquidity,
              availableLiquidity: 0,
              transactions: [
                {
                  id: log.transactionHash + "-frz",
                  type: "ATTACK" as const,
                  timestamp: new Date(),
                  status: "ATTACK" as const,
                  note: "🔒 Guardian circuit breaker engaged — vault frozen on-chain",
                },
                ...state.transactions,
              ].slice(0, 30),
              attackLogs: [
                {
                  id: log.transactionHash + "-frz-log",
                  attackType: "FLASH" as any,
                  label: "CIRCUIT BREAKER TRIGGERED",
                  impact: "CRITICAL" as const,
                  threatDelta: 0,
                  timestamp: new Date(),
                  result: "Guardian wallet called vault.freeze() — all operations halted",
                },
                ...state.attackLogs,
              ].slice(0, 50),
            }));
          }

          // ── UNFREEZE / EMERGENCY UNFREEZE ─────────────────────────────────
          if (topic === UNFREEZE_TOPIC || topic === EMERGENCY_TOPIC) {
            useVultraStore.setState({
              isFrozen:          false,
              systemStatus:      "NORMAL",
              frozenLiquidity:   0,
              threatScore:       0,
              alertMessage:      "✅ Vault unfrozen — normal operations resumed",
            });
          }
        }
      } catch {
        // Silently ignore transient RPC errors during log polling
      }
    };

    pollingRef.current = setInterval(pollLogs, POLL_MS);

    return () => {
      mounted = false;
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [address]);

  return null;
}
