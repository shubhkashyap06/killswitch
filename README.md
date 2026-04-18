# Killswitch | AI-Driven On-Chain Threat Interception

Killswitch is a full-stack, autonomous DeFi security architecture designed to proactively detect and neutralize zero-day exploits, rugpulls, and flash-loan attacks on smart contracts before they can drain liquidity.

By combining an immutable on-chain Hardhat environment with a rapid-polling Node.js/Python monitoring engine, Killswitch continuously evaluates transaction heuristics, triggering preemptive circuit-breaker freezes via specialized guardian wallets independent of human action.

![Dashboard Preview](frontend/public/dashboard-preview.png) *(Note: You can add screenshots here)*

---

## 🛡️ Core Security Architecture

Killswitch utilizes a multi-layered defense mechanism split across three distinct environments:

### 1. On-Chain Enforcement (Solidity)
The base layer of security is enforced at the EVM level inside `LiquidityVault.sol`:
- **Absolute Withdrawal Caps:** The vault strictly enforces a configurable transaction limit (currently 30% of TVL). Any transaction mathematically exceeding this boundary instantly triggers an EVM `ExceedsMaxWithdraw` revert.
- **Guardian Circuit Breakers:** A specialized `freeze()` function can only be invoked by an assigned Guardian Wallet, instantly locking all external non-emergency interactions.
- **Admin Emergency Override:** If frozen, only the Admin wallet can invoke `emergencyUnfreeze()` or perform emergency withdrawals.

### 2. The Threat Monitoring Engine (Node.js & Python AI)
Operating as a high-frequency off-chain oracle, the monitoring engine:
- Polls pending mempool events and confirmed internal transactions (`deposit()`, `withdraw()`) every 400ms.
- Feeds transaction cadence and volume data into connected LLM assessment nodes.
- Intercepts "salami slicing" and structured drain attempts that bypass single-transaction volume limits by executing rapid, sub-threshold withdrawals.
- Immediately signs and dispatches a `freeze()` payload using the Guardian's private key when threat thresholds cross the 80% mark.

### 3. Tactical Command Dashboard (Frontend)
A React, Vite, and Wagmi-powered command center provides live visualization:
- **Live Candlestick Simulator:** Simulates real-time TVL (Total Value Locked) and volume shifts.
- **Threat Meter:** Displays the real-time calculated threat score out of 100 based on incoming mempool telemetry.
- **Emergency Controls:** Instantly triggers Admin override actions directly from the browser by wrapping MetaMask transactions to Hardhat.

---

## ⚔️ Exploit Simulation Suite

To natively prove the architecture's resilience, Killswitch ships with three simulated zero-day attacks located in `/attack-contracts`:

1. **`npm run attack:rugpull`** — A "whale" structures a two-phase drain. Phase 1 attempts a massive 80% extraction and is instantly hard-blocked by the EVM. Phase 2 cleverly slices withdrawals at 29.9% to bypass EVM limits, but the AI spots the volume anomaly and freezes the vault within ~1.2 seconds.
2. **`npm run attack:sybil`** — A bot generates a fresh burner wallet, masks funding via a mixer, deposits heavily, and attempts high-priority un-capped flash withdrawals. The AI flags the zero-day footprint and severs access.
3. **`npm run attack:microdrain`** — A slow, persistent drip (DDoS-style extraction) spread across multiple blocks. The engine's mean-reversion analytics catch the trend and lock the vault.

---

## 🚀 Quickstart Guide

### Prerequisites
- Node.js (v18+)
- Python (3.10+) for AI models
- MetaMask extension

### 1. Launch the Blockchain & Deploy Contracts
In terminal 1:
```bash
cd contracts
npm install
npx hardhat node
```
In terminal 2 (with node running):
```bash
cd contracts
npm run deploy --network localhost
```

### 2. Start the AI Monitoring Engine
In terminal 3:
```bash
cd monitoring-engine
npm install
npm run serve
```

### 3. Launch the Tactical Dashboard
In terminal 4:
```bash
cd frontend
npm install
npm run dev
```
Open `http://localhost:8080/dashboard`. Ensure MetaMask is connected to `Localhost 8545` (Chain ID 31337).

### 4. Run an Exploit
To see the system in action, open a new terminal:
```bash
cd attack-contracts
npm install
npm run attack:rugpull
```
Watch the AI intercept the attacker in the terminal while the Dashboard visually transitions into **SYSTEM FROZEN** lockdown mode.

---

## Repository Structure

- `/contracts`: Core Hardhat execution, `LiquidityVault.sol`, ERC-20 instances.
- `/monitoring-engine`: Real-time backend Node.js listener and Guardian broadcaster.
- `/frontend`: Vite/React based Web3 command center interface.
- `/attack-contracts`: Specialized exploit execution scripts mimicking blackhat behavior.
- `/llm-models`: FastAPI Python endpoints utilized for heuristic transaction analysis.
