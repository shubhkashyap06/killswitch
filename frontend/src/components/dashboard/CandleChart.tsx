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
    const w = 800;
    const h = 360;
    const padX = 8;
    const padY = 16;
    const n = data.length;
    if (!n) return { paths: null, last: 0, change: 0 };
    const min = Math.min(...data.map((d) => d.l));
    const max = Math.max(...data.map((d) => d.h));
    const range = Math.max(1, max - min);
    const cw = (w - padX * 2) / n;
    const bodyW = Math.max(2, cw * 0.6);

    const y = (v: number) => padY + (1 - (v - min) / range) * (h - padY * 2);

    const candles = data.map((d, i) => {
      const x = padX + i * cw + cw / 2;
      const up = d.c >= d.o;
      return {
        x,
        yH: y(d.h),
        yL: y(d.l),
        yO: y(d.o),
        yC: y(d.c),
        up,
        bodyW,
      };
    });

    return {
      paths: { w, h, candles },
      last: data[n - 1].c,
      change: ((data[n - 1].c - data[0].c) / data[0].c) * 100,
    };
  }, [data]);

  if (!paths) return null;

  return (
    <div className="relative">
      <div className="mb-4 flex items-end justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            Vault Liquidity (USD)
          </div>
          <div className="mt-1 flex items-baseline gap-3">
            <span className="font-mono text-[26px] font-semibold tracking-tightest tabular">
              ${last.toFixed(2)}
            </span>
            <span
              className={
                "tabular text-[12px] font-medium " +
                (change >= 0 ? "text-success" : "text-critical")
              }
            >
              {change >= 0 ? "+" : ""}
              {change.toFixed(2)}%
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          {["1m", "5m", "15m", "1h"].map((tf, i) => (
            <button
              key={tf}
              className={
                "rounded px-2 py-1 transition-colors " +
                (i === 1
                  ? "bg-secondary text-foreground"
                  : "hover:bg-secondary/60")
              }
            >
              {tf}
            </button>
          ))}
        </div>
      </div>

      <svg
        viewBox={`0 0 ${paths.w} ${paths.h}`}
        className="block h-[360px] w-full"
        preserveAspectRatio="none"
      >
        {/* horizontal grid */}
        {[0.25, 0.5, 0.75].map((p) => (
          <line
            key={p}
            x1={0}
            x2={paths.w}
            y1={paths.h * p}
            y2={paths.h * p}
            stroke="hsl(var(--hairline))"
            strokeDasharray="2 4"
            strokeOpacity={0.6}
          />
        ))}

        {paths.candles.map((c, i) => {
          const color = c.up ? "hsl(var(--success))" : "hsl(var(--critical))";
          const top = Math.min(c.yO, c.yC);
          const bodyH = Math.max(1, Math.abs(c.yO - c.yC));
          return (
            <motion.g
              key={i}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.25 }}
            >
              <line
                x1={c.x}
                x2={c.x}
                y1={c.yH}
                y2={c.yL}
                stroke={color}
                strokeWidth={1}
                strokeOpacity={0.7}
              />
              <rect
                x={c.x - c.bodyW / 2}
                y={top}
                width={c.bodyW}
                height={bodyH}
                fill={color}
                fillOpacity={c.up ? 0.85 : 0.9}
                rx={0.5}
              />
            </motion.g>
          );
        })}
      </svg>

      <FreezeOverlay visible={frozen} />
    </div>
  );
}
