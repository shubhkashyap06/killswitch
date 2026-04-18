import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("Salami Slicing Defense & Master Controller Override", function () {
    let admin: SignerWithAddress;
    let guardianA: SignerWithAddress;
    let user1: SignerWithAddress;
    let user2: SignerWithAddress;
    let user3: SignerWithAddress;
    let user4: SignerWithAddress;
    let user5: SignerWithAddress;
    let masterSigner1: SignerWithAddress;
    let masterSigner2: SignerWithAddress;
    let masterSigner3: SignerWithAddress;

    let token: any;
    let circuitBreaker: any;
    let masterController: any;
    let vault: any;

    beforeEach(async function () {
        [admin, guardianA, user1, user2, user3, user4, user5, masterSigner1, masterSigner2, masterSigner3] = await ethers.getSigners();

        const Token = await ethers.getContractFactory("MockERC20");
        token = await Token.deploy("Killswitch Token", "VLT");

        const CB = await ethers.getContractFactory("TieredCircuitBreaker");
        circuitBreaker = await upgrades.deployProxy(CB, [admin.address, 1000, ethers.parseEther("5000")], { kind: "uups" });

        const MasterController = await ethers.getContractFactory("MasterController");
        masterController = await MasterController.deploy([masterSigner1.address, masterSigner2.address, masterSigner3.address]);

        const Vault = await ethers.getContractFactory("LiquidityVault");
        vault = await Vault.deploy(token.target, admin.address, admin.address, circuitBreaker.target);
        
        // Grant permissions
        const GUARDIAN_ROLE = await circuitBreaker.GUARDIAN_ROLE();
        await circuitBreaker.grantRole(GUARDIAN_ROLE, guardianA.address);
        await circuitBreaker.grantRole(GUARDIAN_ROLE, masterController.target);
        await vault.grantRole(await vault.DEFAULT_ADMIN_ROLE(), masterController.target);

        // Pre-fund vault
        await token.mint(vault.target, ethers.parseEther("100000"));
    });

    it("TestSalamiSlicingAttack - Aggregator triggers Global Freeze after 5 separate small attacks", async function () {
        const riskScore = 250; // Total 5 attacks * 250 = 1250 risk score (>1000 threshold)
        
        // Individual checks pass (1 by 1) without triggering global freeze immediately
        await circuitBreaker.connect(guardianA).recordThreat(user1.address, riskScore);
        expect(await circuitBreaker.globalFreezeLevel()).to.equal(0);
        
        await circuitBreaker.connect(guardianA).recordThreat(user2.address, riskScore);
        await circuitBreaker.connect(guardianA).recordThreat(user3.address, riskScore);
        await circuitBreaker.connect(guardianA).recordThreat(user4.address, riskScore);
        expect(await circuitBreaker.globalFreezeLevel()).to.equal(0); // 4 attacks, still fine
        
        // 5th attack triggers the global panic
        await expect(circuitBreaker.connect(guardianA).recordThreat(user5.address, riskScore))
            .to.emit(circuitBreaker, "AggregateThreatDetected")
            .withArgs(5, 1250);

        // Global freeze is now 3 (GLOBAL_FROZEN)
        expect(await circuitBreaker.globalFreezeLevel()).to.equal(3);
    });

    it("TestMasterOverride - Master multisig forces freeze bypassing constraints", async function () {
        // AI says system is safe (no threats recorded)
        expect(await circuitBreaker.globalFreezeLevel()).to.equal(0);

        // Master controller triggers emergency freeze
        const [, data, isEmergency] = await masterController.encodeEmergencyGlobalFreeze(circuitBreaker.target);

        await masterController.connect(masterSigner1).submitTransaction(circuitBreaker.target, data, isEmergency);
        await masterController.connect(masterSigner2).confirmTransaction(0);
        await masterController.connect(masterSigner3).confirmTransaction(0);

        // Confirm 3/5 signatures triggers it instantly without waiting for timelock
        expect(await circuitBreaker.globalFreezeLevel()).to.equal(3);
    });
});
