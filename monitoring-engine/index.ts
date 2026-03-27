import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import nodemailer from "nodemailer";
import express from "express";
import cors from "cors";
import crypto from "crypto";

// ─── CONFIG ─────────────────────────────────────────────────────────────────
const configPath = path.resolve(__dirname, "./config.json");
const config = JSON.parse(fs.readFileSync(configPath, "utf8"));

const GUARDIAN_PRIVATE_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const ADMIN_EMAIL = config.email?.adminEmail || "admin@vultra-node.com";
const SMTP_CONFIG = config.email || {
  host: "smtp.ethereal.email",
  port: 587,
  user: "",
  pass: "",
};

// ─── OTP STORE (in-memory) ────────────────────────────────────────────────────
const otpStore = new Map<string, { otp: string; expires: number; email: string }>();

// ─── EMAIL TRANSPORTER ────────────────────────────────────────────────────────
let transporter: nodemailer.Transporter;

async function setupEmail() {
  if (SMTP_CONFIG.user && SMTP_CONFIG.pass) {
    // Use configured SMTP
    transporter = nodemailer.createTransport({
      host: SMTP_CONFIG.host,
      port: SMTP_CONFIG.port,
      secure: false,
      auth: { user: SMTP_CONFIG.user, pass: SMTP_CONFIG.pass },
    });
    console.log(`📧 Email configured: ${SMTP_CONFIG.host}`);
  } else {
    // Auto-create a disposable Ethereal test account
    const testAccount = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      secure: false,
      auth: { user: testAccount.user, pass: testAccount.pass },
    });
    console.log(`📧 Test Email Account: ${testAccount.user}`);
    console.log(`🌐 Preview emails at: https://ethereal.email/login`);
    console.log(`   User: ${testAccount.user} | Pass: ${testAccount.pass}\n`);
  }
}

