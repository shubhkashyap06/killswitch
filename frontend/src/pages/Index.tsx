import * as React from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { ThreatMeter } from "@/components/dashboard/ThreatMeter";
import { CandleChart } from "@/components/dashboard/CandleChart";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import { StatCard } from "@/components/dashboard/StatCard";
import { EmergencyWithdrawModal } from "@/components/dashboard/EmergencyWithdrawModal";
import { useThreat } from "@/context/ThreatContext";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { PlusCircle, ArrowUpCircle } from "lucide-react";
import { useWriteContract, useAccount, useSwitchChain } from "wagmi";
import { parseEther } from "viem";
import VaultABI from "@/lib/abis/LiquidityVault.json";
import TokenABI from "@/lib/abis/KillswitchToken.json";
import { VAULT_ADDRESS, TOKEN_ADDRESS, CHAIN_ID } from "@/lib/constants";
import { cn } from "@/lib/utils";

const Index = () => {
  const {
    threat, status, events, candles, freezeThreshold,
    totalDeposits, maxWithdrawBps, freezeCount, depositCount, withdrawCount,
    userVaultBalance, userTokenBalance,
  } = useThreat();
  const frozen = status === "FROZEN";

  const [blockNum, setBlockNum] = React.useState<number | null>(null);
  React.useEffect(() => {
    // Show a live block number (ethers query)
    const tick = () => {
      fetch("http://127.0.0.1:8545", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", method: "eth_blockNumber", params: [], id: 1 }),
      })
        .then(r => r.json())
        .then(d => setBlockNum(parseInt(d.result, 16)))
        .catch(() => {});
    };
    tick();
    const id = setInterval(tick, 3000);
    return () => clearInterval(id);
  }, []);

  const avgResponseMs = freezeCount > 0
    ? Math.round(800 + Math.random() * 200)   // can replace with real latency tracking
    : 0;

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-foreground">
      <Sidebar />
      <div className="relative flex flex-1 flex-col overflow-hidden">
        <Topbar status={status} />
        <main className="scrollbar-thin relative flex-1 overflow-y-auto">
          {frozen && (
            <div className="absolute inset-0 z-0 bg-critical/5 pointer-events-none transition-colors duration-1000" />
          )}
          <div className="pointer-events-none absolute inset-0 z-0 bg-grid opacity-[0.35]" />
          
          <div className="relative z-10 mx-auto w-full max-w-[1400px] px-6 py-6">

            {/* Global Freeze Banner */}
            {frozen && (
              <motion.div 
                initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
                className="mb-6 flex items-center justify-between overflow-hidden rounded-lg border border-critical/30 bg-critical/10 shadow-[0_0_20px_rgba(255,0,0,0.1)]"
              >
                <div className="flex flex-1 items-center gap-4 px-4 py-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-critical/20 animate-pulse">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="hsl(var(--critical))" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="12" y1="2" x2="12" y2="12"></line>
                      <line x1="12" y1="16" x2="12.01" y2="16"></line>
                      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-[13px] font-bold tracking-widest text-critical uppercase">System Frozen</h3>
                    <p className="text-[11px] text-muted-foreground mt-0.5">The Guardian AI has engaged the circuit breaker. Withdrawals are halted. Emergency unstaking remains active.</p>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Page heading */}
            <header className="mb-6 flex items-end justify-between">
              <div>
                <h2 className="text-[20px] font-semibold tracking-tight">Security Console</h2>
                <p className="mt-1 text-[12px] text-muted-foreground">
                  Real-time on-chain threat detection · automatic vault circuit breaker
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="mr-4 hidden items-center gap-2 md:flex border-r border-hairline pr-4">
                  <span className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Last block</span>
                  <span className="font-mono text-[12px] tabular">
                    {blockNum != null ? `#${blockNum.toLocaleString()}` : "…"}
                  </span>
                </div>
                <EmergencyWithdrawModal userVaultBalance={userVaultBalance} />
                <VaultAction type="deposit"  frozen={frozen} userTokenBalance={userTokenBalance} />
                <VaultAction type="withdraw" frozen={frozen} userVaultBalance={userVaultBalance} totalDeposits={totalDeposits} maxWithdrawBps={maxWithdrawBps} />
              </div>
            </header>

            {/* Stat row */}
            <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <StatCard
                label="TVL (VLT)"
                value={totalDeposits > 0 ? `${totalDeposits.toFixed(1)} VLT` : "0 VLT"}
                delta={depositCount > 0 ? `${depositCount} deposits` : "No deposits yet"}
                positive
                hint="Total value locked"
              />
              <StatCard
                label="Your Deposit"
                value={`${userVaultBalance.toFixed(2)} VLT`}
                delta={userTokenBalance > 0 ? `${userTokenBalance.toFixed(2)} VLT wallet` : "0 VLT wallet"}
                positive
                hint="Your vault balance"
              />
              <StatCard
                label="Threats Blocked"
                value={freezeCount.toString()}
                delta={freezeCount > 0 ? "Circuit breakers fired" : "None yet"}
                positive={freezeCount === 0}
                hint="Vault freeze events"
              />
              <StatCard
                label="Withdraw Cap"
                value={`${(maxWithdrawBps / 100).toFixed(0)}%`}
                delta={`Max ${((totalDeposits * maxWithdrawBps) / 10000).toFixed(1)} VLT`}
                positive
                hint="Per-tx limit"
              />
            </section>

            {/* Threat meter row */}
            <section className="mt-6">
              <motion.div
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}
                className="rounded-lg border border-hairline bg-card"
              >
                <div className="flex items-center justify-between border-b border-hairline px-4 py-3">
                  <h3 className="text-[12px] font-semibold tracking-tight">Threat Detection</h3>
                  <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Live · On-Chain</span>
                </div>
                <div className="flex flex-col items-center px-4 py-6">
                  <ThreatMeter value={threat} threshold={freezeThreshold} />
                  <div className="mt-6 grid w-full grid-cols-3 gap-3 border-t border-hairline pt-4 text-center">
                    <Mini label="Deposits"  value={depositCount.toString()}  tone="success" />
                    <Mini label="Withdraws" value={withdrawCount.toString()} tone={withdrawCount > 5 ? "warning" : "success"} />
                    <Mini label="Freezes"   value={freezeCount.toString()}   tone={freezeCount > 0 ? "critical" : "success"} />
                  </div>
                </div>
              </motion.div>
            </section>

            {/* Liquidity chart — full width, tall */}
            <section className="mt-4">
              <motion.div
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.05 }}
                className="rounded-lg border border-hairline bg-card"
              >
                <div className="flex items-center justify-between border-b border-hairline px-5 py-3">
                  <h3 className="text-[12px] font-semibold tracking-tight">Liquidity · VLT Vault</h3>
                  <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                    {frozen ? "⚠ FROZEN" : "Live · On-Chain"}
                  </span>
                </div>
                <div className="px-5 py-5">
                  <CandleChart data={candles} frozen={frozen} />
                </div>
              </motion.div>
            </section>

            {/* Activity + Policy */}
            <section className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
              <motion.div
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.1 }}
                className="rounded-lg border border-hairline bg-card lg:col-span-2"
                style={{ height: 360 }}
              >
                <ActivityFeed events={events} />
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.15 }}
                className="rounded-lg border border-hairline bg-card"
              >
                <div className="border-b border-hairline px-4 py-3">
                  <h3 className="text-[12px] font-semibold tracking-tight">Guardian Policy</h3>
                </div>
                <ul className="divide-y divide-hairline">
                  <PolicyRow label="Auto-freeze threshold" value={`${freezeThreshold}`} />
                  <PolicyRow label="Max withdraw"          value={`${(maxWithdrawBps / 100).toFixed(0)}%`} />
                  <PolicyRow label="Freeze duration"       value="1h (3600s)" />
                  <PolicyRow label="Signers required"      value="1 Guardian" />
                  <PolicyRow label="Vault state"           value={frozen ? "🔒 FROZEN" : "✅ Active"} />
                </ul>
                <div className="px-4 py-3">
                  <span className="text-[11px] text-muted-foreground">
                    VAULT: {VAULT_ADDRESS.slice(0, 14)}…
                  </span>
                </div>
              </motion.div>
            </section>

          </div>
        </main>
        
      </div>
    </div>
  );
};

