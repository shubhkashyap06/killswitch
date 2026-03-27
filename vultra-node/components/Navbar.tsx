"use client";

import { useVultraStore } from "@/lib/store";
import { motion, AnimatePresence } from "framer-motion";
import { Shield, Wallet, LogOut, ExternalLink } from "lucide-react";
import ThreatMeter from "@/components/ThreatMeter";

export default function Navbar() {
  const { walletAddress, systemStatus, isFrozen, disconnectWallet, threatScore } = useVultraStore();

  return (
    <>
      {/* Freeze overlay flash */}
      <AnimatePresence>
        {isFrozen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.12, 0, 0.08, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.2 }}
            style={{
              position: "fixed", inset: 0, zIndex: 9999,
              background: "#ef4444",
              pointerEvents: "none",
            }}
          />
        )}
      </AnimatePresence>

      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        style={{
          position: "sticky", top: 0, zIndex: 50,
          background: "rgba(5,7,13,0.9)",
          backdropFilter: "blur(20px)",
          borderBottom: isFrozen
            ? "1px solid rgba(239,68,68,0.4)"
            : "1px solid var(--border)",
          transition: "border-color 0.4s ease",
        }}
      >
        <div
          style={{
            maxWidth: 1440, margin: "0 auto", padding: "0 24px",
            height: 68, display: "flex", alignItems: "center", justifyContent: "space-between",
          }}
        >
          {/* Logo */}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <motion.div
              animate={isFrozen ? { boxShadow: ["0 0 8px rgba(239,68,68,0.4)", "0 0 24px rgba(239,68,68,0.7)", "0 0 8px rgba(239,68,68,0.4)"] } : {}}
              transition={{ duration: 1.5, repeat: Infinity }}
              style={{
                width: 38, height: 38, borderRadius: 10,
                background: isFrozen
                  ? "linear-gradient(135deg, #7f1d1d, #ef4444)"
                  : "linear-gradient(135deg, #1d4ed8, #3b82f6)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              <Shield size={20} color="white" />
            </motion.div>
            <div>
              <span style={{ fontWeight: 800, fontSize: "1.05rem", letterSpacing: "-0.01em", color: "var(--text-primary)" }}>
                Vultra-Node
              </span>
              <div style={{ fontSize: "0.65rem", color: "var(--text-muted)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                Liquidity Protocol
              </div>
            </div>
          </div>

          {/* Center — threat meter compact */}
          <div style={{ width: 220 }}>
            <ThreatMeter compact />
          </div>

          {/* Right */}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {/* System status pill */}
            <motion.div
              animate={isFrozen ? { scale: [1, 1.02, 1] } : {}}
              transition={{ duration: 1.2, repeat: Infinity }}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "6px 14px", borderRadius: 999,
                background: isFrozen ? "rgba(239,68,68,0.12)" : "rgba(34,197,94,0.1)",
                border: `1px solid ${isFrozen ? "rgba(239,68,68,0.35)" : "rgba(34,197,94,0.28)"}`,
              }}
            >
              <div
                style={{
                  width: 7, height: 7, borderRadius: "50%",
                  background: isFrozen ? "var(--danger)" : "var(--success)",
                  boxShadow: isFrozen ? "0 0 8px var(--danger)" : "0 0 8px var(--success)",
                }}
                className={isFrozen ? "pulse-danger" : "pulse-glow"}
              />
              <span style={{ fontSize: "0.78rem", fontWeight: 800, color: isFrozen ? "var(--danger)" : "var(--success)", letterSpacing: "0.05em" }}>
                {isFrozen ? "LOCKDOWN" : "ACTIVE"}
              </span>
            </motion.div>

            {/* Attacker portal link */}
            <a
              href="/attacker"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "7px 13px", borderRadius: 9,
                background: "rgba(239,68,68,0.08)",
                border: "1px solid rgba(239,68,68,0.2)",
                color: "#ef4444", fontSize: "0.78rem", fontWeight: 700,
                textDecoration: "none", transition: "all 0.18s",
              }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(239,68,68,0.16)")}
              onMouseLeave={e => (e.currentTarget.style.background = "rgba(239,68,68,0.08)")}
            >
              <ExternalLink size={13} />
              Attacker
            </a>

            {/* Wallet */}
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "7px 13px", borderRadius: 9,
              background: "var(--bg-card)", border: "1px solid var(--border)",
            }}>
              <Wallet size={14} color="var(--accent)" />
              <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-primary)", fontFamily: "monospace" }}>
                {walletAddress}
              </span>
            </div>

            <button onClick={disconnectWallet} className="btn btn-ghost" style={{ padding: "8px 12px" }} title="Disconnect">
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </motion.header>
    </>
  );
}
