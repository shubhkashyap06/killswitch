import { AnimatePresence, motion } from "framer-motion";
import type { ActivityEvent } from "@/hooks/useThreatSimulation";
import { cn } from "@/lib/utils";

interface ActivityFeedProps {
  events: ActivityEvent[];
}

function timeStr(t: number) {
  const d = new Date(t);
  const hh = d.getHours().toString().padStart(2, "0");
  const mm = d.getMinutes().toString().padStart(2, "0");
  const ss = d.getSeconds().toString().padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

export function ActivityFeed({ events }: ActivityFeedProps) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-hairline px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-success animate-blink" />
          <h3 className="text-[12px] font-semibold tracking-tight">Live Activity</h3>
        </div>
        <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          Streaming
        </span>
      </div>

      <ul className="scrollbar-thin flex-1 overflow-y-auto">
        <AnimatePresence initial={false}>
          {events.map((ev) => (
            <motion.li
              key={ev.id}
              layout
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className="grid grid-cols-[64px_1fr_auto] items-center gap-3 border-b border-hairline/60 px-4 py-2.5 text-[12px]"
            >
              <span className="font-mono text-[11px] text-muted-foreground tabular">
                {timeStr(ev.t)}
              </span>
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className={cn(
                    "h-1.5 w-1.5 shrink-0 rounded-full",
                    ev.level === "info" && "bg-muted-foreground/60",
                    ev.level === "warn" && "bg-warning",
                    ev.level === "critical" && "bg-critical"
                  )}
                />
                <span className="truncate text-foreground/90">{ev.message}</span>
              </div>
              <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                {ev.source}
              </span>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </div>
  );
}