function Mini({ label, value, tone }: { label: string; value: string; tone: "success" | "warning" | "critical" }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
      <div className={
        "mt-1 font-mono text-[13px] font-medium " +
        (tone === "success" ? "text-success" : tone === "warning" ? "text-warning" : "text-critical")
      }>
        {value}
      </div>
    </div>
  );
}

function PolicyRow({ label, value }: { label: string; value: string }) {
  return (
    <li className="flex items-center justify-between px-4 py-2.5">
      <span className="text-[12px] text-muted-foreground">{label}</span>
      <span className="font-mono text-[12px] font-medium tabular">{value}</span>
    </li>
  );
}

// ── VaultAction — real on-chain deposit / withdraw ────────────────────────────
interface VaultActionProps {
  type: "deposit" | "withdraw";
  frozen?: boolean;
  userTokenBalance?: number;
  userVaultBalance?: number;
  totalDeposits?: number;
  maxWithdrawBps?: number;
}

function VaultAction({
  type, frozen = false,
  userTokenBalance = 0, userVaultBalance = 0,
  totalDeposits = 0, maxWithdrawBps = 3000,
}: VaultActionProps) {
  const [amount, setAmount]   = React.useState("");
  const [open, setOpen]       = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [step, setStep]       = React.useState("");

  const { writeContractAsync }  = useWriteContract();
  const { switchChainAsync }    = useSwitchChain();
  const { chainId }             = useAccount();

  const maxAllowed = (totalDeposits * maxWithdrawBps) / 10_000;
  const availableBalance = type === "deposit" ? userTokenBalance : userVaultBalance;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (!amount || isNaN(amt) || amt <= 0) {
      toast.error("Enter a valid amount");
      return;
    }

    if (type === "withdraw") {
      if (amt > userVaultBalance) { toast.error("Insufficient deposited balance"); return; }
      if (totalDeposits > 0 && amt > maxAllowed) {
        toast.error(`Exceeds 30% withdraw cap. Max: ${maxAllowed.toFixed(2)} VLT`);
        return;
      }
    }
    if (type === "deposit" && amt > userTokenBalance) {
      toast.error("Insufficient VLT token balance");
      return;
    }

    setLoading(true);
    try {
      console.log(`Starting ${type} transaction for ${amount} VLT...`);
      
      // Step 0: Ensure we are on the right chain
      if (chainId !== CHAIN_ID) {
        setStep("Wait: Switching MetaMask to Hardhat (31337)...");
        try {
          await switchChainAsync({ chainId: CHAIN_ID });
        } catch (switchError: any) {
          console.error("Chain switch failed", switchError);
          toast.error("Please switch your MetaMask to the Hardhat network manually.");
          return;
        }
      }

      const parsed = parseEther(amount);

      if (type === "deposit") {
        setStep("Step 1/2: Approve VLT in MetaMask...");
        const approveTx = await writeContractAsync({
          chainId: CHAIN_ID,
          address: TOKEN_ADDRESS,
          abi: TokenABI.abi as any,
          functionName: "approve",
          args: [VAULT_ADDRESS, parsed],
        });
        console.log("Approval TX:", approveTx);

        setStep("Step 2/2: Confirm Deposit in MetaMask...");
        const depositTx = await writeContractAsync({
          chainId: CHAIN_ID,
          address: VAULT_ADDRESS,
          abi: VaultABI.abi as any,
          functionName: "deposit",
          args: [parsed],
        });
        console.log("Deposit TX:", depositTx);
        toast.success(`Successfully deposited ${amt} VLT!`);
      } else {
        setStep("Confirm Withdrawal in MetaMask...");
        const withdrawTx = await writeContractAsync({
          chainId: CHAIN_ID,
          address: VAULT_ADDRESS,
          abi: VaultABI.abi as any,
          functionName: "withdraw",
          args: [parsed],
        });
        console.log("Withdrawal TX:", withdrawTx);
        toast.success(`Successfully withdrew ${amt} VLT!`);
      }

      setOpen(false);
      setAmount("");
    } catch (err: any) {
      console.error("Transaction Error:", err);
      const msg = err?.shortMessage || err?.message || "Transaction failed";
      toast.error(msg.slice(0, 120));
    } finally {
      setLoading(false);
      setStep("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant={type === "deposit" ? "default" : "outline"}
          size="sm"
          disabled={frozen && type !== "deposit"}
          className={cn(
            "h-9 gap-2 px-4 text-[12px] font-semibold transition-all",
            type === "deposit" && "bg-primary hover:bg-primary/90",
            type === "withdraw" && "border-hairline hover:bg-secondary"
          )}
        >
          {type === "deposit" ? <PlusCircle className="h-4 w-4" /> : <ArrowUpCircle className="h-4 w-4" />}
          {type.charAt(0).toUpperCase() + type.slice(1)}
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-[425px] border-hairline bg-card">
        <DialogHeader>
          <DialogTitle className="text-[18px] font-semibold">
            {type === "deposit" ? "Deposit VLT" : "Withdraw VLT"}
          </DialogTitle>
          <DialogDescription className="text-[13px]">
            {type === "deposit"
              ? "Add VLT liquidity to the vault. Your tokens will be protected by Guardian v3.2."
              : `Remove VLT from the vault. Max single withdrawal: ${(maxWithdrawBps / 100).toFixed(0)}% of pool (${maxAllowed.toFixed(2)} VLT).`}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 py-4">
          <div className="space-y-2">
            <Label htmlFor={`amount-${type}`} className="text-[12px] font-medium text-muted-foreground uppercase tracking-wider">
              Amount (VLT)
            </Label>
            <div className="relative">
              <Input
                id={`amount-${type}`}
                type="number"
                step="0.01"
                placeholder="0.00"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                className="h-12 bg-background border-hairline text-[16px] font-mono pr-16"
                required
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setAmount(availableBalance.toFixed(4))}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-bold text-muted-foreground bg-muted px-2 py-1 rounded hover:text-primary transition-colors"
              >
                MAX
              </button>
            </div>
            <div className="flex justify-between text-[11px] text-muted-foreground">
              <span>
                {type === "deposit"
                  ? `Wallet balance: ${userTokenBalance.toFixed(4)} VLT`
                  : `Vault balance:  ${userVaultBalance.toFixed(4)} VLT`}
              </span>
              {type === "withdraw" && totalDeposits > 0 && (
                <span>Cap: {maxAllowed.toFixed(2)} VLT</span>
              )}
            </div>
          </div>

          {step && (
            <div className="rounded-md bg-primary/5 border border-primary/20 px-3 py-2 text-[12px] text-primary font-medium">
              {step}
            </div>
          )}

          <DialogFooter>
            <Button
              type="submit"
              disabled={loading || (frozen && type === "withdraw")}
              className="w-full h-11 text-[14px] font-bold uppercase tracking-widest bg-primary hover:bg-primary/90"
            >
              {loading ? step || "Processing…" : `Confirm ${type}`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default Index;
