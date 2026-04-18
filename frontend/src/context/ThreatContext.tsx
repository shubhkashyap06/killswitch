import React, { createContext, useContext, type ReactNode, Component, ErrorInfo } from "react";
import type { SystemStatus, Candle, ActivityEvent } from "@/hooks/useThreatSimulation";
import { useVaultData } from "@/hooks/useVaultData";
import { useVaultEvents, type TxRecord } from "@/hooks/useVaultEvents";

interface ThreatContextValue {
  // Core state
  threat:         number;           // 0-100 threat score from on-chain heuristics
  status:         SystemStatus;     // "ACTIVE" | "FROZEN"
  isFrozen:       boolean;

  // Live data
  events:         ActivityEvent[];  // on-chain events feed
  txHistory:      TxRecord[];       // ledger
  candles:        Candle[];         // liquidity candle chart data
  freezeThreshold:number;

  // Vault state (for dashboard cards)
  totalDeposits:  number;           // VLT total locked
  maxWithdrawBps: number;
  freezeCount:    number;
  depositCount:   number;
  withdrawCount:  number;

  // User wallet state
  userVaultBalance:  number;
  userTokenBalance:  number;
  timeLockRemaining: number;

  // Loading
  loading: boolean;
}

const FREEZE_THRESHOLD = 80;

const ThreatContext = createContext<ThreatContextValue | null>(null);

function ThreatProviderInner({ children }: { children: ReactNode }) {
  // ── Real data hooks ───────────────────────────────────────────────────────
  const vault  = useVaultData();        // chain reads (totalDeposits, frozen, balances…)
  const isFrozen = vault.isFrozen;
  const evts   = useVaultEvents(isFrozen);      // chain log polling (events, txHistory, threatScore)

  // On-chain frozen is the authoritative source
  const status: SystemStatus = isFrozen ? "FROZEN" : "ACTIVE";

  // Threat score: on-chain heuristics from events hook;
  // bump to >= 80 instantly when vault freezes
  const threat = isFrozen ? Math.max(evts.threatScore, 80) : evts.threatScore;

  const value: ThreatContextValue = {
    threat,
    status,
    isFrozen,
    events:         evts.events,
    txHistory:      evts.txHistory,
    candles:        evts.candles,
    freezeThreshold: FREEZE_THRESHOLD,
    totalDeposits:  vault.totalDeposits,
    maxWithdrawBps: vault.maxWithdrawBps,
    freezeCount:    evts.freezeCount,
    depositCount:   evts.depositCount,
    withdrawCount:  evts.withdrawCount,
    userVaultBalance:  vault.userVaultBalance,
    userTokenBalance:  vault.userTokenBalance,
    timeLockRemaining: vault.timeLockRemaining,
    loading:           vault.loading,
  };

  return (
    <ThreatContext.Provider value={value}>{children}</ThreatContext.Provider>
  );
}

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean, error: any }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '2rem', background: '#220000', color: '#ffaaaa', fontFamily: 'monospace', minHeight: '100vh' }}>
          <h2>Fatal Crash in ThreatProvider</h2>
          <pre style={{ whiteSpace: 'pre-wrap' }}>{String(this.state.error?.stack || this.state.error)}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

export function ThreatProvider({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary>
      <ThreatProviderInner>{children}</ThreatProviderInner>
    </ErrorBoundary>
  );
}

export function useThreat(): ThreatContextValue {
  const ctx = useContext(ThreatContext);
  if (!ctx) {
    throw new Error("useThreat must be used within a <ThreatProvider>");
  }
  return ctx;
}
