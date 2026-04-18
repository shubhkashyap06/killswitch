import * as React from "react";
import { useAccount } from "wagmi";
import { useNavigate } from "react-router-dom";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { Shield, Lock, Globe, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const Landing = () => {
  const { isConnected } = useAccount();
  const navigate = useNavigate();

  // 3D Parallax Mouse Tracking
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const mouseXSpring = useSpring(x);
  const mouseYSpring = useSpring(y);
  const rotateX = useTransform(mouseYSpring, [-0.5, 0.5], ["10deg", "-10deg"]);
  const rotateY = useTransform(mouseXSpring, [-0.5, 0.5], ["-10deg", "10deg"]);

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    x.set(e.clientX / rect.width - 0.5);
    y.set(e.clientY / rect.height - 0.5);
  };

  // Auto-navigate to dashboard when wallet connects
  React.useEffect(() => {
    if (isConnected) {
      setTimeout(() => navigate("/"), 600);
    }
  }, [isConnected, navigate]);

  return (
    <div
      className="relative min-h-screen w-full overflow-hidden bg-[#020617] text-white flex items-center justify-center font-sans selection:bg-primary/30"
      onMouseMove={handleMouseMove}
    >
      {/* ELITE 3D BACKGROUND LAYER */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(17,24,39,1)_0%,rgba(2,6,23,1)_100%)]" />
        <div className="absolute inset-0 opacity-20">
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />
        </div>
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-primary/10 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-blue-500/10 rounded-full blur-[100px]" />
        <div className="absolute inset-0 overflow-hidden">
          {[...Array(20)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute h-1 w-1 bg-primary/40 rounded-full"
              initial={{ x: Math.random() * 100 + "%", y: Math.random() * 100 + "%", opacity: Math.random() * 0.5 }}
              animate={{ y: [null, Math.random() * -100 - 50], opacity: [0, 0.5, 0] }}
              transition={{ duration: Math.random() * 10 + 10, repeat: Infinity, ease: "linear" }}
            />
          ))}
        </div>
      </div>

      {/* CONTENT LAYER */}
      <motion.div
        style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
        className="relative z-10 flex flex-col items-center max-w-5xl px-6"
      >
        {/* Header Badge */}
        <motion.div
          initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 mb-10 backdrop-blur-md"
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
          </span>
          <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-primary/80">Guardian Protocol v3.2 Live · Hardhat</span>
        </motion.div>

        {/* Main Hero */}
        <div className="text-center mb-12" style={{ transform: "translateZ(50px)" }}>
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.8 }}
            className="inline-flex items-center justify-center p-4 rounded-3xl bg-gradient-to-br from-primary/20 to-transparent border border-white/10 mb-8 backdrop-blur-sm"
          >
            <Shield className="h-12 w-12 text-primary" strokeWidth={1.5} />
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.3 }}
            className="text-6xl md:text-8xl font-bold tracking-tighter mb-6 bg-clip-text text-transparent bg-gradient-to-b from-white via-white to-white/20"
          >
            VAULT SENTINEL
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.4 }}
            className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed font-light"
          >
            The elite security layer for high-net-worth digital assets.
            Real-time heuristic protection with zero-latency circuit breakers.
          </motion.p>
        </div>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.5 }}
          className="flex flex-col items-center gap-6"
          style={{ transform: "translateZ(100px)" }}
        >
          <div className="flex flex-col items-center gap-4 scale-125">
            <ConnectButton.Custom>
              {({ account, chain, openConnectModal, mounted, ready }) => {
                const connected = ready && account && chain;
                return (
                  <button
                    onClick={connected ? () => navigate("/") : openConnectModal}
                    className={cn(
                      "relative group px-10 py-5 font-bold rounded-2xl overflow-hidden transition-all hover:scale-105 active:scale-95",
                      connected
                        ? "bg-green-600 text-white shadow-[0_20px_50px_rgba(22,163,74,0.4)]"
                        : "bg-primary text-black shadow-[0_20px_50px_rgba(30,58,138,0.3)]"
                    )}
                  >
                    <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                    <span className="relative z-10 flex items-center gap-3 text-[14px] uppercase tracking-widest">
                      {connected ? `Enter Dashboard → ${account.displayName}` : "Connect MetaMask"}
                      <ChevronRight className="h-4 w-4" />
                    </span>
                  </button>
                );
              }}
            </ConnectButton.Custom>
          </div>

          <div className="flex items-center gap-8 mt-4">
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-slate-500" />
              <span className="text-[11px] text-slate-500 uppercase tracking-widest">Local Hardhat Network</span>
            </div>
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-slate-500" />
              <span className="text-[11px] text-slate-500 uppercase tracking-widest">Chain ID 31337</span>
            </div>
          </div>
        </motion.div>
      </motion.div>

      {/* Glassmorphic Side Stats */}
      <motion.div
        initial={{ opacity: 0, x: -100 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 1, delay: 0.6 }}
        className="absolute left-10 top-1/2 -translate-y-1/2 hidden xl:flex flex-col gap-4"
      >
        <SideCard label="Attack Vectors" value="Live" sub="AI-monitored 24/7" />
        <SideCard label="Circuit Breaker" value="Arm'd" sub="Auto-freeze ready" />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, x: 100 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 1, delay: 0.6 }}
        className="absolute right-10 top-1/2 -translate-y-1/2 hidden xl:flex flex-col gap-4"
      >
        <SideCard label="LiquidityVault" value="Deployed" sub="Hardhat localhost:8545" />
        <SideCard label="Monitoring Engine" value="Port 3001" sub="Active Guardian" />
      </motion.div>

      <div className="absolute bottom-10 left-10 flex items-center gap-4 text-slate-500">
        <div className="h-px w-12 bg-slate-800" />
        <span className="text-[10px] uppercase tracking-[0.3em] font-light">Killswitch-Node Security Protocol</span>
      </div>
    </div>
  );
};

function SideCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="w-56 p-5 rounded-2xl bg-white/[0.02] border border-white/10 backdrop-blur-xl hover:bg-white/[0.04] transition-colors group cursor-default">
      <div className="text-[10px] uppercase tracking-widest text-slate-500 mb-2 font-bold group-hover:text-primary transition-colors">{label}</div>
      <div className="text-2xl font-bold mb-1 tracking-tight">{value}</div>
      <div className="text-[11px] text-slate-400 font-light">{sub}</div>
    </div>
  );
}

export default Landing;
