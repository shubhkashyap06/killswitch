"use client";

import { useVultraStore } from "@/lib/store";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Droplets, Lock, DollarSign, Wallet, Activity } from "lucide-react";

function fmt(val: number) {
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(2)}M`;
  if (val >= 1_000)     return `$${(val / 1_000).toFixed(1)}K`;
  return `$${val.toFixed(0)}`;
}
function pct(part: number, total: number) {
  return total === 0 ? 0 : Math.round((part / total) * 100);
}

export default function LiquidityCards() {
  const { totalLiquidity, availableLiquidity, frozenLiquidity, userBalance, systemStatus, threatScore } = useVultraStore();
  const isFrozen = systemStatus === "FROZEN";
  const healthScore = Math.max(0, 100 - threatScore);

  const cards = [
    {
      key: "total", label: "Total Liquidity", icon: DollarSign,
      color: "var(--accent)", glow: "rgba(59,130,246,0.16)",
      value: fmt(totalLiquidity), sub: "+12.4% 7d", subOk: true,
    },
    {
      key: "available", label: "Available", icon: Droplets,
      color: "var(--success)", glow: "rgba(34,197,94,0.13)",
      value: fmt(availableLiquidity),
      sub: `${pct(availableLiquidity, totalLiquidity)}% of pool`,
      subOk: !isFrozen,
    },
    {
      key: "frozen", label: "Frozen / Locked", icon: Lock,
      color: "var(--danger)", glow: "rgba(239,68,68,0.13)",
      value: fmt(frozenLiquidity),
      sub: frozenLiquidity > 0 ? "⚠ Active freeze" : "✅ Clear",
      subOk: frozenLiquidity === 0,
    },
    {
      key: "balance", label: "Your Balance", icon: Wallet,
      color: "var(--purple)", glow: "rgba(167,139,250,0.13)",
      value: fmt(userBalance), sub: "LP token value", subOk: true,
    },
    {
      key: "health", label: "Pool Health", icon: Activity,
      color: healthScore > 60 ? "var(--success)" : healthScore > 30 ? "var(--warning)" : "var(--danger)",
      glow: healthScore > 60 ? "rgba(34,197,94,0.13)" : "rgba(239,68,68,0.13)",
      value: `${healthScore}/100`,
      sub: healthScore > 60 ? "Excellent" : healthScore > 30 ? "Degraded" : "Critical",
      subOk: healthScore > 60,
      isScore: true, scoreVal: healthScore,
    },
  ];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 14 }}>
      {cards.map((card, i) => (
        <motion.div
          key={card.key}
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.07, duration: 0.35 }}
          className="glass-card"
          style={{ padding: "20px 22px", position: "relative", overflow: "hidden", cursor: "default" }}
        >
          {/* BG orb */}
          <div style={{
            position: "absolute", top: -16, right: -16,
            width: 72, height: 72, borderRadius: "50%",
            background: card.glow, pointerEvents: "none",
            filter: "blur(12px)",
          }} />

          {/* Icon */}
          <div style={{
            width: 36, height: 36, borderRadius: 10, marginBottom: 14,
            background: card.glow,
            border: `1px solid ${card.color}28`,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <card.icon size={16} color={card.color} />
          </div>

          <div style={{ fontSize: "0.65rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700, marginBottom: 5 }}>
            {card.label}
          </div>

          <motion.div
            key={card.value}
            initial={{ opacity: 0.6 }}
            animate={{ opacity: 1 }}
            style={{ fontSize: "1.6rem", fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.03em", lineHeight: 1, marginBottom: 6 }}
          >
            {card.value}
          </motion.div>

          <div style={{
            fontSize: "0.73rem", fontWeight: 600,
            color: card.subOk ? "var(--success)" : "var(--danger)",
            display: "flex", alignItems: "center", gap: 4,
          }}>
            {card.key === "total" && <TrendingUp size={11} />}
            {card.key === "frozen" && frozenLiquidity > 0 && <TrendingDown size={11} />}
            {card.sub}
          </div>

          {card.isScore && (
            <div style={{ marginTop: 10, background: "rgba(255,255,255,0.06)", borderRadius: 3, height: 3, overflow: "hidden" }}>
              <motion.div
                animate={{ width: `${card.scoreVal}%` }}
                transition={{ duration: 0.9, ease: "easeOut" }}
                style={{ height: "100%", background: card.color, borderRadius: 3 }}
              />
            </div>
          )}
        </motion.div>
      ))}
    </div>
  );
}
