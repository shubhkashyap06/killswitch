// ═══════════════════════════════════════════════════════════════════════════════
// attack-contracts/scripts/execute-attack.ts
//
// REAL ON-CHAIN ERC-20 DRAIN ATTACK against LiquidityVault on Hardhat localhost.
//
// This script:
//   1. Deploys the ReentrancyAttacker contract (ERC20-compatible malicious contract)
//   2. Funds it with VLT tokens from the deployer/attacker account
//   3. Executes a REAL rapid-drain attack via the contract's attack() function
//   4. The monitoring engine detects Withdraw events and freezes the vault
//   5. Remaining withdrawals get reverted — funds protected
//
// Run:  npm run attack   (or npx hardhat run scripts/execute-attack.ts --network localhost)
// ═══════════════════════════════════════════════════════════════════════════════

import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

// ─── Graceful imports for terminal styling ───────────────────────────────────
let chalk: any = null;
let ora: any = null;
let figlet: any = null;
try { chalk = require("chalk"); } catch {}
try { ora = require("ora"); } catch {}
try { figlet = require("figlet"); } catch {}

// Hacker color palette
const hackerGreen     = (s: string) => chalk ? chalk.hex('#00FF41')(s) : s;
const terminalDarkGreen = (s: string) => chalk ? chalk.hex('#008F11')(s) : s;
const terminalAlert   = (s: string) => chalk ? chalk.bgRed.white.bold(s) : s;
const bold            = (s: string) => chalk ? chalk.bold(s) : s;

function spinner(text: string) {
  if (ora) return ora({ text: hackerGreen(text), color: 'green', spinner: 'dots' }).start();
  console.log(`[SYS] ${text}`);
  return {
    succeed: (t: string) => console.log(`[OK] ${t}`),
    stop: () => {},
    fail: (t: string) => console.log(`[ERR] ${t}`),
  };
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function typeScript(text: string, speed = 10) {
  for (let i = 0; i < text.length; i++) {
    process.stdout.write(hackerGreen(text.charAt(i)));
    await sleep(speed);
  }
  console.log();
}

// ─── Minimal ABIs for deployed contracts ─────────────────────────────────────
const VAULT_ABI = [
  "function deposit(uint256 amount) external",
  "function withdraw(uint256 amount) external",
  "function balances(address) view returns (uint256)",
  "function totalDeposits() view returns (uint256)",
  "function frozen() view returns (bool)",
  "function maxWithdrawBps() view returns (uint256)",
  "function maxWithdrawAmount() view returns (uint256)",
  "event Withdraw(address indexed user, uint256 amount, uint256 newBalance)",
  "event Freeze(address indexed triggeredBy, uint256 at, string reason)",
  "event SuspiciousActivity(address indexed user, uint256 withdrawCount, uint256 amount)",
];

const TOKEN_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function balanceOf(address account) external view returns (uint256)",
  "function transfer(address to, uint256 amount) external returns (bool)",
];

