"use client";

import { useVultraStore } from "@/lib/store";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { BarChart2 } from "lucide-react";
import { motion } from "framer-motion";

export default function TxActivityBarChart() {
  const { txActivity } = useVultraStore();

  const data = txActivity.map(p => ({
    time: p.time,
    Deposits:    p.deposits,
    Withdrawals: p.withdrawals,
    Attacks:     p.attacks,
  }));

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.15 }}
      className="glass-card"
      style={{ padding: "20px 20px 16px", overflow: "hidden" }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
        <div>
          <div className="section-label" style={{ marginBottom: 6 }}>Transaction Activity</div>
          <div style={{ fontWeight: 700, fontSize: "0.9rem", color: "var(--text-primary)" }}>Volume by Type</div>
        </div>
        <BarChart2 size={15} color="var(--text-muted)" />
      </div>

      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data} margin={{ top: 4, right: 0, left: -18, bottom: 0 }} barCategoryGap="35%">
          <CartesianGrid stroke="rgba(255,255,255,0.04)" strokeDasharray="4 4" vertical={false} />
          <XAxis dataKey="time" tick={{ fill: "var(--text-muted)", fontSize: 10 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: "var(--text-muted)", fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
          <Tooltip
            contentStyle={{
              background: "var(--bg-card)", border: "1px solid var(--border)",
              borderRadius: 10, fontSize: 12, boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
            }}
            labelStyle={{ color: "var(--text-muted)", marginBottom: 5 }}
            cursor={{ fill: "rgba(255,255,255,0.03)" }}
          />
          <Bar dataKey="Deposits"    fill="#3b82f6" radius={[3, 3, 0, 0]} />
          <Bar dataKey="Withdrawals" fill="#a78bfa" radius={[3, 3, 0, 0]} />
          <Bar dataKey="Attacks"     fill="#ef4444" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div style={{ display: "flex", gap: 18, marginTop: 12 }}>
        {[{ c: "#3b82f6", l: "Deposits" }, { c: "#a78bfa", l: "Withdrawals" }, { c: "#ef4444", l: "Attacks" }].map(e => (
          <div key={e.l} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2.5, background: e.c }} />
            <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>{e.l}</span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
