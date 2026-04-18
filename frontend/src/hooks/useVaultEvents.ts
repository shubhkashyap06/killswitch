import { useEffect, useRef, useState } from "react";
import { ethers }                         from "ethers";
import { useAccount }                      from "wagmi";
import VaultABI                            from "@/lib/abis/LiquidityVault.json";
import { VAULT_ADDRESS, RPC_URL, ATTACKER_ADDRESS } from "@/lib/constants";
import type { ActivityEvent, Candle }      from "./useThreatSimulation";

export interface TxRecord {
  id:        string;
  txHash:    string;
  type:      "Deposit" | "Withdraw" | "Freeze" | "Unfreeze";
  user:      string;
  amount:    number;        // VLT
  timestamp: number;        // ms
  status:    "Confirmed" | "Blocked" | "Suspicious";
  threat:    "Low" | "Moderate" | "High";
  blockNumber: number;
}

export interface VaultEvents {
  events:       ActivityEvent[];   // for ActivityFeed / Alerts
  txHistory:    TxRecord[];        // for Transactions page
  threatScore:  number;            // 0-100 derived heuristic
  candles:      Candle[];          // for CandleChart
  freezeCount:  number;            // total times frozen
  depositCount: number;
  withdrawCount:number;
}

// Dedup set — persists between renders/StrictMode double-invocations
const processedLogIds = new Set<string>();

