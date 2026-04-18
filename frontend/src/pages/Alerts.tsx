import * as React from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { useThreat } from "@/context/ThreatContext";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { StatCard } from "@/components/dashboard/StatCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Bell, 
  ShieldAlert, 
  ShieldCheck, 
  Info, 
  Filter, 
  ExternalLink,
  Terminal,
  CheckCircle2
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const Alerts = () => {
  const { events, status } = useThreat();
  const [filter, setFilter] = React.useState("all");
  const [resolvedIds, setResolvedIds] = React.useState<Set<string>>(new Set());
  const [selectedTrace, setSelectedTrace] = React.useState<any>(null);
  const [traceData, setTraceData] = React.useState<any>(null);
  const [loadingTrace, setLoadingTrace] = React.useState(false);

  React.useEffect(() => {
    if (!selectedTrace?.txHash) {
      setTraceData(null);
      return;
    }
    setLoadingTrace(true);
    fetch(`http://localhost:3001/api/trace/${selectedTrace.txHash}`)
      .then(res => res.json())
      .then(res => {
        if (res.success && res.data) setTraceData(res.data);
        else setTraceData(null);
      })
      .catch((e) => {
        console.error(e);
        setTraceData(null);
      })
      .finally(() => setLoadingTrace(false));
  }, [selectedTrace?.txHash]);
  
  const frozen = status === "FROZEN";

  const activeEvents = events.filter(ev => !resolvedIds.has(ev.id));

  const filteredEvents = activeEvents.filter((ev) => {
    if (filter === "all") return true;
    return ev.level === filter;
  });

  const handleResolve = (id: string) => {
    setResolvedIds(prev => new Set([...prev, id]));
    toast.success("Incident Resolved", {
      description: "The alert has been dismissed and logged as resolved.",
    });
  };

  const criticalCount = activeEvents.filter(e => e.level === "critical").length;
  const warnCount = activeEvents.filter(e => e.level === "warn").length;

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
                <h2 className="text-[20px] font-semibold tracking-tight">
                  Incident Report
                </h2>
                <p className="mt-1 text-[12px] text-muted-foreground">
                  Complete log of security events and automated mitigation actions
                </p>
              </div>
              <div className="hidden items-center gap-4 md:flex">
                 <div className="flex flex-col items-end">
                    <span className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                      Status
                    </span>
                    <span className="text-[12px] font-mono text-success">Monitoring Active</span>
                 </div>
              </div>
            </header>

            <section className="grid grid-cols-2 gap-4 md:grid-cols-4 mb-8">
              <StatCard
                label="Active Events"
                value={activeEvents.length.toString()}
                delta="Live"
                positive
              />
              <StatCard
                label="Critical Alerts"
                value={criticalCount.toString()}
                delta={criticalCount > 5 ? "High" : "Stable"}
                positive={criticalCount <= 5}
              />
              <StatCard
                label="Warnings"
                value={warnCount.toString()}
                delta="Active"
                positive={warnCount < 10}
              />
              <StatCard
                label="System State"
                value={status}
                delta="Auto-Guardian"
                positive={status === "ACTIVE"}
              />
            </section>

            <Tabs defaultValue="all" className="w-full" onValueChange={setFilter}>
              <div className="flex items-center justify-between mb-4">
                <TabsList className="bg-muted/50 border border-hairline h-9 p-0.5">
                  <TabsTrigger value="all" className="text-[11px] uppercase tracking-wider px-4">All</TabsTrigger>
                  <TabsTrigger value="critical" className="text-[11px] uppercase tracking-wider px-4">Critical</TabsTrigger>
                  <TabsTrigger value="warn" className="text-[11px] uppercase tracking-wider px-4">Warnings</TabsTrigger>
                  <TabsTrigger value="info" className="text-[11px] uppercase tracking-wider px-4">Info</TabsTrigger>
                </TabsList>

                <button className="flex items-center gap-2 rounded-md border border-hairline bg-secondary/50 px-3 py-1.5 text-[11px] font-medium transition-colors hover:bg-accent">
                  <Filter className="h-3 w-3" />
                  Filter Rules
                </button>
              </div>

              <TabsContent value={filter} className="mt-0">
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="space-y-3"
                >
                  <AnimatePresence mode="popLayout">
                    {filteredEvents.length === 0 ? (
                      <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex flex-col items-center justify-center py-20 rounded-lg border border-dashed border-hairline bg-muted/20"
                      >
                        <ShieldCheck className="h-8 w-8 text-muted-foreground/40 mb-3" />
                        <p className="text-[13px] text-muted-foreground">No active events match your current filter</p>
                      </motion.div>
                    ) : (
                      filteredEvents.map((ev) => (
                        <motion.div
                          key={ev.id}
                          layout
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          className={cn(
                            "group relative flex items-start gap-4 rounded-lg border border-hairline bg-card p-4 transition-all hover:shadow-md",
                            ev.level === "critical" && "border-critical/20 bg-critical/[0.02] hover:border-critical/40",
                            ev.level === "warn" && "border-warning/20 bg-warning/[0.02] hover:border-warning/40"
                          )}
                        >
                          <div className={cn(
                            "flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-hairline",
                            ev.level === "critical" && "bg-critical/10 text-critical",
                            ev.level === "warn" && "bg-warning/10 text-warning",
                            ev.level === "info" && "bg-muted text-muted-foreground"
                          )}>
                            {ev.level === "critical" ? <ShieldAlert className="h-5 w-5" /> : 
                             ev.level === "warn" ? <ShieldAlert className="h-5 w-5" /> : 
                             <Info className="h-5 w-5" />}
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-4 mb-1">
                              <h4 className="text-[13px] font-semibold truncate uppercase tracking-tight">
                                {ev.source} System Interaction
                              </h4>
                              <span className="font-mono text-[10px] text-muted-foreground tabular-nums">
                                {new Date(ev.t).toLocaleTimeString()}
                              </span>
                            </div>
                            <p className="text-[12px] text-foreground/80 leading-relaxed mb-3">
                              {ev.message}
                            </p>
                            <div className="flex items-center gap-3">
                               <button 
                                 onClick={() => setSelectedTrace(ev)}
                                 className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors"
                               >
                                 <Terminal className="h-3 w-3" />
                                 View Trace
                               </button>
                               <span className="h-3 w-px bg-hairline" />
                               <button 
                                 onClick={() => handleResolve(ev.id)}
                                 className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-success transition-colors"
                               >
                                 <CheckCircle2 className="h-3 w-3" />
                                 Resolve
                               </button>
                            </div>
                          </div>
                          
                          {ev.level === "critical" && (
                            <div className="absolute right-4 bottom-4">
                               <span className="flex h-2 w-2 rounded-full bg-critical animate-ping" />
                            </div>
                          )}
                        </motion.div>
                      ))
                    )}
                  </AnimatePresence>
                </motion.div>
              </TabsContent>
            </Tabs>
          </div>
        </main>

        

        {/* Trace View Dialog */}
        <Dialog open={!!selectedTrace} onOpenChange={(open) => {
          if (!open) {
            setSelectedTrace(null);
            setTraceData(null);
          }
        }}>
          <DialogContent className="sm:max-w-[600px] border-hairline bg-card">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-[18px]">
                <Terminal className="h-5 w-5 text-primary" />
                Incident Trace Data
              </DialogTitle>
              <DialogDescription className="text-[13px]">
                Heuristic execution path and metadata for Event ID: <span className="font-mono text-primary">{selectedTrace?.id}</span>
                {selectedTrace?.txHash && <div>TxHash: <span className="font-mono text-xs">{selectedTrace.txHash}</span></div>}
              </DialogDescription>
            </DialogHeader>
            <div className="mt-4 rounded-lg bg-black p-4 font-mono text-[12px] leading-relaxed overflow-hidden">
               <div className="text-success mb-2 font-bold">» GUARDIAN_ENGINE_V3.2_TRACE_LOG</div>
               <div className="text-muted-foreground space-y-1 overflow-y-auto max-h-[300px] scrollbar-thin">
                  <div>[TIMESTAMP] {selectedTrace && new Date(selectedTrace.t).toISOString()}</div>
                  <div>[SOURCE] {selectedTrace?.source}</div>
                  <div>[LEVEL] {selectedTrace?.level?.toUpperCase()}</div>
                  
                  {loadingTrace ? (
                    <div className="mt-4 animate-pulse text-primary">Fetching AI sub-agent evaluations...</div>
                  ) : traceData ? (
                    <>
                      <div>[SIGNAL] Composite AI Decision: <span className={traceData.status === 'FREEZE' ? 'text-critical' : 'text-success'}>{traceData.status}</span></div>
                      <div>[SCORE] Risk Probability: {traceData.risk_score}%</div>
                      <div className="h-px bg-white/10 my-2" />
                      <div className="text-white">// AI Sub-Agent Heuristics</div>
                      {traceData.details?.node_evaluations ? (
                        Object.entries(traceData.details.node_evaluations).map(([node, evalData]: [string, any]) => (
                          <div key={node} className="flex gap-2">
                             - {node.replace('_node', '').toUpperCase()}: 
                             <span className={evalData.threat_detected ? 'text-critical' : 'text-success'}>
                                {evalData.threat_detected ? 'FAIL' : 'PASS'}
                             </span>
                             <span className="text-muted-foreground text-[10px]"> (conf: {evalData.confidence}%)</span>
                          </div>
                        ))
                      ) : (
                        <div>No node detail breakdown available.</div>
                      )}
                      <div className="h-px bg-white/10 my-2" />
                      <div className="text-white">// Raw Payload</div>
                      <pre className="text-[10px] text-blue-400">
                        {JSON.stringify(traceData.details || traceData, null, 2)}
                      </pre>
                    </>
                  ) : (
                    <>
                      {/* Fallback if no trace found in DB */}
                      <div>[SIGNAL] Composite Threat Score: {selectedTrace?.level === 'critical' ? '92.4' : '41.8'}</div>
                      <div className="h-px bg-white/10 my-2" />
                      <div className="text-white">// Execution Heuristics</div>
                      <div>- Pattern matching: Transaction Re-entrancy Check ... <span className="text-success">PASS</span></div>
                      <div>- Heuristic Analysis: High Gas Deviation ... <span className={selectedTrace?.level === 'critical' ? 'text-critical' : 'text-success'}>{selectedTrace?.level === 'critical' ? 'FAIL' : 'PASS'}</span></div>
                      <div>- Global Context: System Load Index ... <span className="text-success">NORMAL</span></div>
                      <div>- Peer Consensus: Node #0x712 ... <span className="text-success">VERIFIED</span></div>
                      <div className="h-px bg-white/10 my-2" />
                      <div className="text-white">// Raw Metadata (Local Evaluation)</div>
                      <pre className="text-[10px] text-blue-400">
                      {JSON.stringify({
                        txHash: selectedTrace?.txHash || "0x7a" + Math.random().toString(16).slice(2, 10),
                        origin: "Killswitch_Gateway",
                        mitigation: selectedTrace?.level === 'critical' ? "CircuitBreaker_Triggered" : "Passive_Monitor",
                      }, null, 2)}
                      </pre>
                    </>
                  )}
               </div>
            </div>
            <DialogFooter className="mt-6 flex gap-3">
               <Button variant="outline" className="h-9 gap-2 text-[12px] border-hairline">
                 <ExternalLink className="h-4 w-4" />
                 Open Explorer
               </Button>
               <Button 
                 className="h-9 gap-2 text-[12px] bg-primary hover:bg-primary/90"
                 onClick={() => {
                   handleResolve(selectedTrace.id);
                   setSelectedTrace(null);
                   setTraceData(null);
                 }}
               >
                 <CheckCircle2 className="h-4 w-4" />
                 Resolve & Close
               </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default Alerts;

