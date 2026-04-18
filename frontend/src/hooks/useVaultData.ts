import { useEffect, useRef, useState } from "react";
import { ethers }                         from "ethers";
import { useAccount }                      from "wagmi";
import VaultABI                            from "@/lib/abis/LiquidityVault.json";
import TokenABI                            from "@/lib/abis/KillswitchToken.json";
import { VAULT_ADDRESS, TOKEN_ADDRESS, RPC_URL } from "@/lib/constants";

export interface VaultData {
  totalDeposits:    number;  // VLT, formatted
  isFrozen:         boolean;
  frozenAt:         number;  // unix seconds
  freezeDuration:   number;  // seconds
  maxWithdrawBps:   number;  // e.g. 3000 = 30%
  userVaultBalance: number;  // VLT the user deposited into vault
  userTokenBalance: number;  // VLT in user's actual wallet
  timeLockRemaining:number;  // seconds
  maxWithdrawAmount:number;  // VLT
  loading:          boolean;
}

const DEFAULT: VaultData = {
  totalDeposits:     0,
  isFrozen:          false,
  frozenAt:          0,
  freezeDuration:    0,
  maxWithdrawBps:    3000,
  userVaultBalance:  0,
  userTokenBalance:  0,
  timeLockRemaining: 0,
  maxWithdrawAmount: 0,
  loading:           true,
};

let _provider: ethers.JsonRpcProvider | null = null;
function getProvider() {
  if (!_provider) _provider = new ethers.JsonRpcProvider(RPC_URL);
  return _provider;
}

export function useVaultData(): VaultData {
  const { address } = useAccount();
  const [data, setData] = useState<VaultData>(DEFAULT);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    const poll = async () => {
      try {
        const provider = getProvider();
        const vault     = new ethers.Contract(VAULT_ADDRESS, VaultABI.abi, provider);
        const token     = new ethers.Contract(TOKEN_ADDRESS, TokenABI.abi, provider);

        const [
          totalRaw,
          frozenRaw,
          frozenAtRaw,
          freezeDurRaw,
          maxBpsRaw,
          timeLockRaw,
          maxWdRaw,
          userVaultRaw,
          userTokenRaw,
        ] = await Promise.all([
          vault.totalDeposits(),
          vault.frozen(),
          vault.frozenAt(),
          vault.freezeDuration(),
          vault.maxWithdrawBps(),
          vault.timeLockRemaining(),
          vault.maxWithdrawAmount(),
          address ? vault.balances(address) : Promise.resolve(0n),
          address ? token.balanceOf(address) : Promise.resolve(0n),
        ]);

        if (!mountedRef.current) return;

        setData({
          totalDeposits:     Number(ethers.formatEther(totalRaw)),
          isFrozen:          Boolean(frozenRaw),
          frozenAt:          Number(frozenAtRaw),
          freezeDuration:    Number(freezeDurRaw),
          maxWithdrawBps:    Number(maxBpsRaw),
          timeLockRemaining: Number(timeLockRaw),
          maxWithdrawAmount: Number(ethers.formatEther(maxWdRaw)),
          userVaultBalance:  Number(ethers.formatEther(userVaultRaw)),
          userTokenBalance:  Number(ethers.formatEther(userTokenRaw)),
          loading:           false,
        });
      } catch {
        // swallow transient RPC errors
      }
    };

    poll();
    const id = setInterval(poll, 2000);
    return () => {
      mountedRef.current = false;
      clearInterval(id);
    };
  }, [address]);

  return data;
}
