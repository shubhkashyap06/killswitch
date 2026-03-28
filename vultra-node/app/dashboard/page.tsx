"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useVultraStore } from "@/lib/store";
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
  const { isConnected } = useVultraStore();
  const router = useRouter();

  useEffect(() => {
    if (!isConnected) router.push("/");
  }, [isConnected, router]);

  if (!isConnected) return null;

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
