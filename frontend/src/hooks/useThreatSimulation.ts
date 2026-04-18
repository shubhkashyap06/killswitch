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
  const frozenRef = useRef(false);
  const threatRef = useRef(threat);
  threatRef.current = threat;

  // ── Market state refs (persist across ticks) ────────────────────────────────
  const priceRef     = useRef(1842);
  const trendRef     = useRef(0);        // slow drift direction  (-1 bear, +1 bull)
  const trendTickRef = useRef(0);        // ticks remaining in current trend
  const momentumRef  = useRef(0);        // short-term momentum carryover
  const cycleRef     = useRef(0);        // sinusoidal market cycle phase (radians)

  // ── Candle seed — realistic history using same OU model ────────────────────
  const [candles, setCandles] = useState<Candle[]>(() => {
    const out: Candle[] = [];
    let price    = 1842;
    let trend    = 0;
    let trendTtl = 0;
    let momentum = 0;
    let cycle    = 0;
    const TARGET = 1842;
    const now    = Date.now();

    for (let i = 80; i > 0; i--) {
      // Trend flip logic
      trendTtl--;
      if (trendTtl <= 0) {
        trend    = Math.random() < 0.5 ? 1 : -1;
        trendTtl = Math.floor(rand(10, 30)); // new trend lasts 10–30 candles
      }

      cycle += 0.08;
      const cycleComponent = Math.sin(cycle) * 1.2;
      const meanRevert     = (TARGET - price) * 0.018;
      const trendBias      = trend * rand(0.2, 0.8);
      const noise          = rand(-2.5, 2.5);
      const microNoise     = rand(-0.8, 0.8);
      const spike          = Math.random() < 0.04 ? (Math.random() < 0.5 ? 1 : -1) * rand(3, 9) : 0;

      momentum = momentum * 0.75 + (trendBias + noise) * 0.25;
      const delta = meanRevert + cycleComponent + momentum + microNoise + spike;

      const o = price;
      const c = o + delta;
      const wickRange = Math.abs(delta) * rand(0.2, 0.5) + rand(0.5, 2);
      const h = Math.max(o, c) + wickRange;
      const l = Math.min(o, c) - wickRange;

      out.push({ t: now - i * 1200, o, h, l, c, threatScore: 18 });
      price = c;
    }
    priceRef.current = price;
    return out;
  });

  // Threat updates — symmetric random walk with mean reversion back to 25
  useEffect(() => {
    const id = window.setInterval(() => {
      setThreat((prev) => {
        if (frozenRef.current) {
          return Math.max(12, prev - rand(0.4, 1.2));
        }
        const meanRevert = (25 - prev) * 0.04;
        const noise      = rand(-2.0, 2.0);
        const spike      = Math.random() < 0.05 ? rand(4, 12) : 0;
        return Math.min(99, Math.max(8, prev + meanRevert + noise + spike));
      });
    }, 700);
    return () => window.clearInterval(id);
  }, []);

  // Candle ticks — full multi-layer realistic market simulation
  useEffect(() => {
    const TARGET = 1842;

    const id = window.setInterval(() => {
      setCandles((prev) => {
        const last   = prev[prev.length - 1];
        const o      = last.c;
        const frozen = frozenRef.current;

        let c: number;

        if (frozen) {
          // Sharp drop during freeze (panic sell)
          const distance = o - 1500;
          c = o - Math.max(3, distance * rand(0.05, 0.10)) + rand(-3, 3);
        } else {
          // ── Step 1: Trend flip ──────────────────────────────────────────
          trendTickRef.current--;
          if (trendTickRef.current <= 0) {
            trendRef.current    = Math.random() < 0.5 ? 1 : -1;
            trendTickRef.current = Math.floor(rand(8, 25)); // trend lasts 8–25 candles
          }

          // ── Step 2: Sinusoidal market cycle ────────────────────────────
          cycleRef.current += 0.10;
          const cycleComponent = Math.sin(cycleRef.current) * 1.5;

          // ── Step 3: Mean reversion (prevents runaway) ──────────────────
          const meanRevert = (TARGET - o) * 0.020;

          // ── Step 4: Directional bias from trend ────────────────────────
          const trendBias = trendRef.current * rand(0.3, 1.2);

          // ── Step 5: Random noise ────────────────────────────────────────
          const volatility = 1.2 + threatRef.current / 25;
          const noise      = rand(-volatility, volatility);

          // ── Step 6: Microstructure / HFT noise ─────────────────────────
          const micro = rand(-0.6, 0.6);

          // ── Step 7: Momentum carryover ──────────────────────────────────
          momentumRef.current = momentumRef.current * 0.70 + (trendBias + noise) * 0.30;

          // ── Step 8: Occasional spike / news event (5% chance) ──────────
          const spike = Math.random() < 0.05
            ? (Math.random() < 0.5 ? 1 : -1) * rand(4, 11)
            : 0;

          const delta = meanRevert + cycleComponent + momentumRef.current + micro + spike;
          c = o + delta;
        }

        priceRef.current = c;

        // Realistic wicks — wider on high-volatility or spike candles
        const body      = Math.abs(c - o);
        const wickScale = body * rand(0.15, 0.4) + rand(0.5, 2.0);
        const h = Math.max(o, c) + wickScale;
        const l = Math.min(o, c) - wickScale;

        const next: Candle = { t: Date.now(), o, h, l, c, threatScore: threatRef.current };
        return [...prev.slice(-79), next];
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
