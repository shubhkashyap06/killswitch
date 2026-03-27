"use client";

import { useState } from "react";
import { useVultraStore } from "@/lib/store";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowDownCircle, ArrowUpCircle, ShieldCheck, Settings2, Zap,
} from "lucide-react";

export default function ActionPanel() {
  const { isFrozen, deposit, withdraw, unfreezeSystem } = useVultraStore();
  const [depositAmount, setDepositAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [feedback, setFeedback] = useState<{ msg: string; type: "success" | "error" | "warn" } | null>(null);

  const showFeedback = (msg: string, type: "success" | "error" | "warn" = "success") => {
    setFeedback({ msg, type });
    setTimeout(() => setFeedback(null), 3500);
  };

  const handleDeposit = () => {
    const amt = parseFloat(depositAmount);
    if (!depositAmount || isNaN(amt) || amt <= 0) { showFeedback("Enter a valid deposit amount", "error"); return; }
    deposit(amt);
    setDepositAmount("");
    showFeedback(`✅ Deposited $${amt.toLocaleString()} to pool`, "success");
  };

  const handleWithdraw = () => {
    const amt = parseFloat(withdrawAmount);
    if (!withdrawAmount || isNaN(amt) || amt <= 0) { showFeedback("Enter a valid amount", "error"); return; }
    const ok = withdraw(amt);
    setWithdrawAmount("");
    if (!ok) {
      showFeedback(
        isFrozen
          ? "❌ Withdrawals disabled — circuit breaker active"
          : "⚠️ Large withdrawal flagged — threat score increased",
        "error"
      );
    } else {
      showFeedback(`✅ Withdrew $${amt.toLocaleString()} successfully`, "success");
    }
  };

  const fbColors = {
    success: { bg: "rgba(34,197,94,0.1)", border: "rgba(34,197,94,0.3)", color: "var(--success)" },
    error:   { bg: "rgba(239,68,68,0.1)", border: "rgba(239,68,68,0.3)", color: "var(--danger)" },
    warn:    { bg: "rgba(249,115,22,0.1)", border: "rgba(249,115,22,0.3)", color: "var(--warning)" },
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.2 }}
      className={isFrozen ? "glass-card-danger" : "glass-card"}
      style={{ padding: 24 }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
        <Settings2 size={17} color="var(--accent)" />
        <h3 style={{ fontWeight: 700, fontSize: "0.95rem", color: "var(--text-primary)" }}>
          Action Panel
        </h3>
        {isFrozen && (
          <span className="badge badge-danger" style={{ marginLeft: "auto" }}>
            🔒 CIRCUIT BREAKER ACTIVE
          </span>
        )}
      </div>

      {/* Freeze warning banner */}
      <AnimatePresence>
        {isFrozen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            style={{
              padding: "12px 16px", borderRadius: 10, marginBottom: 16,
              background: "rgba(239,68,68,0.08)",
              border: "1px solid rgba(239,68,68,0.3)",
              fontSize: "0.82rem", color: "var(--danger)", lineHeight: 1.5, fontWeight: 600,
            }}
          >
            ⚠️ Withdrawals temporarily disabled due to active security threat.
            <br />
            <span style={{ fontWeight: 400, opacity: 0.85 }}>
              Use Unfreeze after threat has been assessed.
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Deposit */}
      <div style={{ marginBottom: 14 }}>
        <label style={{
          display: "block", fontSize: "0.72rem", color: "var(--text-muted)",
          textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 700, marginBottom: 7,
        }}>
          Deposit Amount (USDC)
        </label>
        <div style={{ display: "flex", gap: 8 }}>
          <input type="number" value={depositAmount} onChange={e => setDepositAmount(e.target.value)}
            placeholder="0.00" className="input-field" min="0" />
          <button onClick={handleDeposit} className="btn btn-success" style={{ whiteSpace: "nowrap", flexShrink: 0, padding: "10px 16px" }}>
            <ArrowDownCircle size={16} />
            Deposit
          </button>
        </div>
      </div>

      {/* Withdraw */}
      <div style={{ marginBottom: 20 }}>
        <label style={{
          display: "block", fontSize: "0.72rem", color: "var(--text-muted)",
          textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 700, marginBottom: 7,
        }}>
          Withdraw Amount (USDC)
        </label>
        <div style={{ display: "flex", gap: 8 }}>
          <input type="number" value={withdrawAmount} onChange={e => setWithdrawAmount(e.target.value)}
            placeholder="0.00" className="input-field" min="0" disabled={isFrozen} />
          <button onClick={handleWithdraw} disabled={isFrozen} className="btn btn-ghost"
            style={{ whiteSpace: "nowrap", flexShrink: 0, padding: "10px 16px" }}>
            <ArrowUpCircle size={16} />
            Withdraw
          </button>
        </div>
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: "var(--border)", marginBottom: 16 }} />

      {/* Unfreeze */}
      <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700, marginBottom: 10 }}>
        Admin Controls
      </div>
      <button
        onClick={() => { unfreezeSystem(); showFeedback("✅ System unfrozen. Threat score resetting.", "success"); }}
        disabled={!isFrozen}
        className="btn btn-success"
        style={{ width: "100%", justifyContent: "center" }}
      >
        <ShieldCheck size={16} />
        Unfreeze System
      </button>

      {/* Feedback */}
      <AnimatePresence>
        {feedback && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            style={{
              marginTop: 14, padding: "10px 14px", borderRadius: 10,
              background: fbColors[feedback.type].bg,
              border: `1px solid ${fbColors[feedback.type].border}`,
              color: fbColors[feedback.type].color,
              fontSize: "0.82rem", fontWeight: 600,
              display: "flex", alignItems: "center", gap: 8,
            }}
          >
            <Zap size={13} />
            {feedback.msg}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
