import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import express from "express";
import cors from "cors";
import crypto from "crypto";
import dotenv from "dotenv";

dotenv.config();

// ─── CONFIG ─────────────────────────────────────────────────────────────────
const configPath = path.resolve(__dirname, "./config.json");
const config = JSON.parse(fs.readFileSync(configPath, "utf8"));

const GUARDIAN_PRIVATE_KEY = process.env.GUARDIAN_PRIVATE_KEY || "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const ADMIN_PHONE = process.env.ADMIN_PHONE || config.phone?.adminPhone || "+1234567890";

async function sendFreezeAlert(reason: string, userEmail?: string) {
  console.log(`\n🚨 ADMIN ALERT LOG: ${reason}`);
  if (userEmail) {
    console.log(`📧 SECURITY EMAIL LOG: Sent freeze notification to ${userEmail}`);
  }
}

// ─── WALLET STATE ─────────────────────────────────────────────────────────────
interface TxRecord { amount: number; timestamp: number; }

class WalletState {
  withdrawals: TxRecord[] = [];
  lastDecayTime: number = Date.now();
  baseScore: number = 0;

  applyTimeDecay() {
    const now = Date.now();
    const minutesPassed = (now - this.lastDecayTime) / 60000;
    if (minutesPassed >= 1 && this.baseScore > 0) {
      const decayAmount = Math.floor(minutesPassed) * config.engine.decayRatePerMinute;
      this.baseScore = Math.max(0, this.baseScore - decayAmount);
      this.lastDecayTime = now;
    }
  }
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log("🛡️  Starting Advanced Vultra-Node Threat Engine...\n");
  console.log(`⚙️  Loaded Config: Threshold > ${config.engine.freezeThreshold} | Decay -${config.engine.decayRatePerMinute}/min\n`);

  const deployPath = path.resolve(__dirname, "../contracts/deployments.json");
  const deployments = JSON.parse(fs.readFileSync(deployPath, "utf8"));
  const VAULT_ADDRESS = deployments.contracts.LiquidityVault;

  const abiPath = path.resolve(__dirname, "../contracts/artifacts/contracts/LiquidityVault.sol/LiquidityVault.json");
  const vaultArtifact = JSON.parse(fs.readFileSync(abiPath, "utf8"));

  const provider = new ethers.JsonRpcProvider(config.engine.rpcUrl);
  provider.pollingInterval = 500; // Fixes 4s event lag on localhost
  const guardianWallet = new ethers.Wallet(GUARDIAN_PRIVATE_KEY, provider);
  const vaultContract = new ethers.Contract(VAULT_ADDRESS, vaultArtifact.abi, guardianWallet);

  console.log(`📡 Guardian Connected: ${guardianWallet.address}`);
  console.log(`🔐 Protecting Vault: ${VAULT_ADDRESS}\n`);

  const stateMap = new Map<string, WalletState>();
  let isFrozen = false;

  const evaluateThreats = (address: string, totalDeposits: number): number => {
    const state = stateMap.get(address)!;
    state.applyTimeDecay();
    let activeScore = state.baseScore;
    const now = Date.now();
    state.withdrawals = state.withdrawals.filter(w => now - w.timestamp < 60000);
    const count = state.withdrawals.length;
    const volume = state.withdrawals.reduce((sum, w) => sum + w.amount, 0);
    const percentDrained = totalDeposits > 0 ? (volume / totalDeposits) * 100 : 0;
    
    const rapidConfig = config.rules.rapidTransactions.thresholds;
    if (count >= rapidConfig[1].count) activeScore += rapidConfig[1].score;
    else if (count >= rapidConfig[0].count) activeScore += rapidConfig[0].score;
    
    const volConfig = config.rules.largeVolume.thresholds;
    if (percentDrained >= volConfig[1].percentage) activeScore += volConfig[1].score;
    else if (percentDrained >= volConfig[0].percentage) activeScore += volConfig[0].score;
    
    return Math.min(activeScore, 100);
  };

