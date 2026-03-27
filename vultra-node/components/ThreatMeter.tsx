"use client";

import { useVultraStore } from "@/lib/store";
import { motion, AnimatePresence } from "framer-motion";

function getThreatColor(score: number) {
  if (score >= 70) return { fg: "#ef4444", glow: "rgba(239,68,68,0.5)", bg: "rgba(239,68,68,0.08)" };
  if (score >= 40) return { fg: "#f97316", glow: "rgba(249,115,22,0.4)", bg: "rgba(249,115,22,0.08)" };
  return { fg: "#22c55e", glow: "rgba(34,197,94,0.35)", bg: "rgba(34,197,94,0.07)" };
}

function getThreatLabel(score: number) {
  if (score >= 70) return "CRITICAL";
  if (score >= 40) return "ELEVATED";
  if (score >= 15) return "MODERATE";
  return "SAFE";
}

export default function ThreatMeter({ compact = false }: { compact?: boolean }) {
  const { threatScore } = useVultraStore();
  const c = getThreatColor(threatScore);
  const label = getThreatLabel(threatScore);
  const isPulsing = threatScore >= 70;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: compact ? 8 : 12 }}>
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 }}>
          Threat Score
        </span>
        <AnimatePresence mode="wait">
          <motion.span
            key={label}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="badge"
            style={{
              background: c.bg,
              color: c.fg,
              border: `1px solid ${c.fg}44`,
              fontSize: "0.68rem",
            }}
          >
            {isPulsing && (
              <span
                style={{
                  width: 6, height: 6, borderRadius: "50%",
                  background: c.fg, display: "inline-block",
                }}
                className="pulse-glow"
              />
            )}
            {label}
          </motion.span>
        </AnimatePresence>
      </div>

      {/* Score display */}
      {!compact && (
        <motion.div
          key={threatScore}
          initial={{ scale: 0.9, opacity: 0.6 }}
          animate={{ scale: 1, opacity: 1 }}
          style={{
            fontSize: "2.8rem", fontWeight: 900, letterSpacing: "-0.03em",
            color: c.fg,
            textShadow: `0 0 24px ${c.glow}`,
            lineHeight: 1,
          }}
        >
          {threatScore}
          <span style={{ fontSize: "1.1rem", fontWeight: 600, color: "var(--text-muted)", marginLeft: 4 }}>
            /100
          </span>
        </motion.div>
      )}

      {/* Bar */}
      <div style={{ position: "relative" }}>
        <div
          style={{
            height: compact ? 8 : 12,
            background: "var(--bg-secondary)",
            borderRadius: 999,
            overflow: "hidden",
            border: "1px solid var(--border)",
          }}
        >
          <motion.div
            animate={{ width: `${threatScore}%`, backgroundColor: c.fg }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            style={{
              height: "100%",
              borderRadius: 999,
              boxShadow: isPulsing ? `0 0 12px ${c.glow}` : "none",
            }}
          />
        </div>
        {/* Threshold markers */}
        {!compact && (
          <>
            {[40, 70].map((mark) => (
              <div
                key={mark}
                style={{
                  position: "absolute",
                  top: 0, bottom: 0,
                  left: `${mark}%`,
                  width: 1,
                  background: mark === 70 ? "rgba(239,68,68,0.5)" : "rgba(249,115,22,0.4)",
                }}
              />
            ))}
          </>
        )}
      </div>

      {/* Scale labels */}
      {!compact && (
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: -4 }}>
          {["0", "MODERATE", "FREEZE", "100"].map((t, i) => (
            <span key={i} style={{ fontSize: "0.6rem", color: "var(--text-muted)", fontWeight: 600 }}>
              {t}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
