import { create } from "zustand";

// ─── Types ────────────────────────────────────────────────────────────────────

export type SystemStatus = "NORMAL" | "FROZEN";
export type TxType = "DEPOSIT" | "WITHDRAW" | "ATTACK" | "UNFREEZE";
export type AttackType =
  | "LARGE_WITHDRAW"
  | "RAPID_TX"
  | "MULTI_WALLET"
  | "FLASH"
  | "DRIP";
export type AlertLevel = "INFO" | "WARNING" | "CRITICAL";

export interface Transaction {
  id: string;
  type: TxType;
  amount?: number;
  timestamp: Date;
  status: "SUCCESS" | "BLOCKED" | "ATTACK";
  note?: string;
}

export interface AlertItem {
  id: string;
  level: AlertLevel;
  message: string;
  timestamp: Date;
}

export interface AttackLog {
  id: string;
  attackType: AttackType;
  label: string;
  impact: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  threatDelta: number;
  timestamp: Date;
  result: string;
}

export interface LiquidityPoint {
  time: string;
  liquidity: number;
  locked: number;
}

export interface TxActivityPoint {
  time: string;
  deposits: number;
  withdrawals: number;
  attacks: number;
}

// ─── Store Interface ───────────────────────────────────────────────────────────

export interface VultraStore {
  /* Wallet */
  walletAddress: string | null;
  isConnected: boolean;
  connectWallet: () => void;
  disconnectWallet: () => void;

  /* Profile */
  userEmail: string | null;
  setUserEmail: (email: string) => void;

  /* System */
  systemStatus: SystemStatus;
  isFrozen: boolean; // convenience alias always in sync with systemStatus
  threatScore: number; // 0–100
  alertMessage: string; // legacy single alert (kept for backward compat)

  /* Liquidity */
  totalLiquidity: number;
  availableLiquidity: number;
  frozenLiquidity: number;
  userBalance: number;

  /* Collections */
  transactions: Transaction[];
  alerts: AlertItem[];
  attackLogs: AttackLog[];

  /* Charts */
  liquidityHistory: LiquidityPoint[];
  txActivity: TxActivityPoint[];

  /* Vesting */
  vestingProgress: number;
  vestingTotal: number;
  vestingUnlocked: number;

  /* Actions — defender */
  deposit: (amount: number) => void;
  withdraw: (amount: number) => boolean;
  unfreeze: () => void;

  /* Actions — system */
  freezeSystem: (reason?: string) => void;
  unfreezeSystem: () => void;
  increaseThreat: (score: number, reason?: string) => void;
  resetThreatGradually: () => void;