  // ─── BLOCKCHAIN LISTENERS ────────────────────────────────────────────────────
  vaultContract.on("Withdraw", async (user, amount) => {
    const formattedAmount = Number(ethers.formatEther(amount));
    console.log(`\n[ALERT] 🔼 Withdraw: ${formattedAmount} VLT by ${user}`);

    if (!stateMap.has(user)) stateMap.set(user, new WalletState());
    stateMap.get(user)!.withdrawals.push({ amount: formattedAmount, timestamp: Date.now() });

    try {
      const totalDepositsRaw = await vaultContract.totalDeposits();
      const totalDeposits = Number(ethers.formatEther(totalDepositsRaw));

      const totalScore = evaluateThreats(user, totalDeposits);
      
      const state = stateMap.get(user)!;
      const recentVolume = state.withdrawals.filter(w => Date.now() - w.timestamp < 60000).reduce((sum, w) => sum + w.amount, 0);
      const percentDrained = totalDeposits > 0 ? (recentVolume / totalDeposits) * 100 : 0;
      
      console.log(`🔎 Threat Engine | User: ${user.slice(0, 6)}... | Score: [${totalScore}/100] | Drained: ${percentDrained.toFixed(2)}% of Vault`);

    if (totalScore >= config.engine.freezeThreshold && !isFrozen) {
      isFrozen = true;
      console.log(`\n🚨 [CRITICAL THREAT] Protocol limit breached! Executing CIRCUIT BREAKER...`);
      const reason = `Suspicious activity from ${user.slice(0,8)}... — Score: ${totalScore}/100`;
      try {
        const tx = await vaultContract.freeze();
        console.log(`⚙️  Freeze TX Sent: ${tx.hash}`);
        await tx.wait();
        console.log(`🔒 SECURED: Vault frozen by Guardian.`);

        // Fire console alerts
        await sendFreezeAlert(reason);
        console.log(`\n📧 Note: All OTPs are now handled via Supabase directly on the client.`);
      } catch (err: any) {
        if (err.message.includes("already frozen")) {
          console.log(`⚠️  Vault already frozen.`);
        } else {
          console.error(`❌ Freeze failed:`, err.message);
          isFrozen = false;
        }
      }
    }
    } catch (error) {
      console.error("Error evaluating threats on withdraw:", error);
    }
  });

  vaultContract.on("Unfreeze", () => {
    isFrozen = false;
    stateMap.clear();
    console.log(`\n✅ [ADMIN ACTION] System Unfrozen. All threat memory cleared.`);
  });

  // ─── HTTP API SERVER ────────────────────────────────────────────────────────
  const app = express();
  app.use(cors({ origin: "http://localhost:3000" }));
  app.use(express.json());

  // POST /api/freeze-alert — Called by the frontend when UI threat hits 70
  app.post("/api/freeze-alert", async (req, res) => {
    const { reason, userEmail } = req.body;
    console.log(`\n📨 Freeze alert requested from frontend: ${reason}`);
    await sendFreezeAlert(reason || "Threat threshold exceeded via UI", userEmail);
    res.json({ success: true, message: "Freeze alert logged" });
  });

  // POST /api/execute-unfreeze — Executes emergencyUnfreeze() as Admin
  app.post("/api/execute-unfreeze", async (req, res) => {
    try {
      console.log(`\n⚙️  Executing on-chain unfreeze as ADMIN...`);
      // Hardhat Account #0 is the deployer/admin
      const adminWallet = new ethers.Wallet("0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80", provider);
      const adminVault = new ethers.Contract(VAULT_ADDRESS, vaultArtifact.abi, adminWallet);
      
      const tx = await adminVault.emergencyUnfreeze();
      await tx.wait();
      isFrozen = false;
      console.log(`✅ Vault unfrozen successfully. TX: ${tx.hash}`);
      res.json({ success: true, txHash: tx.hash });
    } catch (err: any) {
      console.error(`❌ Unfreeze failed: ${err.message}`);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // POST /api/authorize-large-withdrawal — Authorizes a >30% withdrawal
  app.post("/api/authorize-large-withdrawal", async (req, res) => {
    try {
      console.log(`\n⚙️  Authorizing large withdrawal (lifting cap temporarily)...`);
      const adminWallet = new ethers.Wallet("0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80", provider);
      const adminVault = new ethers.Contract(VAULT_ADDRESS, vaultArtifact.abi, adminWallet);
      
      const tx = await adminVault.setMaxWithdrawBps(10000); // 100%
      await tx.wait();
      console.log(`✅ Cap lifted to 100%. TX: ${tx.hash}`);

      // Auto-reset back to 30% after 60 seconds
      setTimeout(async () => {
        try {
          const resetTx = await adminVault.setMaxWithdrawBps(3000);
          await resetTx.wait();
          console.log(`✅ Cap restored to 30%. TX: ${resetTx.hash}`);
        } catch (e) {
          console.error("❌ Failed to restore cap:", e);
        }
      }, 60000);

      res.json({ success: true, txHash: tx.hash });
    } catch (err: any) {
      console.error(`❌ Authorization failed: ${err.message}`);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // POST /api/execute-freeze — Executes freeze() as Guardian
  app.post("/api/execute-freeze", async (req, res) => {
    const { reason } = req.body;
    try {
      console.log(`\n⚙️  Executing on-chain freeze as GUARDIAN...`);
      const tx = await vaultContract.freeze(reason || "Manual UI Freeze");
      await tx.wait();
      isFrozen = true;
      console.log(`🔒 Vault frozen successfully. TX: ${tx.hash}`);
      res.json({ success: true, txHash: tx.hash });
    } catch (err: any) {
      if (err.message?.includes("already frozen")) {
        return res.json({ success: true, message: "Already frozen" });
      }
      console.error(`❌ Freeze failed: ${err.message}`);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.listen(3001, () => {
    console.log(`\n🌐 Threat Engine API running on port 3001`);
    console.log(`   POST /api/freeze-alert`);
    console.log(`   POST /api/execute-unfreeze`);
    console.log(`   POST /api/execute-freeze`);
  });

  process.stdin.resume();
}

main().catch(console.error);
