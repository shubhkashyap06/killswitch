"use client";

import { useVultraStore } from "@/lib/store";
import { motion, AnimatePresence } from "framer-motion";
import { Shield, User, TrendingUp, TrendingDown } from "lucide-react";
import ProfileModal from "@/components/ProfileModal";
import ThreatMeter from "@/components/ThreatMeter";
import { useState, useEffect } from "react";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { injected } from "wagmi/connectors";

function useMarketTickers() {
  const { totalLiquidity, availableLiquidity, threatScore, systemStatus } = useVultraStore();
  return [
    {
      name: "VAULT POOL",
      value: totalLiquidity > 0 ? `$${(totalLiquidity / 1000).toFixed(1)}K` : "$0.0K",
      change: "+2.4%",
      up: true,
    },
    {
      name: "AVAILABLE",
      value: availableLiquidity > 0 ? `$${(availableLiquidity / 1000).toFixed(1)}K` : "$0.0K",
      change: totalLiquidity > 0 ? `${Math.round((availableLiquidity / totalLiquidity) * 100)}% liquid` : "0%",
      up: true,
    },
    {
      name: "THREAT SCORE",
      value: `${threatScore}`,
      change: threatScore >= 20 ? "CRITICAL" : threatScore > 0 ? "ELEVATED" : "SAFE",
      up: threatScore === 0,
    },
    {
      name: "SYSTEM",
      value: systemStatus,
      change: systemStatus === "FROZEN" ? "⚠ LOCKDOWN" : "✓ PROTECTED",
      up: systemStatus === "NORMAL",
    },
    {
      name: "VLT / USD",
      value: "1.0000",
      change: "Stable",
      up: true,
    },
    {
      name: "BLOCK TIME",
      value: "~2s",
      change: "Hardhat",
      up: true,
    },
  ];
}

