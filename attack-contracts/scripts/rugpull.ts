// ═══════════════════════════════════════════════════════════════════════════════
// attack-contracts/scripts/rugpull.ts
//
// Simulates a structural drain (Rugpull) targeting AI Node 4.
// ═══════════════════════════════════════════════════════════════════════════════

import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

let chalk: any = null;
try { chalk = require("chalk"); } catch {}

const hackerGreen = (s: string) => chalk ? chalk.hex('#00FF41')(s) : s;
const terminalAlert = (s: string) => chalk ? chalk.bgRed.white.bold(s) : s;

const VAULT_ABI = [
  "function deposit(uint256 amount) external",
  "function withdraw(uint256 amount) external",
  "function totalDeposits() view returns (uint256)",
  "function frozen() view returns (bool)"
];

const TOKEN_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function balanceOf(address account) external view returns (uint256)",
  "function transfer(address to, uint256 amount) external returns (bool)"
];

async function main() {
  console.clear();
  console.log(hackerGreen("\n██████████  RUGPULL.EXE  ██████████\n"));
  
  const deploymentPath = path.resolve(__dirname, "../../contracts/deployments.json");
  if (!fs.existsSync(deploymentPath)) {
    console.error(terminalAlert(" FATAL ERROR: deployments.json not found. "));
    process.exit(1);
  }

  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
  const vaultAddress = deployment.contracts.vault || deployment.contracts.LiquidityVault;
  const tokenAddress = deployment.contracts.token || deployment.contracts.VultraToken;

  const signers = await ethers.getSigners();
  const deployer = signers[0];
  const attacker = signers[6]; // Use a different account for this attack

  const vault = new ethers.Contract(vaultAddress, VAULT_ABI, attacker);
  const token = new ethers.Contract(tokenAddress, TOKEN_ABI, attacker);
  const tokenAsDeployer = new ethers.Contract(tokenAddress, TOKEN_ABI, deployer);

  console.log(hackerGreen(`> RUGPULL TARGET ACQUIRED: ${vaultAddress}`));
  
  // Fund attacker with a huge amount to simulate a whale or flash loan
  const massiveAmount = ethers.parseEther("50000");
  await (await tokenAsDeployer.transfer(attacker.address, massiveAmount)).wait();
  
  console.log(hackerGreen(`> Injecting ${ethers.formatEther(massiveAmount)} VLT into target...`));
  await (await token.approve(vaultAddress, massiveAmount)).wait();
  await (await vault.deposit(massiveAmount)).wait();

  const vaultTotalBefore = await vault.totalDeposits();
  console.log(hackerGreen(`> Vault TVL is now: ${ethers.formatEther(vaultTotalBefore)} VLT`));
  
  // Attempt to withdraw almost everything at once
  const drainAmount = massiveAmount;
  console.log(terminalAlert(`\n> EXECUTING MASSIVE STRUCTURAL DRAIN: ${ethers.formatEther(drainAmount)} VLT`));
  
  try {
    const tx = await vault.withdraw(drainAmount);
    await tx.wait();
    console.log(terminalAlert(" RUGPULL SUCCEEDED (This should not happen if limits/AI are working) "));
  } catch (e: any) {
    console.log(hackerGreen(`\n> SYSTEM REVERTED TRANSACTION`));
    console.log(`> Reason: ${e.message.split("\n")[0].slice(0, 100)}`);
  }

  // We wait a moment to see if AI catches this and triggers freeze
  console.log(hackerGreen("\n> Awaiting AI Node 4 (Exploit Analysis) response..."));
  await new Promise(r => setTimeout(r, 3000));
  
  const isFrozen = await vault.frozen();
  if (isFrozen) {
    console.log(terminalAlert(" TARGET FROZEN BY GUARDIAN AI. ATTACK NEUTRALIZED. "));
  } else {
    console.log(hackerGreen(" TARGET IS STILL VULNERABLE. "));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
