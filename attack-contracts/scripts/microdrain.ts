// ═══════════════════════════════════════════════════════════════════════════════
// attack-contracts/scripts/microdrain.ts
//
// Simulates a slow micro-withdrawal drain targeting AI Node 1.
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
  "function balanceOf(address account) external view returns (bool)",
  "function transfer(address to, uint256 amount) external returns (bool)"
];

async function main() {
  console.clear();
  console.log(hackerGreen("\n██████████  MICRO-DRAIN.EXE  ██████████\n"));
  
  const deploymentPath = path.resolve(__dirname, "../../contracts/deployments.json");
  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
  const vaultAddress = deployment.contracts.vault || deployment.contracts.LiquidityVault;
  const tokenAddress = deployment.contracts.token || deployment.contracts.KillswitchToken;

  const signers = await ethers.getSigners();
  const deployer = signers[0];
  const attacker = signers[7];

  const vault = new ethers.Contract(vaultAddress, VAULT_ABI, attacker);
  const token = new ethers.Contract(tokenAddress, TOKEN_ABI, attacker);
  const tokenAsDeployer = new ethers.Contract(tokenAddress, TOKEN_ABI, deployer);

  const startTvl = await vault.totalDeposits();
  console.log(hackerGreen(`> TARGET ACQUIRED: ${vaultAddress}`));
  console.log(hackerGreen(`> CURRENT TVL: ${ethers.formatEther(startTvl)} VLT`));
  
  const amountToSeed = ethers.parseEther("1000");
  await (await tokenAsDeployer.transfer(attacker.address, amountToSeed)).wait();
  await (await token.approve(vaultAddress, amountToSeed)).wait();
  await (await vault.deposit(amountToSeed)).wait();

  // Withdraw slowly in small chunks
  const drainAmount = ethers.parseEther("10"); // small amounts
  const rounds = 15;

  console.log(terminalAlert(`\n> INITIATING SLOW MICRO-DRAIN (${ethers.formatEther(drainAmount)} VLT/round)`));
  
  for (let i = 1; i <= rounds; i++) {
    try {
      const isFrozen = await vault.frozen();
      if (isFrozen) {
        console.log(terminalAlert(`\n TARGET FROZEN BY AI AT ROUND ${i}. MICRO-DRAIN STOPPED. `));
        break;
      }

      await (await vault.withdraw(drainAmount)).wait();
      process.stdout.write(hackerGreen(`  [ETH TX] Success: Round ${i} extricated ${ethers.formatEther(drainAmount)} VLT\n`));
      
      // Wait to simulate slow time-decay bypass try
      await new Promise(r => setTimeout(r, 1500));
    } catch (e: any) {
      if (e.message.includes("frozen")) {
         console.log(terminalAlert(`\n TARGET FROZEN BY GUARDIAN AI. INTERCEPTED AT ROUND ${i}. `));
      } else {
         console.log(terminalAlert(`\n EXCEPTION AT ROUND ${i}: ${e.message.slice(0, 60)}`));
      }
      break;
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