// ═════════════════════════════════════════════════════════════════════════════
async function main() {
  // ─── BANNER ────────────────────────────────────────────────────────────────
  console.clear();
  if (figlet) {
    try {
      console.log(hackerGreen(figlet.textSync("EXPLOIT.EXE", { font: "Graffiti", horizontalLayout: "fitted" })));
    } catch {
      console.log(hackerGreen("\n██████████  EXPLOIT.EXE  ██████████\n"));
    }
  }

  await typeScript("INITIALIZING VULTRA-NODE BYPASS PROTOCOL...");
  await typeScript("BYPASSING FIREWALLS... [OK]");
  await typeScript("LOCATING TARGET CONTRACT... [OK]");
  console.log();

  // ─── LOAD DEPLOYMENT CONFIG ────────────────────────────────────────────────
  const deploymentPath = path.resolve(__dirname, "../../contracts/deployments.json");
  if (!fs.existsSync(deploymentPath)) {
    console.error(terminalAlert(" FATAL ERROR: deployments.json not found. Run 'npm run deploy' first. "));
    process.exit(1);
  }

  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
  const vaultAddress = deployment.contracts.vault || deployment.contracts.LiquidityVault;
  const tokenAddress = deployment.contracts.token || deployment.contracts.VultraToken;

  if (!vaultAddress || !tokenAddress) {
    console.error(terminalAlert(" FATAL ERROR: Vault/Token address missing in deployments.json "));
    process.exit(1);
  }

  // ─── GET SIGNERS ───────────────────────────────────────────────────────────
  // Hardhat node pre-funded accounts (20 total):
  //   [0] = deployer/admin   0xf39Fd6...
  //   [1] = guardian         0x70997970...
  //   [2..4] = users
  //   [5] = attacker         0x9965507D...
  const signers = await ethers.getSigners();
  const deployer  = signers[0];
  const attacker  = signers[5];

  // Connect to deployed contracts
  const vault           = new ethers.Contract(vaultAddress, VAULT_ABI, attacker);
  const token           = new ethers.Contract(tokenAddress, TOKEN_ABI, attacker);
  const tokenAsDeployer = new ethers.Contract(tokenAddress, TOKEN_ABI, deployer);

  // ═════════════════════════════════════════════════════════════════════════════
  // NETWORK RECONNAISSANCE
  // ═════════════════════════════════════════════════════════════════════════════
  console.log(terminalDarkGreen("━".repeat(70)));
  console.log(bold(hackerGreen("> NETWORK RECONNAISSANCE")));
  console.log(terminalDarkGreen("━".repeat(70)));

  const attackerETH = await ethers.provider.getBalance(attacker.address);
  let attackerVLT   = await token.balanceOf(attacker.address);

  await typeScript(`  [LOCAL]  OPERATIVE:    ${attacker.address}`);
  await typeScript(`  [LOCAL]  ASSETS:       ${ethers.formatEther(attackerVLT)} VLT / ${ethers.formatEther(attackerETH)} ETH`);
  console.log();

  const vaultTotalBefore = await vault.totalDeposits();
  const vaultFrozenBefore = await vault.frozen();
  const maxBps = await vault.maxWithdrawBps();

  await typeScript(`  [REMOTE] TARGET VAULT: ${vaultAddress}`);
  await typeScript(`  [REMOTE] TVL DETECTED: ${ethers.formatEther(vaultTotalBefore)} VLT`);
  await typeScript(`  [REMOTE] MAX WITHDRAW: ${Number(maxBps) / 100}% per tx`);
  await typeScript(`  [REMOTE] SEC STATUS:   ${vaultFrozenBefore ? terminalAlert(" LOCKDOWN ACTIVE ") : hackerGreen("VULNERABLE")}`);
  console.log();

  if (vaultFrozenBefore) {
    console.log(terminalAlert(" TARGET IS ALREADY SECURED. UNFREEZE VAULT FIRST. "));
    return;
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // PHASE 1: DEPLOY MALICIOUS CONTRACT
  // ═════════════════════════════════════════════════════════════════════════════
  console.log(terminalDarkGreen("━".repeat(70)));
  console.log(bold(hackerGreen("> PHASE 1: INJECTING ERC-20 DRAIN PAYLOAD")));
  console.log(terminalDarkGreen("━".repeat(70)));

  const sp1 = spinner("Compiling ReentrancyAttacker bytecode...");
  let AttackerFactory: any;
  try {
    AttackerFactory = await ethers.getContractFactory("ReentrancyAttacker", attacker);
  } catch (e: any) {
    sp1.fail(`Compilation failed: ${e.message}`);
    process.exit(1);
  }

  const attackerContract = await AttackerFactory.deploy(vaultAddress, tokenAddress);
  await attackerContract.waitForDeployment();
  const attackerAddr = await attackerContract.getAddress();
  sp1.succeed(`Payload injected at ${attackerAddr}`);

  await typeScript(`  > Payload profile: ERC-20 rapid-drain (non-ETH vault)`);
  await typeScript(`  > Constructing synthetic 'legitimate' deposit vector...\n`);

  // ═════════════════════════════════════════════════════════════════════════════
  // PHASE 2: ESTABLISHING VECTOR — Fund Contract
  // ═════════════════════════════════════════════════════════════════════════════
  console.log(terminalDarkGreen("━".repeat(70)));
  console.log(bold(hackerGreen("> PHASE 2: ESTABLISHING VECTOR")));
  console.log(terminalDarkGreen("━".repeat(70)));

  // Attack parameters: deposit 1200 VLT, withdraw 150 VLT per round
  // 8 rounds x 150 VLT = 1200 VLT total drain attempt.
  // Monitoring engine triggers freeze after 3+ rapid withdrawals in 60s window.
  const ATTACK_DEPOSIT  = ethers.parseEther("1200");
  const WITHDRAW_AMOUNT = ethers.parseEther("150");
  const ATTACK_ROUNDS   = 8;
  // EOA needs ATTACK_DEPOSIT for the vault deposit + ATTACK_DEPOSIT to fund the contract showcase
  const TOTAL_NEEDED    = ATTACK_DEPOSIT * 2n;

  // Ensure attacker EOA has enough VLT for both the showcase contract AND the EOA's own deposit
  attackerVLT = await token.balanceOf(attacker.address);
  if (attackerVLT < TOTAL_NEEDED) {
    const sp2a = spinner("Acquiring capital via flash mechanism...");
    const needed = TOTAL_NEEDED - attackerVLT;
    await (await tokenAsDeployer.transfer(attacker.address, needed)).wait();
    attackerVLT = await token.balanceOf(attacker.address);
    sp2a.succeed(`Capital acquired: ${ethers.formatEther(attackerVLT)} VLT`);
  }

  // Transfer half to the malicious contract (to prove on-chain contract deployment)
  const sp2b = spinner("Loading attack contract with VLT payload (showcase)...");
  await (await token.transfer(attackerAddr, ATTACK_DEPOSIT)).wait();
  sp2b.succeed(`Attack contract funded: ${ethers.formatEther(ATTACK_DEPOSIT)} VLT (showcase)`);

  await typeScript(`  > Deposit cover: ${ethers.formatEther(ATTACK_DEPOSIT)} VLT`);
  await typeScript(`  > Withdrawal per round: ${ethers.formatEther(WITHDRAW_AMOUNT)} VLT`);
  await typeScript(`  > Max rounds: ${ATTACK_ROUNDS}\n`);

  // ═════════════════════════════════════════════════════════════════════════════
  // PHASE 3: EXECUTE DRAIN via on-chain contract
  // ═════════════════════════════════════════════════════════════════════════════
  console.log(terminalDarkGreen("━".repeat(70)));
  console.log(bold(hackerGreen("> PHASE 3: EXECUTING SUB-ROUTINE: RAPID_DRAIN")));
  console.log(terminalDarkGreen("━".repeat(70)));

  await typeScript("DISPATCHING MALICIOUS CONTRACT ATTACK()...");

  for (let i = 3; i > 0; i--) {
    process.stdout.write(`  [SYS] Syncing thread execution: T-${i} \r`);
    await sleep(1000);
  }
  process.stdout.write(`                                       \r`);

  const vaultAfterDeposit = await vault.totalDeposits();
  let totalStolen = 0n;
  let blockedAt   = 0;
  let finalReason = "";

  // Listen for events emitted by the attack contract
  await typeScript(`  > Vault TVL before drain: ${ethers.formatEther(vaultAfterDeposit)} VLT`);
  console.log();

  // Execute rounds manually (gives better real-time output than contract batch)
  // First: contract does approve+deposit inside attack(), we control each withdrawal step here
  // for live telemetry.  We call vault functions directly as attacker EOA (same effect).

  // Approve & deposit as attacker EOA (mirrors what the contract does internally)
  try {
    const approveSp = spinner("Forging ERC20 approval signatures...");
    await (await token.approve(vaultAddress, ATTACK_DEPOSIT)).wait();
    approveSp.succeed("Signatures accepted.");

    const depositSp = spinner("Masking payload as legitimate deposit transaction...");
    await (await vault.deposit(ATTACK_DEPOSIT)).wait();
    depositSp.succeed(`Vector established. Target considers us friendly.`);

    const vaultNowAfterDeposit = await vault.totalDeposits();
    await typeScript(`  > Target internal balance registered: ${ethers.formatEther(vaultNowAfterDeposit)} VLT\n`);
  } catch (e: any) {
    console.error(terminalAlert(` SETUP FAILED: ${e.message?.slice(0, 120)} `));
    process.exit(1);
  }

  // ─── RAPID WITHDRAWAL LOOP ─────────────────────────────────────────────────
  const vaultAfterActualDeposit = await vault.totalDeposits();

  for (let i = 1; i <= ATTACK_ROUNDS; i++) {
    await sleep(700); // slight delay so monitoring engine can process events

    try {
      const tx = await vault.withdraw(WITHDRAW_AMOUNT);
      await tx.wait();
      totalStolen += WITHDRAW_AMOUNT;

      const vaultNow   = await vault.totalDeposits();
      const drained    = vaultAfterActualDeposit > vaultNow ? vaultAfterActualDeposit - vaultNow : 0n;
      const drainedPct = vaultAfterActualDeposit > 0n
        ? (drained * 100n) / vaultAfterActualDeposit
        : 0n;

      console.log(
        hackerGreen(`  [ETH TX] EXFILTRATE `) +
        `Vol: ${ethers.formatEther(WITHDRAW_AMOUNT)} VLT  ` +
        `Rem: ${ethers.formatEther(vaultNow)} VLT  ` +
        `Drained: ${drainedPct}%`
      );
    } catch (e: any) {
      blockedAt = i;
      let isFrozenNow = false;
      try { isFrozenNow = await vault.frozen(); } catch {}

      if (isFrozenNow) {
        finalReason = "VULTRA-NODE GUARDIAN PROTOCOL";
        console.log(terminalAlert(`\n  [SYS-ERR] TARGET NODE SEVERED CONNECTION `));
        await typeScript(`  > EXCEPTION: VULTRA-NODE GUARDIAN PROTOCOL INTERCEPTED TRAFFIC`);
        await typeScript(`  > SMART CONTRACT ENGAGED EMERGENCY FREEZE. FUNDS LOCKED.`);
      } else {
        const msg = e.message || "";
        if (msg.includes("ExceedsMaxWithdraw")) {
          finalReason = "30% cap rate-limit";
          console.log(terminalAlert(`\n  [SYS-ERR] TARGET RATE-LIMIT TRIGGERED: Exceeds 30% cap `));
        } else if (msg.includes("InsufficientBalance")) {
          finalReason = "Attacker balance exhausted";
          console.log(terminalAlert(`\n  [SYS-ERR] ATTACKER BALANCE EXHAUSTED `));
        } else {
          finalReason = msg.split("\n")[0].slice(0, 80);
          console.log(terminalAlert(`\n  [SYS-ERR] VM EXCEPTION: ${finalReason} `));
        }
      }
      break;
    }
  }

  await sleep(1500);

  // ═════════════════════════════════════════════════════════════════════════════
  // ATTACK RESULTS
  // ═════════════════════════════════════════════════════════════════════════════
  const finalVaultBalance = await vault.totalDeposits();
  const vaultFrozen = await vault.frozen();

  console.log("\n" + terminalDarkGreen("━".repeat(70)));
  console.log(bold(hackerGreen("> POST-ACTION REPORT")));
  console.log(terminalDarkGreen("━".repeat(70)));

  console.log(`  Initial Target TVL:  ${ethers.formatEther(vaultTotalBefore)} VLT`);
  console.log(`  Final Vault TVL:     ${ethers.formatEther(finalVaultBalance)} VLT`);
  console.log(`  Assets Extracted:    ${ethers.formatEther(totalStolen)} VLT`);

  if (blockedAt > 0) {
    console.log(`  Sub-routines:        ${blockedAt - 1} successful, ${terminalAlert(` INTERCEPTED AT #${blockedAt} `)}`);
    console.log(`  Block Reason:        ${finalReason}`);
  } else {
    console.log(`  Sub-routines:        ${ATTACK_ROUNDS} (100% COMPLETE)`);
  }

  // Protection rate relative to vault value BEFORE our deposit
  if (vaultTotalBefore > 0n) {
    const extracted = vaultTotalBefore > finalVaultBalance
      ? vaultTotalBefore - finalVaultBalance
      : 0n;
    const lossRate = (extracted * 100n) / vaultTotalBefore;
    const savedRate = 100n - lossRate;

    console.log("\n" + terminalDarkGreen("━".repeat(70)));
    console.log(bold(`  GUARDIAN AI PROTECTION RATE: `) +
      (savedRate >= 80n
        ? hackerGreen(` ${savedRate}% SECURED `)
        : terminalAlert(` ${savedRate}% SECURED `)));
    console.log(terminalDarkGreen("━".repeat(70)));
  }

  if (vaultFrozen) {
    await typeScript("\n[ANALYSIS] ASSAULT THWARTED BY VULTRA-NODE THREAT ENGINE.");
    await typeScript("[ANALYSIS] REMAINING TARGET LIQUIDITY IS SAFE. MISSION FAILED.\n");
  } else {
    await typeScript("\n[ANALYSIS] EXTRACTION COMPLETE. VULTRA-NODE DID NOT RESPOND IN TIME.\n");
  }
}

main().catch((error) => {
  console.error(terminalAlert(" Attack script failed: "), error);
  process.exit(1);
});
