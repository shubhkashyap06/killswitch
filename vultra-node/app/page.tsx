"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAccount, useConnect } from "wagmi";
import { injected } from "wagmi/connectors";
import { motion } from "framer-motion";
import { Shield, Zap, Lock, Activity, ChevronRight, ExternalLink } from "lucide-react";

const stats = [
  { label: "Total Value Locked", value: "$4.2M", sub: "+3.2% today" },
  { label: "Attacks Blocked",    value: "1,847",  sub: "All time" },
  { label: "Uptime",             value: "99.98%", sub: "Last 30 days" },
  { label: "Active Vaults",      value: "312",    sub: "Live" },
];

const features = [
  { icon: Shield,   title: "Liquidity Protection", desc: "Real-time guard rails against flash loan and drip attacks.",        color: "#00d09c" },
  { icon: Zap,      title: "Instant Freeze",        desc: "Automatic circuit breaker activates on suspicious activity.",       color: "#5c9aff" },
  { icon: Lock,     title: "OTP-Secured Unfreeze",  desc: "Email-based 2FA before any vault restoration attempts.",           color: "#b39ddb" },
  { icon: Activity, title: "Live Monitoring Engine",desc: "Node.js engine watches on-chain events 24/7 via Ethers.js.",       color: "#ffb74d" },
];

