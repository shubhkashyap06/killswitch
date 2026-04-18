import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import axios from "axios";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://yhgkyjwuogqdlpicvijq.supabase.co";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_pL1ueLdUoV70xPGFbUWWlQ_Y7HIYYvd";
const supabase = createClient(supabaseUrl, supabaseKey);

// ─── CONFIG ──────────────────────────────────────────────────────────────────
const configPath = path.resolve(__dirname, "./config.json");
const config = JSON.parse(fs.readFileSync(configPath, "utf8"));

// Hardhat signer[1] = Guardian address: 0x70997970C51812dc3A010C7d01b50e0d17dc79C8
const GUARDIAN_PRIVATE_KEY =
  process.env.GUARDIAN_PRIVATE_KEY ||
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";

// Hardhat signer[0] = Admin/Deployer address: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
const ADMIN_PRIVATE_KEY =
  process.env.ADMIN_PRIVATE_KEY ||
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

// ─── ALERT HELPER ─────────────────────────────────────────────────────────────
async function sendFreezeAlert(reason: string, userEmail?: string) {
  console.log(`\n🚨 ADMIN ALERT: ${reason}`);
  if (userEmail) {
    console.log(`📧 Freeze notification logged for: ${userEmail}`);
  }
}

// ─── WALLET THREAT STATE ──────────────────────────────────────────────────────
interface TxRecord {
  amount: number;
  timestamp: number;
}

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

// ─── THREAT EVALUATOR (AI INTEGRATION) ────────────────────────────────────────
// The local heuristics are replaced by the python agent wrapper logic down in the loop.


