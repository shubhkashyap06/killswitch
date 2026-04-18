import { useEffect, useRef, useState } from "react";

export type SystemStatus = "ACTIVE" | "FROZEN";

export interface Candle {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  threatScore: number;
}

export interface ActivityEvent {
  id: string;
  txHash?: string;
  t: number;
  level: "info" | "warn" | "critical";
  source: string;
  message: string;
}

const FREEZE_THRESHOLD = 80;

const SOURCES = [
  "mempool",
  "oracle",
  "vault.usdc",
  "vault.eth",
  "router",
  "bridge",
  "guardian",
];

const INFO_MSGS = [
  "Heartbeat OK",
  "Oracle price update",
  "Routine vault rebalance",
  "New block validated",
  "Liquidity provider deposit",
];
const WARN_MSGS = [
  "Liquidity spike detected",
  "Unusual swap volume",
  "Slippage above baseline",
  "Stablecoin depeg < 0.3%",
  "Gas auction anomaly",
];
const CRIT_MSGS = [
  "Suspicious contract interaction",
  "Flash loan pattern observed",
  "Oracle deviation > 2%",
  "Drainer signature matched",
  "Reentrancy attempt blocked",
];

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function rand(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

export function useThreatSimulation() {
  const [threat, setThreat] = useState(18);
  const [status, setStatus] = useState<SystemStatus>("ACTIVE");
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [candles, setCandles] = useState<Candle[]>(() => {
    const out: Candle[] = [];
    let price = 1842;
    const now = Date.now();
    for (let i = 60; i > 0; i--) {
      const o = price;
      const c = o + rand(-6, 6);
      const h = Math.max(o, c) + rand(0, 4);
      const l = Math.min(o, c) - rand(0, 4);
      out.push({ t: now - i * 5000, o, h, l, c, threatScore: 18 });
      price = c;
    }
    return out;
  });

  const frozenRef = useRef(false);
  const threatRef = useRef(threat);
  threatRef.current = threat;

  // Threat updates — smooth, intentional, occasional spikes
  useEffect(() => {
    const id = window.setInterval(() => {
      setThreat((prev) => {
        if (frozenRef.current) {
          // After freeze, slowly bleed back down
          return Math.max(12, prev - rand(0.4, 1.2));
        }
        // Drift + occasional spikes building toward critical
        const drift = rand(-1.2, 1.6);
        const spike = Math.random() < 0.08 ? rand(3, 9) : 0;
        const next = Math.min(99, Math.max(8, prev + drift + spike));
        return next;
      });
    }, 700);
    return () => window.clearInterval(id);
  }, []);

  // Candle ticks
  useEffect(() => {
    const id = window.setInterval(() => {
      setCandles((prev) => {
        const last = prev[prev.length - 1];
        const o = last.c;
        const frozen = frozenRef.current;
        // On freeze, simulate sharp drop (rug pull) then stabilize lower
        let c: number;
        if (frozen) {
          const distance = o - 1500;
          c = o - Math.max(2, distance * rand(0.04, 0.09)) + rand(-2, 2);
        } else {
          const volatility = 2 + threatRef.current / 12;
          c = o + rand(-volatility, volatility);
        }
        const h = Math.max(o, c) + rand(0, 3);
        const l = Math.min(o, c) - rand(0, 3);
        const next: Candle = { t: Date.now(), o, h, l, c, threatScore: threatRef.current };
        const out = [...prev.slice(-79), next];
        return out;
      });
    }, 1200);
    return () => window.clearInterval(id);
  }, []);

  // Activity feed — paced, level matches threat
  useEffect(() => {
    const id = window.setInterval(() => {
      const t = threatRef.current;
      const roll = Math.random();
      let level: ActivityEvent["level"] = "info";
      let pool = INFO_MSGS;
      if (t > 70 || (t > 50 && roll < 0.5)) {
        level = "critical";
        pool = CRIT_MSGS;
      } else if (t > 35 || roll < 0.4) {
        level = "warn";
        pool = WARN_MSGS;
      }
      const ev: ActivityEvent = {
        id: uid(),
        t: Date.now(),
        level,
        source: SOURCES[Math.floor(Math.random() * SOURCES.length)],
        message: pool[Math.floor(Math.random() * pool.length)],
      };
      setEvents((prev) => [ev, ...prev].slice(0, 80));
    }, 1400);
    return () => window.clearInterval(id);
  }, []);

  // Freeze trigger
  useEffect(() => {
    if (threat >= FREEZE_THRESHOLD && !frozenRef.current) {
      frozenRef.current = true;
      setStatus("FROZEN");
      setEvents((prev) => [
        {
          id: uid(),
          t: Date.now(),
          level: "critical",
          source: "killswitch",
          message: "Circuit breaker activated — vault frozen",
        },
        ...prev,
      ]);
      // Auto-recover after a while
      window.setTimeout(() => {
        frozenRef.current = false;
        setStatus("ACTIVE");
        setThreat(24);
        setEvents((prev) => [
          {
            id: uid(),
            t: Date.now(),
            level: "info",
            source: "killswitch",
            message: "Vault unfrozen — systems nominal",
          },
          ...prev,
        ]);
      }, 9000);
    }
  }, [threat]);

  return { threat, status, events, candles, freezeThreshold: FREEZE_THRESHOLD };
}
