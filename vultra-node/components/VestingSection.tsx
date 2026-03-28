"use client";

import { useVultraStore } from "@/lib/store";
import { motion } from "framer-motion";
import { Unlock, Lock } from "lucide-react";

export default function VestingSection() {
  const { vestingProgress, vestingTotal, vestingUnlocked } = useVultraStore();
  const pct = vestingTotal > 0 ? Math.min(100, (vestingUnlocked / vestingTotal) * 100) : 0;

  function fmt(v: number) {
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1000) return `${(v / 1000).toFixed(1)}K`;
    return v.toFixed(0);
  }

  const milestones = [25, 50, 75, 100];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.15 }}
      className="glass-card"
      style={{ padding: 22, height: "100%" }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: "var(--purple-dim)",
          border: "1px solid rgba(167,139,250,0.25)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {pct >= 100 ? <Unlock size={16} color="var(--purple)" /> : <Lock size={16} color="var(--purple)" />}
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: "0.86rem", color: "var(--text-primary)" }}>Vesting Schedule</div>
          <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", marginTop: 2 }}>LP token unlock progress</div>
        </div>
      </div>

      {/* Percentage */}
      <div style={{ marginBottom: 16 }}>
        <motion.div
          key={pct}
          initial={{ opacity: 0.7 }}
          animate={{ opacity: 1 }}
          style={{ fontSize: "2.2rem", fontWeight: 900, letterSpacing: "-0.04em", color: "var(--text-primary)", lineHeight: 1 }}
        >
          {pct.toFixed(1)}
          <span style={{ fontSize: "0.95rem", color: "var(--text-muted)", marginLeft: 3 }}>%</span>
        </motion.div>
        <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: 5 }}>
          {fmt(vestingUnlocked)} / {fmt(vestingTotal)} VLT unlocked
        </div>
      </div>

      {/* Progress bar with milestone markers */}
      <div style={{ position: "relative", marginBottom: 6 }}>
        <div style={{ background: "rgba(255,255,255,0.06)", borderRadius: 3, height: 6 }}>
          <motion.div
            animate={{ width: `${pct}%` }}
            transition={{ duration: 1, ease: "easeOut" }}
            style={{ height: "100%", background: "var(--purple)", borderRadius: 3, boxShadow: "0 0 8px rgba(167,139,250,0.4)" }}
          />
        </div>
        {milestones.map(m => (
          <div key={m} style={{
            position: "absolute", top: -3, left: `${m}%`,
            transform: "translateX(-50%)",
            width: 2, height: 12, borderRadius: 1,
            background: pct >= m ? "var(--purple)" : "rgba(255,255,255,0.12)",
          }} />
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, marginBottom: 16 }}>
        {milestones.map(m => (
          <span key={m} style={{ fontSize: "0.62rem", fontWeight: 700, color: pct >= m ? "var(--purple)" : "var(--text-muted)" }}>
            {m}%
          </span>
        ))}
      </div>

      {/* Next unlock label */}
      <div style={{
        padding: "10px 13px", borderRadius: 9,
        background: "rgba(255,255,255,0.03)",
        border: "1px solid var(--border)",
      }}>
        <div className="section-label" style={{ marginBottom: 5 }}>Next unlock</div>
        <div style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--text-secondary)", lineHeight: 1.55 }}>
          {pct >= 100 ? "✅ Fully vested — all tokens available"
            : pct >= 75 ? "Final tranche in progress"
            : pct >= 50 ? "50% cliff reached — quarter 3 active"
            : "Deposit more to accelerate vesting"}
        </div>
      </div>
    </motion.div>
  );
}
