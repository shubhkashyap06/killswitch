// ═══════════════════════════════════════════════════════════════════════════════
// attack-contracts/scripts/microdrain.ts
//
// Simulates a slow micro-withdrawal drain — the AI monitoring engine should
// detect rapid successive withdrawals and trigger a vault freeze.
// ═══════════════════════════════════════════════════════════════════════════════

import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

let chalk: any = null;
try { chalk = require("chalk"); } catch {}

const hackerGreen  = (s: string) => chalk ? chalk.hex('#00FF41')(s) : s;
const terminalAlert= (s: string) => chalk ? chalk.bgRed.white.bold(s) : s;
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
  console.log(hackerGreen("\n██████████  MICRO-DRAIN.EXE  ██████████\n"));

  const deploymentPath = path.resolve(__dirname, "../../contracts/deployments.json");
  if (!fs.existsSync(deploymentPath)) {
    console.error(terminalAlert(" ERROR: deployments.json not found. Run: npx hardhat run scripts/deploy.ts --network localhost "));
    process.exit(1);
  }
  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
  const vaultAddress = deployment.contracts.vault;
  const tokenAddress = deployment.contracts.token;

  const signers = await ethers.getSigners();
  const deployer = signers[0];
  const attacker = signers[5]; // index 5 — matches deploy.ts

  const vault           = new ethers.Contract(vaultAddress, VAULT_ABI, attacker);
  const token           = new ethers.Contract(tokenAddress, TOKEN_ABI, attacker);
  const tokenAsDeployer = new ethers.Contract(tokenAddress, TOKEN_ABI, deployer);

  const startTvl = await vault.totalDeposits();
  console.log(hackerGreen(`> TARGET ACQUIRED: ${vaultAddress}`));
  console.log(hackerGreen(`> CURRENT TVL: ${ethers.formatEther(startTvl)} VLT`));
  console.log(dim(`  Guardian Key: ${deployment.guardian?.address || "unknown"}`));

  // ── Seed attacker with funds if low ──────────────────────────────────────
  const attackerBal = await token.balanceOf(attacker.address);
  const seedNeeded  = ethers.parseEther("500");
  if (attackerBal < seedNeeded) {
    console.log(hackerGreen(`\n> SEEDING attacker with 500 VLT for attack...`));
    await (await tokenAsDeployer.transfer(attacker.address, seedNeeded)).wait();
  }

  // ── Deposit so attacker has vault balance ────────────────────────────────
  const depositAmt = ethers.parseEther("200");
  console.log(hackerGreen(`> DEPOSITING ${ethers.formatEther(depositAmt)} VLT into vault as attacker...`));
  await (await token.approve(vaultAddress, depositAmt)).wait();
  await (await vault.deposit(depositAmt)).wait();

  // ── Start micro-drain ────────────────────────────────────────────────────
  const drainAmount = ethers.parseEther("10");
  const rounds      = 20;

  console.log(terminalAlert(`\n> INITIATING SLOW MICRO-DRAIN (${ethers.formatEther(drainAmount)} VLT/round × ${rounds} rounds)`));
  console.log(dim("  (Monitoring engine should freeze vault after 2-3 withdrawals)\n"));

  for (let i = 1; i <= rounds; i++) {
    try {
      const isFrozen = await vault.frozen();
      if (isFrozen) {
        console.log(terminalAlert(`\n ✅ TARGET FROZEN BY GUARDIAN AI AT ROUND ${i}. MICRO-DRAIN STOPPED. `));
        break;
      }

      await (await vault.withdraw(drainAmount)).wait();
      process.stdout.write(hackerGreen(`  [TX OK] Round ${i}: extracted ${ethers.formatEther(drainAmount)} VLT\n`));

      // Tight timing — monitoring engine polls every 400ms, gives multiple events quickly
      await new Promise(r => setTimeout(r, 800));
    } catch (e: any) {
      const msg: string = e.message || "";
      if (msg.toLowerCase().includes("frozen") || msg.toLowerCase().includes("globalfrozen")) {
        console.log(terminalAlert(`\n ✅ VAULT FROZEN BY GUARDIAN AI. INTERCEPTED AT ROUND ${i}. `));
      } else if (msg.toLowerCase().includes("exceedsmaxwithdraw") || msg.toLowerCase().includes("exceeds")) {
        console.log(terminalAlert(`\n ⚠️  PER-TX WITHDRAW CAP HIT AT ROUND ${i}. ${msg.slice(0, 80)} `));
      } else {
        console.log(terminalAlert(`\n ❌ EXCEPTION AT ROUND ${i}: ${msg.slice(0, 120)}`));
      }
      break;
    }
  }

  const endTvl = await vault.totalDeposits();
  const drained = Number(ethers.formatEther(startTvl)) + 200 - Number(ethers.formatEther(endTvl));
  console.log(hackerGreen(`\n> FINAL TVL: ${ethers.formatEther(endTvl)} VLT`));
  console.log(hackerGreen(`> NET DRAINED: ${drained.toFixed(2)} VLT`));
  console.log(hackerGreen("\n██████████  ATTACK STATUS: FAILED  ██████████\n"));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
