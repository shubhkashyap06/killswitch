"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import { useKillswitchStore } from "@/lib/store";
import Navbar from "@/components/Navbar";
import LiquidityCards from "@/components/LiquidityCards";
import StatusAlertPanel from "@/components/StatusAlertPanel";
import LiquidityLineChart from "@/components/LiquidityLineChart";
import TxActivityBarChart from "@/components/TxActivityBarChart";
import ActionPanel from "@/components/ActionPanel";
import TransactionLog from "@/components/TransactionLog";
import AlertPanel from "@/components/AlertPanel";
import VestingSection from "@/components/VestingSection";

export default function DashboardPage() {
  // Use wagmi as the source of truth — the Zustand store hydrates late
  const { address, isConnected } = useAccount();
  const router = useRouter();
  // Prevents redirect firing during SSR / first-render hydration when
  // isConnected is always false before the client wallet state arrives.
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (mounted && !isConnected) router.push("/");
  }, [mounted, isConnected, router]);

  if (!mounted || !isConnected) return null;

  return (
    <div
      className="bg-grid"
      style={{ minHeight: "100vh", background: "var(--bg-primary)", paddingBottom: 56 }}
    >
      <Navbar />

      <main style={{ maxWidth: 1440, margin: "0 auto", padding: "22px 22px 0" }}>

        {/* Row 1: Metric Cards */}
        <LiquidityCards />

        {/* Row 2: Status + Action */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16 }}>
          <StatusAlertPanel />
          <ActionPanel />
        </div>

        {/* Row 3: Charts */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16 }}>
          <LiquidityLineChart />
          <TxActivityBarChart />
        </div>

        {/* Row 4: Tx Log + Alert Feed + Vesting */}
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1.4fr 1fr", gap: 16, marginTop: 16 }}>
          <TransactionLog />
          <AlertPanel />
          <VestingSection />
        </div>
      </main>
    </div>
  );
}
