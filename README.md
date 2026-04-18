# Killswitch-Node: Intelligent Liquidity Protection System

Killswitch-Node is an advanced DeFi security protocol designed to actively monitor, detect, and neutralize smart contract threats in real-time. It acts as an automated "Circuit Breaker" for Liquidity Vaults.

By analyzing transaction velocity, volume drain rates, and multi-wallet interactions, the Killswitch-Node monitoring engine calculates a live Threat Score. If the threshold is breached, the engine autonomously calls the `freeze()` function on the smart contract, saving the remaining funds from being drained.

## 🚀 Architecture

Killswitch-Node is built on a modular, enterprise-grade Web3 stack:

1. **Smart Contracts (Solidity & Hardhat)**
   - `LiquidityVault.sol`: The core vault that users deposit funds into. Features extreme security: ReentrancyGuards, Role-Based Access Control (`ADMIN` vs `GUARDIAN`), Time-locked emergency recovery (`freezeDuration`), and dynamic `maxWithdrawBps` limits.
   - `KillswitchToken.sol`: The native ERC-20 token used in the pool.

2. **Frontend Dashboard (Next.js 14, React 18, Tailwind, Wagmi/viem)**
   - Connects seamlessly to MetaMask via RainbowKit.
   - Streams live blockchain sync events using Wagmi `useWatchContractEvent`.
   - Displays dynamic Threat Meters, Real-time Transaction Logs, and Live Countdown Action Panels.

3. **Advanced Threat Engine (Node.js)**
   - A standalone backend microservice matching enterprise security infrastructure.
   - Connects to the RPC provider and listens to all Vault events globally.
   - Maintains a concurrent Event Memory HashMap with configured 'Time-Decay'.
   - Automatically executes the Circuit Breaker transaction via the isolated `GUARDIAN` wallet if a threat is confirmed.

## 🛠️ Getting Started

### 1. Start the Local Blockchain
```bash
cd contracts
npx hardhat node
```
*(This starts a local Hardhat node at `http://localhost:8545`)*

### 2. Deploy the Contracts
```bash
cd contracts
npx hardhat run scripts/deploy.ts --network localhost
```
*(This deploys the Vault and automatically updates the frontend with the live addresses)*

### 3. Start the Threat Engine
```bash
cd monitoring-engine
npm run dev
```

### 4. Run the Dashboard
```bash
cd killswitch
npm run dev
```
Navigate to `http://localhost:3000` to interact with the system!

## 🚨 Understanding Roles & Security

- **User**: Connects wallet, deposits, and withdraws. Normal transactions are smooth. If a user withdraws more than 30% of the pool in one go, the smart contract natively blocks it.
- **Attacker**: Attempts to perform a rapid series of micro-withdrawals (Flash drain attempt). The Node.js Threat Engine tracks this in a rolling 60-second window. At 3 rapid withdrawals, the threat score spikes and the engine automatically triggers the circuit breaker, locking the malicious user out of the remaining funds.
- **Admin**: The only role capable of unfreezing the vault. If the time-lock delay (e.g., 1 hour) has not passed, only the Admin can bypass it using `emergencyUnfreeze()`.

## 📦 Killswitch SDK Integration

For protocols wishing to protect their own Vaults, the `@killswitch/sdk` package allows instant integration into existing Node.js backends.

```typescript
import { KillswitchProtect } from "@killswitch/sdk";

const engine = new KillswitchProtect({
  vaultAddress: "0x...",
  rpcUrl: "https://mainnet.infura.io/...",
  guardianPrivateKey: process.env.GUARDIAN_SECRET,
  threatThreshold: 70
});

await engine.enableProtection();
```

---
*Built with ❤️ for a safer DeFi ecosystem.*