export default function LandingPage() {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const { connect } = useConnect();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (mounted && isConnected) router.push("/dashboard");
  }, [mounted, isConnected, router]);

  function handleConnect() {
    try {
      if (typeof window !== "undefined" && (window as any).ethereum) {
        connect({ connector: injected() });
      } else {
        alert("MetaMask not detected! Please install MetaMask and refresh.");
      }
    } catch (e) {
      console.error(e);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-primary)", display: "flex", flexDirection: "column" }}>

      {/* ── Top Nav — logo + nav links only, NO button ── */}
      <header style={{
        borderBottom: "1px solid var(--border)",
        background: "var(--bg-secondary)",
        position: "sticky", top: 0, zIndex: 50,
      }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px", height: 60, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <img src="/logo.png" alt="Vultra" style={{ width: 34, height: 34, objectFit: "contain" }} />
            <span style={{ fontWeight: 800, fontSize: "1.05rem", color: "var(--text-primary)", letterSpacing: "-0.01em" }}>
              Vultra<span style={{ color: "var(--accent)" }}>Node</span>
            </span>
          </div>
          <nav style={{ display: "flex", alignItems: "center", gap: 28 }}>
            {["Discover", "Security", "Docs"].map(n => (
              <span key={n} style={{ fontSize: 13, fontWeight: 500, color: "var(--text-secondary)", cursor: "pointer", transition: "color 0.14s" }}
                onMouseEnter={e => (e.currentTarget.style.color = "var(--text-primary)")}
                onMouseLeave={e => (e.currentTarget.style.color = "var(--text-secondary)")}
              >{n}</span>
            ))}
          </nav>
          {/* No button in nav — single button is in hero */}
          <div style={{ width: 140 }} />
        </div>
      </header>

      <main style={{ flex: 1 }}>
        {/* ── Hero ── */}
        <section style={{
          background: "linear-gradient(160deg, #0f0f0f 0%, #111 40%, #0d1a15 100%)",
          borderBottom: "1px solid var(--border)",
          padding: "80px 24px 70px",
        }}>
          <div style={{ maxWidth: 1200, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 420px", gap: 60, alignItems: "center" }}>
            {/* Left copy */}
            <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
              <div className="badge badge-success" style={{ marginBottom: 18 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--success)", display: "inline-block" }} />
                Live on Local Network
              </div>
              <h1 style={{
                fontSize: "clamp(2.2rem, 4vw, 3.4rem)", fontWeight: 900,
                letterSpacing: "-0.03em", lineHeight: 1.08,
                color: "var(--text-primary)", marginBottom: 18,
              }}>
                Intelligent DeFi<br />
                <span style={{ color: "var(--accent)" }}>Liquidity Protection</span>
              </h1>
              <p style={{ fontSize: "1.05rem", color: "var(--text-secondary)", lineHeight: 1.7, maxWidth: 480, marginBottom: 20 }}>
                Real-time attack detection, automatic circuit breakers, and percentage-based drip drain prevention for your liquidity vaults.
              </p>
            </motion.div>

            {/* Right: Single Connect Card */}
            <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.15 }}>
              <div className="card" style={{ padding: 32 }}>
                {/* Stats grid */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, background: "var(--border)", borderRadius: 10, overflow: "hidden", marginBottom: 28 }}>
                  {stats.map(s => (
                    <div key={s.label} style={{ background: "var(--bg-secondary)", padding: "14px 16px" }}>
                      <div style={{ fontSize: 18, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.02em", marginBottom: 2 }}>{s.value}</div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500 }}>{s.label}</div>
                      <div style={{ fontSize: 11, color: "var(--success)", marginTop: 2, fontWeight: 600 }}>{s.sub}</div>
                    </div>
                  ))}
                </div>

                {/* Description */}
                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8, color: "var(--text-primary)" }}>
                    Connect your wallet to begin
                  </div>
                  <div style={{ fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.65 }}>
                    Use MetaMask to access the real-time liquidity protection dashboard, deposit assets, and monitor security events live.
                  </div>
                </div>

                {/* ─── THE ONE AND ONLY CONNECT BUTTON ─── */}
                <button
                  id="main-connect-btn"
                  onClick={handleConnect}
                  className="btn btn-primary"
                  style={{ width: "100%", padding: "14px", fontSize: 15, fontWeight: 700, borderRadius: 10, display: "flex", justifyContent: "center", marginBottom: 12 }}
                >
                  <Shield size={17} />
                  Connect MetaMask
                </button>

                <a
                  href="/attacker"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-ghost"
                  style={{ width: "100%", padding: "12px", fontSize: 14, fontWeight: 600, borderRadius: 10, textDecoration: "none", display: "flex", justifyContent: "center", border: "1px solid rgba(239,68,68,0.2)", color: "var(--danger)", background: "rgba(239,68,68,0.05)" }}
                >
                  <ExternalLink size={15} style={{ marginRight: 6 }} />
                  Open Attacker Portal
                </a>

                <div style={{ textAlign: "center", marginTop: 14, fontSize: 11, color: "var(--text-muted)" }}>
                  Local Hardhat testnet · No real funds required
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* ── Feature Grid ── */}
        <section style={{ padding: "64px 24px", maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 40 }}>
            <div className="section-label" style={{ marginBottom: 10 }}>Platform Capabilities</div>
            <h2 style={{ fontSize: "1.75rem", fontWeight: 800, letterSpacing: "-0.02em", color: "var(--text-primary)" }}>
              Enterprise-grade DeFi security
            </h2>
          </div>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 1, background: "var(--border)", borderRadius: 14, overflow: "hidden" }}
          >
            {features.map((f, i) => (
              <motion.div key={f.title}
                initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 + i * 0.07 }}
                style={{ background: "var(--bg-card)", padding: "28px 24px", cursor: "default", transition: "background 0.15s" }}
                onMouseEnter={e => (e.currentTarget.style.background = "var(--bg-card-hover)")}
                onMouseLeave={e => (e.currentTarget.style.background = "var(--bg-card)")}
              >
                <div style={{ width: 40, height: 40, borderRadius: 10, background: `${f.color}18`, border: `1px solid ${f.color}33`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
                  <f.icon size={18} color={f.color} />
                </div>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 7, color: "var(--text-primary)" }}>{f.title}</div>
                <div style={{ fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.65 }}>{f.desc}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 16, fontSize: 12, color: f.color, fontWeight: 600 }}>
                  Learn more <ChevronRight size={12} />
                </div>
              </motion.div>
            ))}
          </motion.div>
        </section>

        {/* ── Bottom CTA — text only, no extra button ── */}
        <section style={{ padding: "0 24px 70px" }}>
          <div style={{ maxWidth: 1200, margin: "0 auto" }}>
            <div style={{
              background: "linear-gradient(135deg, #0d1a15 0%, #111 100%)",
              border: "1px solid rgba(0,208,156,0.18)",
              borderRadius: 16, padding: "36px 48px",
              display: "flex", justifyContent: "space-between", alignItems: "center", gap: 32, flexWrap: "wrap",
            }}>
              <div>
                <h3 style={{ fontSize: "1.3rem", fontWeight: 800, color: "var(--text-primary)", marginBottom: 8 }}>
                  Protect your liquidity vault today
                </h3>
                <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                  Scroll up and connect your MetaMask wallet to launch the dashboard.
                </p>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--accent)", fontWeight: 700, fontSize: 13 }}>
                <Shield size={16} color="var(--accent)" />
                Enterprise-grade DeFi Security
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ── Footer ── */}
      <footer style={{ borderTop: "1px solid var(--border)", background: "var(--bg-secondary)", padding: "20px 24px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <span style={{ fontWeight: 700, fontSize: 13, color: "var(--text-secondary)" }}>© 2026 Vultra-Node Protocol</span>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Built on Hardhat · Ethers.js v6 · Next.js 16</span>
        </div>
      </footer>
    </div>
  );
}
