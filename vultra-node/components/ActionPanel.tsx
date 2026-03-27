"use client";

import { useState, useEffect, useRef } from "react";
import { useVultraStore } from "@/lib/store";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowDownCircle, ArrowUpCircle, ShieldCheck, Settings2, Zap, Clock, Mail, Lock, Check
} from "lucide-react";
import { useWriteContract, useSwitchChain, useAccount, useReadContracts } from "wagmi";
import { parseEther } from "viem";
import VaultABI from "@/lib/abis/LiquidityVault.json";
import TokenABI from "@/lib/abis/VultraToken.json";

const VAULT_ADDRESS = process.env.NEXT_PUBLIC_VAULT_ADDRESS as `0x${string}`;
const TOKEN_ADDRESS = process.env.NEXT_PUBLIC_VLT_TOKEN_ADDRESS as `0x${string}`;
const ENGINE_URL = "http://localhost:3001";

export default function ActionPanel() {
  const { isFrozen, userBalance, totalLiquidity, threatScore } = useVultraStore();
  const [depositAmount, setDepositAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [feedback, setFeedback] = useState<{ msg: string; type: "success" | "error" | "warn" } | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);

  // OTP Unfreeze Auth State
  const [otpStep, setOtpStep] = useState<"idle" | "email" | "otp">("idle");
  const [otpEmail, setOtpEmail] = useState("");
  const [otpValue, setOtpValue] = useState("");
  const [otpToken, setOtpToken] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpPreview, setOtpPreview] = useState<string | null>(null);

  const { writeContractAsync } = useWriteContract();
  const { switchChainAsync } = useSwitchChain();
  const { chainId } = useAccount();

  const prevFrozen = useRef(false);

  // Read time-lock config from contract when frozen
  const { data: timeLockData } = useReadContracts({
    contracts: [
      { address: VAULT_ADDRESS, abi: VaultABI.abi, functionName: "frozenAt" },
      { address: VAULT_ADDRESS, abi: VaultABI.abi, functionName: "freezeDuration" }
    ],
    query: { enabled: isFrozen, refetchInterval: 5000 }
  });

  // Countdown timer
  useEffect(() => {
    if (!isFrozen || !timeLockData?.[0].result || !timeLockData?.[1].result) {
      setTimeLeft(0);
      return;
    }
    const frozenAt = Number(timeLockData[0].result);
    const duration = Number(timeLockData[1].result);
    const unlockTimeMs = (frozenAt + duration) * 1000;
    const interval = setInterval(() => {
      const diff = Math.floor((unlockTimeMs - Date.now()) / 1000);
      setTimeLeft(diff > 0 ? diff : 0);
    }, 1000);
    return () => clearInterval(interval);
  }, [isFrozen, timeLockData]);

  // Auto-send freeze email when freeze starts
  useEffect(() => {
    if (isFrozen && !prevFrozen.current) {
      fetch(`${ENGINE_URL}/api/freeze-alert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: `Threat reached ${threatScore}% — Circuit breaker activated` }),
      }).catch(() => {});
    }
    prevFrozen.current = isFrozen;
  }, [isFrozen]);

  const showFeedback = (msg: string, type: "success" | "error" | "warn" = "success") => {
    setFeedback({ msg, type });
    setTimeout(() => setFeedback(null), 5000);
  };

  const handleDeposit = async () => {
    const amt = parseFloat(depositAmount);
    if (!depositAmount || isNaN(amt) || amt <= 0) { showFeedback("Enter a valid deposit amount", "error"); return; }
    try {
      if (chainId !== 31337) {
        showFeedback("Switching to Local Network...", "warn");
        await switchChainAsync({ chainId: 31337 });
      }
      const parsedAmt = parseEther(depositAmount);
      showFeedback("1/2: Approving token spend...", "warn");
      await writeContractAsync({ chainId: 31337, address: TOKEN_ADDRESS, abi: TokenABI.abi, functionName: "approve", args: [VAULT_ADDRESS, parsedAmt] });
      showFeedback("2/2: Confirming deposit...", "warn");
      await writeContractAsync({ chainId: 31337, address: VAULT_ADDRESS, abi: VaultABI.abi, functionName: "deposit", args: [parsedAmt] });
      setDepositAmount("");
      showFeedback(`✅ Deposited ${amt} VLT to pool`, "success");
    } catch (error: any) {
      console.error(error);
      showFeedback("❌ Deposit failed", "error");
    }
  };

  const handleWithdraw = async () => {
    const amt = parseFloat(withdrawAmount);
    if (!withdrawAmount || isNaN(amt) || amt <= 0) { showFeedback("Enter a valid amount", "error"); return; }
    if (amt > userBalance) { showFeedback("❌ Insufficient deposited balance", "error"); return; }
    const maxAllowed = totalLiquidity * 0.3;
    if (amt > maxAllowed) { showFeedback("❌ Exceeds 30% max pool withdraw limit", "error"); return; }
    try {
      if (chainId !== 31337) {
        showFeedback("Switching to Local Network...", "warn");
        await switchChainAsync({ chainId: 31337 });
      }
      const parsedAmt = parseEther(withdrawAmount);
      showFeedback("Confirming withdrawal...", "warn");
      await writeContractAsync({ chainId: 31337, address: VAULT_ADDRESS, abi: VaultABI.abi, functionName: "withdraw", args: [parsedAmt] });
      setWithdrawAmount("");
      showFeedback(`✅ Withdrew ${amt} VLT successfully`, "success");
    } catch (error: any) {
      console.error(error);
      showFeedback(isFrozen ? "❌ Circuit breaker active" : "❌ Transaction failed", "error");
    }
  };

  // Step 1: Send OTP to user's email
  const handleRequestOtp = async () => {
    if (!otpEmail || !otpEmail.includes("@")) { showFeedback("❌ Enter a valid email address", "error"); return; }
    setOtpLoading(true);
    try {
      const res = await fetch(`${ENGINE_URL}/api/request-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: otpEmail }),
      });
      const data = await res.json();
      if (data.success) {
        setOtpToken(data.token);
        setOtpPreview(data.preview);
        setOtpStep("otp");
        showFeedback("📧 OTP sent to your email!", "success");
      } else {
        showFeedback("❌ Failed to send OTP", "error");
      }
    } catch {
      showFeedback("❌ Cannot reach security engine (port 3001)", "error");
    } finally {
      setOtpLoading(false);
    }
  };

  // Step 2: Verify OTP and execute on-chain unfreeze via Backend API
  const handleVerifyAndUnfreeze = async () => {
    if (!otpValue || otpValue.length !== 6) { showFeedback("❌ Enter the 6-digit OTP", "error"); return; }
    setOtpLoading(true);
    try {
      // 1. Verify OTP
      const verifyRes = await fetch(`${ENGINE_URL}/api/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: otpToken, otp: otpValue }),
      });
      const verifyData = await verifyRes.json();
      if (!verifyData.valid) { showFeedback(`❌ ${verifyData.error}`, "error"); return; }

      showFeedback("✅ OTP verified. Authorizing backend unfreeze...", "warn");

      // 2. Execute Admin Unfreeze on Backend
      const freezeRes = await fetch(`${ENGINE_URL}/api/execute-unfreeze`, {
        method: "POST"
      });
      const freezeData = await freezeRes.json();
      
      if (!freezeRes.ok || !freezeData.success) {
        showFeedback(`❌ Backend unfreeze failed: ${freezeData.error}`, "error");
        return;
      }

      showFeedback("✅ Vault unfrozen successfully!", "success");
      
      if (typeof window !== "undefined") {
        const chan = new BroadcastChannel("vultra_ui_telemetry");
        chan.postMessage({ type: "FORCE_UNFREEZE" });
        chan.close();
      }

      setOtpStep("idle");
      setOtpEmail("");
      setOtpValue("");
      setOtpToken("");
    } catch (error: any) {
      console.error(error);
      showFeedback("❌ Unfreeze failed (backend API error)", "error");
    } finally {
      setOtpLoading(false);
    }
  };

  const fbColors = {
    success: { bg: "rgba(34,197,94,0.1)", border: "rgba(34,197,94,0.3)", color: "var(--success)" },
    error: { bg: "rgba(239,68,68,0.1)", border: "rgba(239,68,68,0.3)", color: "var(--danger)" },
    warn: { bg: "rgba(249,115,22,0.1)", border: "rgba(249,115,22,0.3)", color: "var(--warning)" },
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "10px 14px", borderRadius: 8, outline: "none",
    background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
    color: "var(--text-primary)", fontSize: "0.9rem", boxSizing: "border-box",
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
              background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)",
              fontSize: "0.82rem", color: "var(--danger)", lineHeight: 1.5, fontWeight: 600,
            }}
          >
            ⚠️ Vault frozen — an emergency alert has been sent to the admin email.
            <br />
            <span style={{ fontWeight: 400, opacity: 0.85 }}>
              Authorize unfreeze via the OTP sent to your email below.
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Deposit */}
      <div style={{ marginBottom: 14 }}>
        <label style={{ display: "block", fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 700, marginBottom: 7 }}>
          Deposit Amount (VLT)
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
        <label style={{ display: "block", fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 700, marginBottom: 7 }}>
          Withdraw Amount (VLT)
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

      {/* Admin Controls Header */}
      <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700, marginBottom: 12, display: "flex", justifyContent: "space-between" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Lock size={11} /> Admin Controls
        </span>
        {isFrozen && timeLeft > 0 && (
          <span style={{ color: "var(--warning)", display: "flex", alignItems: "center", gap: 4 }}>
            <Clock size={12} /> Time-lock: {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, "0")}
          </span>
        )}
      </div>

      {/* OTP unfreeze flow */}
      <AnimatePresence mode="wait">
        {/* Step 0: Prompt unfreeze button */}
        {otpStep === "idle" && (
          <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <button
              onClick={() => isFrozen && setOtpStep("email")}
              disabled={!isFrozen}
              className="btn btn-success"
              style={{ width: "100%", justifyContent: "center" }}
            >
              <ShieldCheck size={16} />
              {isFrozen ? "Authorize Emergency Unfreeze (OTP Required)" : "Unfreeze Vault"}
            </button>
          </motion.div>
        )}

        {/* Step 1: Enter email */}
        {otpStep === "email" && (
          <motion.div key="email" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
            <div style={{ padding: "16px", background: "rgba(34,197,94,0.05)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, color: "#22c55e", fontWeight: 700, fontSize: "0.85rem" }}>
                <Mail size={15} /> Email-Based OTP Authentication
              </div>
              <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: 12 }}>
                Enter your admin email to receive a one-time unfreeze code.
              </p>
              <input
                type="email"
                placeholder="admin@example.com"
                value={otpEmail}
                onChange={e => setOtpEmail(e.target.value)}
                style={inputStyle}
              />
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <button onClick={() => setOtpStep("idle")} className="btn btn-ghost" style={{ flex: 1, justifyContent: "center", padding: "8px" }}>
                  Cancel
                </button>
                <button onClick={handleRequestOtp} disabled={otpLoading} className="btn btn-success" style={{ flex: 2, justifyContent: "center", padding: "8px" }}>
                  {otpLoading ? "Sending..." : "Send OTP →"}
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* Step 2: Enter OTP */}
        {otpStep === "otp" && (
          <motion.div key="otp" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
            <div style={{ padding: "16px", background: "rgba(34,197,94,0.05)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, color: "#22c55e", fontWeight: 700, fontSize: "0.85rem" }}>
                <Check size={15} /> Enter OTP Code
              </div>
              <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: 4 }}>
                A 6-digit code was sent to <strong style={{ color: "var(--text-primary)" }}>{otpEmail}</strong>
              </p>
              {otpPreview && (
                <a href={otpPreview} target="_blank" rel="noreferrer" style={{ fontSize: "0.7rem", color: "#22c55e", display: "block", marginBottom: 10 }}>
                  📧 Preview test email →
                </a>
              )}
              <input
                type="text"
                placeholder="000000"
                value={otpValue}
                maxLength={6}
                onChange={e => setOtpValue(e.target.value.replace(/\D/g, ""))}
                style={{ ...inputStyle, fontSize: "1.4rem", letterSpacing: "0.4em", textAlign: "center", fontWeight: 700 }}
              />
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <button onClick={() => setOtpStep("email")} className="btn btn-ghost" style={{ flex: 1, justifyContent: "center", padding: "8px" }}>
                  ← Back
                </button>
                <button onClick={handleVerifyAndUnfreeze} disabled={otpLoading} className="btn btn-success" style={{ flex: 2, justifyContent: "center", padding: "8px" }}>
                  {otpLoading ? "Verifying..." : "✅ Verify & Unfreeze"}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Feedback Toast */}
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
