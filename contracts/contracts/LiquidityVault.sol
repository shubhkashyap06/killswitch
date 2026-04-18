// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface ITieredCircuitBreaker {
    function checkAndRecordWithdrawal(address user, address asset, uint256 amount, uint256 currentTVL) external;
}

/**
 * @title  LiquidityVault
 * @notice Core vault for Vultra-Node intelligent liquidity protection.
 *         Upgraded to support Tiered Circuit Breaker constraints and rate limits.
 */
contract LiquidityVault is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ─── Roles ───────────────────────────────────────────────────────────────
    bytes32 public constant GUARDIAN_ROLE = keccak256("GUARDIAN_ROLE");

    // ─── Immutables ──────────────────────────────────────────────────────────
    IERC20 public immutable token;
    ITieredCircuitBreaker public circuitBreaker;

    // ─── State ───────────────────────────────────────────────────────────────
    mapping(address => uint256) public balances;
    uint256 public totalDeposits;

    // ─── Events (monitoring-engine compatible) ───────────────────────────────
    event Deposit(address indexed user, uint256 amount, uint256 newBalance);
    event Withdraw(address indexed user, uint256 amount, uint256 newBalance);
    event Freeze(address indexed triggeredBy, uint256 at, string reason);
    event Unfreeze(address indexed triggeredBy, uint256 at);
    event EmergencyUnfreeze(address indexed admin, uint256 at);

    // Enhanced security events
    event SuspiciousActivity(address indexed user, uint256 withdrawCount, uint256 amount);
    event MaxWithdrawBpsUpdated(uint256 oldBps, uint256 newBps);
    event FreezeDurationUpdated(uint256 oldDuration, uint256 newDuration);

    // ─── Errors ──────────────────────────────────────────────────────────────
    error VaultIsFrozen();
    error VaultNotFrozen();
    error TimeLockActive(uint256 remaining);
    error ZeroAmount();
    error InsufficientBalance(uint256 requested, uint256 available);
    error ExceedsMaxWithdraw(uint256 requested, uint256 maxAllowed);

    // ─── Constructor ─────────────────────────────────────────────────────────
    constructor(
        address _token,
        address _admin,
        address _guardian,
        address _circuitBreaker
    ) {
        require(_token   != address(0), "Invalid token");
        require(_admin   != address(0), "Invalid admin");
        require(_guardian != address(0), "Invalid guardian");
        require(_circuitBreaker != address(0), "Invalid CB");

        token = IERC20(_token);
        circuitBreaker = ITieredCircuitBreaker(_circuitBreaker);

        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(GUARDIAN_ROLE, _guardian);
    }

    // ─── Modifiers ───────────────────────────────────────────────────────────
    modifier applyCircuitBreaker(address user, uint256 amount) {
        // Enforce Tier 1 to 4 restrictions across the user and global system
        circuitBreaker.checkAndRecordWithdrawal(user, address(token), amount, totalDeposits);
        _;
    }

    // ─── User Functions ──────────────────────────────────────────────────────

    function deposit(uint256 amount) external nonReentrant applyCircuitBreaker(msg.sender, 0) {
        if (amount == 0) revert ZeroAmount();
        token.safeTransferFrom(msg.sender, address(this), amount);
        balances[msg.sender] += amount;
        totalDeposits += amount;
        emit Deposit(msg.sender, amount, balances[msg.sender]);
    }

    function withdraw(uint256 amount) external nonReentrant applyCircuitBreaker(msg.sender, amount) {
        if (amount == 0) revert ZeroAmount();
        if (amount > balances[msg.sender])
            revert InsufficientBalance(amount, balances[msg.sender]);

        balances[msg.sender] -= amount;
        totalDeposits -= amount;
        token.safeTransfer(msg.sender, amount);

        emit Withdraw(msg.sender, amount, balances[msg.sender]);
    }

    // ─── Security Functions ──────────────────────────────────────────────────

    function emergencyWithdraw(address _token, address to, uint256 amount) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (_token == address(token)) {
            totalDeposits -= amount;
        }
        IERC20(_token).safeTransfer(to, amount);
    }

    // ─── Admin Configuration ─────────────────────────────────────────────────

    function setCircuitBreaker(address _cb) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_cb != address(0), "Invalid CB");
        circuitBreaker = ITieredCircuitBreaker(_cb);
    }
}
