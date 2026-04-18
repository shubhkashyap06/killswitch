"use client";

import { useKillswitchStore } from "@/lib/store";
import type { AttackLog as AttackLogType } from "@/lib/store";
import { motion, AnimatePresence } from "framer-motion";
import { Radio } from "lucide-react";

const impactColor: Record<AttackLogType["impact"], string> = {
  LOW:      "#22c55e",
  MEDIUM:   "#fbbf24",
  HIGH:     "#f97316",
  CRITICAL: "#ef4444",
};

function fmtTime(d: Date) {
  return `${d.getHours().toString().padStart(2,"0")}:${d.getMinutes().toString().padStart(2,"0")}:${d.getSeconds().toString().padStart(2,"0")}`;
}

export default function AttackLog() {
  const { attackLogs } = useKillswitchStore();

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.2 }}
      style={{
        background: "#080a10",
        border: "1px solid rgba(239,68,68,0.2)",
        borderRadius: 16,
        padding: 24,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Radio size={16} color="#ef4444" />
          <h3 style={{ fontWeight: 700, fontSize: "0.95rem", color: "#e2e8f8" }}>
            Attack Log
          </h3>
        </div>
        {attackLogs.length > 0 && (
          <span className="badge badge-danger" style={{ fontSize: "0.6rem" }}>
            LIVE
          </span>
        )}
      </div>

      <div style={{ maxHeight: 380, overflowY: "auto" }}>
        <AnimatePresence>
          {attackLogs.length === 0 ? (
            <div className="terminal-log" style={{ color: "#434d6b", padding: "8px 0" }}>
              {">"} Awaiting attack commands...{" "}
              <motion.span
                animate={{ opacity: [1, 0, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
                style={{ color: "#ef4444" }}
              >
                █
              </motion.span>
            </div>
          ) : (
            attackLogs.map((log, i) => (
              <motion.div
                key={log.id}
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                style={{
                  padding: "10px 0",
                  borderBottom: "1px solid rgba(239,68,68,0.08)",
                }}
              >
                {/* Header row */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span
                    className="terminal-log"
                    style={{ color: "#434d6b", fontSize: "0.68rem", flexShrink: 0 }}
                  >
                    [{fmtTime(log.timestamp)}]
                  </span>
                  <span
                    style={{
                      fontWeight: 700,
                      fontSize: "0.8rem",
                      color: impactColor[log.impact],
                    }}
                  >
                    {log.label}
                  </span>
                  <span
                    className="badge"
                    style={{
                      marginLeft: "auto",
                      background: `${impactColor[log.impact]}15`,
                      color: impactColor[log.impact],
                      border: `1px solid ${impactColor[log.impact]}40`,
                      fontSize: "0.58rem",
                    }}
                  >
                    {log.impact}
                  </span>
                </div>

                {/* Result row */}
                <div className="terminal-log" style={{ color: "#4b5680", paddingLeft: 8 }}>
                  {"└─"} {log.result}
                </div>
                <div className="terminal-log" style={{ color: "#2a3560", paddingLeft: 8, fontSize: "0.67rem" }}>
                  {"   "} Threat delta: +{log.threatDelta}
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
