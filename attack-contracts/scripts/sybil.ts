// ═══════════════════════════════════════════════════════════════════════════════
// attack-contracts/scripts/sybil.ts
//
// Simulates a Sybil/New Wallet flash drain targeting AI Node 2 and Node 3.
// ═══════════════════════════════════════════════════════════════════════════════

import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

let chalk: any = null;
try { chalk = require("chalk"); } catch {}

const hackerGreen = (s: string) => chalk ? chalk.hex('#00FF41')(s) : s;
const terminalAlert = (s: string) => chalk ? chalk.bgRed.white.bold(s) : s;
const bold = (s: string) => chalk ? chalk.bold(s) : s;

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
  console.log(hackerGreen("\n██████████  SYBIL-FLASH.EXE  ██████████\n"));
  
  const deploymentPath = path.resolve(__dirname, "../../contracts/deployments.json");
  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
  const vaultAddress = deployment.contracts.vault || deployment.contracts.LiquidityVault;
  const tokenAddress = deployment.contracts.token || deployment.contracts.KillswitchToken;

  const signers = await ethers.getSigners();
  const deployer = signers[0];

  // Create a brand new wallet for sybil attack
  const burnerWallet = ethers.Wallet.createRandom().connect(ethers.provider);
  console.log(hackerGreen(`> GENERATED BURNER WALLET: ${burnerWallet.address}`));

  // Fund burner with ETH and VLT
  console.log(hackerGreen(`> FUNDING BURNER FROM MIXER...`));
  await (await deployer.sendTransaction({ to: burnerWallet.address, value: ethers.parseEther("1.0") })).wait();

  const tokenAsDeployer = new ethers.Contract(tokenAddress, TOKEN_ABI, deployer);
  const fundAmount = ethers.parseEther("1500");
  await (await tokenAsDeployer.transfer(burnerWallet.address, fundAmount)).wait();

  // Connect to contracts with burner wallet
  const vault = new ethers.Contract(vaultAddress, VAULT_ABI, burnerWallet);
  const token = new ethers.Contract(tokenAddress, TOKEN_ABI, burnerWallet);

  console.log(hackerGreen(`> MASKING PAYLOAD VIA DEPOSIT...`));
  await (await token.approve(vaultAddress, fundAmount)).wait();
  await (await vault.deposit(fundAmount)).wait();

  // Flash withdraw with intentionally HIGH priority gas (simulates bot behavior)
  const withdrawAmount = ethers.parseEther("500");
  console.log(terminalAlert(`\n> EXECUTING HIGH-VELOCITY DRAIN TRANSACTIONS...`));
  
  for (let i = 1; i <= 3; i++) {
    try {
      const isFrozen = await vault.frozen();
      if (isFrozen) {
        console.log(terminalAlert(`\n TARGET PREEMPTIVELY SECURED. AI CAUGHT THE ZERO-DAY WALLET. `));
        break;
      }
      
      const tx = await vault.withdraw(withdrawAmount, {
          maxPriorityFeePerGas: ethers.parseUnits("50", "gwei"),
          maxFeePerGas: ethers.parseUnits("100", "gwei")
      });
      await tx.wait();
      process.stdout.write(hackerGreen(`  [ETH TX] Bot Flash Success: Extracted ${ethers.formatEther(withdrawAmount)} VLT\n`));
      
      await new Promise(r => setTimeout(r, 500)); // Flash behavior
    } catch (e: any) {
      if (e.message.includes("frozen")) {
         console.log(terminalAlert(`\n TARGET FROZEN BY GUARDIAN AI. SYBIL EXTRACTOR KILLED. `));
      } else {
         console.log(terminalAlert(`\n TX EXCEPTION: ${e.message.slice(0, 60)}`));
      }
      break;
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
