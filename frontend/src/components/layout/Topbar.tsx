import * as React from "react";
import { useAccount } from "wagmi";
import { WalletButton } from "@/components/wallet/WalletButton";
import { cn } from "@/lib/utils";
import type { SystemStatus } from "@/hooks/useThreatSimulation";
import { ShieldAlert, ShieldCheck, Lock, Unlock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ENGINE_URL } from "@/lib/constants";

interface TopbarProps {
  status: SystemStatus;
}

export function Topbar({ status }: TopbarProps) {
  const { address, isConnected } = useAccount();
  const frozen = status === "FROZEN";
  const [loading, setLoading] = React.useState(false);

  const handleFreeze = async () => {
    setLoading(true);
    try {
      const res  = await fetch(`${ENGINE_URL}/api/execute-freeze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Manual freeze via Topbar" }),
      });
      const data = await res.json();
      if (data.success) toast.success("Vault frozen on-chain");
      else toast.info(data.message || "Already frozen");
    } catch {
      toast.error("Engine unreachable — is monitoring-engine running?");
    }
    setLoading(false);
  };

  const handleUnfreeze = async () => {
    setLoading(true);
    try {
      const res  = await fetch(`${ENGINE_URL}/api/execute-unfreeze`, { method: "POST" });
      const data = await res.json();
      if (data.success) toast.success("Vault unfrozen", { description: `TX: ${data.txHash?.slice(0, 20)}…` });
      else toast.error(`Unfreeze failed: ${data.error}`);
    } catch {
      toast.error("Engine unreachable — is monitoring-engine running?");
    }
    setLoading(false);
  };

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-hairline bg-background/80 backdrop-blur-md px-6">
      {/* Status Pill */}
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-widest transition-colors",
            frozen
              ? "bg-critical/10 text-critical border border-critical/20"
              : "bg-success/10 text-success border border-success/20"
          )}
        >
          {frozen ? (
            <ShieldAlert className="h-3 w-3 shrink-0 animate-blink" />
          ) : (
            <ShieldCheck className="h-3 w-3 shrink-0" />
          )}
          {frozen ? "VAULT FROZEN" : "GUARDIAN ACTIVE"}
        </div>

        {/* Block indicator */}
        {isConnected && (
          <div className="hidden md:flex items-center gap-2 text-[11px] text-muted-foreground border border-hairline rounded-full px-3 py-1">
            <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
            <span className="font-mono">Hardhat · Chain 31337</span>
          </div>
        )}
      </div>

      {/* Right: Admin Actions + Wallet */}
      <div className="flex items-center gap-2">
        {/* Manual Freeze button — always visible */}
        <Button
          variant="outline"
          size="sm"
          disabled={loading || frozen}
          onClick={handleFreeze}
          className={cn(
            "h-8 gap-1.5 text-[11px] border-hairline font-semibold transition-all",
            !frozen && "hover:border-critical/40 hover:text-critical hover:bg-critical/5"
          )}
        >
          <Lock className="h-3 w-3" />
          <span className="hidden sm:inline">Freeze</span>
        </Button>

        {/* Emergency Unfreeze — only when frozen */}
        {frozen && (
          <Button
            variant="outline"
            size="sm"
            disabled={loading}
            onClick={handleUnfreeze}
            className="h-8 gap-1.5 text-[11px] border-success/30 text-success hover:bg-success/5 font-semibold"
          >
            <Unlock className="h-3 w-3" />
            <span className="hidden sm:inline">Unfreeze</span>
          </Button>
        )}

        {/* Wallet */}
        <div className="ml-2 h-5 w-px bg-hairline" />
        <WalletButton />
      </div>
    </header>
  );
}
