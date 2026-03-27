"use client";

import { useVultraStore, AttackType } from "@/lib/store";
import { motion } from "framer-motion";
import { TerminalSquare } from "lucide-react";
import { useState, useRef } from "react";
import { ethers } from "ethers";
import VaultABI from "@/lib/abis/LiquidityVault.json";
import TokenABI from "@/lib/abis/VultraToken.json";

const VAULT_ADDRESS = process.env.NEXT_PUBLIC_VAULT_ADDRESS as string;
const TOKEN_ADDRESS = process.env.NEXT_PUBLIC_VLT_TOKEN_ADDRESS as string;
const RPC_URL = "http://127.0.0.1:8545";

// Hardhat Account #1 (Attacker)
const ATTACKER_PK = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";
// Hardhat Account #0 (Guardian — holds GUARDIAN_ROLE on the vault)
const GUARDIAN_PK = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const FREEZE_THRESHOLD = 70;

interface AttackDef {
  type: AttackType;
  label: string;
  command: string;
  desc: string;
  threat: number;
  impact: "MEDIUM" | "HIGH" | "CRITICAL";
}

const ATTACKS: AttackDef[] = [
  {
    type: "LARGE_WITHDRAW",
    label: "Large Withdrawal",
    command: "./exploit --target vault --amount 100k_VLT",
    desc: "Attempts to drain 100,000 VLT — Smart Contract reverts. Adds +50 threat. Triggers freeze if cumulative ≥ 70.",
    threat: 50,
    impact: "HIGH",
  },
  {
    type: "RAPID_TX",
    label: "Rapid Tx Spam",
    command: "./scripts/spam.sh --count 4 --delay 0",
    desc: "Executes 4 rapid withdrawals on-chain. Triggers Guardian Circuit Breaker at threshold.",
    threat: 30,
    impact: "MEDIUM",
  },
  {
    type: "FLASH",
    label: "Flash Attack",
    command: "cast send --unfreeze-exploit",
    desc: "Triggers immediate CRITICAL freeze. Guardian wallet calls vault.freeze() directly.",
    threat: 100,
    impact: "CRITICAL",
  },
];

const impactColors = {
  MEDIUM: "#fbbf24",
  HIGH: "#f97316",
  CRITICAL: "#ef4444",
};

// ─── Shared Ethers setup ─────────────────────────────────────────────────────
const getProvider = () => new ethers.JsonRpcProvider(RPC_URL);
const getGuardianVault = () => {
  const provider = getProvider();
  const wallet = new ethers.Wallet(GUARDIAN_PK, provider);
  return new ethers.Contract(VAULT_ADDRESS, VaultABI.abi, wallet);
};
const getAttackerSetup = () => {
  const provider = getProvider();
  const wallet = new ethers.Wallet(ATTACKER_PK, provider);
  const vault = new ethers.Contract(VAULT_ADDRESS, VaultABI.abi, wallet);
  const token = new ethers.Contract(TOKEN_ADDRESS, TokenABI.abi, wallet);
  return { wallet, vault, token };
};

// ─── Trigger real on-chain freeze via Server API ───────────────────────────────
async function executeOnChainFreeze(reason: string, pushLog: Function) {
  pushLog({ attackType: "FLASH" as AttackType, label: "CIRCUIT BREAKER", impact: "CRITICAL", threatDelta: 0, result: `🔒 Threshold breached! Guardian executing vault.freeze()...` });
  try {
    const res = await fetch("http://localhost:3001/api/execute-freeze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason })
    });
    const data = await res.json();
    
    if (!res.ok || !data.success) throw new Error(data.error || "Unknown API error");

    if (data.message === "Already frozen") {
      pushLog({ attackType: "FLASH" as AttackType, label: "CIRCUIT BREAKER", impact: "CRITICAL", threatDelta: 0, result: `⚠️ Vault already frozen.` });
    } else {
      pushLog({ attackType: "FLASH" as AttackType, label: "CIRCUIT BREAKER", impact: "CRITICAL", threatDelta: 0, result: `✅ Vault FROZEN on-chain via Backend. TX: ${data.txHash.slice(0,16)}...` });
    }

    // Force-sync the isFrozen state immediately via BroadcastChannel
    if (typeof window !== "undefined") {
      const chan = new BroadcastChannel("vultra_ui_telemetry");
      chan.postMessage({ type: "FORCE_FREEZE", isFrozen: true });
      chan.close();
    }

    // Notify the engine alert API
    fetch("http://localhost:3001/api/freeze-alert", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    }).catch(() => {});
  } catch (err: any) {
    pushLog({ attackType: "FLASH" as AttackType, label: "CIRCUIT BREAKER", impact: "CRITICAL", threatDelta: 0, result: `❌ Freeze TX failed: ${err.message?.slice(0,80)}` });
  }
}

