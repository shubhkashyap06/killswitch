"use client";

import { useVultraStore, AttackType } from "@/lib/store";
import { motion } from "framer-motion";
import { Zap, TrendingDown, Users, Skull } from "lucide-react";
import { useState } from "react";

interface AttackDef {
  type: AttackType;
  label: string;
  desc: string;
  threat: number;
  impact: "MEDIUM" | "HIGH" | "CRITICAL";
  icon: typeof Zap;
  color: string;
}

const ATTACKS: AttackDef[] = [
  {
    type: "LARGE_WITHDRAW",
    label: "Large Withdrawal Attack",
    desc: "Drain 85% of the liquidity pool in a single transaction",
    threat: 50,
    impact: "HIGH",
    icon: TrendingDown,
    color: "#f97316",
  },
  {
    type: "RAPID_TX",
    label: "Rapid Transaction Flood",
    desc: "Spam 47 micro-withdrawals to exhaust rate limits",
    threat: 30,
    impact: "MEDIUM",
    icon: Zap,
    color: "#fbbf24",
  },
  {
    type: "MULTI_WALLET",
    label: "Multi-Wallet Drain",
    desc: "Coordinated drain from 12 wallets simultaneously",
    threat: 40,
    impact: "HIGH",
    icon: Users,
    color: "#f97316",
  },
  {
    type: "FLASH",
    label: "⚡ Flash Attack",
    desc: "Instant flash loan exploit — triggers automatic freeze",
    threat: 100,
    impact: "CRITICAL",
    icon: Skull,
    color: "#ef4444",
  },
];

const impactColors = {
  MEDIUM:   { bg: "rgba(251,191,36,0.1)",  border: "rgba(251,191,36,0.3)",  text: "#fbbf24" },
  HIGH:     { bg: "rgba(249,115,22,0.1)",  border: "rgba(249,115,22,0.3)",  text: "#f97316" },
  CRITICAL: { bg: "rgba(239,68,68,0.12)",  border: "rgba(239,68,68,0.35)",  text: "#ef4444" },
};

export default function AttackerControls() {
  const { simulateAttack, isFrozen } = useVultraStore();
  const [firing, setFiring] = useState<AttackType | null>(null);

  const handleAttack = (type: AttackType) => {
    if (firing !== null) return; // debounce
    setFiring(type);
    simulateAttack(type);
    setTimeout(() => setFiring(null), 900);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {ATTACKS.map((atk, i) => {
        const ic = impactColors[atk.impact];
        const isThisOneFiring = firing === atk.type;
        const Icon = atk.icon;
        const isFlash = atk.type === "FLASH";
        const isDisabled = firing !== null || (isFrozen && !isFlash);

        const btnStyle: React.CSSProperties = {
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 18px",
          borderRadius: 10,
          fontWeight: 700,
          fontSize: "0.82rem",
          cursor: isDisabled ? "not-allowed" : "pointer",
          border: "none",
          outline: "none",
          opacity: isDisabled ? 0.45 : 1,
          transition: "all 0.18s ease",
          background: isFlash
            ? "linear-gradient(135deg, #b91c1c, #ef4444)"
            : "linear-gradient(135deg, #7f1d1d, #991b1b, #dc2626)",
          color: "white",
          boxShadow: isDisabled ? "none" : `0 4px 16px ${atk.color}50`,
        };

        return (
          <motion.div
            key={atk.type}
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.06 }}
            style={{
              padding: "16px 18px",
              borderRadius: 14,
              background: isFlash ? "rgba(239,68,68,0.06)" : "var(--bg-card)",
              border: isFlash ? "1px solid rgba(239,68,68,0.25)" : "1px solid var(--border)",
              display: "flex",
              gap: 14,
              alignItems: "flex-start",
            }}
          >
            {/* Icon */}
            <div
              style={{
                width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                background: `${atk.color}18`,
                border: `1px solid ${atk.color}33`,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              <Icon size={18} color={atk.color} />
            </div>

            {/* Info */}
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <span style={{ fontWeight: 700, fontSize: "0.9rem", color: "var(--text-primary)" }}>
                  {atk.label}
                </span>
                <span
                  style={{
                    display: "inline-flex", alignItems: "center",
                    padding: "2px 8px", borderRadius: 999,
                    background: ic.bg, color: ic.text,
                    border: `1px solid ${ic.border}`,
                    fontSize: "0.6rem", fontWeight: 700,
                  }}
                >
                  {atk.impact}
                </span>
              </div>
              <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)", marginBottom: 12, lineHeight: 1.4 }}>
                {atk.desc}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                {/* Plain button — reliable click handling */}
                <button
                  type="button"
                  onClick={() => handleAttack(atk.type)}
                  disabled={isDisabled}
                  style={btnStyle}
                  onMouseEnter={e => {
                    if (!isDisabled) (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-2px)";
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)";
                  }}
                >
                  {isThisOneFiring ? (
                    <motion.span
                      animate={{ opacity: [1, 0.4, 1] }}
                      transition={{ duration: 0.5, repeat: Infinity }}
                    >
                      ⚡ Executing...
                    </motion.span>
                  ) : (
                    "Launch Attack"
                  )}
                </button>
                <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                  +{atk.threat} threat
                </span>
              </div>
            </div>
          </motion.div>
        );
      })}

      {isFrozen && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            padding: "12px 16px", borderRadius: 10,
            background: "rgba(239,68,68,0.08)",
            border: "1px solid rgba(239,68,68,0.3)",
            fontSize: "0.82rem", color: "#ef4444",
            textAlign: "center", fontWeight: 600,
          }}
        >
          🔒 Target system FROZEN — Flash Attack still available
        </motion.div>
      )}
    </div>
  );
}