let _provider: ethers.JsonRpcProvider | null = null;
function getProvider() {
  if (!_provider) _provider = new ethers.JsonRpcProvider(RPC_URL);
  return _provider;
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

const POLL_MS = 800;

export function useVaultEvents(isFrozenOverride: boolean = false): VaultEvents {
  const { address } = useAccount();
  const lastBlockRef = useRef(-1);
  const mountedRef   = useRef(true);

  // Withdraw tracking for threat score
  const recentWithdrawals = useRef<Record<string, number[]>>({});
  const threatRef          = useRef(0);

  // Candle state: price simulates from totalDeposits baseline
  const candlePriceRef = useRef(1842);

  const [state, setState] = useState<VaultEvents>({
    events:        [],
    txHistory:     [],
    threatScore:   0,
    candles:       (() => {
      const out: Candle[] = [];
      let price = 1842;
      const now = Date.now();
      for (let i = 60; i > 0; i--) {
        const o = price;
        const c = o + (Math.random() - 0.5) * 10;
        out.push({ t: now - i * 5000, o, h: Math.max(o, c) + Math.random() * 3, l: Math.min(o, c) - Math.random() * 3, c, threatScore: 0 });
        price = c;
      }
      return out;
    })(),
    freezeCount:   0,
    depositCount:  0,
    withdrawCount: 0,
  });

  useEffect(() => {
    mountedRef.current = true;
    const iface = new ethers.Interface(VaultABI.abi);

    const DEPOSIT_TOPIC   = iface.getEvent("Deposit")?.topicHash;
    const WITHDRAW_TOPIC  = iface.getEvent("Withdraw")?.topicHash;
    const FREEZE_TOPIC    = iface.getEvent("Freeze")?.topicHash;
    const UNFREEZE_TOPIC  = iface.getEvent("Unfreeze")?.topicHash;
    const EMERGENCY_TOPIC = iface.getEvent("EmergencyUnfreeze")?.topicHash;
    const SUSPICIOUS_TOPIC = iface.getEvent("SuspiciousActivity")?.topicHash;

    const pollLogs = async () => {
      try {
        const provider = getProvider();
        const currentBlock = await provider.getBlockNumber();

        if (lastBlockRef.current < 0) {
          lastBlockRef.current = Math.max(0, currentBlock - 10);
        }
        if (currentBlock <= lastBlockRef.current) return;

        const logs = await provider.getLogs({
          address: VAULT_ADDRESS,
          fromBlock: lastBlockRef.current + 1,
          toBlock: currentBlock,
        });

        lastBlockRef.current = currentBlock;
        if (!mountedRef.current || logs.length === 0) return;

        const newEvents:    ActivityEvent[] = [];
        const newTxRecords: TxRecord[]      = [];
        let freezeCountDelta   = 0;
        let depositCountDelta  = 0;
        let withdrawCountDelta = 0;
        let threatDelta        = 0;

        for (const log of logs) {
          const logId = `${log.transactionHash}-${log.index}`;
          if (processedLogIds.has(logId)) continue;
          processedLogIds.add(logId);

          const topic = log.topics[0];
          let parsed: ethers.LogDescription | null = null;
          try {
            parsed = iface.parseLog({ topics: [...log.topics], data: log.data });
          } catch { continue; }
          if (!parsed) continue;

          const now = Date.now();
          const ts  = Math.floor(now);

          // ── DEPOSIT ───────────────────────────────────────────────────────
          if (topic === DEPOSIT_TOPIC) {
            const user   = parsed.args[0] as string;
            const amount = Number(ethers.formatEther(parsed.args[1] as bigint));
            depositCountDelta++;
            // Limit price impact for massive testing deposits to keep chart legible
            const maxImpact = Math.min(amount * 0.005, 80); 
            candlePriceRef.current += maxImpact;

            newEvents.push({
              id: uid(), txHash: log.transactionHash, t: ts, level: "info",
              source: "vault.deposit",
              message: `Deposit of ${amount.toFixed(2)} VLT from ${user.slice(0, 10)}…`,
            });
            newTxRecords.push({
              id: logId, txHash: log.transactionHash,
              type: "Deposit", user, amount, timestamp: ts,
              status: "Confirmed", threat: "Low", blockNumber: log.blockNumber,
            });
          }

          // ── WITHDRAW ──────────────────────────────────────────────────────
          if (topic === WITHDRAW_TOPIC) {
            const user   = (parsed.args[0] as string).toLowerCase();
            const amount = Number(ethers.formatEther(parsed.args[1] as bigint));
            withdrawCountDelta++;
            // Track rapid withdrawals per address
            if (!recentWithdrawals.current[user]) recentWithdrawals.current[user] = [];
            recentWithdrawals.current[user] = recentWithdrawals.current[user].filter(t => now - t < 90_000);
            recentWithdrawals.current[user].push(now);
            const count = recentWithdrawals.current[user].length;

            const isAttack = count >= 2 || user === ATTACKER_ADDRESS;
            const threat: TxRecord["threat"] = count >= 3 ? "High" : count >= 2 ? "Moderate" : "Low";
            const level: ActivityEvent["level"] = isAttack ? "critical" : count >= 2 ? "warn" : "info";
            threatDelta += isAttack ? (count >= 3 ? 35 : 18) : 0;

            // Protect Y-axis scale using max impact constraints
            const maxImpact = Math.min(amount * 0.008, 120);
            candlePriceRef.current = Math.max(800, candlePriceRef.current - maxImpact);

            newEvents.push({
              id: uid(), txHash: log.transactionHash, t: ts, level,
              source: isAttack ? "guardian" : "vault.withdraw",
              message: isAttack
                ? `⚠ Rapid drain #${count} — ${user.slice(0, 10)}… withdrew ${amount.toFixed(2)} VLT`
                : `Withdraw of ${amount.toFixed(2)} VLT from ${user.slice(0, 10)}…`,
            });
            newTxRecords.push({
              id: logId, txHash: log.transactionHash,
              type: "Withdraw", user, amount, timestamp: ts,
              status: isAttack ? "Suspicious" : "Confirmed",
              threat, blockNumber: log.blockNumber,
            });
          }

          // ── SUSPICIOUS ACTIVITY ───────────────────────────────────────────
          if (topic === SUSPICIOUS_TOPIC) {
            const user  = parsed.args[0] as string;
            const count = Number(parsed.args[1]);
            threatDelta += 15;
            newEvents.push({
              id: uid(), txHash: log.transactionHash, t: ts, level: "critical",
              source: "guardian",
              message: `SuspiciousActivity: ${user.slice(0, 10)}… rapid withdrawal count=${count}`,
            });
          }

          // ── FREEZE ───────────────────────────────────────────────────────
          if (topic === FREEZE_TOPIC) {
            const reason = parsed.args[2] as string;
            freezeCountDelta++;
            threatDelta += 40;
            newEvents.push({
              id: uid(), txHash: log.transactionHash, t: ts, level: "critical",
              source: "killswitch",
              message: `🔒 Circuit breaker activated — vault frozen: ${reason.slice(0, 60)}`,
            });
            newTxRecords.push({
              id: logId, txHash: log.transactionHash,
              type: "Freeze", user: parsed.args[0] as string, amount: 0, timestamp: ts,
              status: "Blocked", threat: "High", blockNumber: log.blockNumber,
            });
          }

          // ── UNFREEZE / EMERGENCY ──────────────────────────────────────────
          if (topic === UNFREEZE_TOPIC || topic === EMERGENCY_TOPIC) {
            const label = topic === EMERGENCY_TOPIC ? "Emergency Unfreeze" : "Unfreeze";
            threatRef.current = 0;
            recentWithdrawals.current = {};
            newEvents.push({
              id: uid(), txHash: log.transactionHash, t: ts, level: "info",
              source: "killswitch",
              message: `✅ ${label} — vault restored to normal operations`,
            });
            newTxRecords.push({
              id: logId, txHash: log.transactionHash,
              type: "Unfreeze", user: parsed.args[0] as string, amount: 0, timestamp: ts,
              status: "Confirmed", threat: "Low", blockNumber: log.blockNumber,
            });
          }
        }

        if (newEvents.length === 0 && newTxRecords.length === 0) return;

        // Build new candle
        const o = candlePriceRef.current;
        const volatility = 2 + threatRef.current / 12;
        const c = o + (Math.random() - 0.5) * volatility * 2;
        const newCandle: Candle = {
          t: Date.now(), o,
          h: Math.max(o, c) + Math.random() * 3,
          l: Math.min(o, c) - Math.random() * 3,
          c,
        };
        candlePriceRef.current = c;

        setState(prev => {
          const newThreat = Math.min(100, Math.max(0, prev.threatScore + threatDelta));
          threatRef.current = newThreat;
          return {
            events:        [...newEvents, ...prev.events].slice(0, 100),
            txHistory:     [...newTxRecords, ...prev.txHistory].slice(0, 200),
            threatScore:   newThreat,
            candles:       [...prev.candles.slice(-79), newCandle],
            freezeCount:   prev.freezeCount   + freezeCountDelta,
            depositCount:  prev.depositCount  + depositCountDelta,
            withdrawCount: prev.withdrawCount + withdrawCountDelta,
          };
        });

      } catch {
        // swallow transient RPC errors
      }
    };

    // Candle tick even if no new events (price drift)
    const candleTick = setInterval(() => {
      setState(prev => {
        const o = candlePriceRef.current;
        const volatility = 4 + prev.threatScore / 10;
        const frozen = isFrozenOverride || prev.threatScore >= 80;
        
        let c: number;
        let finalVolatility = volatility;

        if (frozen) {
          c = o; // Price flatlines exactly at current point
          finalVolatility = 0; // No vertical wicks
        } else {
          // Human-like transaction bot simulation (momentum + random walk)
          // Add occasional "human-like" spike clusters reflecting market buys/sells
          const volatilitySpike = Math.random() > 0.85 ? volatility * 3 : volatility;
          const trendDirection = Math.sin(Date.now() / 15000); // 15-second macro trend waves
          const organicBuying = trendDirection * (Math.random() * volatilitySpike);
          
          const meanReversion = (2500 - o) * 0.01;
          const drift = organicBuying + meanReversion;
          
          c = o + drift + (Math.random() - 0.5) * volatilitySpike;
        }
        
        const newCandle: Candle = {
          t: Date.now(), o,
          h: frozen ? o : Math.max(o, c) + Math.random() * (finalVolatility * 0.8),
          l: frozen ? o : Math.min(o, c) - Math.random() * (finalVolatility * 0.8),
          c,
          threatScore: prev.threatScore,
        };
        candlePriceRef.current = c;
        return { ...prev, candles: [...prev.candles.slice(-79), newCandle] };
      });
    }, 1200);

    // Threat score natural decay
    const decayTick = setInterval(() => {
      setState(prev => {
        if (prev.threatScore <= 0) return prev;
        const next = Math.max(0, prev.threatScore - 0.8);
        threatRef.current = next;
        return { ...prev, threatScore: next };
      });
    }, 800);

    const pollId = setInterval(pollLogs, POLL_MS);
    pollLogs();

    return () => {
      mountedRef.current = false;
      clearInterval(pollId);
      clearInterval(candleTick);
      clearInterval(decayTick);
    };
  }, [address]);

  return state;
}
