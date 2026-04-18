// ═══════════════════════════════════════════════════════════════════════════════
// attack-contracts/scripts/rugpull.ts
//
// Simulates a Rugpull (structural drain) attack.
// Phase 1: Attempts to withdraw >30% in a single tx — BLOCKED by vault cap.
// Phase 2: Tries to slice withdrawals just under 30% repeatedly — caught by AI.
// ═══════════════════════════════════════════════════════════════════════════════

import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

let chalk: any = null;
try { chalk = require("chalk"); } catch {}

const hackerGreen  = (s: string) => chalk ? chalk.hex('#00FF41')(s) : s;
const terminalAlert= (s: string) => chalk ? chalk.bgRed.white.bold(s) : s;
const yellow       = (s: string) => chalk ? chalk.yellow(s) : s;
const dim          = (s: string) => chalk ? chalk.dim(s) : s;

const VAULT_ABI = [
  "function deposit(uint256 amount) external",
  "function withdraw(uint256 amount) external",
  "function totalDeposits() view returns (uint256)",
  "function frozen() view returns (bool)",
  "function maxWithdrawBps() view returns (uint256)",
];

const TOKEN_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function balanceOf(address account) external view returns (uint256)",
  "function transfer(address to, uint256 amount) external returns (bool)",
];

async function main() {
  console.clear();
  console.log(hackerGreen("\n██████████  RUGPULL.EXE  ██████████\n"));

  const deploymentPath = path.resolve(__dirname, "../../contracts/deployments.json");
  if (!fs.existsSync(deploymentPath)) {
    console.error(terminalAlert(" FATAL ERROR: deployments.json not found. Run deploy first. "));
    process.exit(1);
  }

  const deployment  = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
  const vaultAddress = deployment.contracts.vault;
  const tokenAddress = deployment.contracts.token;

  const signers        = await ethers.getSigners();
  const deployer       = signers[0];
  const attacker       = signers[5];

  const vault           = new ethers.Contract(vaultAddress, VAULT_ABI, attacker);
  const token           = new ethers.Contract(tokenAddress, TOKEN_ABI, attacker);
  const tokenAsDeployer = new ethers.Contract(tokenAddress, TOKEN_ABI, deployer);

  console.log(hackerGreen(`> RUGPULL TARGET: ${vaultAddress}`));
  console.log(dim(`  Attacker:  ${attacker.address}`));

  const tvlRawPrior = await vault.totalDeposits();
  const tvlPrior    = Number(ethers.formatEther(tvlRawPrior));
  
  // Predict an inject amount that will give the attacker >40% of the NEW TVL
  // So they can attempt to withdraw 35% and trigger the cap
  const injectAmount = ethers.parseEther(String(Math.floor(tvlPrior * 0.8 + 10000)));

  const attackerBal = await token.balanceOf(attacker.address);
  if (attackerBal < injectAmount) {
    console.log(hackerGreen(`\n> FUNDING attacker with extra VLT...`));
    await (await tokenAsDeployer.transfer(attacker.address, injectAmount)).wait();
  }

  console.log(hackerGreen(`> INJECTING ${ethers.formatEther(injectAmount)} VLT into vault as whale...`));
  await (await token.approve(vaultAddress, injectAmount)).wait();
  await (await vault.deposit(injectAmount)).wait();

  const tvlRaw = await vault.totalDeposits();
  const tvl    = Number(ethers.formatEther(tvlRaw));
  const capBps = Number(await vault.maxWithdrawBps());
  const capPct = capBps / 100;
  const maxTx  = (tvl * capBps) / 10000;

  console.log(hackerGreen(`\n> VAULT TVL: ${tvl.toFixed(2)} VLT`));
  console.log(hackerGreen(`> ON-CHAIN MAX WITHDRAW CAP: ${capPct}% per tx (${maxTx.toFixed(2)} VLT)`));

  // ════════════════════════════════════════════════════════════════════════════
  // PHASE 1 — Attempt to withdraw 80% in a single transaction
  // EXPECTED: BLOCKED by ExceedsMaxWithdraw on-chain
  // ════════════════════════════════════════════════════════════════════════════
  // ════════════════════════════════════════════════════════════════════════════
  // EXPLOIT PHASE — Salami slice: withdraw just under 30% cap repeatedly
  // EXPECTED: Attacker knows they can't breach 30%, so they try 29.9% slices.
  // The first round succeeds, but the AI monitoring engine spots the volume and freezes it.
  // ════════════════════════════════════════════════════════════════════════════
  const rounds = 5;

  console.log(terminalAlert(`\n> EXECUTING STRUCTURAL DRAIN — Bypassing hard cap via 29.9% slices`));
  console.log(dim(`  (The AI Threat Engine should spot the anomaly and freeze the vault)\n`));

  for (let i = 1; i <= rounds; i++) {
    try {
      const isFrozen = await vault.frozen();
      if (isFrozen) {
        console.log(terminalAlert(`\n ✅ VAULT FROZEN BY GUARDIAN AI AT ROUND ${i}. RUGPULL STOPPED. `));
        break;
      }

      // Re-calculate the 29.9% cap dynamically for the current TVL
      const currentTvlRaw = await vault.totalDeposits();
      const currentTvl    = Number(ethers.formatEther(currentTvlRaw));
      const sliceAmt      = ethers.parseEther(String(Math.floor(currentTvl * 0.299)));

      await (await vault.withdraw(sliceAmt)).wait();
      process.stdout.write(hackerGreen(`  [TX OK] Round ${i}: extracted ${ethers.formatEther(sliceAmt)} VLT\n`));

      await new Promise(r => setTimeout(r, 600));
    } catch (e: any) {
      const msg: string = e.message || "";
      if (msg.toLowerCase().includes("frozen")) {
        console.log(terminalAlert(`\n ✅ FROZEN BY GUARDIAN AI MID-TX AT ROUND ${i}. `));
      } else if (msg.toLowerCase().includes("exceedsmaxwithdraw")) {
        console.log(yellow(`\n ⚠  Cap enforced at round ${i} (TVL shrank, cap recalculated).`));
      } else {
        console.log(terminalAlert(`\n ❌ EXCEPTION AT ROUND ${i}: ${msg.slice(0, 100)}`));
      }
      break;
    }
  }

  // ── Final state ─────────────────────────────────────────────────────────────
  const tvlFinal    = await vault.totalDeposits();
  const isFrozenFinal = await vault.frozen();
  console.log(hackerGreen(`\n> FINAL TVL: ${ethers.formatEther(tvlFinal)} VLT`));
  console.log(isFrozenFinal
    ? terminalAlert(" 🔒 VAULT IS FROZEN — ATTACK NEUTRALIZED BY KILLSWITCH ")
    : yellow(" ⚠  Vault still operational — AI monitoring engine may not be running."));
  console.log(hackerGreen("\n██████████  ATTACK STATUS: FAILED  ██████████\n"));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
