"use client";

import { useVultraStore, AlertItem, AlertLevel } from "@/lib/store";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle, AlertTriangle, AlertOctagon, Bell } from "lucide-react";

const levelConfig: Record<AlertLevel, { icon: typeof CheckCircle; color: string; bg: string; border: string }> = {
  INFO: {
    icon: CheckCircle,
    color: "var(--success)",
    bg: "rgba(34,197,94,0.07)",
    border: "rgba(34,197,94,0.2)",
  },
  WARNING: {
    icon: AlertTriangle,
    color: "var(--warning)",
    bg: "rgba(249,115,22,0.07)",
    border: "rgba(249,115,22,0.2)",
  },
  CRITICAL: {
    icon: AlertOctagon,
    color: "var(--danger)",
    bg: "rgba(239,68,68,0.08)",
    border: "rgba(239,68,68,0.25)",
  },
};

function timeStr(d: Date) {
  return `${d.getHours().toString().padStart(2,"0")}:${d.getMinutes().toString().padStart(2,"0")}:${d.getSeconds().toString().padStart(2,"0")}`;
}

export default function AlertPanel() {
  const { alerts } = useVultraStore();
  const visible = alerts.slice(0, 6);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
      className="glass-card"
      style={{ padding: 24 }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Bell size={17} color="var(--accent)" />
          <h3 style={{ fontWeight: 700, fontSize: "0.95rem", color: "var(--text-primary)" }}>
            Alert Log
          </h3>
        </div>
        <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
          {alerts.length} events
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 280, overflowY: "auto" }}>
        <AnimatePresence>
          {visible.map((alert) => {
            const cfg = levelConfig[alert.level];
            const Icon = cfg.icon;
            return (
              <motion.div
                key={alert.id}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 12 }}
                transition={{ duration: 0.2 }}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                  padding: "10px 12px",
                  borderRadius: 10,
                  background: cfg.bg,
                  border: `1px solid ${cfg.border}`,
                }}
              >
                <Icon size={15} color={cfg.color} style={{ flexShrink: 0, marginTop: 1 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "0.82rem", color: "var(--text-primary)", lineHeight: 1.4 }}>
                    {alert.message}
                  </div>
                  <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", marginTop: 2, fontFamily: "monospace" }}>
                    {timeStr(alert.timestamp)}
                  </div>
                </div>
                <span
                  className="badge"
                  style={{
                    background: cfg.bg, color: cfg.color,
                    border: `1px solid ${cfg.border}`,
                    fontSize: "0.6rem", flexShrink: 0,
                  }}
                >
                  {alert.level}
                </span>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {visible.length === 0 && (
          <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "24px 0", fontSize: "0.82rem" }}>
            No alerts yet.
          </div>
        )}
      </div>
    </motion.div>
  );
}