async function sendFreezeAlert(reason: string, userEmail?: string) {
  const otp = crypto.randomInt(100000, 999999).toString();
  const unfreezeToken = crypto.randomUUID();
  const expires = Date.now() + 15 * 60 * 1000; // 15 min

  otpStore.set(unfreezeToken, { otp, expires, email: ADMIN_EMAIL });

  const unfreezeLink = `http://localhost:3000/unfreeze?token=${unfreezeToken}&otp=${otp}`;

  const adminHtml = `
  <div style="font-family: monospace; background:#050810; color:#e2e8f8; padding:32px; border-radius:12px; max-width:560px;">
    <div style="color:#ef4444; font-size:22px; font-weight:700; margin-bottom:12px;">
      🔒 VULTRA-NODE VAULT FROZEN
    </div>
    <p style="color:#94a3b8;">The DeFi security protocol has automatically frozen the liquidity vault.</p>
    <div style="background:#0f172a; border:1px solid #1e293b; border-radius:8px; padding:16px; margin:16px 0;">
      <div style="color:#64748b; font-size:12px; margin-bottom:4px;">REASON</div>
      <div style="color:#f97316;">${reason}</div>
    </div>
    <div style="background:#0f172a; border:1px solid #1e293b; border-radius:8px; padding:16px; margin:16px 0;">
      <div style="color:#64748b; font-size:12px; margin-bottom:8px;">EMERGENCY UNFREEZE OTP</div>
      <div style="color:#22c55e; font-size:32px; letter-spacing:8px; font-weight:700;">${otp}</div>
      <div style="color:#475569; font-size:11px; margin-top:6px;">Expires in 15 minutes</div>
    </div>
    <a href="${unfreezeLink}" style="display:inline-block; background:#22c55e; color:#000; padding:12px 24px; border-radius:8px; text-decoration:none; font-weight:700; margin-top:8px;">
      Click to Authorize Unfreeze →
    </a>
    <p style="color:#334155; font-size:11px; margin-top:20px;">Vultra-Node DeFi Security Protocol | Do not share this OTP</p>
  </div>`;

  try {
    const adminInfo = await transporter.sendMail({
      from: `"Vultra-Node Security" <security@vultra-node.com>`,
      to: ADMIN_EMAIL,
      subject: `🔒 CRITICAL: Vault Frozen — Emergency OTP Inside`,
      html: adminHtml,
    });
    const adminPreview = nodemailer.getTestMessageUrl(adminInfo);
    if (adminPreview) console.log(`\n📧 Admin Alert Preview: ${adminPreview}`);

    if (userEmail && userEmail !== ADMIN_EMAIL) {
      const userInfo = await transporter.sendMail({
        from: `"Vultra-Node Security" <security@vultra-node.com>`,
        to: userEmail,
        subject: `⚠️ Your DeFi Vault Has Been Frozen`,
        html: adminHtml.replace("EMERGENCY UNFREEZE OTP", "YOUR VAULT NOTIFICATION").replace(`<div style="color:#22c55e; font-size:32px; letter-spacing:8px; font-weight:700;">${otp}</div>`, ""),
      });
      const userPreview = nodemailer.getTestMessageUrl(userInfo);
      if (userPreview) console.log(`📧 User Notification Preview: ${userPreview}`);
    }
  } catch (err: any) {
    console.error(`❌ Email failed: ${err.message}`);
  }

  return { otp, unfreezeToken };
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

  await setupEmail();

  const deployPath = path.resolve(__dirname, "../contracts/deployments.json");
  const deployments = JSON.parse(fs.readFileSync(deployPath, "utf8"));
  const VAULT_ADDRESS = deployments.contracts.LiquidityVault;

  const abiPath = path.resolve(__dirname, "../contracts/artifacts/contracts/LiquidityVault.sol/LiquidityVault.json");
  const vaultArtifact = JSON.parse(fs.readFileSync(abiPath, "utf8"));

  const provider = new ethers.JsonRpcProvider(config.engine.rpcUrl);
  const guardianWallet = new ethers.Wallet(GUARDIAN_PRIVATE_KEY, provider);
  const vaultContract = new ethers.Contract(VAULT_ADDRESS, vaultArtifact.abi, guardianWallet);

  console.log(`📡 Guardian Connected: ${guardianWallet.address}`);
  console.log(`🔐 Protecting Vault: ${VAULT_ADDRESS}\n`);

  const stateMap = new Map<string, WalletState>();
  let isFrozen = false;

  const evaluateThreats = (address: string): number => {
    const state = stateMap.get(address)!;
    state.applyTimeDecay();
    let activeScore = state.baseScore;
    const now = Date.now();
    state.withdrawals = state.withdrawals.filter(w => now - w.timestamp < 60000);
    const count = state.withdrawals.length;
    const volume = state.withdrawals.reduce((sum, w) => sum + w.amount, 0);
    const rapidConfig = config.rules.rapidTransactions.thresholds;
    if (count >= rapidConfig[1].count) activeScore += rapidConfig[1].score;
    else if (count >= rapidConfig[0].count) activeScore += rapidConfig[0].score;
    const volConfig = config.rules.largeVolume.thresholds;
    if (volume >= volConfig[1].volume) activeScore += volConfig[1].score;
    else if (volume >= volConfig[0].volume) activeScore += volConfig[0].score;
    return Math.min(activeScore, 100);
  };

  // ─── BLOCKCHAIN LISTENERS ────────────────────────────────────────────────────
  vaultContract.on("Withdraw", async (user, amount) => {
    const formattedAmount = Number(ethers.formatEther(amount));
    console.log(`\n[ALERT] 🔼 Withdraw: ${formattedAmount} VLT by ${user}`);

    if (!stateMap.has(user)) stateMap.set(user, new WalletState());
    stateMap.get(user)!.withdrawals.push({ amount: formattedAmount, timestamp: Date.now() });

    const totalScore = evaluateThreats(user);
    console.log(`🔎 Threat Engine | User: ${user.slice(0, 6)}... | Score: [${totalScore}/100]`);

    if (totalScore >= config.engine.freezeThreshold && !isFrozen) {
      isFrozen = true;
      console.log(`\n🚨 [CRITICAL THREAT] Protocol limit breached! Executing CIRCUIT BREAKER...`);
      const reason = `Suspicious activity from ${user.slice(0,8)}... — Score: ${totalScore}/100`;
      try {
        const tx = await vaultContract.freeze();
        console.log(`⚙️  Freeze TX Sent: ${tx.hash}`);
        await tx.wait();
        console.log(`🔒 SECURED: Vault frozen by Guardian.`);

        // Fire email alerts
        const { otp, unfreezeToken } = await sendFreezeAlert(reason);
        console.log(`\n🔑 Admin OTP: ${otp}`);
        console.log(`🔗 Unfreeze Token stored: ${unfreezeToken.slice(0,12)}...`);
      } catch (err: any) {
        if (err.message.includes("already frozen")) {
          console.log(`⚠️  Vault already frozen.`);
        } else {
          console.error(`❌ Freeze failed:`, err.message);
          isFrozen = false;
        }
      }
    }
  });

  vaultContract.on("Unfreeze", () => {
    isFrozen = false;
    stateMap.clear();
    otpStore.clear();
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
    const result = await sendFreezeAlert(reason || "Threat threshold exceeded via UI", userEmail);
    res.json({ success: true, message: "Freeze alert sent", token: result.unfreezeToken });
  });

  // POST /api/request-otp — Sends a fresh OTP for unfreeze
  app.post("/api/request-otp", async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email required" });

    const otp = crypto.randomInt(100000, 999999).toString();
    const token = crypto.randomUUID();
    otpStore.set(token, { otp, expires: Date.now() + 15 * 60 * 1000, email });

    try {
      const info = await transporter.sendMail({
        from: `"Vultra-Node Security" <security@vultra-node.com>`,
        to: email,
        subject: `🔑 Your Unfreeze OTP — ${otp}`,
        html: `<div style="font-family:monospace;background:#050810;color:#e2e8f8;padding:32px;border-radius:12px;">
          <h2 style="color:#22c55e;">Vault Unfreeze OTP</h2>
          <p style="color:#94a3b8;">Enter this OTP in the Vultra-Node dashboard to unfreeze the vault:</p>
          <div style="background:#0f172a;border:1px solid #22c55e33;padding:16px;border-radius:8px;margin:16px 0;">
            <div style="color:#22c55e;font-size:36px;letter-spacing:10px;font-weight:700;">${otp}</div>
          </div>
          <p style="color:#64748b;font-size:12px;">Expires in 15 minutes. Do not share.</p>
        </div>`,
      });
      const preview = nodemailer.getTestMessageUrl(info);
      if (preview) console.log(`\n📧 OTP Preview: ${preview}`);
      res.json({ success: true, token, preview: preview || null });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/verify-otp — Validates OTP before the frontend calls unfreeze()
  app.post("/api/verify-otp", (req, res) => {
    const { token, otp } = req.body;
    const record = otpStore.get(token);

    if (!record) return res.status(404).json({ valid: false, error: "Invalid token" });
    if (Date.now() > record.expires) {
      otpStore.delete(token);
      return res.status(401).json({ valid: false, error: "OTP expired" });
    }
    if (record.otp !== otp) return res.status(401).json({ valid: false, error: "Incorrect OTP" });

    otpStore.delete(token); // One-time use
    console.log(`\n✅ OTP verified for: ${record.email}`);
    res.json({ valid: true, message: "OTP verified — proceed to unfreeze" });
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
      otpStore.clear();
      console.log(`✅ Vault unfrozen successfully. TX: ${tx.hash}`);
      res.json({ success: true, txHash: tx.hash });
    } catch (err: any) {
      console.error(`❌ Unfreeze failed: ${err.message}`);
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
    console.log(`   POST /api/request-otp`);
    console.log(`   POST /api/verify-otp`);
  });

  process.stdin.resume();
}

main().catch(console.error);
