"use client";

import { useVultraStore } from "@/lib/store";
import { motion } from "framer-motion";

function getThreatColor(score: number) {
  if (score >= 20) return { fg: "var(--danger)", glow: "rgba(239,68,68,0.5)", bg: "rgba(239,68,68,0.08)" };
  if (score > 0)   return { fg: "var(--warning)", glow: "rgba(249,115,22,0.4)", bg: "rgba(249,115,22,0.08)" };
  return { fg: "var(--success)", glow: "rgba(34,197,94,0.35)", bg: "rgba(34,197,94,0.07)" };
}

function getThreatLabel(score: number) {
  if (score >= 20) return "CRITICAL";
  if (score > 0)   return "ELEVATED";
  return "SAFE";
}

export default function ThreatMeter({ compact = false }: { compact?: boolean }) {
  const { threatScore } = useVultraStore();
  const c = getThreatColor(threatScore);
  const label = getThreatLabel(threatScore);
  const isPulsing = threatScore >= 20;

  if (compact) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ flex: 1, background: "rgba(255,255,255,0.06)", borderRadius: 3, height: 5, overflow: "hidden" }}>
          <motion.div
            animate={{ width: `${threatScore}%`, backgroundColor: c.fg }}
            transition={{ duration: 0.5 }}
            style={{ height: "100%", borderRadius: 3 }}
          />
        </div>
        <span style={{ fontSize: "0.75rem", fontWeight: 800, color: c.fg, minWidth: 28, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
          {threatScore}
        </span>
        <span style={{ fontSize: "0.65rem", padding: "2px 7px", borderRadius: 4, background: c.bg, color: c.fg, fontWeight: 700 }}>
          {label}
        </span>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span className="section-label">Threat Score</span>
        <span style={{
          fontSize: "0.67rem", padding: "2px 9px", borderRadius: 4,
          background: c.bg, color: c.fg, fontWeight: 700,
          display: "flex", alignItems: "center", gap: 5,
        }}>
          {isPulsing && (
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: c.fg, display: "inline-block" }} className="pulse-danger" />
          )}
          {label}
        </span>
      </div>

      {/* Score */}
      <motion.div
        key={threatScore}
        initial={{ scale: 0.92, opacity: 0.6 }}
        animate={{ scale: 1, opacity: 1 }}
        style={{
          fontSize: "2.6rem", fontWeight: 900, letterSpacing: "-0.04em",
          color: c.fg, textShadow: `0 0 22px ${c.glow}`, lineHeight: 1,
        }}
      >
        {threatScore}
        <span style={{ fontSize: "1rem", fontWeight: 400, color: "var(--text-muted)", marginLeft: 4 }}>/100</span>
      </motion.div>

      {/* Bar */}
      <div style={{ position: "relative" }}>
        <div style={{ background: "rgba(255,255,255,0.06)", borderRadius: 3, height: 7, overflow: "hidden" }}>
          <motion.div
            animate={{ width: `${threatScore}%`, backgroundColor: c.fg }}
            transition={{ duration: 0.65, ease: "easeOut" }}
            style={{ height: "100%", borderRadius: 3, boxShadow: isPulsing ? `0 0 10px ${c.glow}` : "none" }}
          />
        </div>
        {/* Threshold marker at 20% */}
        <div style={{ position: "absolute", top: -2, left: "20%", width: 2, height: 11, background: "rgba(239,68,68,0.55)", borderRadius: 1 }} />
      </div>

      {/* Scale */}
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <span style={{ fontSize: "0.6rem", color: "var(--text-muted)" }}>0 — Safe</span>
        <span style={{ fontSize: "0.6rem", color: "rgba(239,68,68,0.6)" }}>20 Freeze</span>
        <span style={{ fontSize: "0.6rem", color: "var(--text-muted)" }}>100</span>
      </div>
    </div>
  );
}
