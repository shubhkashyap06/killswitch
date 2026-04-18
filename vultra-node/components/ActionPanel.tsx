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
import { supabase } from "@/lib/supabase";

const VAULT_ADDRESS = process.env.NEXT_PUBLIC_VAULT_ADDRESS as `0x${string}`;
const TOKEN_ADDRESS = process.env.NEXT_PUBLIC_TOKEN_ADDRESS as `0x${string}`;
const ENGINE_URL = "http://localhost:3001";

export default function ActionPanel() {
  const { isFrozen, userBalance, totalLiquidity, threatScore, userEmail } = useVultraStore();
  const [depositAmount, setDepositAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [feedback, setFeedback] = useState<{ msg: string; type: "success" | "error" | "warn" } | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);

  // OTP Unfreeze Auth State
  const [otpStep, setOtpStep] = useState<"idle" | "otp">("idle");
  const [otpValue, setOtpValue] = useState("");
  const [otpToken, setOtpToken] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpPreview, setOtpPreview] = useState<string | null>(null);
  const [devOtp, setDevOtp] = useState<string | null>(null);

  // Withdrawal OTP State (for >30% large withdrawals)
  const [wdOtpActive, setWdOtpActive] = useState(false);
  const [wdOtpValue, setWdOtpValue] = useState("");
  const [wdOtpLoading, setWdOtpLoading] = useState(false);
  const [pendingWithdrawAmt, setPendingWithdrawAmt] = useState("");

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

  // Auto-send freeze email when freeze starts (uses stored profile email)
  useEffect(() => {
    if (isFrozen && !prevFrozen.current) {
      fetch(`${ENGINE_URL}/api/freeze-alert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: `Threat reached ${threatScore}% — Circuit breaker activated`,
          userEmail: userEmail || undefined,
        }),
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

    // Large withdrawal (>30%) — require email OTP
    if (amt > maxAllowed && !wdOtpActive) {
      if (!userEmail) { showFeedback("❌ Set your email in Profile to authorize large withdrawals", "error"); return; }
      showFeedback("📧 Large withdrawal detected. Sending OTP to your email...", "warn");
      setWdOtpLoading(true);
      try {
        const { error } = await supabase.auth.signInWithOtp({ email: userEmail });
        if (error) {
          showFeedback(`⚠️ Real OTP failed. Use Demo OTP '000000'`, "warn");
        } else {
          showFeedback(`📧 OTP sent to ${userEmail} (or use 000000)`, "success");
        }
        setPendingWithdrawAmt(withdrawAmount);
        setWdOtpActive(true);
      } catch (err: any) {
        showFeedback(`❌ OTP send failed: ${err.message}`, "error");
      } finally {
        setWdOtpLoading(false);
      }
      return;
    }

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

  // Verify withdrawal OTP and execute the transaction
  const handleVerifyWdOtp = async () => {
    if (!wdOtpValue || wdOtpValue.length < 6) { showFeedback("❌ Enter the Security OTP", "error"); return; }
    setWdOtpLoading(true);
    try {
      if (wdOtpValue !== "000000" && wdOtpValue !== "00000000") {
        const { error } = await supabase.auth.verifyOtp({
          email: userEmail!,
          token: wdOtpValue,
          type: 'email'
        });
        if (error) { showFeedback(`❌ ${error.message}`, "error"); return; }
      }

      // OTP valid — execute withdrawal
      showFeedback("✅ OTP verified! Authorizing large withdrawal limit...", "warn");
      const authRes = await fetch(`${ENGINE_URL}/api/authorize-large-withdrawal`, { method: "POST" });
      const authData = await authRes.json();
      if (!authRes.ok || !authData.success) {
        showFeedback(`❌ Authorization failed: ${authData.error || "Unknown error"}`, "error");
        return;
      }

      showFeedback("✅ Authorised! Processing transaction...", "warn");
      if (chainId !== 31337) await switchChainAsync({ chainId: 31337 });
      const parsedAmt = parseEther(pendingWithdrawAmt);
      await writeContractAsync({ chainId: 31337, address: VAULT_ADDRESS, abi: VaultABI.abi, functionName: "withdraw", args: [parsedAmt] });
      setWithdrawAmount("");
      showFeedback(`✅ Large withdrawal of ${pendingWithdrawAmt} VLT authorized and processed!`, "success");
      setWdOtpActive(false);
      setWdOtpValue("");
    } catch (err: any) {
      showFeedback("❌ Withdrawal failed after OTP", "error");
    } finally {
      setWdOtpLoading(false);
    }
  };

  // Step 1: Auto-send OTP using stored profile email
  const handleRequestOtp = async () => {
    if (!userEmail) {
      showFeedback("❌ Please set your email in the Profile section first", "error");
      return;
    }
    setOtpLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({ email: userEmail });
      
      if (error) {
        showFeedback(`⚠️ Real OTP failed. Use Demo OTP '000000'`, "warn");
      } else {
        showFeedback(`📧 OTP sent to ${userEmail} (or use 000000)`, "success");
      }
      setOtpStep("otp");
    } catch {
      showFeedback("❌ Network error connecting to Supabase", "error");
    } finally {
      setOtpLoading(false);
    }
  };

  // Step 2: Verify OTP and execute on-chain unfreeze via Backend API
  const handleVerifyAndUnfreeze = async () => {
    if (!otpValue || otpValue.length < 6) { showFeedback("❌ Enter the Security OTP", "error"); return; }
    setOtpLoading(true);
    try {
      // 1. Verify OTP
      if (otpValue !== "000000" && otpValue !== "00000000") {
        const { error } = await supabase.auth.verifyOtp({
          email: userEmail!,
          token: otpValue,
          type: 'email'
        });
        if (error) { showFeedback(`❌ ${error.message}`, "error"); return; }
      }

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
      setOtpValue("");
    } catch (error: any) {
      console.error(error);
      showFeedback("❌ Unfreeze failed (backend API error)", "error");
    } finally {
      setOtpLoading(false);
    }
  };

  const fbColors = {
    success: { bg: "var(--success-dim)", border: "rgba(0,208,156,0.3)", color: "var(--success)" },
    error:   { bg: "var(--danger-dim)",  border: "rgba(255,82,82,0.3)",  color: "var(--danger)" },
    warn:    { bg: "var(--warning-dim)", border: "rgba(255,183,77,0.3)", color: "var(--warning)" },
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "10px 13px", borderRadius: 8, outline: "none",
    background: "var(--bg-input)", border: "1px solid var(--border)",
    color: "var(--text-primary)", fontSize: "14px", boxSizing: "border-box",
    fontFamily: "'Inter', sans-serif",
    transition: "border-color 0.15s",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.2 }}
      className={isFrozen ? "glass-card-danger" : "glass-card"}
      style={{ padding: 24, display: "flex", flexDirection: "column" }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
        <Settings2 size={17} color="var(--accent)" />
        <h3 style={{ fontWeight: 700, fontSize: "0.95rem", color: "var(--text-primary)" }}>
          Action Panel
        </h3>
        {isFrozen && (
          <span className="badge badge-danger" style={{ marginLeft: "auto" }}>
            🔒 FROZEN
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
                padding: "10px 14px", borderRadius: 8, marginBottom: 16,
                background: "var(--danger-dim)", border: "1px solid rgba(255,82,82,0.3)",
                fontSize: 12.5, color: "var(--danger)", lineHeight: 1.55, fontWeight: 500,
              }}
            >
              ⚠️ Vault frozen — emergency alert dispatched to admin email.
              <br />
              <span style={{ fontWeight: 400, opacity: 0.8 }}>Authorize unfreeze via the Admin tab.</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Deposit */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: "block", fontSize: 11, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
            Amount (VLT)
          </label>
          <div style={{ display: "flex", gap: 8 }}>
            <input type="number" value={depositAmount} onChange={e => setDepositAmount(e.target.value)}
              placeholder="0.00" className="input-field" min="0" />
            <button onClick={handleDeposit} className="btn btn-success" style={{ flexShrink: 0, padding: "10px 16px" }}>
              <ArrowDownCircle size={15} /> Deposit
            </button>
          </div>
        </div>

        {/* Withdraw */}
        <div style={{ marginBottom: 18 }}>
          <label style={{ display: "block", fontSize: 11, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
            Withdraw (VLT)
          </label>
          <div style={{ display: "flex", gap: 8 }}>
            <input type="number" value={withdrawAmount} onChange={e => setWithdrawAmount(e.target.value)}
              placeholder="0.00" className="input-field" min="0" disabled={isFrozen} />
            <button onClick={handleWithdraw} disabled={isFrozen} className="btn btn-ghost" style={{ flexShrink: 0, padding: "10px 16px", whiteSpace: "nowrap" }}>
              <ArrowUpCircle size={15} /> Withdraw
            </button>
          </div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6 }}>
            Balance: {userBalance.toFixed(4)} VLT · Max single: 30% of pool
          </div>
        </div>

        <div style={{ height: 1, background: "var(--border)", marginBottom: 16 }} />

        {/* Admin: Unfreeze */}
        <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}><Lock size={11} /> Guardian Admin</span>
          {isFrozen && timeLeft > 0 && (
            <span style={{ color: "var(--warning)", display: "flex", alignItems: "center", gap: 4 }}>
              <Clock size={11} /> {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, "0")}
            </span>
          )}
        </div>

      <AnimatePresence>
        {wdOtpActive && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            style={{ marginBottom: 16 }}
          >
            <div style={{ padding: "16px", background: "rgba(249,115,22,0.05)", border: "1px solid rgba(249,115,22,0.3)", borderRadius: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, color: "#f97316", fontWeight: 700, fontSize: "0.85rem" }}>
                <Mail size={15} /> Large Withdrawal Authorization
              </div>
              <p style={{ fontSize: "0.76rem", color: "var(--text-muted)", marginBottom: 10 }}>
                OTP sent to <strong style={{ color: "var(--text-primary)" }}>{userEmail}</strong> — enter it below to authorize.
              </p>

              <input
                type="text" placeholder="--------"
                value={wdOtpValue} maxLength={8}
                onChange={e => setWdOtpValue(e.target.value.replace(/\D/g, ""))}
                style={{ ...inputStyle, fontSize: "1.4rem", letterSpacing: "0.2em", textAlign: "center", fontWeight: 700, marginBottom: 10 }}
              />
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => { setWdOtpActive(false); setWdOtpValue(""); }} className="btn btn-ghost" style={{ flex: 1, justifyContent: "center", padding: "8px" }}>
                  Cancel
                </button>
                <button onClick={handleVerifyWdOtp} disabled={wdOtpLoading} className="btn btn-success" style={{ flex: 2, justifyContent: "center", padding: "8px", background: "rgba(249,115,22,0.2)", border: "1px solid rgba(249,115,22,0.5)", color: "#f97316" }}>
                  {wdOtpLoading ? "Verifying..." : "✅ Verify & Withdraw"}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
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
        {/* Step 0: Authorize button */}
        {otpStep === "idle" && (
          <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {!userEmail && isFrozen && (
              <div style={{
                padding: "10px 14px", borderRadius: 8, marginBottom: 10,
                background: "rgba(249,115,22,0.08)", border: "1px solid rgba(249,115,22,0.3)",
                fontSize: "0.78rem", color: "#f97316",
              }}>
                ⚠️ No email set — click the <strong>Profile</strong> button in the header first.
              </div>
            )}
            {userEmail && isFrozen && (
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: 8, textAlign: "center" }}>
                OTP will be sent to <strong>{userEmail}</strong>
              </div>
            )}
            <button
              onClick={() => {
                if (isFrozen && userEmail) handleRequestOtp();
                else if (isFrozen && !userEmail) showFeedback("❌ Please set your email in Profile first", "error");
              }}
              disabled={!isFrozen || otpLoading}
              className="btn btn-success"
              style={{ width: "100%", justifyContent: "center" }}
            >
              <ShieldCheck size={16} />
              {otpLoading ? "Sending OTP..." : isFrozen ? (!userEmail ? "Set Email First" : "Send Unfreeze OTP") : "Unfreeze Vault"}
            </button>
          </motion.div>
        )}

        {/* Step 1: Enter OTP */}
        {otpStep === "otp" && (
          <motion.div key="otp" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
            <div style={{ padding: "16px", background: "rgba(34,197,94,0.05)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, color: "#22c55e", fontWeight: 700, fontSize: "0.85rem" }}>
                <Check size={15} /> Enter Security OTP Code
              </div>
              <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: 4 }}>
                A security code was sent to <strong style={{ color: "var(--text-primary)" }}>{userEmail}</strong>
              </p>

              <input
                type="text"
                placeholder="--------"
                value={otpValue}
                maxLength={8}
                onChange={e => setOtpValue(e.target.value.replace(/\D/g, ""))}
                style={{ ...inputStyle, fontSize: "1.4rem", letterSpacing: "0.2em", textAlign: "center", fontWeight: 700 }}
              />
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <button onClick={() => setOtpStep("idle")} className="btn btn-ghost" style={{ flex: 1, justifyContent: "center", padding: "8px" }}>
                  ← Cancel
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
              marginTop: 14, padding: "9px 12px", borderRadius: 7,
              background: fbColors[feedback.type].bg,
              border: `1px solid ${fbColors[feedback.type].border}`,
              color: fbColors[feedback.type].color,
              fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 7,
            }}
          >
            <Zap size={12} />
            {feedback.msg}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
