"use client";

import { useKillswitchStore } from "@/lib/store";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  AlertOctagon,
  ShieldCheck,
  Clock,
  History,
} from "lucide-react";
import { TxType } from "@/lib/store";

const typeConfig: Record<
  TxType,
  { label: string; color: string; icon: typeof ArrowDownCircle }
> = {
  DEPOSIT: {
    label: "Deposit",
    color: "var(--success)",
    icon: ArrowDownCircle,
  },
  WITHDRAW: {
    label: "Withdraw",
    color: "var(--accent)",
    icon: ArrowUpCircle,
  },
  ATTACK: {
    label: "Attack",
    color: "var(--danger)",
    icon: AlertOctagon,
  },
  UNFREEZE: {
    label: "Unfreeze",
    color: "var(--warning)",
    icon: ShieldCheck,
  },
};

const statusConfig = {
  SUCCESS: { label: "Success", color: "var(--success)", bg: "rgba(34,197,94,0.12)", border: "rgba(34,197,94,0.3)" },
  BLOCKED: { label: "Blocked", color: "var(--danger)", bg: "rgba(239,68,68,0.12)", border: "rgba(239,68,68,0.3)" },
  ATTACK: { label: "Attack", color: "#f97316", bg: "rgba(249,115,22,0.12)", border: "rgba(249,115,22,0.3)" },
};

function timeAgo(d: Date) {
  const diffSec = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  return `${Math.floor(diffMin / 60)}h ago`;
}

export default function TransactionHistory() {
  const { transactions } = useKillswitchStore();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.35 }}
      className="glass-card"
      style={{ padding: 24 }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 20,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <History size={18} color="var(--accent)" />
          <h3
            style={{
              fontWeight: 700,
              fontSize: "1rem",
              color: "var(--text-primary)",
            }}
          >
            Transaction History
          </h3>
        </div>
        <span
          style={{
            fontSize: "0.75rem",
            color: "var(--text-muted)",
          }}
        >
          {transactions.length} records
        </span>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {["Type", "Amount", "Status", "Note", "Time"].map((h) => (
                <th
                  key={h}
                  style={{
                    textAlign: "left",
                    padding: "8px 12px",
                    fontSize: "0.72rem",
                    color: "var(--text-muted)",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    fontWeight: 700,
                    borderBottom: "1px solid var(--border)",
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <AnimatePresence>
              {transactions.map((tx, i) => {
                const cfg = typeConfig[tx.type];
                const scfg = statusConfig[tx.status];
                const Icon = cfg.icon;
                return (
                  <motion.tr
                    key={tx.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    transition={{ delay: i * 0.04 }}
                    style={{
                      borderBottom: "1px solid rgba(30,34,53,0.6)",
                    }}
                  >
                    <td style={{ padding: "12px 12px" }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        <Icon size={15} color={cfg.color} />
                        <span
                          style={{
                            fontSize: "0.83rem",
                            fontWeight: 600,
                            color: cfg.color,
                          }}
                        >
                          {cfg.label}
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: "12px 12px" }}>
                      <span
                        style={{
                          fontSize: "0.83rem",
                          color: "var(--text-primary)",
                          fontWeight: 600,
                          fontFamily: "monospace",
                        }}
                      >
                        {tx.amount ? `$${tx.amount.toLocaleString()}` : "—"}
                      </span>
                    </td>
                    <td style={{ padding: "12px 12px" }}>
                      <span
                        style={{
                          display: "inline-flex",
                          padding: "3px 9px",
                          borderRadius: 6,
                          fontSize: "0.72rem",
                          fontWeight: 700,
                          background: scfg.bg,
                          color: scfg.color,
                          border: `1px solid ${scfg.border}`,
                        }}
                      >
                        {scfg.label}
                      </span>
                    </td>
                    <td style={{ padding: "12px 12px" }}>
                      <span
                        style={{
                          fontSize: "0.8rem",
                          color: "var(--text-secondary)",
                        }}
                      >
                        {tx.note || "—"}
                      </span>
                    </td>
                    <td style={{ padding: "12px 12px" }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 5,
                          color: "var(--text-muted)",
                          fontSize: "0.78rem",
                        }}
                      >
                        <Clock size={12} />
                        {timeAgo(tx.timestamp)}
                      </div>
                    </td>
                  </motion.tr>
                );
              })}
            </AnimatePresence>
          </tbody>
        </table>

        {transactions.length === 0 && (
          <div
            style={{
              textAlign: "center",
              color: "var(--text-muted)",
              padding: "32px",
              fontSize: "0.85rem",
            }}
          >
            No transactions yet. Deposit or interact to get started.
          </div>
        )}
      </div>
    </motion.div>
  );
}
