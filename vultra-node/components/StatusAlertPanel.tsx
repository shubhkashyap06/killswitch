"use client";

import { useVultraStore } from "@/lib/store";
import { motion, AnimatePresence } from "framer-motion";
import { Shield, ShieldOff, AlertTriangle } from "lucide-react";

export default function StatusAlertPanel() {
  const { systemStatus, isFrozen, threatScore, alertMessage, alerts } = useVultraStore();
  const critical = alerts.filter(a => a.level === "CRITICAL").length;
  const warnings  = alerts.filter(a => a.level === "WARNING").length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.1 }}
      className={isFrozen ? "glass-card-danger" : "glass-card"}
      style={{ padding: 22, height: "100%" }}
    >
      {/* System Status Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 11,
          background: isFrozen ? "rgba(239,68,68,0.12)" : "rgba(34,197,94,0.1)",
          border: `1px solid ${isFrozen ? "rgba(239,68,68,0.3)" : "rgba(34,197,94,0.25)"}`,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {isFrozen
            ? <ShieldOff size={18} color="var(--danger)" />
            : <Shield    size={18} color="var(--success)" />}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: "0.9rem", color: "var(--text-primary)", lineHeight: 1.2 }}>
            System Status
          </div>
          <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", marginTop: 2 }}>
            Real-time pool monitoring
          </div>
        </div>
        <span className={isFrozen ? "badge badge-danger" : "badge badge-success"}>
          <span style={{ width: 5, height: 5, borderRadius: "50%", background: "currentColor", display: "inline-block" }} />
          {isFrozen ? "FROZEN" : "ACTIVE"}
        </span>
      </div>

      {/* Alert message */}
      <AnimatePresence>
        {alertMessage && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            style={{
              padding: "10px 13px", borderRadius: 9, marginBottom: 16,
              background: isFrozen ? "rgba(239,68,68,0.07)" : "rgba(255,255,255,0.03)",
              border: `1px solid ${isFrozen ? "rgba(239,68,68,0.22)" : "var(--border)"}`,
              fontSize: "0.77rem", lineHeight: 1.55,
              color: isFrozen ? "var(--danger)" : "var(--text-secondary)",
            }}
          >
            {alertMessage}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Threat bar */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
          <span className="section-label">Threat Level</span>
          <span style={{
            fontSize: "0.78rem", fontWeight: 800, fontVariantNumeric: "tabular-nums",
            color: threatScore >= 20 ? "var(--danger)" : threatScore > 0 ? "var(--warning)" : "var(--success)",
          }}>
            {threatScore} / 100
          </span>
        </div>
        <div style={{ background: "rgba(255,255,255,0.06)", borderRadius: 3, height: 6, overflow: "hidden", position: "relative" }}>
          <motion.div
            animate={{
              width: `${threatScore}%`,
              backgroundColor: threatScore >= 20 ? "#ef4444" : threatScore > 0 ? "#f97316" : "#22c55e",
            }}
            transition={{ duration: 0.65 }}
            style={{ height: "100%", borderRadius: 3 }}
          />
        </div>
        {/* 20% threshold marker */}
        <div style={{ position: "relative", height: 6, marginTop: -6 }}>
          <div style={{ position: "absolute", left: "20%", top: 0, width: 2, height: 6, background: "rgba(239,68,68,0.5)", borderRadius: 1 }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 5 }}>
          <span style={{ fontSize: "0.62rem", color: "var(--text-muted)" }}>0 Safe</span>
          <span style={{ fontSize: "0.62rem", color: "rgba(239,68,68,0.65)", marginLeft: "12%" }}>20 Freeze</span>
          <span style={{ fontSize: "0.62rem", color: "var(--text-muted)" }}>100</span>
        </div>
      </div>

      {/* Alert count grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div style={{
          padding: "13px 15px", borderRadius: 9,
          background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.18)",
        }}>
          <div style={{ fontSize: "1.5rem", fontWeight: 900, color: "var(--danger)", marginBottom: 2, letterSpacing: "-0.02em" }}>{critical}</div>
          <div className="section-label" style={{ color: "var(--text-muted)" }}>Critical Events</div>
        </div>
        <div style={{
          padding: "13px 15px", borderRadius: 9,
          background: "rgba(249,115,22,0.07)", border: "1px solid rgba(249,115,22,0.18)",
        }}>
          <div style={{ fontSize: "1.5rem", fontWeight: 900, color: "var(--warning)", marginBottom: 2, letterSpacing: "-0.02em" }}>{warnings}</div>
          <div className="section-label" style={{ color: "var(--text-muted)" }}>Warnings</div>
        </div>
      </div>
    </motion.div>
  );
}