  /* Actions — attacker */
  simulateAttack: (type?: AttackType) => void;
  pushAttackLog: (log: Omit<AttackLog, "id" | "timestamp">) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ts = () => {
  const d = new Date();
  return `${d.getHours().toString().padStart(2, "0")}:${d
    .getMinutes()
    .toString()
    .padStart(2, "0")}:${d.getSeconds().toString().padStart(2, "0")}`;
};

const uid = () => `id_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

const MOCK_WALLET = "0x71C...d3f9";

// ─── Initial data ──────────────────────────────────────────────────────────────

const initialLiquidityHistory: LiquidityPoint[] = [
  { time: "09:00", liquidity: 15000, locked: 2000 },
  { time: "09:30", liquidity: 17500, locked: 2000 },
  { time: "10:00", liquidity: 16800, locked: 3200 },
  { time: "10:30", liquidity: 19200, locked: 3200 },
  { time: "11:00", liquidity: 21500, locked: 4000 },
  { time: "11:30", liquidity: 20100, locked: 4000 },
  { time: "12:00", liquidity: 22800, locked: 5000 },
];

const initialTxActivity: TxActivityPoint[] = [
  { time: "09:00", deposits: 3, withdrawals: 1, attacks: 0 },
  { time: "09:30", deposits: 5, withdrawals: 2, attacks: 0 },
  { time: "10:00", deposits: 2, withdrawals: 4, attacks: 0 },
  { time: "10:30", deposits: 8, withdrawals: 3, attacks: 0 },
  { time: "11:00", deposits: 4, withdrawals: 2, attacks: 1 },
  { time: "11:30", deposits: 6, withdrawals: 1, attacks: 0 },
  { time: "12:00", deposits: 7, withdrawals: 3, attacks: 0 },
];

const initialAlerts: AlertItem[] = [
  {
    id: uid(),
    level: "INFO",
    message: "No suspicious activity detected.",
    timestamp: new Date(Date.now() - 1000 * 60 * 5),
  },
];

const attackMeta: Record<
  AttackType,
  { label: string; impact: AttackLog["impact"]; threat: number; result: string }
> = {
  LARGE_WITHDRAW: {
    label: "Large Withdrawal Attack",
    impact: "HIGH",
    threat: 50,
    result: "Attempted to drain 85% of liquidity pool",
  },
  RAPID_TX: {
    label: "Rapid Transaction Flood",
    impact: "MEDIUM",
    threat: 30,
    result: "Spammed 47 micro-withdrawals in 3 seconds",
  },
  MULTI_WALLET: {
    label: "Multi-Wallet Drain",
    impact: "HIGH",
    threat: 40,
    result: "Coordinated drain from 12 wallets simultaneously",
  },
  FLASH: {
    label: "Flash Attack",
    impact: "CRITICAL",
    threat: 100,
    result: "Flash loan exploit — instant pool drain attempt",
  },
  DRIP: {
    label: "Drip Drain (10%, 10%, 5%)",
    impact: "HIGH",
    threat: 40,
    result: "Cumulative percentage drain exploit sequence",
  },
};

// ─── Store ─────────────────────────────────────────────────────────────────────

// NOTE: In production, this detection layer runs as a Node.js monitoring
// engine that connects via WebSocket RPC (Ethers.js), listens to on-chain
// events (Transfer, Swap, Borrow), and calls smart contract freeze()
// if threat heuristics exceed the configured threshold.

let gradualResetTimer: ReturnType<typeof setInterval> | null = null;

export const useVultraStore = create<VultraStore>((set, get) => ({
  /* ── Wallet ── */
  walletAddress: null,
  isConnected: false,
  connectWallet: () => set({ walletAddress: MOCK_WALLET, isConnected: true }),
  disconnectWallet: () => set({ walletAddress: null, isConnected: false }),

  /* ── Profile ── */
  userEmail: typeof window !== "undefined" ? localStorage.getItem("vultra_user_email") : null,
  setUserEmail: (email: string) => {
    if (typeof window !== "undefined") localStorage.setItem("vultra_user_email", email);
    set({ userEmail: email });
  },

  /* ── System ── */
  systemStatus: "NORMAL",
  isFrozen: false,
  threatScore: 0,
  alertMessage: "No suspicious activity detected.",

  /* ── Liquidity ── */
  totalLiquidity: 0,
  availableLiquidity: 0,
  frozenLiquidity: 0,
  userBalance: 0,

  /* ── Collections ── */
  transactions: [
    {
      id: "tx001",
      type: "DEPOSIT",
      amount: 5000,
      timestamp: new Date(Date.now() - 1000 * 60 * 45),
      status: "SUCCESS",
      note: "USDC deposited",
    },
    {
      id: "tx002",
      type: "WITHDRAW",
      amount: 1200,
      timestamp: new Date(Date.now() - 1000 * 60 * 30),
      status: "SUCCESS",
      note: "Normal withdrawal",
    },
    {
      id: "tx003",
      type: "DEPOSIT",
      amount: 3500,
      timestamp: new Date(Date.now() - 1000 * 60 * 15),
      status: "SUCCESS",
      note: "ETH deposited",
    },
  ],
  alerts: initialAlerts,
  attackLogs: [],

  /* ── Charts ── */
  liquidityHistory: initialLiquidityHistory,
  txActivity: initialTxActivity,

  /* ── Vesting ── */
  vestingProgress: 0,
  vestingTotal: 100000,
  vestingUnlocked: 0,

  // ──────────────────────────────────────────────────────────────────────────
  // SYSTEM ACTIONS
  // ──────────────────────────────────────────────────────────────────────────

  freezeSystem: (reason = "Threat threshold exceeded") => {
    const { totalLiquidity, liquidityHistory, txActivity, transactions, alerts } = get();
    const label = ts();

    const newLiqHistory: LiquidityPoint[] = [
      ...liquidityHistory.slice(-11),
      { time: label, liquidity: totalLiquidity, locked: totalLiquidity },
    ];
    const lastTx = txActivity[txActivity.length - 1];
    const newTxActivity: TxActivityPoint[] = [
      ...txActivity.slice(-11),
      { time: label, deposits: 0, withdrawals: 0, attacks: (lastTx?.attacks || 0) + 1 },
    ];

    const newAlert: AlertItem = {
      id: uid(),
      level: "CRITICAL",
      message: `🚨 CIRCUIT BREAKER TRIGGERED — ${reason}`,
      timestamp: new Date(),
    };

    const freezeTx: Transaction = {
      id: uid(),
      type: "ATTACK",
      timestamp: new Date(),
      status: "ATTACK",
      note: `System frozen — ${reason}`,
    };

    set({
      systemStatus: "FROZEN",
      isFrozen: true,
      threatScore: Math.min(get().threatScore, 100),
      alertMessage: `🚨 CIRCUIT BREAKER TRIGGERED — ${reason}`,
      frozenLiquidity: totalLiquidity,
      availableLiquidity: 0,
      liquidityHistory: newLiqHistory,
      txActivity: newTxActivity,
      transactions: [freezeTx, ...transactions].slice(0, 30),
      alerts: [newAlert, ...alerts].slice(0, 20),
    });
  },

  unfreezeSystem: () => {
    const { totalLiquidity, liquidityHistory, txActivity, transactions, alerts } = get();
    const label = ts();

    const newLiqHistory: LiquidityPoint[] = [
      ...liquidityHistory.slice(-11),
      { time: label, liquidity: totalLiquidity, locked: 0 },
    ];
    const lastTx = txActivity[txActivity.length - 1];
    const newTxActivity: TxActivityPoint[] = [
      ...txActivity.slice(-11),
      { time: label, deposits: 0, withdrawals: 0, attacks: 0 },
    ];

    const newAlert: AlertItem = {
      id: uid(),
      level: "INFO",
      message: "✅ System unfrozen by admin. All operations resumed.",
      timestamp: new Date(),
    };

    const unfreezeTx: Transaction = {
      id: uid(),
      type: "UNFREEZE",
      timestamp: new Date(),
      status: "SUCCESS",
      note: "Admin unfreeze — system restored to NORMAL",
    };

    set({
      systemStatus: "NORMAL",
      isFrozen: false,
      alertMessage: "✅ System unfrozen by admin. All operations resumed.",
      availableLiquidity: totalLiquidity,
      frozenLiquidity: 0,
      liquidityHistory: newLiqHistory,
      txActivity: newTxActivity,
      transactions: [unfreezeTx, ...transactions].slice(0, 30),
      alerts: [newAlert, ...alerts].slice(0, 20),
    });

    get().resetThreatGradually();
  },

  increaseThreat: (score: number, reason = "Suspicious activity") => {
    if (gradualResetTimer) {
      clearInterval(gradualResetTimer);
      gradualResetTimer = null;
    }
    const current = get().threatScore;
    const next = Math.min(current + score, 100);
    const alerts = get().alerts;

    const level: AlertLevel = next >= 20 ? "CRITICAL" : next > 0 ? "WARNING" : "INFO";
    const newAlert: AlertItem = {
      id: uid(),
      level,
      message:
        level === "CRITICAL"
          ? `⚠ Suspicious transaction detected — threat at ${next}%`
          : level === "WARNING"
          ? `⚠ Elevated threat level: ${next}% — monitoring intensified`
          : `Threat indicator increased to ${next}%`,
      timestamp: new Date(),
    };

    set({
      threatScore: next,
      alerts: [newAlert, ...alerts].slice(0, 20),
    });

    if (typeof window !== "undefined") {
      const chan = new BroadcastChannel("vultra_ui_telemetry");
      chan.postMessage({ type: "THREAT_UPDATE", threatScore: next, attackLogs: get().attackLogs });
      chan.close();
    }

    // Auto-freeze if threshold reached
    if (next >= 20 && !get().isFrozen) {
      get().freezeSystem(`Threat score ${next}% exceeded safety threshold`);
    }
  },

  resetThreatGradually: () => {
    if (gradualResetTimer) clearInterval(gradualResetTimer);
    gradualResetTimer = setInterval(() => {
      const current = get().threatScore;
      if (current <= 0) {
        if (gradualResetTimer) clearInterval(gradualResetTimer);
        return;
      }
      set({ threatScore: Math.max(0, current - 5) });
    }, 1200);
  },

  // ──────────────────────────────────────────────────────────────────────────
  // DEFENDER ACTIONS
  // ──────────────────────────────────────────────────────────────────────────

  deposit: (amount: number) => {
    const {
      totalLiquidity, availableLiquidity, userBalance,
      liquidityHistory, txActivity, transactions, alerts,
      vestingProgress, vestingUnlocked, vestingTotal,
    } = get();
    const newTotal = totalLiquidity + amount;
    const newAvail = availableLiquidity + amount;
    const label = ts();

    const newLiqHistory: LiquidityPoint[] = [
      ...liquidityHistory.slice(-11),
      { time: label, liquidity: newTotal, locked: newTotal - newAvail },
    ];
    const lastTx = txActivity[txActivity.length - 1];
    const newTxActivity: TxActivityPoint[] = [
      ...txActivity.slice(-11),
      { time: label, deposits: (lastTx?.deposits || 0) + 1, withdrawals: 0, attacks: 0 },
    ];

    const newTx: Transaction = {
      id: uid(),
      type: "DEPOSIT",
      amount,
      timestamp: new Date(),
      status: "SUCCESS",
      note: "Liquidity deposited to pool",
    };
    const newAlert: AlertItem = {
      id: uid(),
      level: "INFO",
      message: `Deposit of $${amount.toLocaleString()} confirmed`,
      timestamp: new Date(),
    };

    set({
      totalLiquidity: newTotal,
      availableLiquidity: newAvail,
      userBalance: userBalance + amount * 0.05,
      liquidityHistory: newLiqHistory,
      txActivity: newTxActivity,
      transactions: [newTx, ...transactions].slice(0, 30),
      alerts: [newAlert, ...alerts].slice(0, 20),
      vestingProgress: Math.min(vestingProgress + 2, 100),
      vestingUnlocked: Math.min(vestingUnlocked + amount * 0.1, vestingTotal),
    });
  },

  withdraw: (amount: number): boolean => {
    const {
      isFrozen, systemStatus, totalLiquidity, availableLiquidity,
      liquidityHistory, txActivity, transactions, alerts,
    } = get();

    if (isFrozen || systemStatus === "FROZEN") {
      const blockedTx: Transaction = {
        id: uid(),
        type: "WITHDRAW",
        amount,
        timestamp: new Date(),
        status: "BLOCKED",
        note: "Blocked — system frozen",
      };
      const newAlert: AlertItem = {
        id: uid(),
        level: "WARNING",
        message: `Withdrawal of $${amount.toLocaleString()} blocked — system is frozen`,
        timestamp: new Date(),
      };
      set({
        transactions: [blockedTx, ...transactions].slice(0, 30),
        alerts: [newAlert, ...alerts].slice(0, 20),
      });
      return false;
    }

    const pct = amount / totalLiquidity;
    if (pct > 0.3) {
      // Large withdrawal — increase threat (may auto-freeze)
      get().increaseThreat(60, `Large withdrawal attempt (${(pct * 100).toFixed(1)}% of pool)`);
      const blockedTx: Transaction = {
        id: uid(),
        type: "WITHDRAW",
        amount,
        timestamp: new Date(),
        status: "BLOCKED",
        note: `Large withdrawal (${(pct * 100).toFixed(1)}%) — threat escalated`,
      };
      set({
        transactions: [blockedTx, ...transactions].slice(0, 30),
      });
      return false;
    }

    const newAvail = availableLiquidity - amount;
    const newTotal = totalLiquidity - amount;
    const label = ts();
    const newLiqHistory: LiquidityPoint[] = [
      ...liquidityHistory.slice(-11),
      { time: label, liquidity: newTotal, locked: newTotal - newAvail },
    ];
    const lastTx = txActivity[txActivity.length - 1];
    const newTxActivity: TxActivityPoint[] = [
      ...txActivity.slice(-11),
      { time: label, deposits: 0, withdrawals: (lastTx?.withdrawals || 0) + 1, attacks: 0 },
    ];
    const newTx: Transaction = {
      id: uid(),
      type: "WITHDRAW",
      amount,
      timestamp: new Date(),
      status: "SUCCESS",
      note: "Normal withdrawal",
    };
    const newAlert: AlertItem = {
      id: uid(),
      level: "INFO",
      message: `Withdrawal of $${amount.toLocaleString()} processed successfully`,
      timestamp: new Date(),
    };
    set({
      totalLiquidity: newTotal,
      availableLiquidity: newAvail,
      liquidityHistory: newLiqHistory,
      txActivity: newTxActivity,
      transactions: [newTx, ...transactions].slice(0, 30),
      alerts: [newAlert, ...alerts].slice(0, 20),
    });
    return true;
  },

  // backward-compat alias used by ActionPanel
  unfreeze: () => get().unfreezeSystem(),

  // ──────────────────────────────────────────────────────────────────────────
  // ATTACKER ACTIONS
  // ──────────────────────────────────────────────────────────────────────────

  simulateAttack: (type: AttackType = "FLASH") => {
    const meta = attackMeta[type];
    const { attackLogs, totalLiquidity, liquidityHistory, txActivity, transactions, alerts } = get();

    const log: AttackLog = {
      id: uid(),
      attackType: type,
      label: meta.label,
      impact: meta.impact,
      threatDelta: meta.threat,
      timestamp: new Date(),
      result: meta.result,
    };

    const label = ts();
    const lastTx = txActivity[txActivity.length - 1];
    const newTxActivity: TxActivityPoint[] = [
      ...txActivity.slice(-11),
      { time: label, deposits: 0, withdrawals: 0, attacks: (lastTx?.attacks || 0) + 1 },
    ];

    if (type === "FLASH") {
      // Instant freeze
      const newLiqHistory: LiquidityPoint[] = [
        ...liquidityHistory.slice(-11),
        { time: label, liquidity: totalLiquidity, locked: totalLiquidity },
      ];
      const attackTx: Transaction = {
        id: uid(),
        type: "ATTACK",
        timestamp: new Date(),
        status: "ATTACK",
        note: `${meta.label} — ${meta.result}`,
      };
      set({
        threatScore: 100,
        attackLogs: [log, ...attackLogs].slice(0, 50),
        txActivity: newTxActivity,
        liquidityHistory: newLiqHistory,
        transactions: [attackTx, ...transactions].slice(0, 30),
      });
      get().freezeSystem(`Flash attack — ${meta.result}`);
    } else {
      // Gradual threat increase
      const attackTx: Transaction = {
        id: uid(),
        type: "ATTACK",
        timestamp: new Date(),
        status: "ATTACK",
        note: `${meta.label} — ${meta.result}`,
      };
      const newLiqHistory: LiquidityPoint[] = [
        ...liquidityHistory.slice(-11),
        { time: label, liquidity: totalLiquidity * 0.95, locked: totalLiquidity * 0.05 },
      ];
      set({
        attackLogs: [log, ...attackLogs].slice(0, 50),
        txActivity: newTxActivity,
        liquidityHistory: newLiqHistory,
        transactions: [attackTx, ...transactions].slice(0, 30),
      });
      get().increaseThreat(meta.threat, meta.label);
    }
  },

  pushAttackLog: (logInput) => {
    const log: AttackLog = {
      ...logInput,
      id: uid(),
      timestamp: new Date(),
    };
    set((state) => {
      const newState = { attackLogs: [log, ...state.attackLogs].slice(0, 50) };
      // Safely broadcast ONLY the attack logs and threat score
      if (typeof window !== "undefined") {
        const chan = new BroadcastChannel("vultra_ui_telemetry");
        chan.postMessage({ type: "THREAT_UPDATE", threatScore: get().threatScore, attackLogs: newState.attackLogs });
        chan.close();
      }
      return newState;
    });
  },
}));

// Safe UI Telemetry Receiver
if (typeof window !== "undefined") {
  const telemetryChannel = new BroadcastChannel("vultra_ui_telemetry");
  telemetryChannel.onmessage = (e) => {
    if (e.data?.type === "THREAT_UPDATE") {
      if (gradualResetTimer) {
        clearInterval(gradualResetTimer);
        gradualResetTimer = null;
      }
      useVultraStore.setState({ 
        threatScore: e.data.threatScore, 
        attackLogs: e.data.attackLogs 
      });
    }
    // Instant freeze sync from attacker portal after successful vault.freeze() TX
    if (e.data?.type === "FORCE_FREEZE") {
      useVultraStore.setState({ 
        isFrozen: true, 
        systemStatus: "FROZEN",
        alertMessage: "⚠ Circuit breaker triggered — vault frozen by Guardian"
      });
    }
    if (e.data?.type === "FORCE_UNFREEZE") {
      useVultraStore.setState({ 
        isFrozen: false, 
        systemStatus: "NORMAL",
        threatScore: 0,
        alertMessage: "No suspicious activity detected."
      });
    }
  };
}
