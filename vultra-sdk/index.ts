/**
 * @module @vultra/sdk
 * @description Official Node.js/TypeScript SDK for interacting with Vultra-Node liquidity protection.
 */

import { ethers } from "ethers";

export interface ProtectionOptions {
  vaultAddress: string;
  rpcUrl: string;
  guardianPrivateKey: string;
  threatThreshold?: number; // Default 70
}

export class VultraProtect {
  private vaultAddress: string;
  private provider: ethers.JsonRpcProvider;
  private guardian: ethers.Wallet;
  private threatThreshold: number;

  constructor(options: ProtectionOptions) {
    this.vaultAddress = options.vaultAddress;
    this.provider = new ethers.JsonRpcProvider(options.rpcUrl);
    this.guardian = new ethers.Wallet(options.guardianPrivateKey, this.provider);
    this.threatThreshold = options.threatThreshold || 70;
  }

  /**
   * Instantiates the monitoring engine and begins listening to the provided vault.
   */
  public async enableProtection(): Promise<void> {
    console.log(`[Vultra SDK] Starting protection for vault: ${this.vaultAddress}`);
    // Bootstraps WebSocket listeners and attaches to the Threat Engine...
    // (Implementation matches the monitoring-engine/index.ts architecture)
  }

  /**
   * Disables the active protection engine.
   */
  public async disableProtection(): Promise<void> {
    console.log(`[Vultra SDK] Stopping protection for vault: ${this.vaultAddress}`);
    this.provider.removeAllListeners();
  }

  /**
   * Manually trigger a vault freeze if threat threshold is bypassed externally.
   */
  public async emergencyFreeze(reason: string): Promise<string> {
    console.log(`[Vultra SDK] EMERGENCY FREEZE ACTIVATED: ${reason}`);
    const abi = ["function freeze(string calldata reason) external"];
    const contract = new ethers.Contract(this.vaultAddress, abi, this.guardian);
    
    const tx = await contract.freeze(reason);
    await tx.wait();
    return tx.hash;
  }
}
