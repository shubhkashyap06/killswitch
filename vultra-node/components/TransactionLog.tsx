"use client";

import { useKillswitchStore } from "@/lib/store";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowDownLeft, ArrowUpRight, Ban, RefreshCw, Activity } from "lucide-react";

const typeConfig = {
  DEPOSIT:  { icon: ArrowDownLeft, color: "var(--success)", label: "Deposit"  },
  WITHDRAW: { icon: ArrowUpRight,  color: "var(--accent)",  label: "Withdraw" },
  ATTACK:   { icon: Ban,           color: "var(--danger)",  label: "Attack"   },
  UNFREEZE: { icon: RefreshCw,     color: "var(--warning)", label: "Unfreeze" },
};

const statusConfig = {
  SUCCESS: { color: "var(--success)", bg: "rgba(34,197,94,0.1)",  label: "Success" },
  BLOCKED: { color: "var(--danger)",  bg: "rgba(239,68,68,0.1)",  label: "Blocked" },
  ATTACK:  { color: "var(--danger)",  bg: "rgba(239,68,68,0.1)",  label: "Attack"  },
};

function fmt(v?: number) {
  if (!v) return "—";
  if (v >= 1000) return `$${(v / 1000).toFixed(1)}K`;
  return `$${v.toFixed(2)}`;
}

function fmtTime(d: Date) {
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export default function TransactionLog() {
  const { transactions } = useKillswitchStore();

  return (
    <div className="glass-card" style={{ overflow: "hidden" }}>
      {/* Header */}
      <div style={{
        padding: "15px 18px 12px",
        borderBottom: "1px solid var(--border)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Activity size={14} color="var(--accent)" />
          <span style={{ fontWeight: 700, fontSize: "0.86rem", color: "var(--text-primary)" }}>Transaction History</span>
        </div>
        <span className="badge badge-accent">{transactions.length} txns</span>
      </div>

      {/* Table */}
      <div style={{ overflowX: "auto" }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Type</th>
              <th>Amount</th>
              <th>Time</th>
              <th>Status</th>
              <th>Note</th>
            </tr>
          </thead>
          <tbody>
            <AnimatePresence initial={false}>
              {transactions.slice(0, 14).map((tx) => {
                const t = typeConfig[tx.type] ?? typeConfig.DEPOSIT;
                const s = statusConfig[tx.status] ?? statusConfig.SUCCESS;
                const Icon = t.icon;
                return (
                  <motion.tr
                    key={tx.id}
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{
                          width: 28, height: 28, borderRadius: 7,
                          background: `${t.color}14`,
                          border: `1px solid ${t.color}28`,
                          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                        }}>
                          <Icon size={13} color={t.color} />
                        </div>
                        <span style={{ fontWeight: 600, fontSize: "0.82rem" }}>{t.label}</span>
                      </div>
                    </td>
                    <td style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums", fontSize: "0.82rem" }}>
                      {fmt(tx.amount)}
                    </td>
                    <td style={{ color: "var(--text-muted)", fontSize: "0.75rem", fontVariantNumeric: "tabular-nums" }}>
                      {fmtTime(tx.timestamp)}
                    </td>
                    <td>
                      <span style={{
                        fontSize: "0.65rem", fontWeight: 700, padding: "2px 8px", borderRadius: 4,
                        background: s.bg, color: s.color,
                        textTransform: "uppercase", letterSpacing: "0.04em",
                      }}>
                        {s.label}
                      </span>
                    </td>
                    <td style={{ color: "var(--text-secondary)", fontSize: "0.75rem", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {tx.note || "—"}
                    </td>
                  </motion.tr>
                );
              })}
            </AnimatePresence>
          </tbody>
        </table>

        {transactions.length === 0 && (
          <div style={{ padding: "36px 24px", textAlign: "center", color: "var(--text-muted)", fontSize: "0.8rem" }}>
            No transactions yet. Deposit assets to begin.
          </div>
        )}
      </div>
    </div>
  );
}
