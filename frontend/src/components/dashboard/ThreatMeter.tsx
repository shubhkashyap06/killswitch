import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { useEffect } from "react";
import { cn } from "@/lib/utils";

interface ThreatMeterProps {
  value: number; // 0-100
  threshold: number;
}

function getStatus(v: number) {
  if (v >= 80) return { label: "Critical", color: "hsl(var(--critical))", token: "critical" };
  if (v >= 50) return { label: "Moderate", color: "hsl(var(--warning))", token: "warning" };
  return { label: "Stable", color: "hsl(var(--success))", token: "success" };
}

export function ThreatMeter({ value, threshold }: ThreatMeterProps) {
  const size = 220;
  const stroke = 10;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  // Use 3/4 arc (270deg) for a gauge feel
  const arc = c * 0.75;

  const mv = useMotionValue(value);
  const spring = useSpring(mv, { stiffness: 60, damping: 18, mass: 0.6 });

  useEffect(() => {
    mv.set(value);
  }, [value, mv]);

  const dashoffset = useTransform(spring, (v) => arc * (1 - v / 100) + (c - arc));
  const display = useTransform(spring, (v) => v.toFixed(1));

  const status = getStatus(value);
  const thresholdAngle = 0.75 * (threshold / 100);

  return (
    <div className="relative flex items-center justify-center">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-[135deg]"
      >
        {/* Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="hsl(var(--hairline))"
          strokeWidth={stroke}
          strokeDasharray={`${arc} ${c}`}
          strokeLinecap="round"
        />
        {/* Threshold tick */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="hsl(var(--muted-foreground))"
          strokeOpacity={0.5}
          strokeWidth={stroke + 4}
          strokeDasharray={`2 ${c}`}
          strokeDashoffset={-arc * thresholdAngle}
          strokeLinecap="butt"
        />
        {/* Progress */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={status.color}
          strokeWidth={stroke}
          strokeDasharray={`${arc} ${c}`}
          style={{ strokeDashoffset: dashoffset }}
          strokeLinecap="round"
        />
      </svg>

      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          Threat Index
        </span>
        <motion.span className="mt-1 font-mono text-[44px] font-semibold leading-none tracking-tightest tabular">
          {display}
        </motion.span>
        <div className="mt-2 flex items-center gap-1.5">
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              status.token === "success" && "bg-success",
              status.token === "warning" && "bg-warning",
              status.token === "critical" && "bg-critical animate-blink"
            )}
          />
          <span
            className={cn(
              "text-[12px] font-medium",
              status.token === "success" && "text-success",
              status.token === "warning" && "text-warning",
              status.token === "critical" && "text-critical"
            )}
          >
            {status.label}
          </span>
        </div>
        <span className="mt-3 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          Trip @ {threshold}
        </span>
      </div>
    </div>
  );
}
