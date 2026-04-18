import { AnimatePresence, motion } from "framer-motion";
import { ShieldAlert } from "lucide-react";

interface FreezeOverlayProps {
  visible: boolean;
}

export function FreezeOverlay({ visible }: FreezeOverlayProps) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="pointer-events-none absolute inset-0 z-40 flex flex-col items-center justify-center p-4"
        >
          {/* Subtle darken */}
          <div className="absolute inset-0 bg-background/55 backdrop-blur-[2px]" />
          {/* Faint red wash */}
          <div className="absolute inset-0 bg-critical/5" />

          <motion.div
            initial={{ y: 8, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 4, opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }}
            className="relative flex flex-col items-center gap-4 rounded-xl border border-critical/30 bg-card/95 px-10 py-8 shadow-elev"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-critical/40 bg-critical/10 pulse-ring">
              <ShieldAlert className="h-5 w-5 text-critical" strokeWidth={2} />
            </div>
            <div className="text-center">
              <div className="font-mono text-[22px] font-semibold tracking-tightest text-critical">
                VAULT FROZEN
              </div>
              <div className="mt-1 text-[12px] uppercase tracking-[0.18em] text-muted-foreground">
                Circuit breaker activated
              </div>
            </div>
            <div className="grid grid-cols-3 gap-6 border-t border-hairline pt-4 text-center">
              <Stat label="Withdrawals" value="Halted" />
              <Stat label="Swaps" value="Blocked" />
              <Stat label="Deposits" value="Allowed" />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 font-mono text-[13px] font-medium">{value}</div>
    </div>
  );
}
