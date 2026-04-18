import { ethers } from "hardhat";
import fs from "fs";
import path from "path";

async function main() {
  console.log("🚀 Deploying Vultra-Node contracts...\n");
 
  // ─── SIGNERS ────────────────────────────────────────────────────────────────
  const [
    deployer,   
    guardian,   
    user1,      
    user2,      
    user3,      
    attacker,   
  ] = await ethers.getSigners();
 
  console.log("👤 Deployer (Admin):", deployer.address);
  console.log("🛡️  Guardian:        ", guardian.address);
  console.log("👥 User1:           ", user1.address);
  console.log("💀 Attacker:        ", attacker.address);
  console.log();
 
  // ─── DEPLOY TOKEN ────────────────────────────────────────────────────────────
  const VultraToken = await ethers.getContractFactory("VultraToken");
  const token = await VultraToken.deploy(deployer.address);
  await token.waitForDeployment();
  const tokenAddress = await token.getAddress();
  console.log("✅ VultraToken deployed:", tokenAddress);
 
  // ─── DEPLOY VAULT ────────────────────────────────────────────────────────────
  const guardians = [guardian.address];
  const requiredVotes = 1; 
  const freezeDuration = 3600;
  const maxWithdrawBps = 3000;
 
  const LiquidityVault = await ethers.getContractFactory("LiquidityVault");
  
  // Adjusted to match the LiquidityVault.sol constructor we currently have
  const vault = await LiquidityVault.deploy(
    tokenAddress,
    deployer.address, // admin
    guardian.address, // guardian (for local non-BFT constructor compatibility)
    freezeDuration,
    maxWithdrawBps
  );
  await vault.waitForDeployment();
  const vaultAddress = await vault.getAddress();
  console.log("✅ LiquidityVault deployed:", vaultAddress);
  console.log(`   Guardian: ${guardian.address}`);
  console.log(`   Required votes to freeze: ${requiredVotes}`);
  console.log();
 
  // ─── FUND TEST ACCOUNTS WITH TOKENS ──────────────────────────────────────────
  const FUND_AMOUNT = ethers.parseEther("1000"); 
 
  const usersToFund = [
    { wallet: user1,    label: "User1" },
    { wallet: user2,    label: "User2" },
    { wallet: user3,    label: "User3" },
    { wallet: attacker, label: "Attacker" },
  ];
 
  for (const { wallet, label } of usersToFund) {
    const tx = await token.transfer(wallet.address, FUND_AMOUNT);
    await tx.wait();
    console.log(`💸 Funded ${label} (${wallet.address.slice(0, 8)}...) with 1000 VLT`);
  }
  console.log();
 
  // ─── SEED VAULT WITH INITIAL LIQUIDITY ───────────────────────────────────────
  const SEED_AMOUNT = ethers.parseEther("5000");
  await (await token.approve(vaultAddress, SEED_AMOUNT)).wait();
  await (await vault.deposit(SEED_AMOUNT)).wait();
  console.log("🏦 Vault seeded with 5000 VLT initial liquidity");
  console.log();
 
  // ─── BUILD CONFIG OBJECT ─────────────────────────────────────────────────────
  const network = await ethers.provider.getNetwork();
 
  const config = {
    network: network.name === "unknown" ? "localhost" : network.name,
    chainId: Number(network.chainId),
    deployedAt: new Date().toISOString(),
    contracts: {
      vault:  vaultAddress,
      token:  tokenAddress,
    },
    guardian: {
      address:       guardian.address,
      requiredVotes,
      totalGuardians: guardians.length,
    },
    admin: {
      address: deployer.address,
      role: "Can emergencyUnfreeze() and setMaxWithdrawBps(). Never has freeze power.",
    },
    accounts: {
      deployer: deployer.address,
      guardian: guardian.address,
      user1:    user1.address,
      user2:    user2.address,
      user3:    user3.address,
      attacker: attacker.address,
    },
  };
 
  // ─── EXPORT TO ALL MODULES ───────────────────────────────────────────────────
  const scriptDir = __dirname;
  const projectRoot = path.resolve(scriptDir, "../..");
 
  const exportTargets = [
    {
      label: "Frontend (Next.js)",
      filePath: path.join(projectRoot, "vultra-node", "config", "contracts.json"),
    },
    {
      label: "Monitoring Engine",
      filePath: path.join(projectRoot, "monitoring-engine", "config", "contracts.json"),
    },
    {
      label: "Attack Simulator",
      filePath: path.join(projectRoot, "attack-simulator", "config", "contracts.json"),
    },
    {
      label: "Contracts (local cache)",
      filePath: path.join(scriptDir, "../deployments.json"),
    },
  ];
 
  for (const target of exportTargets) {
    const dir = path.dirname(target.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(target.filePath, JSON.stringify(config, null, 2));
    console.log(`📁 Config → ${target.label}`);
    console.log(`   ${target.filePath}`);
  }
 
  // ─── ALSO AUTO-UPDATE FRONTEND .env.local ────────────────────────────────────
  const envLocalPath = path.join(projectRoot, "vultra-node", ".env.local");
  
  let existingEnv = "";
  if (fs.existsSync(envLocalPath)) {
      existingEnv = fs.readFileSync(envLocalPath, "utf8");
  }

  // Parse existing vars and remove the ones we are about to overwrite
  const lines = existingEnv.split("\n");
  const preservedLines = lines.filter(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("# Auto-generated")) return false;
      if (trimmed.startsWith("NEXT_PUBLIC_VAULT_ADDRESS=")) return false;
      if (trimmed.startsWith("NEXT_PUBLIC_TOKEN_ADDRESS=")) return false;
      if (trimmed.startsWith("NEXT_PUBLIC_CHAIN_ID=")) return false;
      if (trimmed.startsWith("NEXT_PUBLIC_ALCHEMY_HTTP=")) return false;
      return true;
  });
  
  const envContent = [
    ...preservedLines,
    `NEXT_PUBLIC_VAULT_ADDRESS=${vaultAddress}`,
    `NEXT_PUBLIC_TOKEN_ADDRESS=${tokenAddress}`,
    `NEXT_PUBLIC_CHAIN_ID=${Number(network.chainId)}`,
    `NEXT_PUBLIC_ALCHEMY_HTTP=http://127.0.0.1:8545`,
    `# Auto-generated by deploy.ts at ${new Date().toISOString()}`,
  ].join("\n");
 
  fs.writeFileSync(envLocalPath, envContent);
  console.log(`\n⚙️  Frontend .env.local auto-updated (preserved existing custom vars)`);
 
  // ─── SUMMARY ─────────────────────────────────────────────────────────────────
  console.log("\n" + "─".repeat(56));
  console.log("🎉 DEPLOYMENT COMPLETE");
  console.log("─".repeat(56));
  console.log(`Network:   ${config.network} (chainId: ${config.chainId})`);
  console.log(`Vault:     ${vaultAddress}`);
  console.log(`Token:     ${tokenAddress}`);
  console.log(`Admin:     ${deployer.address}`);
  console.log(`Guardian:  ${guardian.address}`);
  console.log(`Attacker:  ${attacker.address}`);
  console.log("─".repeat(56));
  console.log("Next steps:");
  console.log("  1. cd monitoring-engine && npm run dev");
  console.log("  2. cd vultra-node       && npm run dev");
  console.log("  3. Run attack: npx hardhat run scripts/attack.ts --network localhost");
  console.log("─".repeat(56));
}
 
main().catch((err) => {
  console.error("❌ Deployment failed:", err);
  process.exit(1);
});
