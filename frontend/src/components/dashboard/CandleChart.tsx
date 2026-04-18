import { useMemo } from "react";
import type { Candle } from "@/hooks/useThreatSimulation";
import { motion } from "framer-motion";
import { FreezeOverlay } from "./FreezeOverlay";

interface CandleChartProps {
  data: Candle[];
  frozen: boolean;
}

export function CandleChart({ data, frozen }: CandleChartProps) {
  const { paths, last, change } = useMemo(() => {
    const w    = 1200;
    const h    = 520;
    const padX = 10;
    const padY = 24;
    const n    = data.length;
    if (!n) return { paths: null, last: 0, change: 0 };

    const min   = Math.min(...data.map((d) => d.l));
    const max   = Math.max(...data.map((d) => d.h));
    const range = Math.max(1, max - min);
    const cw    = (w - padX * 2) / n;
    const bodyW = Math.max(3, cw * 0.62);

    const y = (v: number) => padY + (1 - (v - min) / range) * (h - padY * 2);

    // Price labels for Y-axis
    const gridLines = [0.15, 0.3, 0.45, 0.6, 0.75, 0.9].map((p) => {
      const yPos    = padY + p * (h - padY * 2);
      const price   = max - p * range;
      return { yPos, label: price.toFixed(1) };
    });

    const candles = data.map((d, i) => {
      const x  = padX + i * cw + cw / 2;
      const up = d.c >= d.o;
      return { x, yH: y(d.h), yL: y(d.l), yO: y(d.o), yC: y(d.c), up, bodyW };
    });

    return {
      paths: { w, h, candles, gridLines },
      last:   data[n - 1].c,
      change: ((data[n - 1].c - data[0].c) / data[0].c) * 100,
    };
  }, [data]);

  if (!paths) return null;

  return (
    <div className="relative">
      {/* Header */}
      <div className="mb-5 flex items-end justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            Vault Liquidity (USD)
          </div>
          <div className="mt-1 flex items-baseline gap-3">
            <span className="font-mono text-[32px] font-semibold tracking-tightest tabular">
              ${last.toFixed(2)}
            </span>
            <span
              className={
                "tabular text-[13px] font-semibold " +
                (change >= 0 ? "text-success" : "text-critical")
              }
            >
              {change >= 0 ? "▲" : "▼"} {Math.abs(change).toFixed(2)}%
            </span>
            {frozen && (
              <span className="rounded bg-critical/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-critical">
                FROZEN
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          {["1m", "5m", "15m", "1h"].map((tf, i) => (
            <button
              key={tf}
              className={
                "rounded px-3 py-1.5 transition-colors " +
                (i === 1 ? "bg-secondary text-foreground" : "hover:bg-secondary/60")
              }
            >
              {tf}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <svg
        viewBox={`0 0 ${paths.w} ${paths.h}`}
        className="block h-[520px] w-full"
        preserveAspectRatio="none"
      >
        {/* Y-axis grid lines + price labels */}
        {paths.gridLines.map(({ yPos, label }, i) => (
          <g key={i}>
            <line
              x1={0}
              x2={paths.w - 48}
              y1={yPos}
              y2={yPos}
              stroke="hsl(var(--hairline))"
              strokeDasharray="3 5"
              strokeOpacity={0.55}
            />
            <text
              x={paths.w - 44}
              y={yPos + 4}
              fontSize={9}
              fill="hsl(var(--muted-foreground))"
              fontFamily="monospace"
              opacity={0.7}
            >
              {label}
            </text>
          </g>
        ))}

        {/* Candles */}
        {paths.candles.map((c, i) => {
          const color  = c.up ? "hsl(var(--success))" : "hsl(var(--critical))";
          const top    = Math.min(c.yO, c.yC);
          const bodyH  = Math.max(1.5, Math.abs(c.yO - c.yC));
          return (
            <motion.g
              key={i}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2 }}
            >
              {/* Wick */}
              <line
                x1={c.x} x2={c.x}
                y1={c.yH} y2={c.yL}
                stroke={color}
                strokeWidth={1.2}
                strokeOpacity={0.75}
              />
              {/* Body */}
              <rect
                x={c.x - c.bodyW / 2}
                y={top}
                width={c.bodyW}
                height={bodyH}
                fill={color}
                fillOpacity={c.up ? 0.88 : 0.95}
                rx={0.8}
              />
            </motion.g>
          );
        })}

        {/* Latest price line */}
        {(() => {
          const last = paths.candles[paths.candles.length - 1];
          if (!last) return null;
          const yPrice = last.yC;
          const col    = last.up ? "hsl(var(--success))" : "hsl(var(--critical))";
          return (
            <line
              x1={0} x2={paths.w - 48}
              y1={yPrice} y2={yPrice}
              stroke={col}
              strokeDasharray="4 4"
              strokeWidth={1}
              strokeOpacity={0.45}
            />
          );
        })()}
      </svg>

      <FreezeOverlay visible={frozen} />
    </div>
  );
}
