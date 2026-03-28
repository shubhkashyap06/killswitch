"use client";

import { useVultraStore } from "@/lib/store";
import { motion } from "framer-motion";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { TrendingUp, TrendingDown } from "lucide-react";

export default function LiquidityLineChart() {
  const { liquidityHistory } = useVultraStore();

  const data = liquidityHistory.map(p => ({
    time: p.time,
    liquidity: p.liquidity,
    locked: p.locked,
  }));

  const lastVal  = data[data.length - 1]?.liquidity ?? 0;
  const firstVal = data[0]?.liquidity ?? 0;
  const change   = lastVal - firstVal;
  const changePct = firstVal > 0 ? ((change / firstVal) * 100).toFixed(2) : "0.00";
  const isUp = change >= 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
      className="glass-card"
      style={{ padding: "20px 20px 16px", overflow: "hidden" }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 18 }}>
        <div>
          <div className="section-label" style={{ marginBottom: 6 }}>Liquidity Over Time</div>
          <div style={{ fontSize: "1.65rem", fontWeight: 900, letterSpacing: "-0.03em", lineHeight: 1, color: "var(--text-primary)" }}>
            {lastVal >= 1000 ? `$${(lastVal / 1000).toFixed(1)}K` : `$${lastVal.toLocaleString()}`}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 4 }}>
          {isUp ? <TrendingUp size={13} color="var(--success)" /> : <TrendingDown size={13} color="var(--danger)" />}
          <span style={{ fontSize: "0.82rem", fontWeight: 700, color: isUp ? "var(--success)" : "var(--danger)" }}>
            {isUp ? "+" : ""}{changePct}%
          </span>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={data} margin={{ top: 4, right: 0, left: -18, bottom: 0 }}>
          <defs>
            <linearGradient id="gradLiq" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="#3b82f6" stopOpacity={0.22} />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="gradLocked" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="#ef4444" stopOpacity={0.16} />
              <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="rgba(255,255,255,0.04)" strokeDasharray="4 4" vertical={false} />
          <XAxis dataKey="time" tick={{ fill: "var(--text-muted)", fontSize: 10 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: "var(--text-muted)", fontSize: 10 }} axisLine={false} tickLine={false}
            tickFormatter={v => v >= 1000 ? `$${(v / 1000).toFixed(0)}K` : `$${v}`} />
          <Tooltip
            contentStyle={{
              background: "var(--bg-card)", border: "1px solid var(--border)",
              borderRadius: 10, boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
              fontSize: 12, color: "var(--text-primary)",
            }}
            labelStyle={{ color: "var(--text-muted)", marginBottom: 5 }}
            formatter={(val: unknown, name: unknown) => [
              `$${Number(val).toLocaleString()}`,
              name === "liquidity" ? "Total Liquidity" : "Locked"
            ]}
          />
          <Area type="monotone" dataKey="liquidity" stroke="#3b82f6" strokeWidth={2} fill="url(#gradLiq)" dot={false} />
          <Area type="monotone" dataKey="locked"    stroke="#ef4444" strokeWidth={1.5} fill="url(#gradLocked)" dot={false} strokeDasharray="4 3" />
        </AreaChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div style={{ display: "flex", gap: 20, marginTop: 12 }}>
        {[{ c: "#3b82f6", l: "Available Liquidity" }, { c: "#ef4444", l: "Frozen / Locked", dashed: true }].map(e => (
          <div key={e.l} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{
              width: 20, height: 2.5, background: e.dashed ? "transparent" : e.c,
              borderTop: e.dashed ? `2px dashed ${e.c}` : "none",
              borderRadius: 1,
            }} />
            <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>{e.l}</span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
