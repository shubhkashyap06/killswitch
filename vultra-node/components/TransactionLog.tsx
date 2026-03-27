"use client";

import { useVultraStore, Transaction, TxType } from "@/lib/store";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowDownCircle, ArrowUpCircle, AlertOctagon, ShieldCheck, Terminal,
} from "lucide-react";

const typeConfig: Record<TxType, { symbol: string; color: string }> = {
  DEPOSIT:  { symbol: "DEP",  color: "#22c55e" },
  WITHDRAW: { symbol: "WDR",  color: "#3b82f6" },
  ATTACK:   { symbol: "ATK",  color: "#ef4444" },
  UNFREEZE: { symbol: "UNF",  color: "#f97316" },
};

const statusConfig: Record<string, { char: string; color: string }> = {
  SUCCESS: { char: "OK",  color: "#22c55e" },
  BLOCKED: { char: "BLK", color: "#f97316" },
  ATTACK:  { char: "ERR", color: "#ef4444" },
};

function fmtTime(d: Date) {
  return `${d.getHours().toString().padStart(2,"0")}:${d.getMinutes().toString().padStart(2,"0")}:${d.getSeconds().toString().padStart(2,"0")}`;
}

export default function TransactionLog() {
  const { transactions } = useVultraStore();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.35 }}
      className="glass-card"
      style={{ padding: 24 }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Terminal size={17} color="var(--accent)" />
          <h3 style={{ fontWeight: 700, fontSize: "0.95rem", color: "var(--text-primary)" }}>
            Event Log
          </h3>
        </div>
        <span style={{ fontSize: "0.68rem", color: "var(--text-muted)", fontFamily: "monospace" }}>
          {transactions.length} records
        </span>
      </div>

      <div
        className="terminal-flicker"
        style={{
          background: "#050810",
          border: "1px solid #1a2040",
          borderRadius: 10,
          padding: "14px 16px",
          maxHeight: 320,
          overflowY: "auto",
        }}
      >
        <AnimatePresence>
          {transactions.map((tx) => {
            const tc = typeConfig[tx.type];
            const sc = statusConfig[tx.status];
            return (
              <motion.div
                key={tx.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="terminal-log"
                style={{
                  display: "flex",
                  gap: 10,
                  padding: "3px 0",
                  borderBottom: "1px solid rgba(26,32,64,0.5)",
                  alignItems: "baseline",
                }}
              >
                {/* Timestamp */}
                <span style={{ color: "#434d6b", flexShrink: 0 }}>
                  [{fmtTime(tx.timestamp)}]
                </span>
                {/* Type tag */}
                <span style={{ color: tc.color, fontWeight: 700, flexShrink: 0, width: 36 }}>
                  {tc.symbol}
                </span>
                {/* Status */}
                <span style={{ color: sc.color, flexShrink: 0, width: 28, fontSize: "0.68rem" }}>
                  {sc.char}
                </span>
                {/* Amount */}
                {tx.amount && (
                  <span style={{ color: "#7b87a8", flexShrink: 0 }}>
                    ${tx.amount.toLocaleString()}
                  </span>
                )}
                {/* Note */}
                <span style={{ color: "#4b5680", flex: 1, fontSize: "0.71rem" }}>
                  — {tx.note}
                </span>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {transactions.length === 0 && (
          <div className="terminal-log" style={{ color: "#434d6b" }}>
            {">"} Awaiting transactions...
          </div>
        )}

        {/* Blinking cursor */}
        <div className="terminal-log" style={{ color: "#434d6b", marginTop: 4 }}>
          {">"}{" "}
          <motion.span
            animate={{ opacity: [1, 0, 1] }}
            transition={{ duration: 1, repeat: Infinity }}
            style={{ display: "inline-block", color: "#3b82f6" }}
          >
            █
          </motion.span>
        </div>
      </div>
    </motion.div>
  );
}
