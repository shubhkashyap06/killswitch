import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("\n🚀 Deploying Vultra-Node contracts...");
  console.log(`   Deployer: ${deployer.address}`);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`   Balance:  ${ethers.formatEther(balance)} ETH\n`);

  // ── 1. Deploy VultraToken ────────────────────────────────────────────────
  console.log("📦 Deploying VultraToken...");
  const VultraToken = await ethers.getContractFactory("VultraToken");
  const token = await VultraToken.deploy(deployer.address);
  await token.waitForDeployment();
  const tokenAddress = await token.getAddress();
  console.log(`   ✅ VultraToken deployed at: ${tokenAddress}`);

  // ── 2. Deploy LiquidityVault ─────────────────────────────────────────────
  console.log("\n📦 Deploying LiquidityVault...");

  const ADMIN_ADDRESS    = deployer.address;
  // In production: set GUARDIAN to your monitoring engine wallet address
  const GUARDIAN_ADDRESS = process.env.GUARDIAN_ADDRESS || deployer.address;
  const FREEZE_DURATION  = 60 * 60; // 1 hour in seconds
  const MAX_WITHDRAW_BPS = 3000;    // 30%

  const LiquidityVault = await ethers.getContractFactory("LiquidityVault");
  const vault = await LiquidityVault.deploy(
    tokenAddress,
    ADMIN_ADDRESS,
    GUARDIAN_ADDRESS,
    FREEZE_DURATION,
    MAX_WITHDRAW_BPS
  );
  await vault.waitForDeployment();
  const vaultAddress = await vault.getAddress();
  console.log(`   ✅ LiquidityVault deployed at: ${vaultAddress}`);
  console.log(`      Admin:           ${ADMIN_ADDRESS}`);
  console.log(`      Guardian:        ${GUARDIAN_ADDRESS}`);
  console.log(`      Freeze Duration: ${FREEZE_DURATION}s (${FREEZE_DURATION / 3600}h)`);
  console.log(`      Max Withdraw:    ${MAX_WITHDRAW_BPS / 100}%`);

  // ── 3. Save deployment addresses ────────────────────────────────────────
  const deployment = {
    network: (await ethers.provider.getNetwork()).name,
    chainId: Number((await ethers.provider.getNetwork()).chainId),
    deployedAt: new Date().toISOString(),
    deployer: deployer.address,
    contracts: {
      VultraToken:     tokenAddress,
      LiquidityVault:  vaultAddress,
    },
    config: {
      freezeDuration:  FREEZE_DURATION,
      maxWithdrawBps:  MAX_WITHDRAW_BPS,
      guardianAddress: GUARDIAN_ADDRESS,
    },
  };

  const outPath = path.join(__dirname, "../deployments.json");
  fs.writeFileSync(outPath, JSON.stringify(deployment, null, 2));
  console.log(`\n📄 Deployment saved to: ${outPath}`);

  // Also write to frontend env file so wagmi picks up addresses
  const frontendEnvPath = path.join(
    __dirname,
    "../../vultra-node/.env.local"
  );
  const envContent = [
    `NEXT_PUBLIC_VLT_TOKEN_ADDRESS=${tokenAddress}`,
    `NEXT_PUBLIC_VAULT_ADDRESS=${vaultAddress}`,
    `NEXT_PUBLIC_CHAIN_ID=${deployment.chainId}`,
  ].join("\n") + "\n";
  fs.writeFileSync(frontendEnvPath, envContent, { flag: "w" });
  console.log(`   ✅ Frontend .env.local updated: ${frontendEnvPath}`);

  console.log("\n🎉 All contracts deployed successfully!\n");
}

main().catch((error) => {
  console.error("❌ Deployment failed:", error);
  process.exitCode = 1;
});
