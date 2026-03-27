import { expect } from "chai";
import { ethers } from "hardhat";
import { LiquidityVault, VultraToken } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";

const ONE_VLT  = ethers.parseEther("1");
const TEN_VLT  = ethers.parseEther("10");
const HOUR     = 3600;

describe("VultraToken", () => {
  let token: VultraToken;
  let owner: HardhatEthersSigner;
  let user: HardhatEthersSigner;

  beforeEach(async () => {
    [owner, user] = await ethers.getSigners();
    const VultraToken = await ethers.getContractFactory("VultraToken");
    token = await VultraToken.deploy(owner.address);
  });

  it("has correct name, symbol, decimals", async () => {
    expect(await token.name()).to.equal("Vultra Token");
    expect(await token.symbol()).to.equal("VLT");
    expect(await token.decimals()).to.equal(18);
  });

  it("mints 10M VLT to owner on deploy", async () => {
    const supply = await token.totalSupply();
    expect(supply).to.equal(ethers.parseEther("10000000"));
    expect(await token.balanceOf(owner.address)).to.equal(supply);
  });

  it("allows owner to mint additional tokens", async () => {
    await token.mint(user.address, ONE_VLT);
    expect(await token.balanceOf(user.address)).to.equal(ONE_VLT);
  });

  it("reverts mint from non-owner", async () => {
    await expect(token.connect(user).mint(user.address, ONE_VLT))
      .to.be.revertedWithCustomError(token, "OwnableUnauthorizedAccount");
  });
});