export default function AttackerControls() {
  const { pushAttackLog, isFrozen, increaseThreat, threatScore } = useVultraStore();
  const [firing, setFiring] = useState<AttackType | null>(null);
  const localScore = useRef(threatScore);
  // Keep local ref current for accumulation
  localScore.current = threatScore;

  const triggerFreezeIfNeeded = async (addedThreat: number, reason: string) => {
    const projected = Math.min(localScore.current + addedThreat, 100);
    if (projected >= FREEZE_THRESHOLD && !isFrozen) {
      await executeOnChainFreeze(reason, pushAttackLog);
    }
  };

  const executeRealAttack = async (type: AttackType, meta: AttackDef) => {
    if (firing) return;
    setFiring(type);

    try {
      const { vault, token } = getAttackerSetup();

      if (type === "LARGE_WITHDRAW") {
        pushAttackLog({ attackType: type, label: meta.label, impact: meta.impact, threatDelta: 0, result: "Executing massive vault drain (100,000 VLT)..." });

        // First check if freeze is needed BEFORE the revert (since event never fires)
        await triggerFreezeIfNeeded(meta.threat, `Large withdrawal exploit — projected threat: ${Math.min(localScore.current + meta.threat, 100)}%`);

        try {
          const tx = await vault.withdraw(ethers.parseEther("100000"));
          await tx.wait();
          pushAttackLog({ attackType: type, label: meta.label, impact: meta.impact, threatDelta: meta.threat, result: `Drain succeeded unexpectedly!` });
        } catch {
          pushAttackLog({ attackType: type, label: meta.label, impact: meta.impact, threatDelta: meta.threat, result: `Failed! Reverted: Exceeds max withdraw limit.` });
        }
        increaseThreat(meta.threat, "Large Withdrawal Exploit Payload");
      }

      else if (type === "RAPID_TX") {
        pushAttackLog({ attackType: type, label: meta.label, impact: meta.impact, threatDelta: 0, result: "Funding attacker wallet for spam..." });

        const depositAmt = ethers.parseEther("10");
        const withdrawAmt = ethers.parseEther("0.1");

        try {
          const approveTx = await token.approve(VAULT_ADDRESS, depositAmt);
          await approveTx.wait();
          const depTx = await vault.deposit(depositAmt);
          await depTx.wait();
          pushAttackLog({ attackType: type, label: meta.label, impact: meta.impact, threatDelta: 0, result: "Funded. Sending micro-withdrawal flood..." });
        } catch {
          pushAttackLog({ attackType: type, label: meta.label, impact: meta.impact, threatDelta: 0, result: "Funding skipped (already deposited)." });
        }

        for (let i = 0; i < 4; i++) {
          const addedScore = 10;
          // Check threshold before each withdrawal
          await triggerFreezeIfNeeded(addedScore, `Rapid spam flood — segment ${i + 1}`);

          try {
            const tx = await vault.withdraw(withdrawAmt);
            await tx.wait();
            pushAttackLog({ attackType: type, label: meta.label, impact: meta.impact, threatDelta: addedScore, result: `Withdraw ${i + 1}/4 confirmed. Threat +10` });
            increaseThreat(addedScore, `Spam Payload Segment ${i + 1}`);
          } catch (e: any) {
            if (e.message?.includes("frozen")) {
              pushAttackLog({ attackType: type, label: meta.label, impact: meta.impact, threatDelta: 0, result: `Withdraw ${i + 1}/4 BLOCKED — System is frozen!` });
              break;
            }
            pushAttackLog({ attackType: type, label: meta.label, impact: meta.impact, threatDelta: 0, result: `Withdraw ${i + 1}/4 failed.` });
          }
        }
        pushAttackLog({ attackType: type, label: meta.label, impact: meta.impact, threatDelta: meta.threat, result: "Rapid flood payload complete." });
      }

      else if (type === "FLASH") {
        pushAttackLog({ attackType: type, label: meta.label, impact: meta.impact, threatDelta: 100, result: "⚡ Flash exploit initiated — triggering immediate CRITICAL freeze..." });
        increaseThreat(100, "Flash Exploit — Immediate Freeze");
        // Flash always triggers a direct Guardian freeze
        await executeOnChainFreeze("Flash Attack — immediate critical threat signature", pushAttackLog);
      }

    } catch (e: any) {
      console.error(e);
      pushAttackLog({ attackType: type, label: meta.label, impact: meta.impact, threatDelta: 0, result: "Exploit execution failed unexpectedly." });
    } finally {
      setFiring(null);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      style={{
        background: "#050810",
        border: "1px solid #1a2040",
        borderRadius: 12,
        padding: 24,
        fontFamily: "monospace",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20, borderBottom: "1px solid #1a2040", paddingBottom: 16 }}>
        <TerminalSquare size={18} color="#f97316" />
        <h3 style={{ fontWeight: 700, fontSize: "1rem", color: "#e2e8f8" }}>
          EXPLOIT_RUNNER_v1.2
        </h3>
        <span style={{ marginLeft: "auto", fontSize: "0.7rem", color: "#ef4444", fontWeight: 700 }}>
          THREAT: {Math.round(threatScore)}/100
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {ATTACKS.map((atk) => {
          const isFiring = firing === atk.type;
          const isDisabled = firing !== null || (isFrozen && atk.type !== "FLASH");
          const color = impactColors[atk.impact];

          return (
            <div
              key={atk.type}
              style={{
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.05)",
                padding: "16px",
                borderRadius: 8,
              }}
            >
              <div style={{ color: "#a5b4fc", fontSize: "0.85rem", marginBottom: 8 }}>
                <span style={{ color: "#22c55e" }}>attacker@root</span>
                :<span style={{ color: "#3b82f6" }}>~</span>$ <span style={{ color: "#e2e8f8" }}>{atk.command}</span>
              </div>

              <div style={{ fontSize: "0.75rem", color: "#64748b", marginBottom: 12, lineHeight: 1.5 }}>
                {atk.desc}
              </div>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: "0.7rem", color, fontWeight: 700, letterSpacing: "0.1em" }}>
                  [{atk.impact} RISK] +{atk.threat} threat
                </span>
                <button
                  onClick={() => executeRealAttack(atk.type, atk)}
                  disabled={isDisabled}
                  style={{
                    background: isDisabled ? "transparent" : `${color}15`,
                    color: isDisabled ? "#64748b" : color,
                    border: isDisabled ? "1px solid #334155" : `1px solid ${color}40`,
                    padding: "6px 14px",
                    borderRadius: 4,
                    fontSize: "0.8rem",
                    fontWeight: 700,
                    cursor: isDisabled ? "not-allowed" : "pointer",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    transition: "all 0.2s ease",
                  }}
                  onMouseEnter={e => { if (!isDisabled) e.currentTarget.style.background = `${color}25`; }}
                  onMouseLeave={e => { if (!isDisabled) e.currentTarget.style.background = `${color}15`; }}
                >
                  {isFiring ? "Executing..." : "Run"}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {isFrozen && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            marginTop: 16, padding: "12px 16px", borderRadius: 8,
            background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)",
            fontSize: "0.82rem", color: "#ef4444", textAlign: "center", fontWeight: 600,
          }}
        >
          🔒 VAULT FROZEN ON-CHAIN — Flash Attack still available
        </motion.div>
      )}
    </motion.div>
  );
}