// ─── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log("🛡️  Starting Advanced Killswitch-Node Threat Engine...\n");
  console.log(
    `⚙️  Loaded Config: Threshold > ${config.engine.freezeThreshold} | Decay -${config.engine.decayRatePerMinute}/min\n`
  );

  // Load deployment config
  const deployPath = path.resolve(__dirname, "../contracts/deployments.json");
  const deployments = JSON.parse(fs.readFileSync(deployPath, "utf8"));
  const VAULT_ADDRESS: string = deployments.contracts.vault;

  // Load ABI
  const abiPath = path.resolve(
    __dirname,
    "../contracts/artifacts/contracts/LiquidityVault.sol/LiquidityVault.json"
  );
  const vaultArtifact = JSON.parse(fs.readFileSync(abiPath, "utf8"));

  // Provider + wallets
  const provider = new ethers.JsonRpcProvider(config.engine.rpcUrl);
  const guardianWallet = new ethers.Wallet(GUARDIAN_PRIVATE_KEY, provider);
  const adminWallet = new ethers.Wallet(ADMIN_PRIVATE_KEY, provider);

  const vaultContractGuard = new ethers.Contract(
    VAULT_ADDRESS,
    vaultArtifact.abi,
    guardianWallet
  );

  const vaultContractAdmin = new ethers.Contract(
    VAULT_ADDRESS,
    vaultArtifact.abi,
    adminWallet
  );

  console.log(`📡 Guardian Connected: ${guardianWallet.address}`);
  console.log(`🔐 Protecting Vault:   ${VAULT_ADDRESS}\n`);

  // ─── STATE ────────────────────────────────────────────────────────────────
  const stateMap = new Map<string, WalletState>();
  let isFrozen = false;

  // Sync frozen status from chain on startup
  try {
    isFrozen = await vaultContractGuard.frozen();
    if (isFrozen) console.log("⚠️  Vault is already frozen at startup.");
  } catch {}

  // ─── EVENT INTERFACE ──────────────────────────────────────────────────────
  const iface = new ethers.Interface(vaultArtifact.abi);

  // Topic hashes we care about
  const WITHDRAW_TOPIC = iface.getEvent("Withdraw")!.topicHash;
  const UNFREEZE_TOPIC = iface.getEvent("Unfreeze")!.topicHash;
  const EMERGENCY_UNFREEZE_TOPIC = iface.getEvent("EmergencyUnfreeze")!.topicHash;

  // ─── SECURITY HELPERS ──────────────────────────────────────────────────────
  async function triggerFreeze(user: string, reasonDetails: string) {
    if (isFrozen) return; // already done
    isFrozen = true;
    const reason = `Security flag: ${reasonDetails.slice(0, 50)}`;
    console.log(`\n🚨 [CRITICAL] Freezing Vault proactively...`);
    try {
      const tx = await vaultContractGuard.freeze(reason);
      console.log(`⚙️  Freeze TX: ${tx.hash}`);
      await tx.wait();
      console.log(`🔒 SECURED: Vault frozen by Guardian.`);
      await sendFreezeAlert(reason);
      
      // Automatic 2-minute cool down
      setTimeout(async () => {
        if (isFrozen) {
          console.log(`\n⏱️ [COOLDOWN] 2 minutes passed. Automatically unfreezing vault...`);
          await triggerEmergencyUnfreeze();
        }
      }, 120_000);
      
    } catch (err: any) {
      if (
        err.message?.includes("frozen") ||
        err.message?.includes("already")
      ) {
        console.log("⚠️  Vault already frozen (race condition — OK).");
      } else {
        console.error(`❌ Freeze TX failed: ${err.message}`);
        isFrozen = false;
      }
    }
  }

  async function triggerEmergencyUnfreeze() {
    console.log(`\n✅ [AI PROCEED] Unfreezing Vault...`);
    try {
      const tx = await vaultContractAdmin.emergencyUnfreeze();
      await tx.wait();
      console.log(`🔓 UNLOCKED: Vault operation resumed normally.`);
    } catch (err: any) {
      console.error(`❌ Unfreeze TX failed: ${err.message}`);
    }
  }

  // ─── MANUAL LOG POLL (avoids ethers FilterIdEventSubscriber null bug) ─────
  // This replaces vaultContract.on() which crashes on Hardhat with:
  // "TypeError: results is not iterable" — Hardhat returns null instead of []
  let lastProcessedBlock = (await provider.getBlockNumber()) - 1;

  const pollLogs = async () => {
    try {
      const currentBlock = await provider.getBlockNumber();
      if (currentBlock <= lastProcessedBlock) return;

      const logs = await provider.getLogs({
        address: VAULT_ADDRESS,
        fromBlock: lastProcessedBlock + 1,
        toBlock: currentBlock,
      });

      // Advance the cursor BEFORE processing so a crash doesn't replay
      lastProcessedBlock = currentBlock;

      for (const log of logs) {
        const topic = log.topics[0];

        // ── Unfreeze events ────────────────────────────────────────────────
        if (topic === UNFREEZE_TOPIC || topic === EMERGENCY_UNFREEZE_TOPIC) {
          isFrozen = false;
          stateMap.clear();
          const label =
            topic === EMERGENCY_UNFREEZE_TOPIC ? "Emergency Unfreeze" : "Unfreeze";
          console.log(`\n✅ [ADMIN ACTION] ${label} detected on-chain. Threat memory cleared.`);
          continue;
        }

        // ── Withdraw event ─────────────────────────────────────────────────
        if (topic === WITHDRAW_TOPIC) {
          let parsed: ethers.LogDescription | null = null;
          try {
            parsed = iface.parseLog({ topics: [...log.topics], data: log.data });
          } catch {
            continue;
          }
          if (!parsed) continue;

          const user: string = parsed.args[0];
          const amountRaw: bigint = parsed.args[1];
          const formattedAmount = Number(ethers.formatEther(amountRaw));

          console.log(
            `\n[EVENT] 🔼 Withdraw: ${formattedAmount} VLT by ${user.slice(0, 10)}…`
          );

          // Skip if vault is already frozen — no point scoring
          if (isFrozen) {
            console.log("  ↳ Vault is frozen — event noted, no action needed.");
            continue;
          }

          if (!stateMap.has(user)) stateMap.set(user, new WalletState());
          const state = stateMap.get(user)!;
          state.withdrawals.push({ amount: formattedAmount, timestamp: Date.now() });

          // Fetch current total deposits for percentage calculations
          let totalDeposits = 0;
          try {
            const raw = await vaultContractGuard.totalDeposits();
            totalDeposits = Number(ethers.formatEther(raw));
          } catch {}

          const recentVolume = state.withdrawals
            .filter((w) => Date.now() - w.timestamp < 60_000)
            .reduce((s, w) => s + w.amount, 0);

          console.log(`\n⏳ AI Evaluation started for ${user.slice(0, 8)}... Freezing vault proactively.`);
          
          if (!isFrozen) {
            await triggerFreeze(user, "Proactive freeze for AI evaluation");
          }

          try {
            // Note down to supabase
            await supabase.from("monitoring_logs").insert([
              {
                transaction_hash: log.transactionHash,
                wallet_address: user,
                amount: formattedAmount,
                timestamp: new Date().toISOString(),
                status: "EVALUATING",
              },
            ]);
          } catch (e) {
            console.log("Supabase insert skipped", e);
          }

          const payload = {
            transaction_id: log.transactionHash,
            timestamp: Math.floor(Date.now() / 1000),
            wallet_address: user,
            withdrawal_amount_eth: formattedAmount,
            withdrawal_amount_bps: totalDeposits > 0 ? Math.floor((formattedAmount / totalDeposits) * 10000) : 0,
            vault_total_liquidity_eth: totalDeposits,
            wallet_registered: false,
            registered_withdrawal_wallet: "",
            funding_source: "0x0000000000000000000000000000000000000000",
            funding_source_is_known_exchange: false,
            funding_depth: 1,
            ip_address: "127.0.0.1",
            gas_price_gwei: 1.5,
            baseline_gas_price_gwei: 1.5,
            recent_transactions: state.withdrawals.map((w) => ({
              timestamp: Math.floor(w.timestamp / 1000),
              amount_eth: w.amount,
              type: "withdraw",
            })),
            wallet_age_days: 10,
            previous_interactions_with_vault: state.withdrawals.length,
            flagged_address: false,
          };

          try {
            const response = await axios.post("http://127.0.0.1:8000/analyze", payload);
            const result = response.data;

            console.log(`🧠 AI Decision: ${result.decision} | Risk: ${result.risk_score}`);

            try {
              // Update result to supabase
              await supabase
                .from("monitoring_logs")
                .update({
                  status: result.decision,
                  risk_score: result.risk_score,
                  details: result,
                })
                .eq("transaction_hash", log.transactionHash);
            } catch (e) {}

            if (result.decision === "PROCEED" || result.decision === "DELAY_SHORT") {
              await triggerEmergencyUnfreeze();
            } else {
              console.log(`🚨 AI determined threat. Vault stays completely frozen.`);
            }
          } catch (err: any) {
            console.error("AI Evaluation failed:", err.message);
            console.log(`⚠️ AI offline. Falling back to PROCEED. Unfreezing vault.`);
            await triggerEmergencyUnfreeze();
          }
        }
      }
    } catch (err: any) {
      // Silently swallow transient RPC errors during polling
      if (
        !err.message?.includes("connection") &&
        !err.message?.includes("timeout")
      ) {
        console.error("Poll error:", err.message?.slice(0, 120));
      }
    }
  };

  // Poll every 400ms — fast enough to catch rapid withdrawals (700ms apart in script)
  const POLL_INTERVAL_MS = 400;
  setInterval(pollLogs, POLL_INTERVAL_MS);
  console.log(
    `🔍 Log polling started (every ${POLL_INTERVAL_MS}ms) — replacing ethers event subscriptions.\n`
  );

  // ─── HTTP API SERVER ──────────────────────────────────────────────────────
  const app = express();
  app.use(cors({ origin: "*" }));
  app.use(express.json());

  // POST /api/freeze-alert — Frontend notification
  app.post("/api/freeze-alert", async (req, res) => {
    const { reason, userEmail } = req.body;
    console.log(`\n📨 Freeze alert from frontend: ${reason}`);
    await sendFreezeAlert(reason || "Threshold exceeded via UI", userEmail);
    res.json({ success: true, message: "Freeze alert logged" });
  });

  // POST /api/execute-unfreeze — Admin emergency unfreeze
  app.post("/api/execute-unfreeze", async (req, res) => {
    try {
      console.log(`\n⚙️  Executing on-chain emergencyUnfreeze as ADMIN…`);
      const tx = await vaultContractAdmin.emergencyUnfreeze();
      await tx.wait();
      isFrozen = false;
      console.log(`✅ Vault unfrozen. TX: ${tx.hash}`);
      res.json({ success: true, txHash: tx.hash });
    } catch (err: any) {
      console.error(`❌ Unfreeze failed: ${err.message}`);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // POST /api/authorize-large-withdrawal — Temporarily lift 30% cap
  app.post("/api/authorize-large-withdrawal", async (req, res) => {
    try {
      console.log(`\n⚙️  Authorizing large withdrawal (lifting cap to 100%)…`);
      const tx = await vaultContractAdmin.setMaxWithdrawBps(10000);
      await tx.wait();
      console.log(`✅ Cap lifted to 100%. TX: ${tx.hash}`);
      // Auto-restore after 60s
      setTimeout(async () => {
        try {
          const resetTx = await vaultContractAdmin.setMaxWithdrawBps(3000);
          await resetTx.wait();
          console.log(`✅ Cap restored to 30%. TX: ${resetTx.hash}`);
        } catch (e: any) {
          console.error("❌ Failed to restore cap:", e.message);
        }
      }, 60_000);
      res.json({ success: true, txHash: tx.hash });
    } catch (err: any) {
      console.error(`❌ Authorization failed: ${err.message}`);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // POST /api/execute-freeze — Manual Guardian freeze via UI
  app.post("/api/execute-freeze", async (req, res) => {
    const { reason } = req.body;
    if (isFrozen) {
      return res.json({ success: true, message: "Already frozen" });
    }
    try {
      console.log(`\n⚙️  Executing on-chain freeze as GUARDIAN…`);
      const tx = await vaultContractGuard.freeze(reason || "Manual UI Freeze");
      await tx.wait();
      isFrozen = true;
      console.log(`🔒 Vault frozen. TX: ${tx.hash}`);
      res.json({ success: true, txHash: tx.hash });
    } catch (err: any) {
      if (err.message?.includes("frozen")) {
        return res.json({ success: true, message: "Already frozen" });
      }
      console.error(`❌ Freeze failed: ${err.message}`);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // GET /api/status — live state for frontend polling
  app.get("/api/status", async (_req, res) => {
    let totalDeposits = 0;
    try {
      const raw = await vaultContractGuard.totalDeposits();
      totalDeposits = Number(ethers.formatEther(raw));
    } catch {}

    res.json({
      isFrozen,
      totalDeposits,
      walletCount: stateMap.size,
      timestamp: Date.now(),
    });
  });

  // GET /api/trace/:txHash — get AI logic for trace UI
  app.get("/api/trace/:txHash", async (req, res) => {
    try {
      const { data, error } = await supabase
        .from("monitoring_logs")
        .select("*")
        .eq("transaction_hash", req.params.txHash)
        .single();
      
      if (error || !data) {
        return res.status(404).json({ success: false, error: "Trace not found" });
      }
      res.json({ success: true, data });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  app.listen(3001, () => {
    console.log(`\n🌐 Threat Engine API running on port 3001`);
    console.log(`   GET  /api/status`);
    console.log(`   POST /api/freeze-alert`);
    console.log(`   POST /api/execute-unfreeze`);
    console.log(`   POST /api/execute-freeze`);
    console.log(`   POST /api/authorize-large-withdrawal\n`);
  });

  process.stdin.resume();
}

main().catch(console.error);
