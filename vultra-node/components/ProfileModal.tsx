"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { User, Mail, CheckCircle, X, AlertTriangle } from "lucide-react";
import { useKillswitchStore } from "@/lib/store";

interface ProfileModalProps {
  open: boolean;
  onClose: () => void;
  mandatory?: boolean; // if true, can't close without saving
}

export default function ProfileModal({ open, onClose, mandatory = false }: ProfileModalProps) {
  const { userEmail, setUserEmail } = useKillswitchStore();
  const [inputEmail, setInputEmail] = useState(userEmail || "");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (open) {
      setInputEmail(userEmail || "");
      setSaved(false);
      setError("");
    }
  }, [open, userEmail]);

  // Basic email validation
  const validate = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const handleSave = () => {
    if (!inputEmail || !validate(inputEmail.trim())) {
      setError("Please enter a valid email address.");
      return;
    }
    setUserEmail(inputEmail.trim());
    setSaved(true);
    setTimeout(() => {
      onClose();
    }, 1200);
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={mandatory ? undefined : onClose}
            style={{
              position: "fixed", inset: 0, zIndex: 1000,
              background: "rgba(0,0,0,0.75)",
              backdropFilter: "blur(6px)",
              cursor: mandatory ? "default" : "pointer",
            }}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.93, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.93, y: 16 }}
            transition={{ type: "spring", stiffness: 300, damping: 28 }}
            style={{
              position: "fixed",
              top: "50%", left: "50%",
              transform: "translate(-50%, -50%)",
              zIndex: 1001,
              width: "min(96vw, 440px)",
              background: "#080c18",
              border: "1px solid rgba(59,130,246,0.25)",
              borderRadius: 16,
              padding: "32px 28px",
              boxShadow: "0 0 60px rgba(59,130,246,0.12), 0 30px 80px rgba(0,0,0,0.6)",
            }}
          >
            {/* Close button */}
            {!mandatory && (
              <button
                onClick={onClose}
                style={{
                  position: "absolute", top: 14, right: 14,
                  background: "transparent", border: "none", cursor: "pointer",
                  color: "var(--text-muted)", display: "flex", alignItems: "center",
                }}
              >
                <X size={18} />
              </button>
            )}

            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
              <div style={{
                width: 42, height: 42, borderRadius: 10,
                background: "linear-gradient(135deg, #1d4ed8, #3b82f6)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <User size={20} color="white" />
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: "1rem", color: "var(--text-primary)" }}>
                  Security Profile
                </div>
                <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                  {mandatory ? "Required — set your email to receive security alerts" : "Manage your account settings"}
                </div>
              </div>
            </div>

            {/* Mandatory warning */}
            {mandatory && (
              <div style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "10px 14px", borderRadius: 8, marginBottom: 18,
                background: "rgba(249,115,22,0.08)",
                border: "1px solid rgba(249,115,22,0.3)",
                fontSize: "0.79rem", color: "#f97316",
              }}>
                <AlertTriangle size={14} />
                You must set an email address before interacting with the vault.
              </div>
            )}

            {/* Current email display */}
            {userEmail && !saved && (
              <div style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "8px 12px", borderRadius: 8, marginBottom: 14,
                background: "rgba(34,197,94,0.06)",
                border: "1px solid rgba(34,197,94,0.2)",
                fontSize: "0.78rem", color: "#22c55e",
              }}>
                <CheckCircle size={13} />
                Current: <strong style={{ marginLeft: 4 }}>{userEmail}</strong>
              </div>
            )}

            {/* Email input */}
            <label style={{
              display: "block", fontSize: "0.72rem",
              color: "var(--text-muted)", textTransform: "uppercase",
              letterSpacing: "0.07em", fontWeight: 700, marginBottom: 7,
            }}>
              <Mail size={11} style={{ marginRight: 6, display: "inline" }} />
              Email Address
            </label>
            <input
              type="email"
              value={inputEmail}
              onChange={e => { setInputEmail(e.target.value); setError(""); }}
              onKeyDown={e => e.key === "Enter" && handleSave()}
              placeholder="admin@killswitch.com"
              style={{
                width: "100%", padding: "11px 14px", borderRadius: 9,
                background: "rgba(255,255,255,0.04)",
                border: error ? "1px solid rgba(239,68,68,0.6)" : "1px solid rgba(255,255,255,0.1)",
                color: "var(--text-primary)", fontSize: "0.92rem",
                outline: "none", boxSizing: "border-box", marginBottom: 8,
                transition: "border 0.15s",
              }}
              autoFocus
            />
            {error && (
              <div style={{ fontSize: "0.76rem", color: "var(--danger)", marginBottom: 12 }}>
                {error}
              </div>
            )}

            {/* Saved confirmation */}
            <AnimatePresence>
              {saved && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0 }}
                  style={{
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "10px 14px", borderRadius: 8, marginBottom: 12,
                    background: "rgba(34,197,94,0.08)",
                    border: "1px solid rgba(34,197,94,0.3)",
                    color: "#22c55e", fontSize: "0.82rem", fontWeight: 600,
                  }}
                >
                  <CheckCircle size={14} /> Email saved! Security alerts & OTPs will be sent here.
                </motion.div>
              )}
            </AnimatePresence>

            {/* Buttons */}
            <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
              {!mandatory && (
                <button onClick={onClose} className="btn btn-ghost" style={{ flex: 1, justifyContent: "center" }}>
                  Cancel
                </button>
              )}
              <button
                onClick={handleSave}
                className="btn btn-success"
                style={{ flex: 2, justifyContent: "center" }}
                disabled={saved}
              >
                {saved ? "✅ Saved!" : "Save Email"}
              </button>
            </div>

            <p style={{ marginTop: 16, fontSize: "0.7rem", color: "var(--text-muted)", lineHeight: 1.5 }}>
              🔒 Your email is stored locally and used only for vault freeze alerts and emergency OTP verification.
            </p>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
