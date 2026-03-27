// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title  LiquidityVault
 * @notice Core vault contract for Vultra-Node intelligent liquidity protection.
 *
 * @dev    Architecture overview (production integration):
 *         ┌─────────────────┐     on-chain events     ┌──────────────────────┐
 *         │  Next.js UI     │ ◄── WebSocket RPC ──── │  Monitoring Engine   │
 *         │  (defender)     │                         │  (Node.js / Ethers)  │
 *         └────────┬────────┘                         └──────────┬───────────┘
 *                  │ wagmi calls                                 │ GUARDIAN role
 *                  ▼                                             ▼
 *         ┌─────────────────────────────────────────────────────────────────┐
 *         │                       LiquidityVault.sol                         │
 *         │  deposit()  withdraw()  freeze()  unfreeze()  emergencyUnfreeze() │
 *         └─────────────────────────────────────────────────────────────────┘
 *
 * Roles
 * ─────
 *  DEFAULT_ADMIN_ROLE (ADMIN) — deployer; can grant/revoke roles, tweak params,
 *                               call emergencyUnfreeze() bypassing time-lock.
 *  GUARDIAN_ROLE              — assigned to the monitoring engine wallet;
 *                               can ONLY call freeze() — nothing else.
 *
 * Time-lock
 * ─────────
 *  After a freeze, the vault cannot be unfrozen before `frozenAt + freezeDuration`
 *  elapses. The admin can always override via `emergencyUnfreeze()`.
 *
 * Withdraw cap
 * ────────────
 *  A single withdraw cannot exceed MAX_WITHDRAW_BPS of total deposits.
 *  Default: 3000 bps = 30%.  Configurable by admin.
 */
