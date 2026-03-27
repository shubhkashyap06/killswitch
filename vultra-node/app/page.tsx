"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { injected } from "wagmi/connectors";
import { motion } from "framer-motion";
import { Shield, Zap, Lock, Activity } from "lucide-react";

const features = [
  {
    icon: Shield,
    title: "Liquidity Protection",
    desc: "Real-time guard rails against flash loan attacks",
  },
  {
    icon: Zap,
    title: "Instant Freeze",
    desc: "Automatic protocol freeze on suspicious activity",
  },
  {
    icon: Lock,
    title: "Secure Vaults",
    desc: "Multi-layer security for deposited assets",
  },
  {
    icon: Activity,
    title: "Live Monitoring",
    desc: "On-chain analytics and anomaly detection",
  },
];

export default function LandingPage() {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const { connect } = useConnect();
  const { disconnect } = useDisconnect();

  useEffect(() => {
    if (isConnected) {
      router.push("/dashboard");
    }
  }, [isConnected, router]);

  return (
    <div
      className="min-h-screen bg-grid flex flex-col items-center justify-center relative overflow-hidden"
      style={{ background: "var(--bg-primary)" }}
    >
      {/* Background orbs */}
      <div
        style={{
          position: "absolute",
          top: "10%",
          left: "15%",
          width: 400,
          height: 400,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(79,110,247,0.12) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: "10%",
          right: "10%",
          width: 360,
          height: 360,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(167,139,250,0.1) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 48,
          maxWidth: 900,
          width: "100%",
          padding: "0 24px",
        }}
      >
        {/* Hero section */}
        <div style={{ textAlign: "center" }}>
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1, duration: 0.5 }}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 12,
              marginBottom: 24,
            }}
          >
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: 14,
                background: "linear-gradient(135deg, #4f6ef7, #a78bfa)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 8px 32px rgba(79,110,247,0.4)",
              }}
            >
              <Shield size={28} color="white" />
            </div>
            <span
              style={{
                fontSize: "1.35rem",
                fontWeight: 800,
                letterSpacing: "-0.01em",
                color: "var(--text-primary)",
              }}
            >
              Vultra-Node
            </span>
          </motion.div>

          <h1
            className="glow-text"
            style={{
              fontSize: "clamp(2.5rem, 6vw, 4rem)",
              fontWeight: 900,
              letterSpacing: "-0.03em",
              lineHeight: 1.1,
              marginBottom: 16,
            }}
          >
            Intelligent Liquidity
            <br />
            Protection System
          </h1>
          <p
            style={{
              fontSize: "1.1rem",
              color: "var(--text-secondary)",
              maxWidth: 520,
              margin: "0 auto",
              lineHeight: 1.6,
            }}
          >
            Advanced DeFi security protocol with real-time monitoring,
            automatic freeze mechanisms, and attack detection.
          </p>
        </div>

        {/* Connect card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="glass-card"
          style={{
            padding: 40,
            textAlign: "center",
            maxWidth: 460,
            width: "100%",
          }}
        >
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: 20,
              background:
                "linear-gradient(135deg, rgba(79,110,247,0.2), rgba(167,139,250,0.2))",
              border: "1px solid rgba(79,110,247,0.3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 20px",
            }}
          >
            <Shield size={36} color="var(--accent)" />
          </div>
          <h2
            style={{
              fontSize: "1.5rem",
              fontWeight: 700,
              marginBottom: 8,
              color: "var(--text-primary)",
            }}
          >
            Connect Your Wallet
          </h2>
          <p
            style={{
              color: "var(--text-secondary)",
              fontSize: "0.875rem",
              lineHeight: 1.6,
            }}
          >
            Connect your Web3 wallet to access the Vultra-Node dashboard and
            manage your DeFi liquidity.
          </p>

          {/* Real RainbowKit Button */}
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
            {isConnected && address ? (
              <button
                onClick={() => router.push('/dashboard')}
                className="btn"
                style={{ background: "#3b82f6", color: "white", padding: "12px 24px", fontSize: "1.05rem", fontWeight: 700 }}
              >
                Enter Dashboard ({address.slice(0,6)}...)
              </button>
            ) : (
              <button
                onClick={() => connect({ connector: injected() })}
                className="btn pulse-glow"
                style={{ background: "#3b82f6", color: "white", padding: "12px 24px", fontSize: "1.05rem", fontWeight: 700 }}
              >
                Connect MetaMask
              </button>
            )}
          </div>

          <div
            style={{
              marginTop: 20,
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <div
              style={{ flex: 1, height: 1, background: "var(--border)" }}
            />
            <span
              style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}
            >
              Demo Mode — No real wallet required
            </span>
            <div
              style={{ flex: 1, height: 1, background: "var(--border)" }}
            />
          </div>
        </motion.div>

        {/* Feature grid */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.5 }}
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 16,
            width: "100%",
          }}
        >
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 + i * 0.08 }}
              className="glass-card"
              style={{ padding: "20px 18px" }}
            >
              <f.icon
                size={22}
                color="var(--accent)"
                style={{ marginBottom: 10 }}
              />
              <div
                style={{
                  fontWeight: 600,
                  fontSize: "0.875rem",
                  color: "var(--text-primary)",
                  marginBottom: 4,
                }}
              >
                {f.title}
              </div>
              <div
                style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}
              >
                {f.desc}
              </div>
            </motion.div>
          ))}
        </motion.div>
      </motion.div>
    </div>
  );
}
