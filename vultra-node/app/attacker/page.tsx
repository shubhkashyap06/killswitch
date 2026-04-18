"use client";

import { useKillswitchStore } from "@/lib/store";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertOctagon, Shield, Crosshair, Radio, Wifi,
} from "lucide-react";
import AttackerControls from "@/components/AttackerControls";
import AttackLog from "@/components/AttackLog";
import ThreatMeter from "@/components/ThreatMeter";

export default function AttackerPage() {
  const { systemStatus, isFrozen, threatScore, attackLogs, transactions } = useKillswitchStore();

  const attackCount = attackLogs.length;
  const frozenCount = transactions.filter(t => t.status === "ATTACK").length;

  return (
    <div
      className="bg-cyber"
      style={{ minHeight: "100vh", background: "var(--bg-attacker)", paddingBottom: 60 }}
    >
      {/* Frozen red pulse overlay */}
      <AnimatePresence>
        {isFrozen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.06, 0.03, 0.06, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 2, repeat: Infinity }}
            style={{ position: "fixed", inset: 0, background: "#ef4444", pointerEvents: "none", zIndex: 0 }}
          />
        )}
      </AnimatePresence>

      {/* Top warning bar */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          background: "rgba(239,68,68,0.1)",
          borderBottom: "1px solid rgba(239,68,68,0.3)",
          padding: "10px 24px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <AlertOctagon size={16} color="#ef4444" />
          <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "#ef4444", letterSpacing: "0.05em" }}>
            ⚠️ SIMULATION MODE — ATTACKER PORTAL — FOR DEMO PURPOSES ONLY
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#ef4444" }} className="pulse-danger" />
          <span style={{ fontSize: "0.72rem", color: "#ef4444", fontFamily: "monospace" }}>LIVE</span>
        </div>
      </motion.div>

      {/* Header */}
      <div style={{ maxWidth: 1400, margin: "0 auto", padding: "28px 24px 0" }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ marginBottom: 28 }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 8 }}>
            <div style={{
              width: 46, height: 46, borderRadius: 14,
              background: "linear-gradient(135deg, #7f1d1d, #ef4444)",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 6px 24px rgba(239,68,68,0.4)",
            }}>
              <Crosshair size={22} color="white" />
            </div>
            <div>
              <h1 className="glow-text-danger" style={{ fontSize: "1.7rem", fontWeight: 900, letterSpacing: "-0.02em", lineHeight: 1.1 }}>
                Attacker Simulation Portal
              </h1>
              <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginTop: 2 }}>
                Target: Killswitch-Node Liquidity Pool · Shared real-time state
              </div>
            </div>

            {/* Target status */}
            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{
                padding: "8px 16px", borderRadius: 10,
                background: isFrozen ? "rgba(239,68,68,0.12)" : "rgba(34,197,94,0.1)",
                border: `1px solid ${isFrozen ? "rgba(239,68,68,0.3)" : "rgba(34,197,94,0.25)"}`,
                display: "flex", alignItems: "center", gap: 8,
              }}>
                {isFrozen ? <Shield size={15} color="#ef4444" /> : <Wifi size={15} color="#22c55e" />}
                <span style={{ fontWeight: 700, fontSize: "0.82rem", color: isFrozen ? "#ef4444" : "#22c55e" }}>
                  TARGET {isFrozen ? "FROZEN 🔒" : "ONLINE 🟢"}
                </span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Stats row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 24 }}>
          {[
            { label: "Attacks Launched", value: attackCount, color: "#ef4444" },
            { label: "Freeze Events", value: frozenCount, color: "#f97316" },
            { label: "Threat Score", value: `${threatScore}%`, color: threatScore >= 20 ? "#ef4444" : threatScore > 0 ? "#f97316" : "#22c55e" },
            { label: "Target Status", value: isFrozen ? "FROZEN" : "ACTIVE", color: isFrozen ? "#ef4444" : "#22c55e" },
          ].map((stat) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              style={{
                padding: "16px 18px",
                background: "rgba(239,68,68,0.04)",
                border: "1px solid rgba(239,68,68,0.14)",
                borderRadius: 12,
              }}
            >
              <div style={{ fontSize: "0.65rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.09em", fontWeight: 700, marginBottom: 6 }}>
                {stat.label}
              </div>
              <div style={{ fontSize: "1.65rem", fontWeight: 900, color: stat.color, letterSpacing: "-0.02em" }}>
                {stat.value}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Main grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          {/* Left: Attack Controls */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
          >
            <div style={{
              display: "flex", alignItems: "center", gap: 8, marginBottom: 14,
              fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase",
              letterSpacing: "0.09em", fontWeight: 700,
            }}>
              <Crosshair size={14} color="#ef4444" />
              Attack Arsenal
            </div>
            <AttackerControls />
          </motion.div>

          {/* Right: Threat + Log */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.15 }}
            style={{ display: "flex", flexDirection: "column", gap: 20 }}
          >
            {/* Threat meter card */}
            <div style={{
              background: "#080a10",
              border: "1px solid rgba(239,68,68,0.18)",
              borderRadius: 16,
              padding: "20px 22px",
            }}>
              <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.09em", fontWeight: 700, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
                <Radio size={13} color="#ef4444" />
                Real-time Threat Monitor
              </div>
              <ThreatMeter />
              <div style={{ marginTop: 12, fontSize: "0.72rem", color: "var(--text-muted)", lineHeight: 1.5 }}>
                Threshold: auto-freeze at 20 · Current target: Killswitch-Node Pool
              </div>
            </div>

            {/* Attack log */}
            <AttackLog />
          </motion.div>
        </div>

        {/* Bottom note */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          style={{
            marginTop: 24, padding: "12px 16px", borderRadius: 10,
            background: "rgba(239,68,68,0.04)",
            border: "1px solid rgba(239,68,68,0.1)",
            fontSize: "0.72rem", color: "var(--text-muted)", lineHeight: 1.6,
            fontFamily: "monospace",
          }}
        >
          // In production: Node.js monitoring engine connects via WebSocket RPC (Ethers.js).
          Listens to on-chain Transfer/Borrow events. Calls smart contract freeze() if heuristics exceed threshold.
          This portal simulates the attacker vector for demonstration.
        </motion.div>
      </div>
    </div>
  );
}
