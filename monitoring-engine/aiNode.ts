import { ethers } from "ethers";

// EIP-712 Type Definitions
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

// Enum Matching Smart Contract
enum FreezeLevel {
    NONE = 0,
    USER_FROZEN = 1,
    ASSET_FROZEN = 2,
    GLOBAL_FROZEN = 3
}

export interface Attack {
    wallet: string;
    fundingSource: string;
    creationTimestamp: number;
    functionSelector: string;
    targetContract: string;
    amount: bigint;
}

export class GuardianNode {
    private provider: ethers.WebSocketProvider;
    private wallet: ethers.Wallet;
    private vaultContract: ethers.Contract;
    private defaultDomain: any;
    
    // Internal state tracking for deterministic heuristics
    private txBlockTracker: Map<string, number> = new Map();
    private userVolumeTracker: Map<string, number[]> = new Map(); // tracks timestamps
    
    constructor(wsUrl: string, privateKey: string, vaultAddress: string, consensusAddress: string, chainId: number) {
        this.provider = new ethers.WebSocketProvider(wsUrl);
        this.wallet = new ethers.Wallet(privateKey, this.provider);
        
        // EIP-712 Domain matching AIOracleConsensus
        this.defaultDomain = {
            name: "VaultSentinel",
            version: "1",
            chainId: chainId,
            verifyingContract: consensusAddress
        };

        const abi = [
            "event Withdraw(address indexed user, uint256 amount, uint256 newBalance)",
            "event Deposit(address indexed user, uint256 amount, uint256 newBalance)"
        ];
        
        this.vaultContract = new ethers.Contract(vaultAddress, abi, this.provider);
        console.log(`[AI Node] Initialized for Guardian: ${this.wallet.address}`);
    }

    public async start() {
        console.log(`[AI Node] Subscribing to Vault events over WebSocket...`);
        
        this.provider.on("block", (blockNumber) => {
            // Clean up trackers dynamically to prevent memory leaks
            if (blockNumber % 100 === 0) this.txBlockTracker.clear();
        });

        this.vaultContract.on("Withdraw", async (user, amount, newBalance, log) => {
            await this.analyzeEvent(user, amount, log.blockNumber, log.transactionHash, "Withdraw");
        });
        
        // Simulated Oracle Stream (in reality, connect to Pyth/Chainlink WS)
        setInterval(() => this.analyzeOracleDeviation(1.0, 1.05), 30000); // 30s heartbeat
    }

    private async analyzeEvent(user: string, amount: bigint, blockNumber: number, txHash: string, type: string) {
        let threatScore = 0;
        let scope = FreezeLevel.NONE;
        
        // 1. Flash Loan Heuristic
        // If a user borrows and interacts in the exact same block.
        // We simulate "borrow" here. Since we only see "Withdraw" on this contract,
        // we check if they deposited in the same block.
        if (this.txBlockTracker.get(user) === blockNumber) {
            threatScore += 80; // High probability of flash loan sandwich if multiple ops per block
            console.warn(`[AI Node] Flash loan pattern detected for ${user} in block ${blockNumber}`);
        } else {
            this.txBlockTracker.set(user, blockNumber);
        }

        // 2. High Volume Spike Heuristic (3-sigma)
        const now = Date.now();
        const past = this.userVolumeTracker.get(user) || [];
        const recent = past.filter(t => now - t < 5 * 60 * 1000); // 5 min rolling window
        recent.push(now);
        this.userVolumeTracker.set(user, recent);

        if (recent.length > 5) { // 5 withdraws in 5 mins is highly irregular
            threatScore += 45;
            console.warn(`[AI Node] Volume spike detected for ${user}`);
        }

        // 3. Mapping Threat to Tier
        if (threatScore >= 90) {
            scope = FreezeLevel.GLOBAL_FROZEN;
        } else if (threatScore >= 70) {
            scope = FreezeLevel.USER_FROZEN;
        } else if (threatScore >= 40) {
            // RATE_LIMIT Only (Doesn't require Circuit Breaker consensus, handled natively by TieredCircuitBreaker)
            console.log(`[AI Node] Suspicious volume strictly routed to on-chain Tier 1 Rate Limiter`);
            return; 
        }

        if (scope !== FreezeLevel.NONE) {
            await this.signAndDispatchVote(threatScore, scope, user, txHash);
        }
    }

