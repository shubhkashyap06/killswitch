"use client";

import { useVultraStore } from "@/lib/store";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, ShieldCheck, Info, Info as InfoIcon, Bell } from "lucide-react";
import type { AlertItem } from "@/lib/store";

const levelConfig = {
  CRITICAL: { icon: AlertTriangle, color: "var(--danger)",  bg: "rgba(239,68,68,0.08)",    border: "rgba(239,68,68,0.22)",   label: "Critical" },
  WARNING:  { icon: AlertTriangle, color: "var(--warning)", bg: "rgba(249,115,22,0.08)",   border: "rgba(249,115,22,0.22)",  label: "Warning"  },
  INFO:     { icon: InfoIcon,      color: "var(--accent)",  bg: "rgba(59,130,246,0.08)",   border: "rgba(59,130,246,0.2)",   label: "Info"     },
};

function timeAgo(date: Date): string {
  const diff = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

export default function AlertPanel() {
  const { alerts } = useVultraStore();

  return (
    <div className="glass-card" style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {/* Header */}
      <div style={{
        padding: "15px 18px 12px",
        borderBottom: "1px solid var(--border)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Bell size={14} color="var(--accent)" />
          <span style={{ fontWeight: 700, fontSize: "0.86rem", color: "var(--text-primary)" }}>Security Alerts</span>
        </div>
        <span className="badge badge-accent">{alerts.length}</span>
      </div>

      {/* Alert list */}
      <div style={{ flex: 1, overflowY: "auto", padding: "4px 0" }}>
        <AnimatePresence initial={false}>
          {alerts.slice(0, 12).map((alert: AlertItem) => {
            const cfg = levelConfig[alert.level];
            const Icon = cfg.icon;
            return (
              <motion.div
                key={alert.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.22 }}
                style={{
                  padding: "10px 18px",
                  borderBottom: "1px solid rgba(255,255,255,0.03)",
                }}
              >
                <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <div style={{ marginTop: 1, flexShrink: 0 }}>
                    <Icon size={13} color={cfg.color} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: "0.78rem", color: "var(--text-primary)", lineHeight: 1.55, marginBottom: 5 }}>
                      {alert.message}
                    </p>
                    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                      <span style={{
                        fontSize: "0.62rem", fontWeight: 700, padding: "1px 7px", borderRadius: 3,
                        background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`,
                        textTransform: "uppercase", letterSpacing: "0.05em",
                      }}>{cfg.label}</span>
                      <span style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>{timeAgo(alert.timestamp)}</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {alerts.length === 0 && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "32px 20px", gap: 8 }}>
            <ShieldCheck size={22} color="var(--success)" />
            <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)" }}>No active alerts</span>
            <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>System operating normally</span>
          </div>
        )}
      </div>
    </div>
  );
}
