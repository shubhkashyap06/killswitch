import { ethers, upgrades } from "hardhat";

async function main() {
    console.log("=== Deploying Vault Sentinel Tiered Architecture ===");

    const [deployer] = await ethers.getSigners();
    console.log("Deployer:", deployer.address);

    // 1. Deploy Token (or attach to existing)
    const Token = await ethers.getContractFactory("VultraToken");
    const token = await Token.deploy();
    await token.waitForDeployment();
    console.log("Tokens deployed to:", token.target);

    // 2. Deploy TieredCircuitBreaker Proxy
    console.log("\nDeploying TieredCircuitBreaker (UUPS Proxy)...");
    const TieredCircuitBreaker = await ethers.getContractFactory("TieredCircuitBreaker");
    // initialize: admin, tvlBps (10% = 1000), userLimit (5000 VLT)
    const circuitBreaker = await upgrades.deployProxy(
        TieredCircuitBreaker, 
        [deployer.address, 1000, ethers.parseEther("5000")], 
        { kind: "uups" }
    );
    await circuitBreaker.waitForDeployment();
    console.log("CircuitBreaker deployed to:", circuitBreaker.target);

    // 3. Deploy AIOracleConsensus
    console.log("\nDeploying AIOracleConsensus...");
    const AIOracleConsensus = await ethers.getContractFactory("AIOracleConsensus");
    const consensus = await AIOracleConsensus.deploy(circuitBreaker.target);
    await consensus.waitForDeployment();
    console.log("AIOracleConsensus deployed to:", consensus.target);

    // 4. Deploy Upgraded Liquidity Vault
    console.log("\nDeploying LiquidityVault...");
    const LiquidityVault = await ethers.getContractFactory("LiquidityVault");
    const vault = await LiquidityVault.deploy(
        token.target,
        deployer.address,    // admin
        deployer.address,    // legacy Guardian (if keeping legacy)
        circuitBreaker.target
    );
    await vault.waitForDeployment();
    console.log("LiquidityVault deployed to:", vault.target);

    // 5. Connect Permissions
    console.log("\nWiring Roles...");
    const GUARDIAN_ROLE = await circuitBreaker.GUARDIAN_ROLE();
    await circuitBreaker.grantRole(GUARDIAN_ROLE, consensus.target);
    console.log("- Granted Consensus contract GUARDIAN_ROLE on CircuitBreaker");

    await circuitBreaker.grantRole(GUARDIAN_ROLE, vault.target);
    console.log("- Granted LiquidityVault GUARDIAN_ROLE on CircuitBreaker (for rate limiting)");

    // Done
    console.log("\n=== Deployment Complete ===");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