describe("LiquidityVault", () => {
  let token:    VultraToken;
  let vault:    LiquidityVault;
  let owner:    HardhatEthersSigner;
  let guardian: HardhatEthersSigner;
  let alice:    HardhatEthersSigner;
  let bob:      HardhatEthersSigner;

  const FREEZE_DURATION  = HOUR;
  const MAX_WITHDRAW_BPS = 3000; // 30%

  beforeEach(async () => {
    [owner, guardian, alice, bob] = await ethers.getSigners();

    // Deploy token
    const VultraToken = await ethers.getContractFactory("VultraToken");
    token = await VultraToken.deploy(owner.address);

    // Deploy vault
    const LiquidityVault = await ethers.getContractFactory("LiquidityVault");
    vault = await LiquidityVault.deploy(
      await token.getAddress(),
      owner.address,
      guardian.address,
      FREEZE_DURATION,
      MAX_WITHDRAW_BPS
    );

    // Fund alice + bob with 100 VLT each
    await token.mint(alice.address, ethers.parseEther("100"));
    await token.mint(bob.address,   ethers.parseEther("100"));
  });

  // ── Deposit ──────────────────────────────────────────────────────────────

  describe("deposit()", () => {
    it("accepts VLT and updates state", async () => {
      await token.connect(alice).approve(await vault.getAddress(), TEN_VLT);
      await expect(vault.connect(alice).deposit(TEN_VLT))
        .to.emit(vault, "Deposit")
        .withArgs(alice.address, TEN_VLT, TEN_VLT);

      expect(await vault.balances(alice.address)).to.equal(TEN_VLT);
      expect(await vault.totalDeposits()).to.equal(TEN_VLT);
    });

    it("reverts with ZeroAmount when amount = 0", async () => {
      await expect(vault.connect(alice).deposit(0))
        .to.be.revertedWithCustomError(vault, "ZeroAmount");
    });

    it("reverts when vault is frozen", async () => {
      await vault.connect(guardian).freeze("test freeze");
      await token.connect(alice).approve(await vault.getAddress(), ONE_VLT);
      await expect(vault.connect(alice).deposit(ONE_VLT))
        .to.be.revertedWithCustomError(vault, "VaultFrozen");
    });
  });

  // ── Withdraw ─────────────────────────────────────────────────────────────

  describe("withdraw()", () => {
    beforeEach(async () => {
      // Alice deposits 10 VLT
      await token.connect(alice).approve(await vault.getAddress(), TEN_VLT);
      await vault.connect(alice).deposit(TEN_VLT);
    });

    it("allows withdrawal within cap", async () => {
      // 30% of 10 VLT = 3 VLT
      const withdrawAmt = ethers.parseEther("3");
      await expect(vault.connect(alice).withdraw(withdrawAmt))
        .to.emit(vault, "Withdraw")
        .withArgs(alice.address, withdrawAmt, TEN_VLT - withdrawAmt);
    });

    it("reverts when exceeding max withdraw cap", async () => {
      // 31% > 30% → should revert
      const tooMuch = ethers.parseEther("3.1");
      await expect(vault.connect(alice).withdraw(tooMuch))
        .to.be.revertedWithCustomError(vault, "ExceedsMaxWithdraw");
    });

    it("reverts when user has insufficient balance", async () => {
      const tooMuch = ethers.parseEther("1"); // Bob has 0 in vault
      await expect(vault.connect(bob).withdraw(tooMuch))
        .to.be.revertedWithCustomError(vault, "InsufficientBalance");
    });

    it("reverts when vault is frozen", async () => {
      await vault.connect(guardian).freeze("attack detected");
      await expect(vault.connect(alice).withdraw(ONE_VLT))
        .to.be.revertedWithCustomError(vault, "VaultFrozen");
    });
  });

  // ── Freeze ────────────────────────────────────────────────────────────────

  describe("freeze()", () => {
    it("guardian can freeze the vault", async () => {
      await expect(vault.connect(guardian).freeze("suspicious activity"))
        .to.emit(vault, "Freeze");
      expect(await vault.isFrozen()).to.equal(true);
    });

    it("is idempotent — double freeze does NOT revert", async () => {
      await vault.connect(guardian).freeze("first");
      await expect(vault.connect(guardian).freeze("second")).to.not.be.reverted;
    });

    it("reverts if caller lacks GUARDIAN_ROLE", async () => {
      await expect(vault.connect(alice).freeze("hack attempt"))
        .to.be.revertedWithCustomError(vault, "AccessControlUnauthorizedAccount");
    });
  });

  // ── Unfreeze (time-locked) ────────────────────────────────────────────────

  describe("unfreeze()", () => {
    beforeEach(async () => {
      await vault.connect(guardian).freeze("test");
    });

    it("reverts before time-lock elapses", async () => {
      await expect(vault.connect(owner).unfreeze())
        .to.be.revertedWithCustomError(vault, "TimeLockActive");
    });

    it("succeeds after time-lock elapses", async () => {
      await time.increase(FREEZE_DURATION + 1);
      await expect(vault.connect(owner).unfreeze())
        .to.emit(vault, "Unfreeze");
      expect(await vault.isFrozen()).to.equal(false);
    });

    it("emergency unfreeze bypasses time-lock", async () => {
      await expect(vault.connect(owner).emergencyUnfreeze())
        .to.emit(vault, "EmergencyUnfreeze");
      expect(await vault.isFrozen()).to.equal(false);
    });

    it("reverts if non-admin calls unfreeze", async () => {
      await time.increase(FREEZE_DURATION + 1);
      await expect(vault.connect(alice).unfreeze())
        .to.be.revertedWithCustomError(vault, "AccessControlUnauthorizedAccount");
    });
  });

  // ── Admin Config ─────────────────────────────────────────────────────────

  describe("Admin configuration", () => {
    it("admin can update maxWithdrawBps", async () => {
      await expect(vault.connect(owner).setMaxWithdrawBps(5000))
        .to.emit(vault, "MaxWithdrawBpsUpdated")
        .withArgs(3000, 5000);
      expect(await vault.maxWithdrawBps()).to.equal(5000);
    });

    it("reverts if bps > 10000", async () => {
      await expect(vault.connect(owner).setMaxWithdrawBps(10_001))
        .to.be.revertedWithCustomError(vault, "InvalidBps");
    });

    it("admin can update freeze duration", async () => {
      await expect(vault.connect(owner).setFreezeDuration(7200))
        .to.emit(vault, "FreezeDurationUpdated")
        .withArgs(FREEZE_DURATION, 7200);
    });
  });

  // ── View Helpers ─────────────────────────────────────────────────────────

  describe("View functions", () => {
    it("timeLockRemaining returns 0 when not frozen", async () => {
      expect(await vault.timeLockRemaining()).to.equal(0);
    });

    it("timeLockRemaining returns remaining seconds when frozen", async () => {
      await vault.connect(guardian).freeze("test");
      const remaining = await vault.timeLockRemaining();
      expect(remaining).to.be.gt(0);
      expect(remaining).to.be.lte(FREEZE_DURATION);
    });

    it("maxWithdrawAmount returns correct value", async () => {
      await token.connect(alice).approve(await vault.getAddress(), TEN_VLT);
      await vault.connect(alice).deposit(TEN_VLT);
      const max = await vault.maxWithdrawAmount();
      expect(max).to.equal((TEN_VLT * 3000n) / 10_000n);
    });
  });
});
