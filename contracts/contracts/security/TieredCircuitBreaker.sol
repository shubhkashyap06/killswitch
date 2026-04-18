// SPDX-License-Identifier: MIT
pragma solidity >=0.8.20;

import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

// ────────────────────────────────────────────────────────────────────────────
// ERRORS
// ────────────────────────────────────────────────────────────────────────────
error VaultGloballyFrozen();
error AssetIsFrozen(address asset);
error UserIsFrozen(address user);
error RateLimitExceeded(address user, uint256 attempted, uint256 cap);
error InvalidConfiguration();

// ────────────────────────────────────────────────────────────────────────────
// ENUMS
// ────────────────────────────────────────────────────────────────────────────
enum FreezeLevel {
    NONE,           // Normal operations
    USER_FROZEN,    // Specific address blocked (Tier 2)
    ASSET_FROZEN,   // Single token/pool halted (Tier 3)
    GLOBAL_FROZEN   // Entire vault halted (Tier 4)
}

/**
 * @title TieredCircuitBreaker
 * @notice Guardian-centric rules engine separating rate limit thresholds and tiered freezes.
 *         Upgrades local memory rate-limiting to on-chain sliding window checkpoints.
 */
contract TieredCircuitBreaker is Initializable, AccessControlUpgradeable, UUPSUpgradeable {
    bytes32 public constant GUARDIAN_ROLE = keccak256("GUARDIAN_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

    // ── Global State ──
    FreezeLevel public globalFreezeLevel;

    // ── Granular Freezes ──
    mapping(address => bool) public frozenUsers;
    mapping(address => bool) public frozenAssets;

    // ── Rate Limiting (Tier 1) ──
    uint256 public constant RATE_LIMIT_WINDOW = 1 hours;
    
    // Configurable basis points for TVL global hourly limit (e.g. 1000 = 10%)
    uint256 public maxTVLWithdrawBps;
    
    // Configurable flat cap per user per epoch
    uint256 public maxUserWithdrawPerEpoch;

    // Sliding window logic structs
    struct RateCheck {
        uint256 amount;
        uint256 timestamp;
    }

    // epoch mapping: epochId = timestamp / RATE_LIMIT_WINDOW
    // We map epoch => total withdrawals globally to track TVL velocity
    mapping(uint256 => uint256) public globalEpochWithdrawals;
    
    // We map user => epoch => partial amounts
    mapping(address => mapping(uint256 => uint256)) public userEpochWithdrawals;

    // ── Threat Aggregation (Salami Slicing) ──
    mapping(address => uint256) public accountRiskScore;
    uint256 public globalRiskScore;
    uint256 public attackCount;
    uint256 public lastGlobalFreezeTime;
    uint256 public windowStartTime;

    uint256 public constant GLOBAL_ATTACK_THRESHOLD = 5;
    uint256 public constant GLOBAL_RISK_SCORE_CAP = 1000;
    uint256 public constant AGGREGATE_TIME_WINDOW = 60 seconds;

    // ── Events ──
    event TierStatusChanged(FreezeLevel level, address target, string reason);
    event RateLimitTriggered(address indexed user, uint256 attempted, uint256 cap);
    event RateLimitsUpdated(uint256 newTvlBps, uint256 newUserCap);
    event AggregateThreatDetected(uint256 attackCount, uint256 totalRisk);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initializes proxy storage
     */
    function initialize(
        address admin, 
        uint256 _maxTVLWithdrawBps, 
        uint256 _maxUserWithdrawPerEpoch
    ) public initializer {
        __AccessControl_init();
        __UUPSUpgradeable_init();

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(UPGRADER_ROLE, admin);
        _grantRole(GUARDIAN_ROLE, admin);

        if (_maxTVLWithdrawBps > 10000) revert InvalidConfiguration();
        
        maxTVLWithdrawBps = _maxTVLWithdrawBps;
        maxUserWithdrawPerEpoch = _maxUserWithdrawPerEpoch;
    }

    /**
     * @notice Asserts that the vault is safely actionable for the user and asset.
     *         Checks global tier, asset tier, user tier, and runs rate limiting.
     */
    function checkAndRecordWithdrawal(
        address user, 
        address asset, 
        uint256 amount, 
        uint256 currentTVL
    ) external onlyRole(GUARDIAN_ROLE) {
        // Evaluate Freeze Tiers
        if (globalFreezeLevel == FreezeLevel.GLOBAL_FROZEN) revert VaultGloballyFrozen();
        if (frozenAssets[asset]) revert AssetIsFrozen(asset);
        if (frozenUsers[user]) revert UserIsFrozen(user);

        // Evaluate Tier 1 Rate Limiting (Sliding Epoch Window)
        uint256 epochId = block.timestamp / RATE_LIMIT_WINDOW;

        // User constraint
        uint256 newUserTotal = userEpochWithdrawals[user][epochId] + amount;
        if (newUserTotal > maxUserWithdrawPerEpoch) {
            emit RateLimitTriggered(user, newUserTotal, maxUserWithdrawPerEpoch);
            revert RateLimitExceeded(user, newUserTotal, maxUserWithdrawPerEpoch);
        }

        // Global TVL velocity constraint
        uint256 limitAmount = (currentTVL * maxTVLWithdrawBps) / 10000;
        uint256 newGlobalTotal = globalEpochWithdrawals[epochId] + amount;
        
        if (newGlobalTotal > limitAmount && limitAmount > 0) {
            emit RateLimitTriggered(address(0), newGlobalTotal, limitAmount);
            revert RateLimitExceeded(address(0), newGlobalTotal, limitAmount);
        }

        // Apply if passed
        userEpochWithdrawals[user][epochId] = newUserTotal;
        globalEpochWithdrawals[epochId] = newGlobalTotal;
    }

    // ────────────────────────────────────────────────────────────────────────────
    // TIER STATE MUTATORS (Called by Consensus Engine or Admin)
    // ────────────────────────────────────────────────────────────────────────────

    function setGlobalFreeze(bool frozen, string calldata reason) external onlyRole(GUARDIAN_ROLE) {
        globalFreezeLevel = frozen ? FreezeLevel.GLOBAL_FROZEN : FreezeLevel.NONE;
        emit TierStatusChanged(globalFreezeLevel, address(0), reason);
    }

    function setAssetFreeze(address asset, bool frozen, string calldata reason) external onlyRole(GUARDIAN_ROLE) {
        frozenAssets[asset] = frozen;
        emit TierStatusChanged(frozen ? FreezeLevel.ASSET_FROZEN : FreezeLevel.NONE, asset, reason);
    }

    function setUserFreeze(address user, bool frozen, string calldata reason) external onlyRole(GUARDIAN_ROLE) {
        frozenUsers[user] = frozen;
        emit TierStatusChanged(frozen ? FreezeLevel.USER_FROZEN : FreezeLevel.NONE, user, reason);
    }

    function updateRateLimits(uint256 tvlBps, uint256 userCap) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (tvlBps > 10000) revert InvalidConfiguration();
        maxTVLWithdrawBps = tvlBps;
        maxUserWithdrawPerEpoch = userCap;
        emit RateLimitsUpdated(tvlBps, userCap);
    }

    // ────────────────────────────────────────────────────────────────────────────
    // THREAT AGGREGATOR (Salami Slicing Detection)
    // ────────────────────────────────────────────────────────────────────────────

    function recordThreat(address user, uint256 riskAmount) external onlyRole(GUARDIAN_ROLE) {
        if (block.timestamp - windowStartTime > AGGREGATE_TIME_WINDOW) {
            // Reset sliding window
            windowStartTime = block.timestamp;
            attackCount = 0;
            globalRiskScore = 0;
        }

        if (accountRiskScore[user] == 0) {
            attackCount++;
        }
        
        accountRiskScore[user] += riskAmount;
        globalRiskScore += riskAmount;

        _checkAggregateThreat();
    }

    function _checkAggregateThreat() internal {
        if (attackCount >= GLOBAL_ATTACK_THRESHOLD && globalRiskScore > GLOBAL_RISK_SCORE_CAP) {
            if (block.timestamp - windowStartTime <= AGGREGATE_TIME_WINDOW) {
                globalFreezeLevel = FreezeLevel.GLOBAL_FROZEN;
                lastGlobalFreezeTime = block.timestamp;
                emit AggregateThreatDetected(attackCount, globalRiskScore);
                emit TierStatusChanged(globalFreezeLevel, address(0), "SALAMI_SLICING_DETECTED");
            }
        }
    }

    function clearUserRisk(address user) external onlyRole(GUARDIAN_ROLE) {
        if (accountRiskScore[user] > 0) {
            globalRiskScore -= accountRiskScore[user];
            accountRiskScore[user] = 0;
            if (attackCount > 0) attackCount--;
        }
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyRole(UPGRADER_ROLE) {}
}
