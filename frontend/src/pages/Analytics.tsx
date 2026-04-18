import * as React from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { useThreat } from "@/context/ThreatContext";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { StatCard } from "@/components/dashboard/StatCard";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell,
} from "recharts";
import { TrendingUp, Shield, Zap, Activity } from "lucide-react";

const Analytics = () => {
  const { threat, status, candles, totalDeposits, freezeCount, depositCount, withdrawCount, txHistory } = useThreat();
  const frozen = status === "FROZEN";

  // Build threat history from candle timestamps (derived)
  const threatHistory = React.useMemo(() => {
    return candles.slice(-30).map((c, i) => ({
      time: i,
      level: c.threatScore ?? 0,
    }));
  }, [candles]);

  // Blocked attacks per 5-min window (from real event count)
  const attackBarData = React.useMemo(() => {
    const labels = ["T-30m", "T-25m", "T-20m", "T-15m", "T-10m", "T-5m", "Now"];
    const now = Date.now();
    const BUCKET_MS = 5 * 60 * 1000;
    
    return labels.map((day, i) => {
      const bucketEnd = now - (labels.length - 1 - i) * BUCKET_MS;
      const bucketStart = bucketEnd - BUCKET_MS;
      const bucketFreezes = txHistory.filter(t => t.type === "Freeze" && t.timestamp >= bucketStart && t.timestamp < bucketEnd).length;
      return {
        day,
        attacks: bucketFreezes,
      };
    });
  }, [txHistory]);

  // Vault composition: VLT only (single token)
  const totalValue = totalDeposits;

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-foreground">
      <Sidebar />
      <div className="relative flex flex-1 flex-col overflow-hidden">
        <Topbar status={status} />
        <main className="scrollbar-thin relative flex-1 overflow-y-auto">
          <div className="pointer-events-none absolute inset-0 bg-grid opacity-[0.35]" />
          <div className="relative mx-auto w-full max-w-[1400px] px-6 py-6">

            <header className="mb-6">
              <h2 className="text-[20px] font-semibold tracking-tight">Deep Analytics</h2>
              <p className="mt-1 text-[12px] text-muted-foreground">
                Real on-chain metrics from LiquidityVault · Guardian threat intelligence
              </p>
            </header>

            <section className="grid grid-cols-2 gap-4 md:grid-cols-4 mb-8">
              <StatCard
                label="Vault TVL"
                value={`${totalDeposits.toFixed(1)} VLT`}
                delta={depositCount > 0 ? `${depositCount} deposits` : "Empty"}
                positive={totalDeposits > 0}
              />
              <StatCard
                label="Vault State"
                value={frozen ? "FROZEN" : "ACTIVE"}
                delta={frozen ? "Circuit breaker" : "Normal"}
                positive={!frozen}
              />
              <StatCard
                label="Freezes Fired"
                value={freezeCount.toString()}
                delta={freezeCount > 0 ? "Attack intercepted" : "No attacks"}
                positive={freezeCount === 0}
              />
              <StatCard
                label="Threat Index"
                value={`${threat.toFixed(1)}`}
                delta={threat > 80 ? "Critical" : threat > 50 ? "Elevated" : "Stable"}
                positive={threat < 50}
              />
            </section>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {/* Threat Level History */}
              <motion.div
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                className="rounded-lg border border-hairline bg-card p-6"
              >
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    <h3 className="text-[14px] font-semibold">Threat Intensity (Live)</h3>
                  </div>
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">On-chain heuristics</span>
                </div>
                <div className="h-[240px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={threatHistory} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="threatGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="hsl(var(--critical))" stopOpacity={0.4} />
                          <stop offset="50%" stopColor="hsl(var(--warning))"  stopOpacity={0.2} />
                          <stop offset="95%" stopColor="hsl(var(--primary))"  stopOpacity={0.1} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--hairline))" />
                      <XAxis hide />
                      <YAxis domain={[0, 100]} axisLine={false} tickLine={false}
                        tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                        ticks={[0, 25, 50, 75, 100]}
                      />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload?.length) {
                            const val = payload[0].value as number;
                            return (
                              <div className="rounded-lg border border-hairline bg-card p-2 shadow-xl">
                                <div className="text-[10px] uppercase text-muted-foreground mb-1">Threat Level</div>
                                <div className={cn(
                                  "text-[14px] font-bold",
                                  val > 80 ? "text-critical" : val > 50 ? "text-warning" : "text-primary"
                                )}>
                                  {val.toFixed(1)}%
                                </div>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Area
                        type="monotone" dataKey="level"
                        stroke="hsl(var(--critical))" fill="url(#threatGradient)"
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </motion.div>

              {/* Vault Freezes */}
              <motion.div
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                className="rounded-lg border border-hairline bg-card p-6"
              >
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-critical" />
                    <h3 className="text-[14px] font-semibold">Circuit Breaker Events</h3>
                  </div>
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    {freezeCount} total freeze{freezeCount !== 1 ? "s" : ""}
                  </span>
                </div>
                <div className="h-[240px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={attackBarData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--hairline))" />
                      <XAxis dataKey="day" axisLine={false} tickLine={false}
                        tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                      />
                      <YAxis hide />
                      <Tooltip
                        content={({ active, payload, label }) => {
                          if (active && payload?.length) {
                            return (
                              <div className="rounded-lg border border-hairline bg-card p-2 shadow-xl">
                                <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
                                <div className="text-[13px] font-mono font-bold">{payload[0].value} freeze{payload[0].value !== 1 ? "s" : ""}</div>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Bar dataKey="attacks" radius={[4, 4, 0, 0]}>
                        {attackBarData.map((entry, i) => (
                          <Cell
                            key={i}
                            fill={entry.attacks > 2 ? "hsl(var(--critical))" : entry.attacks > 0 ? "hsl(var(--warning))" : "hsl(var(--success))"}
                            fillOpacity={0.8}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </motion.div>
            </div>

            {/* Vault Stats + Response Metrics */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Vault Composition */}
              <motion.div
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                className="rounded-lg border border-hairline bg-card p-6"
              >
                <div className="flex items-center gap-2 mb-6">
                  <Zap className="h-4 w-4 text-warning" />
                  <h3 className="text-[14px] font-semibold">Vault Composition</h3>
                </div>
                <div className="flex flex-col items-center justify-center h-[160px]">
                  <div className="text-[40px] font-bold tabular">{totalValue.toFixed(1)}</div>
                  <div className="text-[12px] text-muted-foreground mt-1">VLT Total Locked</div>
                  <div className="mt-4 flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-primary" />
                    <span className="text-[12px]">VLT (100%)</span>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-hairline grid grid-cols-2 gap-2 text-center">
                  <div>
                    <div className="text-[20px] font-bold tabular text-success">{depositCount}</div>
                    <div className="text-[11px] text-muted-foreground">Deposits</div>
                  </div>
                  <div>
                    <div className="text-[20px] font-bold tabular text-primary">{withdrawCount}</div>
                    <div className="text-[11px] text-muted-foreground">Withdrawals</div>
                  </div>
                </div>
              </motion.div>

              {/* Response metrics */}
              <motion.div
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
                className="lg:col-span-2 rounded-lg border border-hairline bg-card p-6"
              >
                <div className="flex items-center gap-2 mb-6">
                  <Activity className="h-4 w-4 text-success" />
                  <h3 className="text-[14px] font-semibold">Response Metrics</h3>
                </div>
                <div className="space-y-6">
                  {[
                    { label: "Vault Health",           value: frozen ? "FROZEN" : "Operational",  progress: frozen ? 10 : 100 },
                    { label: "Liquidity Utilization",  value: `${((withdrawCount / Math.max(depositCount, 1)) * 100).toFixed(0)}%`, progress: Math.min(100, (withdrawCount / Math.max(depositCount, 1)) * 100) },
                    { label: "Guardian Coverage",      value: "100%",  progress: 100 },
                    { label: "Threat Score (Current)", value: `${threat.toFixed(1)} / 100`, progress: threat },
                  ].map(item => (
                    <div key={item.label}>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-[12px] text-muted-foreground">{item.label}</span>
                        <span className={cn("text-[12px] font-mono font-semibold",
                          frozen && item.label === "Vault Health" ? "text-critical" : ""
                        )}>{item.value}</span>
                      </div>
                      <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${item.progress}%` }}
                          transition={{ duration: 1, delay: 0.5 }}
                          className={cn("h-full",
                            item.progress > 80 ? "bg-critical" :
                            item.progress > 50 ? "bg-warning" : "bg-primary"
                          )}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            </div>

          </div>
        </main>
        
      </div>
    </div>
  );
};

export default Analytics;