contract LiquidityVault is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ─── Roles ───────────────────────────────────────────────────────────────
    bytes32 public constant GUARDIAN_ROLE = keccak256("GUARDIAN_ROLE");

    // ─── Immutables ──────────────────────────────────────────────────────────
    IERC20 public immutable token; // VLT

    // ─── State ───────────────────────────────────────────────────────────────
    mapping(address => uint256) public balances;
    uint256 public totalDeposits;

    bool public isFrozen;
    uint256 public frozenAt;
    uint256 public freezeDuration; // seconds; default 1 hour

    /// @notice Max single-withdraw as basis points of totalDeposits (10000 = 100%)
    uint256 public maxWithdrawBps; // default 3000 (30%)

    // ─── Events ──────────────────────────────────────────────────────────────
    event Deposit(address indexed user, uint256 amount, uint256 newBalance);
    event Withdraw(address indexed user, uint256 amount, uint256 newBalance);
    event Freeze(address indexed triggeredBy, uint256 at, string reason);
    event Unfreeze(address indexed triggeredBy, uint256 at);
    event EmergencyUnfreeze(address indexed admin, uint256 at);
    event MaxWithdrawBpsUpdated(uint256 oldBps, uint256 newBps);
    event FreezeDurationUpdated(uint256 oldDuration, uint256 newDuration);

    // ─── Errors ──────────────────────────────────────────────────────────────
    error VaultFrozen();
    error VaultNotFrozen();
    error TimeLockActive(uint256 frozenAt, uint256 duration, uint256 remaining);
    error ExceedsMaxWithdraw(uint256 requested, uint256 maxAllowed);
    error InsufficientBalance(uint256 requested, uint256 available);
    error InvalidBps(uint256 bps);
    error ZeroAmount();

    // ─── Constructor ─────────────────────────────────────────────────────────
    constructor(
        address _token,
        address _admin,
        address _guardian,
        uint256 _freezeDuration,   // e.g. 3600 = 1 hour
        uint256 _maxWithdrawBps    // e.g. 3000 = 30%
    ) {
        require(_token   != address(0), "Invalid token");
        require(_admin   != address(0), "Invalid admin");
        require(_guardian != address(0), "Invalid guardian");
        require(_maxWithdrawBps <= 10_000, "BPS > 100%");

        token = IERC20(_token);
        freezeDuration = _freezeDuration;
        maxWithdrawBps = _maxWithdrawBps;

        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(GUARDIAN_ROLE, _guardian);
    }

    // ─── Modifiers ───────────────────────────────────────────────────────────
    modifier whenNotFrozen() {
        if (isFrozen) revert VaultFrozen();
        _;
    }

    modifier whenFrozen() {
        if (!isFrozen) revert VaultNotFrozen();
        _;
    }

    // ─── User Functions ───────────────────────────────────────────────────────

    /**
     * @notice Deposit VLT tokens into the vault.
     * @param amount Amount of VLT (in wei) to deposit.
     * @dev    Caller must have approved this contract for `amount` first.
     */
    function deposit(uint256 amount) external nonReentrant whenNotFrozen {
        if (amount == 0) revert ZeroAmount();

        token.safeTransferFrom(msg.sender, address(this), amount);
        balances[msg.sender] += amount;
        totalDeposits += amount;

        emit Deposit(msg.sender, amount, balances[msg.sender]);
    }

    /**
     * @notice Withdraw VLT tokens from the vault.
     * @param amount Amount of VLT (in wei) to withdraw.
     * @dev    Blocked when frozen. Single tx cannot exceed maxWithdrawBps of totalDeposits.
     */
    function withdraw(uint256 amount) external nonReentrant whenNotFrozen {
        if (amount == 0) revert ZeroAmount();

        if (amount > balances[msg.sender])
            revert InsufficientBalance(amount, balances[msg.sender]);

        if (totalDeposits > 0) {
            uint256 maxAllowed = (totalDeposits * maxWithdrawBps) / 10_000;
            if (amount > maxAllowed)
                revert ExceedsMaxWithdraw(amount, maxAllowed);
        }

        balances[msg.sender] -= amount;
        totalDeposits -= amount;
        token.safeTransfer(msg.sender, amount);

        emit Withdraw(msg.sender, amount, balances[msg.sender]);
    }

    // ─── Security Functions ──────────────────────────────────────────────────

    /**
     * @notice Freeze the vault. Only callable by GUARDIAN (monitoring engine).
     * @param reason Short human-readable reason string for audit trail.
     * @dev    Emits Freeze event; monitoring engine calls this when threat >= 70.
     */
    function freeze(string calldata reason) external onlyRole(GUARDIAN_ROLE) {
        if (isFrozen) return; // idempotent — already frozen
        isFrozen = true;
        frozenAt = block.timestamp;
        emit Freeze(msg.sender, block.timestamp, reason);
    }

    /**
     * @notice Unfreeze the vault (time-lock enforced).
     * @dev    Only callable by ADMIN. Reverts if freezeDuration has not elapsed.
     */
    function unfreeze() external onlyRole(DEFAULT_ADMIN_ROLE) whenFrozen {
        uint256 elapsed = block.timestamp - frozenAt;
        if (elapsed < freezeDuration)
            revert TimeLockActive(frozenAt, freezeDuration, freezeDuration - elapsed);

        isFrozen = false;
        emit Unfreeze(msg.sender, block.timestamp);
    }

    /**
     * @notice Emergency unfreeze — bypasses time-lock. ADMIN only.
     * @dev    Use when freezeDuration has NOT elapsed but situation is resolved.
     *         Emits a separate EmergencyUnfreeze event for audit clarity.
     */
    function emergencyUnfreeze() external onlyRole(DEFAULT_ADMIN_ROLE) whenFrozen {
        isFrozen = false;
        emit EmergencyUnfreeze(msg.sender, block.timestamp);
    }

    // ─── Admin Configuration ─────────────────────────────────────────────────

    /**
     * @notice Update the max single-withdraw limit.
     * @param newBps Basis points (e.g. 3000 = 30%). Must be <= 10000.
     */
    function setMaxWithdrawBps(uint256 newBps) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (newBps > 10_000) revert InvalidBps(newBps);
        emit MaxWithdrawBpsUpdated(maxWithdrawBps, newBps);
        maxWithdrawBps = newBps;
    }

    /**
     * @notice Update the freeze duration for future freezes.
     * @param newDuration Duration in seconds.
     */
    function setFreezeDuration(uint256 newDuration) external onlyRole(DEFAULT_ADMIN_ROLE) {
        emit FreezeDurationUpdated(freezeDuration, newDuration);
        freezeDuration = newDuration;
    }

    // ─── View Functions ──────────────────────────────────────────────────────

    /**
     * @notice Returns the remaining time before the vault can be unfrozen.
     * @return seconds remaining (0 if time-lock has elapsed or vault not frozen)
     */
    function timeLockRemaining() external view returns (uint256) {
        if (!isFrozen) return 0;
        uint256 elapsed = block.timestamp - frozenAt;
        if (elapsed >= freezeDuration) return 0;
        return freezeDuration - elapsed;
    }

    /**
     * @notice Returns the maximum amount a user can withdraw in one tx.
     * @return maxAllowed in wei
     */
    function maxWithdrawAmount() external view returns (uint256) {
        if (totalDeposits == 0) return 0;
        return (totalDeposits * maxWithdrawBps) / 10_000;
    }

    // ─── Future: DAO Governance hooks (commented for later implementation) ───
    //
    // bytes32 public constant PROPOSER_ROLE  = keccak256("PROPOSER_ROLE");
    // bytes32 public constant EXECUTOR_ROLE  = keccak256("EXECUTOR_ROLE");
    //
    // A DAO time-lock controller (e.g. OpenZeppelin TimelockController) can be
    // granted DEFAULT_ADMIN_ROLE to put parameter changes behind governance votes.
    // The monitoring engine retains GUARDIAN_ROLE independently of governance.
}
