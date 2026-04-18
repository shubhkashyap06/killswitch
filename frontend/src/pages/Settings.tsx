import * as React from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { useThreat } from "@/context/ThreatContext";
import { motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Shield, Bell, Lock, Settings as SettingsIcon, Save, Smartphone, Mail } from "lucide-react";
import { ENGINE_URL } from "@/lib/constants";
import { VAULT_ADDRESS, TOKEN_ADDRESS } from "@/lib/constants";

const Settings = () => {
  const { status, freezeThreshold, maxWithdrawBps, isFrozen } = useThreat();
  const frozen = status === "FROZEN";

  const [loading, setLoading] = React.useState(false);

  // Live Backend actions
  const handleManualFreeze = async () => {
    setLoading(true);
    try {
      const res  = await fetch(`${ENGINE_URL}/api/execute-freeze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Manual UI freeze from Settings" }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Vault frozen", { description: `TX: ${data.txHash?.slice(0, 20)}…` });
      } else {
        toast.info(data.message || "Already frozen");
      }
    } catch {
      toast.error("Could not reach monitoring engine. Is it running?");
    }
    setLoading(false);
  };

  const handleEmergencyUnfreeze = async () => {
    setLoading(true);
    try {
      const res  = await fetch(`${ENGINE_URL}/api/execute-unfreeze`, { method: "POST" });
      const data = await res.json();
      if (data.success) {
        toast.success("Vault unfrozen", { description: `TX: ${data.txHash?.slice(0, 20)}…` });
      } else {
        toast.error(`Unfreeze failed: ${data.error}`);
      }
    } catch {
      toast.error("Could not reach monitoring engine. Is it running?");
    }
    setLoading(false);
  };

  const handleAuthorizeLarge = async () => {
    setLoading(true);
    try {
      const res  = await fetch(`${ENGINE_URL}/api/authorize-large-withdrawal`, { method: "POST" });
      const data = await res.json();
      if (data.success) {
        toast.success("Large withdrawal authorized", { description: "Cap lifted to 100% for 60 seconds." });
      } else {
        toast.error(`Failed: ${data.error}`);
      }
    } catch {
      toast.error("Could not reach monitoring engine.");
    }
    setLoading(false);
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-foreground">
      <Sidebar />
      <div className="relative flex flex-1 flex-col overflow-hidden">
        <Topbar status={status} />
        <main className="scrollbar-thin relative flex-1 overflow-y-auto">
          <div className="pointer-events-none absolute inset-0 bg-grid opacity-[0.35]" />
          <div className="relative mx-auto w-full max-w-[1000px] px-6 py-10">

            <header className="mb-10">
              <div className="flex items-center gap-3 mb-2">
                <SettingsIcon className="h-5 w-5 text-muted-foreground" />
                <h2 className="text-[24px] font-semibold tracking-tight">System Settings</h2>
              </div>
              <p className="text-[14px] text-muted-foreground">
                Configure vault security and execute guardian admin actions. All actions hit the real on-chain contracts via the monitoring engine.
              </p>
            </header>

            <div className="space-y-8">

              {/* Guardian Policy (read-only from chain) */}
              <motion.section
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                className="rounded-xl border border-hairline bg-card overflow-hidden"
              >
                <div className="border-b border-hairline bg-muted/30 px-6 py-4 flex items-center gap-2">
                  <Shield className="h-4 w-4 text-primary" />
                  <h3 className="text-[14px] font-semibold">Guardian Configuration (Live from Chain)</h3>
                </div>
                <div className="p-6 space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="space-y-1.5">
                      <Label className="text-[12px] font-medium text-muted-foreground uppercase tracking-wider">Auto-Freeze Threshold</Label>
                      <div className="h-10 bg-background border border-hairline rounded-md px-3 flex items-center font-mono text-[14px] font-bold text-primary">
                        {freezeThreshold}
                      </div>
                      <p className="text-[11px] text-muted-foreground">Composite threat score that triggers the circuit breaker.</p>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[12px] font-medium text-muted-foreground uppercase tracking-wider">Max Withdraw Cap</Label>
                      <div className="h-10 bg-background border border-hairline rounded-md px-3 flex items-center font-mono text-[14px] font-bold">
                        {(maxWithdrawBps / 100).toFixed(0)}% ({maxWithdrawBps} bps)
                      </div>
                      <p className="text-[11px] text-muted-foreground">Per-transaction withdrawal limit from on-chain config.</p>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[12px] font-medium text-muted-foreground uppercase tracking-wider">Vault State</Label>
                      <div className={`h-10 border rounded-md px-3 flex items-center font-mono text-[14px] font-bold ${isFrozen ? "bg-critical/10 border-critical/30 text-critical" : "bg-success/10 border-success/30 text-success"}`}>
                        {isFrozen ? "🔒 FROZEN" : "✅ ACTIVE"}
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[12px] font-medium text-muted-foreground uppercase tracking-wider">Vault Address</Label>
                      <div className="h-10 bg-background border border-hairline rounded-md px-3 flex items-center font-mono text-[11px] text-muted-foreground">
                        {VAULT_ADDRESS.slice(0, 20)}…
                      </div>
                    </div>
                  </div>
                </div>
              </motion.section>

              {/* Admin Actions */}
              <motion.section
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                className="rounded-xl border border-hairline bg-card overflow-hidden"
              >
                <div className="border-b border-hairline bg-muted/30 px-6 py-4 flex items-center gap-2">
                  <Lock className="h-4 w-4 text-critical" />
                  <h3 className="text-[14px] font-semibold">Admin Controls (On-Chain Actions)</h3>
                </div>
                <div className="p-6 space-y-4">

                  <div className="p-4 rounded-lg bg-critical/5 border border-critical/10 space-y-4">
                    <div className="flex items-center gap-2 text-critical">
                      <Shield className="h-4 w-4" />
                      <span className="text-[12px] font-bold uppercase tracking-widest">Vault Circuit Breaker</span>
                    </div>
                    <p className="text-[12px] text-foreground/80 leading-relaxed">
                      These actions route through the monitoring engine and execute real on-chain transactions.
                      Guardian wallet signs freeze; Admin wallet signs unfreeze.
                    </p>
                    <div className="flex flex-wrap gap-3">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={loading || isFrozen}
                        onClick={handleManualFreeze}
                        className="text-critical border-critical/30 hover:bg-critical/5 text-[12px]"
                      >
                        🔒 Manual Freeze Vault
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={loading || !isFrozen}
                        onClick={handleEmergencyUnfreeze}
                        className="text-success border-success/30 hover:bg-success/5 text-[12px]"
                      >
                        ✅ Emergency Unfreeze
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={loading}
                        onClick={handleAuthorizeLarge}
                        className="text-warning border-warning/30 hover:bg-warning/5 text-[12px]"
                      >
                        ⚡ Authorize Large Withdrawal (60s)
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-[12px] font-medium text-muted-foreground uppercase tracking-wider">Token Address</Label>
                      <div className="h-10 bg-background border border-hairline rounded-md px-3 flex items-center font-mono text-[11px] text-muted-foreground">
                        {TOKEN_ADDRESS.slice(0, 22)}…
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[12px] font-medium text-muted-foreground uppercase tracking-wider">RPC Endpoint</Label>
                      <div className="h-10 bg-background border border-hairline rounded-md px-3 flex items-center font-mono text-[11px] text-muted-foreground">
                        http://127.0.0.1:8545
                      </div>
                    </div>
                  </div>
                </div>
              </motion.section>

              {/* Notifications */}
              <motion.section
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                className="rounded-xl border border-hairline bg-card overflow-hidden"
              >
                <div className="border-b border-hairline bg-muted/30 px-6 py-4 flex items-center gap-2">
                  <Bell className="h-4 w-4 text-warning" />
                  <h3 className="text-[14px] font-semibold">Notification Preferences</h3>
                </div>
                <div className="p-6 space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-md bg-muted flex items-center justify-center">
                        <Smartphone className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="space-y-0.5">
                        <span className="text-[13px] font-medium block">Engine Console Alerts</span>
                        <span className="text-[11px] text-muted-foreground block">Monitoring engine logs all freeze/unfreeze events.</span>
                      </div>
                    </div>
                    <Switch defaultChecked />
                  </div>

                  <div className="flex items-center justify-between border-t border-hairline pt-6">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-md bg-muted flex items-center justify-center">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="space-y-0.5">
                        <span className="text-[13px] font-medium block">Freeze Alert Webhook</span>
                        <span className="text-[11px] text-muted-foreground block">POST to monitoring engine's /api/freeze-alert.</span>
                      </div>
                    </div>
                    <Switch defaultChecked />
                  </div>

                  <div className="space-y-3 pt-6 border-t border-hairline">
                    <Label className="text-[13px] font-medium">Monitoring Engine URL</Label>
                    <div className="flex gap-2">
                      <Input
                        defaultValue={ENGINE_URL}
                        readOnly
                        className="bg-background border-hairline h-10 font-mono text-[12px]"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-10 px-4 shrink-0"
                        onClick={async () => {
                          try {
                            const res = await fetch(`${ENGINE_URL}/api/status`);
                            if (res.ok) toast.success("Engine online ✅", { description: "Connected to monitoring engine." });
                            else toast.error("Engine returned non-OK response");
                          } catch {
                            toast.error("Engine unreachable", { description: "Start monitoring-engine first." });
                          }
                        }}
                      >
                        Ping
                      </Button>
                    </div>
                  </div>
                </div>
              </motion.section>

            </div>
          </div>
        </main>
        
      </div>
    </div>
  );
};

export default Settings;
