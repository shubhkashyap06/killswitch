import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("Tiered Circuit Breaker Architecture", function () {
    let admin: SignerWithAddress;
    let guardianA: SignerWithAddress;
    let guardianB: SignerWithAddress;
    let guardianC: SignerWithAddress;
    let guardianD: SignerWithAddress;
    let user: SignerWithAddress;

    let token: any;
    let circuitBreaker: any;
    let consensus: any;
    let vault: any;

    const VOTE_TYPE = {
        AIVote: [
            { name: "threatLevel", type: "uint8" },
            { name: "freezeScope", type: "uint8" },
            { name: "targetAddress", type: "address" },
            { name: "evidenceHash", type: "bytes32" },
            { name: "nonce", type: "uint256" },
            { name: "deadline", type: "uint256" }
        ]
    };

    let domain: any;

    beforeEach(async function () {
        [admin, guardianA, guardianB, guardianC, guardianD, user] = await ethers.getSigners();

        // 1. Deploy Mock Token
        const Token = await ethers.getContractFactory("MockERC20");
        token = await Token.deploy("Vultra Token", "VLT");

        // 2. Deploy Circuit Breaker (UUPS)
        const CB = await ethers.getContractFactory("TieredCircuitBreaker");
        circuitBreaker = await upgrades.deployProxy(CB, [admin.address, 1000, ethers.parseEther("5000")], { kind: "uups" });

        // 3. Deploy AI Consensus
        const Consensus = await ethers.getContractFactory("AIOracleConsensus");
        consensus = await Consensus.deploy(circuitBreaker.target);

        // Grant Roles
        const AI_NODE_ROLE = await consensus.AI_NODE_ROLE();
        await consensus.grantRole(AI_NODE_ROLE, guardianA.address);
        await consensus.grantRole(AI_NODE_ROLE, guardianB.address);
        await consensus.grantRole(AI_NODE_ROLE, guardianC.address);
        await consensus.grantRole(AI_NODE_ROLE, guardianD.address);

        const GUARDIAN_ROLE = await circuitBreaker.GUARDIAN_ROLE();
        await circuitBreaker.grantRole(GUARDIAN_ROLE, consensus.target);
        // Allow vault to use Tier 1 limits
        await circuitBreaker.grantRole(GUARDIAN_ROLE, admin.address);

        // 4. Deploy Liquidity Vault
        const Vault = await ethers.getContractFactory("LiquidityVault");
        vault = await Vault.deploy(token.target, admin.address, admin.address, circuitBreaker.target);
        
        await circuitBreaker.grantRole(GUARDIAN_ROLE, vault.target);

        // EIP-712 Domain
        const network = await ethers.provider.getNetwork();
        domain = {
            name: "VaultSentinel",
            version: "1",
            chainId: network.chainId,
            verifyingContract: consensus.target
        };
    });

    it("Should enforce Tier 1 Sliding Window TVL limits", async function () {
        // Vault has 100k TVL, max 10% (1000 bps) = 10k withdraw per hour
        await token.mint(user.address, ethers.parseEther("100000"));
        await token.connect(user).approve(vault.target, ethers.parseEther("100000"));
        await vault.connect(user).deposit(ethers.parseEther("100000"));

        // User allowed max 5000 per epoch natively via circuitBreaker init vars
        await vault.connect(user).withdraw(ethers.parseEther("4000"));
        
        // Exceed user epoch limit
        await expect(
            vault.connect(user).withdraw(ethers.parseEther("1500"))
        ).to.be.revertedWithCustomError(circuitBreaker, "RateLimitExceeded");
    });

    it("Should execute 2-of-4 AI Consensus for USER_FROZEN", async function () {
        const evidence = ethers.id("FLASH_LOAN");
        const deadline = Math.floor(Date.now() / 1000) + 1000;

        const message = {
            threatLevel: 85,
            freezeScope: 1, // USER_FROZEN
            targetAddress: user.address,
            evidenceHash: evidence,
            nonce: 0,
            deadline: deadline
        };

        const sig1 = await guardianA.signTypedData(domain, VOTE_TYPE, message);
        const sig2 = await guardianB.signTypedData(domain, VOTE_TYPE, message);

        await consensus.submitConsensus(
            85, 1, user.address, evidence, deadline, [sig1, sig2]
        );

        expect(await circuitBreaker.frozenUsers(user.address)).to.be.true;

        // Verify Vault rejects user
        await expect(
            vault.connect(user).withdraw(ethers.parseEther("100"))
        ).to.be.revertedWithCustomError(circuitBreaker, "UserIsFrozen");
    });

    it("Should revert on duplicate signatures or insufficient threshold", async function () {
        const evidence = ethers.id("EXPLIOT");
        const deadline = Math.floor(Date.now() / 1000) + 1000;

        const message = {
            threatLevel: 95,
            freezeScope: 3, // GLOBAL_FROZEN (requires 3/4)
            targetAddress: ethers.ZeroAddress,
            evidenceHash: evidence,
            nonce: 0,
            deadline: deadline
        };

        const sig1 = await guardianA.signTypedData(domain, VOTE_TYPE, message);
        const sig2 = await guardianB.signTypedData(domain, VOTE_TYPE, message);

        // Submitting with 2 signatures when 3 are required
        await expect(
            consensus.submitConsensus(95, 3, ethers.ZeroAddress, evidence, deadline, [sig1, sig2])
        ).to.be.revertedWithCustomError(consensus, "InsufficientSignatures");

        // Submitting duplicate signature to fake 3/4
        await expect(
            consensus.submitConsensus(95, 3, ethers.ZeroAddress, evidence, deadline, [sig1, sig2, sig1])
        ).to.be.revertedWithCustomError(consensus, "DuplicateSignature");
    });
});