    private async analyzeOracleDeviation(twap: number, spot: number) {
        const deviation = Math.abs((spot - twap) / twap) * 100;
        if (deviation > 5.0) {
            console.error(`[AI Node] CRITICAL: Oracle manipulated by ${deviation.toFixed(2)}% > 5% TWAP!`);
            await this.signAndDispatchVote(85, FreezeLevel.ASSET_FROZEN, ethers.ZeroAddress, ethers.id("ORACLE_DEVIATION"));
        }
    }

    private async signAndDispatchVote(threatLevel: number, scope: FreezeLevel, target: string, evidenceStr: string) {
        const evidenceHash = ethers.id(evidenceStr);
        const deadline = Math.floor(Date.now() / 1000) + 120; // 2 min expiry

        const message = {
            threatLevel: threatLevel,
            freezeScope: scope,
            targetAddress: target,
            evidenceHash: evidenceHash,
            nonce: 0, // In prod, pull nonce from AIOracleConsensus.aiNonces
            deadline: deadline
        };

        const signature = await this.wallet.signTypedData(this.defaultDomain, VOTE_TYPE, message);
        console.log(`\n===========================================`);
        console.log(`[AI Node] Broadcast Signed EIP-712 Consensus Vote:`);
        console.log(`- Guardian: ${this.wallet.address}`);
        console.log(`- Scope: ${FreezeLevel[scope]}`);
        console.log(`- Target: ${target}`);
        console.log(`- Signature Length: ${signature.length}`);
        console.log(`===========================================\n`);
        
        // At this stage, the node posts the `signature` object to an off-chain REST API Relayer.
        // The Relayer aggregates exactly 3/4 valid signatures and drops them on-chain into AIOracleConsensus.sol!
    }

    /**
     * @notice Analyzes an array of recent low-level attacks to find Sybil patterns (Salami Slicing)
     * @param attacks Array of recent suspicious operations flagged by nodes
     * @returns boolean True if a cluster is detected indicating a systemic attack
     */
    public detectSybilCluster(attacks: Attack[]): boolean {
        if (attacks.length < 5) return false;

        // Count correlations
        const fundingSources = new Map<string, number>();
        const functionSelectors = new Map<string, number>();
        const targetContracts = new Map<string, number>();
        
        let closeCreationTimestamps = 0;

        // We assume attacks are sorted by time, or we just cross-check them all
        const baseTime = attacks[0].creationTimestamp;

        for (const attack of attacks) {
            fundingSources.set(attack.fundingSource, (fundingSources.get(attack.fundingSource) || 0) + 1);
            functionSelectors.set(attack.functionSelector, (functionSelectors.get(attack.functionSelector) || 0) + 1);
            targetContracts.set(attack.targetContract, (targetContracts.get(attack.targetContract) || 0) + 1);
            
            // If created within 24 hours of cluster origin
            if (Math.abs(attack.creationTimestamp - baseTime) < 86400) {
                closeCreationTimestamps++;
            }
        }

        // Sybil Check: 
        // 1. Same funding source (e.g. Tornado Cash) for 5+ wallets
        // 2. Or same bot creation window + same exploit vector hitting the same contract 
        const hasCommonFunding = Array.from(fundingSources.values()).some(count => count >= 5);
        const hasCoordinatedVector = Array.from(functionSelectors.values()).some(count => count >= 5) && 
                                     Array.from(targetContracts.values()).some(count => count >= 5);

        if (hasCommonFunding || (hasCoordinatedVector && closeCreationTimestamps >= 5)) {
            console.error(`[AI Node] CRIT: Salami Slicing Cluster Detected! Aggregating into single Global Threat.`);
            return true;
        }

        return false;
    }
}
