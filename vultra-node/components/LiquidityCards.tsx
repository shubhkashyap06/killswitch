"use client";

import { useVultraStore } from "@/lib/store";
import { motion } from "framer-motion";
import { TrendingUp, Droplets, Lock, DollarSign, Wallet } from "lucide-react";

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
      key: "total",
      label: "Total Liquidity",
      icon: DollarSign,
      color: "var(--accent)",
      glow: "rgba(59,130,246,0.18)",
      value: fmt(totalLiquidity),
      sub: "+12.4% 7d",
      subOk: true,
    },
    {
      key: "available",
      label: "Available Liquidity",
      icon: Droplets,
      color: "var(--success)",
      glow: "rgba(34,197,94,0.14)",
      value: fmt(availableLiquidity),
      sub: `${pct(availableLiquidity, totalLiquidity)}% of pool`,
      subOk: !isFrozen,
    },
    {
      key: "frozen",
      label: "Frozen / Locked",
      icon: Lock,
      color: "var(--danger)",
      glow: "rgba(239,68,68,0.14)",
      value: fmt(frozenLiquidity),
      sub: frozenLiquidity > 0 ? "⚠ Active freeze" : "✅ Clear",
      subOk: frozenLiquidity === 0,
    },
    {
      key: "balance",
      label: "Your Balance",
      icon: Wallet,
      color: "var(--purple)",
      glow: "rgba(167,139,250,0.14)",
      value: fmt(userBalance),
      sub: "LP token value",
      subOk: true,
    },
    {
      key: "health",
      label: "Pool Health",
      icon: TrendingUp,
      color: healthScore > 60 ? "var(--success)" : healthScore > 30 ? "var(--warning)" : "var(--danger)",
      glow: healthScore > 60 ? "rgba(34,197,94,0.14)" : "rgba(239,68,68,0.14)",
      value: `${healthScore}/100`,
      sub: healthScore > 60 ? "Excellent" : healthScore > 30 ? "Degraded" : "Critical",
      subOk: healthScore > 60,
      isScore: true,
      scoreVal: healthScore,
    },
  ];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
      {cards.map((card, i) => (
        <motion.div
          key={card.key}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.07, duration: 0.4 }}
          className="glass-card"
          style={{ padding: 22, position: "relative", overflow: "hidden" }}
        >
          {/* BG glow orb */}
          <div style={{
            position: "absolute", top: -20, right: -20,
            width: 80, height: 80, borderRadius: "50%",
            background: card.glow, pointerEvents: "none",
          }} />

          <div style={{
            width: 38, height: 38, borderRadius: 10, marginBottom: 14,
            background: card.glow,
            border: `1px solid ${card.color}33`,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <card.icon size={18} color={card.color} />
          </div>

          <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.09em", fontWeight: 700, marginBottom: 5 }}>
            {card.label}
          </div>

          <motion.div
            key={card.value}
            initial={{ opacity: 0.6, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            style={{ fontSize: "1.7rem", fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.02em", marginBottom: 4 }}
          >
            {card.value}
          </motion.div>

          <div style={{ fontSize: "0.75rem", fontWeight: 600, color: card.subOk ? "var(--success)" : "var(--danger)" }}>
            {card.sub}
          </div>

          {card.isScore && (
            <div style={{ marginTop: 10, background: "var(--bg-secondary)", borderRadius: 4, height: 4, overflow: "hidden" }}>
              <motion.div
                animate={{ width: `${card.scoreVal}%` }}
                transition={{ duration: 0.8 }}
                style={{ height: "100%", background: card.color, borderRadius: 4 }}
              />
            </div>
          )}
        </motion.div>
      ))}
    </div>
  );
}
