import { ethers } from "hardhat";

async function main() {
  const [admin] = await ethers.getSigners();
  const VAULT = "0xc3e53F4d16Ae77Db1c982e75a937B9f60FE63690";
  const vault = new ethers.Contract(VAULT, [
    "function emergencyUnfreeze() external",
    "function frozen() view returns (bool)"
  ], admin);
  const isFrozen = await vault.frozen();
  if (!isFrozen) { console.log("✅ Vault is already unfrozen."); return; }
  await (await vault.emergencyUnfreeze()).wait();
  console.log("🔓 Vault unfrozen successfully.");
}
main().catch(console.error);
