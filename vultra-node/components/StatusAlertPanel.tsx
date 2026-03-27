"use client";

import { useVultraStore } from "@/lib/store";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldOff, ShieldCheck, Shield } from "lucide-react";
import ThreatMeter from "@/components/ThreatMeter";

export default function StatusAlertPanel() {
  const { systemStatus, isFrozen, alertMessage, threatScore } = useVultraStore();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.15 }}
      className={isFrozen ? "glass-card-danger" : "glass-card"}
      style={{ padding: 24 }}
    >
      {/* Big status card */}
      <AnimatePresence mode="wait">
        <motion.div
          key={systemStatus}
          initial={{ scale: 0.92, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.92, opacity: 0 }}
          transition={{ duration: 0.35 }}
          style={{
            display: "flex", flexDirection: "column", alignItems: "center",
            textAlign: "center", padding: "24px 20px",
            borderRadius: 14, marginBottom: 20,
            background: isFrozen
              ? "rgba(239,68,68,0.07)"
              : "rgba(34,197,94,0.06)",
            border: `1px solid ${isFrozen ? "rgba(239,68,68,0.3)" : "rgba(34,197,94,0.2)"}`,
          }}
        >
          {/* Icon */}
          <motion.div
            animate={isFrozen ? { scale: [1, 1.08, 1], filter: ["drop-shadow(0 0 4px #ef4444)", "drop-shadow(0 0 16px #ef4444)", "drop-shadow(0 0 4px #ef4444)"] } : {}}
            transition={{ duration: 1.8, repeat: Infinity }}
            style={{
              width: 64, height: 64, borderRadius: 20,
              background: isFrozen ? "rgba(239,68,68,0.15)" : "rgba(34,197,94,0.12)",
              border: `1px solid ${isFrozen ? "rgba(239,68,68,0.3)" : "rgba(34,197,94,0.25)"}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              marginBottom: 14,
            }}
          >
            {isFrozen ? (
              <ShieldOff size={30} color="var(--danger)" />
            ) : (
              <ShieldCheck size={30} color="var(--success)" />
            )}
          </motion.div>

          {/* Status text */}
          <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700, marginBottom: 6 }}>
            System Status
          </div>
          <motion.div
            key={systemStatus}
            initial={{ y: 8, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            style={{
              fontSize: "1.9rem", fontWeight: 900, letterSpacing: "-0.02em",
              color: isFrozen ? "var(--danger)" : "var(--success)",
              textShadow: isFrozen ? "0 0 24px rgba(239,68,68,0.5)" : "0 0 20px rgba(34,197,94,0.4)",
              marginBottom: 6,
            }}
          >
            {isFrozen ? "🔴 SYSTEM LOCKDOWN" : "🟢 SYSTEM ACTIVE"}
          </motion.div>
          <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>
            {isFrozen
              ? "Threat detected — circuit breaker engaged"
              : "Monitoring stable — all systems operational"}
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Latest alert */}
      <AnimatePresence mode="wait">
        <motion.div
          key={alertMessage}
          initial={{ x: -10, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 10, opacity: 0 }}
          transition={{ duration: 0.22 }}
          style={{
            padding: "12px 14px",
            borderRadius: 10,
            background: "var(--bg-secondary)",
            border: "1px solid var(--border)",
            fontSize: "0.82rem",
            color: isFrozen ? "var(--danger)" : "var(--text-secondary)",
            lineHeight: 1.5,
            marginBottom: 16,
          }}
        >
          {alertMessage}
        </motion.div>
      </AnimatePresence>

      {/* Threat meter */}
      <ThreatMeter />

      {/* Service health dots */}
      <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
        {[
          { label: "Price Feed", ok: true },
          { label: "Oracle",     ok: !isFrozen },
          { label: "Liquidity",  ok: !isFrozen },
          { label: "Governance", ok: true },
          { label: "Monitoring", ok: true },
        ].map((item) => (
          <div key={item.label} style={{
            display: "flex", alignItems: "center", gap: 5,
            padding: "3px 9px", borderRadius: 7,
            background: "var(--bg-secondary)", border: "1px solid var(--border)",
            fontSize: "0.71rem", color: "var(--text-secondary)",
          }}>
            <div style={{ width: 5, height: 5, borderRadius: "50%", background: item.ok ? "var(--success)" : "var(--danger)" }} />
            {item.label}
          </div>
        ))}
      </div>
    </motion.div>
  );
}
