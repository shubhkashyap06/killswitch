import { cn } from "@/lib/utils";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string;
  delta?: string;
  positive?: boolean;
  hint?: string;
}

export function StatCard({ label, value, delta, positive = true, hint }: StatCardProps) {
  return (
    <div className="rounded-lg border border-hairline bg-card p-4">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          {label}
        </span>
        {delta && (
          <span
            className={cn(
              "flex items-center gap-0.5 text-[11px] font-medium tabular",
              positive ? "text-success" : "text-critical"
            )}
          >
            {positive ? (
              <ArrowUpRight className="h-3 w-3" strokeWidth={2} />
            ) : (
              <ArrowDownRight className="h-3 w-3" strokeWidth={2} />
            )}
            {delta}
          </span>
        )}
      </div>
      <div className="mt-2 font-mono text-[22px] font-semibold tracking-tightest tabular">
        {value}
      </div>
      {hint && (
        <div className="mt-1 text-[11px] text-muted-foreground">{hint}</div>
      )}
    </div>
  );
}
