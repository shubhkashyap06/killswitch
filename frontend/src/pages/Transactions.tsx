import * as React from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { useThreat } from "@/context/ThreatContext";
import { type TxRecord } from "@/hooks/useVaultEvents";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/dashboard/StatCard";
import { ArrowLeftRight, ExternalLink, Search, Download, Activity } from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const Transactions = () => {
  const { status, totalDeposits, depositCount, withdrawCount, freezeCount, txHistory } = useThreat();
  const frozen = status === "FROZEN";

  const [search, setSearch] = React.useState("");

  const filtered = txHistory.filter(tx =>
    !search ||
    tx.txHash.toLowerCase().includes(search.toLowerCase()) ||
    tx.user.toLowerCase().includes(search.toLowerCase()) ||
    tx.type.toLowerCase().includes(search.toLowerCase())
  );

  // Build volume chart from real tx history (last 8 buckets of ~5 minutes each)
  const volumeData = React.useMemo(() => {
    const now = Date.now();
    const buckets: { time: string; inflow: number; outflow: number }[] = [];
    const BUCKET_MS = 5 * 60 * 1000;
    const NUM_BUCKETS = 8;

    for (let i = NUM_BUCKETS; i >= 0; i--) {
      const bucketStart = now - i * BUCKET_MS;
      const bucketEnd   = now - (i - 1) * BUCKET_MS;
      const label       = new Date(bucketStart).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      const inflow  = txHistory.filter(t => t.timestamp >= bucketStart && t.timestamp < bucketEnd && t.type === "Deposit").reduce((s, t) => s + t.amount, 0);
      const outflow = txHistory.filter(t => t.timestamp >= bucketStart && t.timestamp < bucketEnd && t.type === "Withdraw").reduce((s, t) => s + t.amount, 0);
      buckets.push({ time: label, inflow: Math.round(inflow * 100) / 100, outflow: Math.round(outflow * 100) / 100 });
    }
    return buckets;
  }, [txHistory]);

  const totalVolume = txHistory.reduce((s, t) => s + t.amount, 0);
  const blockedCount = txHistory.filter(t => t.status === "Blocked" || t.status === "Suspicious").length;

  const handleExport = () => {
    const headers = ["TX Hash", "Type", "Amount (VLT)", "User", "Status", "Threat", "Block", "Time"];
    const rows = filtered.map(tx => [
      tx.txHash,
      tx.type,
      tx.amount.toFixed(4),
      tx.user,
      tx.status,
      tx.threat,
      tx.blockNumber.toString(),
      new Date(tx.timestamp).toISOString(),
    ]);
    const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url  = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `vault_txs_${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Exported", { description: `${filtered.length} real on-chain transactions exported.` });
  };

  const relativeTime = (ts: number) => {
    const diff = Date.now() - ts;
    if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`;
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
    return new Date(ts).toLocaleTimeString();
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-foreground">
      <Sidebar />
      <div className="relative flex flex-1 flex-col overflow-hidden">
        <Topbar status={status} />
        <main className="scrollbar-thin relative flex-1 overflow-y-auto">
          <div className="pointer-events-none absolute inset-0 bg-grid opacity-[0.35]" />
          <div className="relative mx-auto w-full max-w-[1400px] px-6 py-6">

            <header className="mb-6 flex items-end justify-between">
              <div>
                <h2 className="text-[20px] font-semibold tracking-tight">Transaction Ledger</h2>
                <p className="mt-1 text-[12px] text-muted-foreground">
                  Real on-chain events from Hardhat LiquidityVault · Deposit, Withdraw, Freeze
                </p>
              </div>
              <div className="hidden items-center gap-4 md:flex">
                <div className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
                  <span className="font-mono text-[12px]">
                    {txHistory.length} tx on-chain
                  </span>
                </div>
              </div>
            </header>

            <section className="grid grid-cols-2 gap-4 md:grid-cols-4 mb-6">
              <StatCard label="Total Volume"  value={`${totalVolume.toFixed(1)} VLT`} delta={`${txHistory.length} txns`} positive />
              <StatCard label="Deposits"      value={depositCount.toString()}   delta={`${depositCount} events`}  positive />
              <StatCard label="Withdrawals"   value={withdrawCount.toString()}  delta={`${withdrawCount} events`} positive={true} />
              <StatCard label="Blocked/Susp." value={blockedCount.toString()}   delta={`${freezeCount} freezes`}  positive={blockedCount === 0} />
            </section>

            {/* Volume Chart */}
            <motion.div
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}
              className="rounded-lg border border-hairline bg-card p-6 mb-6"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-[14px] font-semibold tracking-tight">Vault Activity Volume (Real-Time)</h3>
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-success" />
                    <span className="text-[11px] text-muted-foreground uppercase tracking-widest">Inflow</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-primary" />
                    <span className="text-[11px] text-muted-foreground uppercase tracking-widest">Outflow</span>
                  </div>
                </div>
              </div>
              <div className="h-[200px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={volumeData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorInflow" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="hsl(var(--success))" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="hsl(var(--success))" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorOutflow" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="hsl(var(--primary))" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--hairline))" />
                    <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload?.length) {
                          return (
                            <div className="rounded-lg border border-hairline bg-card/90 p-3 shadow-xl backdrop-blur-md">
                              <div className="text-[10px] uppercase text-muted-foreground mb-2 font-bold">VLT Flow</div>
                              <div className="space-y-1">
                                <div className="flex items-center justify-between gap-6">
                                  <div className="flex items-center gap-1.5"><div className="h-1.5 w-1.5 bg-success rounded-full" /><span className="text-[12px]">Inflow</span></div>
                                  <span className="text-[12px] font-mono font-bold">{payload[0]?.value} VLT</span>
                                </div>
                                <div className="flex items-center justify-between gap-6">
                                  <div className="flex items-center gap-1.5"><div className="h-1.5 w-1.5 bg-primary rounded-full" /><span className="text-[12px]">Outflow</span></div>
                                  <span className="text-[12px] font-mono font-bold">{payload[1]?.value} VLT</span>
                                </div>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Area type="monotone" dataKey="inflow"  stroke="hsl(var(--success))" fill="url(#colorInflow)"  strokeWidth={2} />
                    <Area type="monotone" dataKey="outflow" stroke="hsl(var(--primary))" fill="url(#colorOutflow)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </motion.div>

            {/* TX Table */}
            <motion.div
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.1 }}
              className="rounded-lg border border-hairline bg-card overflow-hidden"
            >
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-hairline px-4 py-4 bg-muted/30 gap-4">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-[12px] font-semibold tracking-tight">On-Chain Events</h3>
                  <span className="text-[10px] text-muted-foreground">({txHistory.length} total)</span>
                </div>
                <div className="flex w-full sm:w-auto items-center gap-2">
                  <div className="relative flex-1 sm:w-64">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Search tx hash or address..."
                      className="h-8 pl-8 text-[11px] bg-background border-hairline w-full"
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                    />
                  </div>
                  <Button variant="outline" size="sm" className="h-8 gap-2 border-hairline text-[11px]" onClick={handleExport}>
                    <Download className="h-3 w-3" />
                    <span className="hidden xs:inline">Export</span>
                  </Button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <div className="min-w-[800px]">
                  {filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                      <ArrowLeftRight className="h-8 w-8 mb-3 opacity-30" />
                      <p className="text-[13px]">
                        {txHistory.length === 0
                          ? "No on-chain transactions yet — make a deposit or withdrawal."
                          : "No transactions match your search."}
                      </p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent bg-muted/10">
                          <TableHead className="w-[160px] text-[11px] uppercase tracking-wider">TX Hash</TableHead>
                          <TableHead className="text-[11px] uppercase tracking-wider">Type</TableHead>
                          <TableHead className="text-[11px] uppercase tracking-wider">Amount (VLT)</TableHead>
                          <TableHead className="text-[11px] uppercase tracking-wider">User</TableHead>
                          <TableHead className="text-[11px] uppercase tracking-wider">Status</TableHead>
                          <TableHead className="text-[11px] uppercase tracking-wider">Threat</TableHead>
                          <TableHead className="text-right text-[11px] uppercase tracking-wider">Time</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filtered.map(tx => (
                          <TableRow key={tx.id} className="group cursor-pointer">
                            <TableCell className="font-mono text-[11px] text-primary">
                              <div className="flex items-center gap-2">
                                {tx.txHash.slice(0, 10)}…{tx.txHash.slice(-6)}
                                <a
                                  href={`http://localhost:8545`}
                                  target="_blank" rel="noopener noreferrer"
                                  title="Copy TX Hash"
                                  onClick={e => { e.preventDefault(); navigator.clipboard.writeText(tx.txHash); toast.info("TX hash copied!"); }}
                                >
                                  <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground" />
                                </a>
                              </div>
                            </TableCell>
                            <TableCell className="text-[12px] font-medium">
                              <Badge variant="outline" className={cn(
                                "text-[10px] font-bold px-2 h-5",
                                tx.type === "Deposit"  && "border-success/30 bg-success/5 text-success",
                                tx.type === "Withdraw" && "border-primary/30 bg-primary/5 text-primary",
                                tx.type === "Freeze"   && "border-critical/40 bg-critical/5 text-critical",
                                tx.type === "Unfreeze" && "border-warning/30 bg-warning/5 text-warning",
                              )}>
                                {tx.type}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-[12px] font-mono">
                              {tx.amount > 0 ? tx.amount.toFixed(4) : "—"}
                            </TableCell>
                            <TableCell className="font-mono text-[11px] text-muted-foreground">
                              {tx.user.slice(0, 8)}…{tx.user.slice(-4)}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={cn(
                                "text-[10px] font-bold px-2 h-5",
                                tx.status === "Confirmed"  && "border-success/30 bg-success/5 text-success",
                                tx.status === "Suspicious" && "border-warning/30 bg-warning/5 text-warning",
                                tx.status === "Blocked"    && "border-critical/40 bg-critical/5 text-critical",
                              )}>
                                {tx.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <div className="h-1 w-12 rounded-full bg-muted overflow-hidden">
                                  <div className={cn(
                                    "h-full rounded-full",
                                    tx.threat === "Low"      && "bg-success w-1/4",
                                    tx.threat === "Moderate" && "bg-warning w-1/2",
                                    tx.threat === "High"     && "bg-critical w-full",
                                  )} />
                                </div>
                                <span className="text-[11px] text-muted-foreground font-mono">{tx.threat}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right text-[11px] text-muted-foreground font-mono">
                              {relativeTime(tx.timestamp)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        </main>
        
      </div>
    </div>
  );
};

export default Transactions;