export default function Navbar() {
  const { systemStatus, isFrozen, threatScore, userEmail } = useVultraStore();
  const { isConnected } = useAccount();
  const [profileOpen, setProfileOpen] = useState(false);
  const tickers = useMarketTickers();

  useEffect(() => {
    if (isConnected && !userEmail) {
      const t = setTimeout(() => setProfileOpen(true), 800);
      return () => clearTimeout(t);
    }
  }, [isConnected, userEmail]);

  return (
    <>
      {/* Freeze flash overlay */}
      <AnimatePresence>
        {isFrozen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.12, 0, 0.08, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.2 }}
            style={{ position: "fixed", inset: 0, zIndex: 9999, background: "#ef4444", pointerEvents: "none" }}
          />
        )}
      </AnimatePresence>

      {/* ── Main Header ── */}
      <motion.header
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        style={{
          position: "sticky", top: 0, zIndex: 50,
          background: "rgba(5,7,13,0.92)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderBottom: isFrozen
            ? "1px solid rgba(239,68,68,0.4)"
            : "1px solid var(--border)",
          transition: "border-color 0.4s ease",
        }}
      >
        <div style={{
          maxWidth: 1440, margin: "0 auto", padding: "0 24px",
          height: 62, display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          {/* Logo */}
          <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
            <motion.div
              animate={isFrozen
                ? { filter: ["drop-shadow(0 0 4px rgba(239,68,68,0.5))", "drop-shadow(0 0 14px rgba(239,68,68,0.9))", "drop-shadow(0 0 4px rgba(239,68,68,0.5))"] }
                : { filter: "drop-shadow(0 0 8px rgba(59,130,246,0.35))" }}
              transition={{ duration: 1.6, repeat: Infinity }}
              style={{ width: 42, height: 42, display: "flex", alignItems: "center", justifyContent: "center" }}
            >
              <img src="/logo.png" alt="Vultra Logo" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
            </motion.div>
            <div>
              <div style={{ fontWeight: 800, fontSize: "0.98rem", letterSpacing: "-0.01em", lineHeight: 1.1, color: "var(--text-primary)" }}>
                Vultra<span style={{ color: "var(--accent)" }}>Node</span>
              </div>
              <div style={{ fontSize: "0.58rem", color: "var(--text-muted)", letterSpacing: "0.14em", textTransform: "uppercase" }}>
                Liquidity Guardian
              </div>
            </div>
          </div>

          {/* Center: compact threat meter */}
          <div style={{ width: 240 }}>
            <ThreatMeter compact />
          </div>

          {/* Right controls */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {/* System status pill */}
            <motion.div
              animate={isFrozen ? { scale: [1, 1.02, 1] } : {}}
              transition={{ duration: 1.2, repeat: Infinity }}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "6px 14px", borderRadius: 999,
                background: isFrozen ? "rgba(239,68,68,0.1)" : "rgba(34,197,94,0.08)",
                border: `1px solid ${isFrozen ? "rgba(239,68,68,0.35)" : "rgba(34,197,94,0.28)"}`,
              }}
            >
              <div style={{
                width: 7, height: 7, borderRadius: "50%",
                background: isFrozen ? "var(--danger)" : "var(--success)",
              }} className={isFrozen ? "pulse-danger" : "pulse-glow"} />
              <span style={{ fontSize: "0.74rem", fontWeight: 800, letterSpacing: "0.05em", color: isFrozen ? "var(--danger)" : "var(--success)" }}>
                {isFrozen ? "LOCKDOWN" : "ACTIVE"}
              </span>
            </motion.div>

            <RawConnectButton />

            {/* Profile */}
            <button
              onClick={() => setProfileOpen(true)}
              title={userEmail ? `Profile: ${userEmail}` : "Set security email"}
              style={{
                width: 36, height: 36, borderRadius: 9,
                background: userEmail ? "rgba(34,197,94,0.08)" : "rgba(249,115,22,0.08)",
                border: userEmail ? "1px solid rgba(34,197,94,0.3)" : "1px solid rgba(249,115,22,0.4)",
                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", position: "relative",
              }}
            >
              <User size={15} color={userEmail ? "var(--success)" : "var(--warning)"} />
              {!userEmail && (
                <span style={{ position: "absolute", top: -3, right: -3, width: 9, height: 9, borderRadius: "50%", background: "var(--warning)", border: "2px solid #050810" }} />
              )}
            </button>
          </div>
        </div>
      </motion.header>

      {/* ── Live Market Ticker Strip ── */}
      <div className="market-strip">
        {tickers.map((t) => (
          <div key={t.name} className="market-ticker">
            <span style={{ fontSize: "0.65rem", color: "var(--text-muted)", fontWeight: 700, letterSpacing: "0.07em" }}>{t.name}</span>
            <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}>{t.value}</span>
            <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
              {t.up ? <TrendingUp size={10} color="var(--success)" /> : <TrendingDown size={10} color="var(--danger)" />}
              <span style={{ fontSize: "0.67rem", fontWeight: 600, color: t.up ? "var(--success)" : "var(--danger)" }}>{t.change}</span>
            </div>
          </div>
        ))}
      </div>

      <ProfileModal
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
        mandatory={isConnected && !userEmail}
      />
    </>
  );
}

function RawConnectButton() {
  const { connect } = useConnect();
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();

  if (isConnected && address) {
    return (
      <button
        onClick={() => disconnect()}
        style={{
          padding: "6px 14px", borderRadius: 8, fontSize: "0.78rem", fontWeight: 700,
          background: "rgba(59,130,246,0.12)", border: "1px solid rgba(59,130,246,0.35)",
          color: "var(--accent)", cursor: "pointer",
        }}
      >
        {address.slice(0, 6)}…{address.slice(-4)}
      </button>
    );
  }

  return (
    <button
      onClick={() => { try { if ((window as any).ethereum) connect({ connector: injected() }); else alert("MetaMask not detected!"); } catch (e) { console.error(e); } }}
      className="btn btn-primary"
      style={{ padding: "7px 16px", fontSize: "0.78rem" }}
    >
      Connect
    </button>
  );
}
