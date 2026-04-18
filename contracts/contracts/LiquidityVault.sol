// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title  LiquidityVault
 * @notice Core vault for Killswitch-Node intelligent liquidity protection.
 *         Self-contained freeze logic — Guardian can freeze/unfreeze directly.
 *         Monitoring engine calls freeze(reason) and emergencyUnfreeze().
 */
contract LiquidityVault is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ─── Roles ───────────────────────────────────────────────────────────────
    bytes32 public constant GUARDIAN_ROLE = keccak256("GUARDIAN_ROLE");

    // ─── Immutables ──────────────────────────────────────────────────────────
    IERC20 public immutable token;

    // ─── Vault State ─────────────────────────────────────────────────────────
    mapping(address => uint256) public balances;
    uint256 public totalDeposits;

    // ─── Freeze State ────────────────────────────────────────────────────────
    bool public frozen;
    uint256 public frozenAt;
    uint256 public freezeDuration = 3600; // 1 hour default
    uint256 public maxWithdrawBps = 3000; // 30% cap per tx

    // ─── Events (monitoring-engine compatible) ───────────────────────────────
    event Deposit(address indexed user, uint256 amount, uint256 newBalance);
    event Withdraw(address indexed user, uint256 amount, uint256 newBalance);
    event Freeze(address indexed triggeredBy, uint256 at, string reason);
    event Unfreeze(address indexed triggeredBy, uint256 at);
    event EmergencyUnfreeze(address indexed admin, uint256 at);
    event MaxWithdrawBpsUpdated(uint256 oldBps, uint256 newBps);

    // ─── Errors ──────────────────────────────────────────────────────────────
    error VaultIsFrozen();
    error VaultNotFrozen();
    error ZeroAmount();
    error InsufficientBalance(uint256 requested, uint256 available);
    error ExceedsMaxWithdraw(uint256 requested, uint256 maxAllowed);

    // ─── Constructor ─────────────────────────────────────────────────────────
    constructor(
        address _token,
        address _admin,
        address _guardian
    ) {
        require(_token    != address(0), "Invalid token");
        require(_admin    != address(0), "Invalid admin");
        require(_guardian != address(0), "Invalid guardian");

        token = IERC20(_token);

        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(GUARDIAN_ROLE, _guardian);
    }

    // ─── Modifier ────────────────────────────────────────────────────────────
    modifier notFrozen() {
        if (frozen) revert VaultIsFrozen();
        _;
    }

    // ─── User Functions ──────────────────────────────────────────────────────

    function deposit(uint256 amount) external nonReentrant notFrozen {
        if (amount == 0) revert ZeroAmount();
        token.safeTransferFrom(msg.sender, address(this), amount);
        balances[msg.sender] += amount;
        totalDeposits += amount;
        emit Deposit(msg.sender, amount, balances[msg.sender]);
    }

    function withdraw(uint256 amount) external nonReentrant notFrozen {
        if (amount == 0) revert ZeroAmount();
        if (amount > balances[msg.sender])
            revert InsufficientBalance(amount, balances[msg.sender]);

        // Per-tx withdrawal cap
        uint256 maxAllowed = (totalDeposits * maxWithdrawBps) / 10000;
        if (totalDeposits > 0 && amount > maxAllowed)
            revert ExceedsMaxWithdraw(amount, maxAllowed);

        balances[msg.sender] -= amount;
        totalDeposits -= amount;
        token.safeTransfer(msg.sender, amount);

        emit Withdraw(msg.sender, amount, balances[msg.sender]);
    }

    // ─── View Helpers ────────────────────────────────────────────────────────

    function timeLockRemaining() external view returns (uint256) {
        if (!frozen) return 0;
        uint256 elapsed = block.timestamp - frozenAt;
        if (elapsed >= freezeDuration) return 0;
        return freezeDuration - elapsed;
    }

    function maxWithdrawAmount() external view returns (uint256) {
        if (totalDeposits == 0) return 0;
        return (totalDeposits * maxWithdrawBps) / 10000;
    }

    // ─── Guardian Security (called by monitoring engine) ─────────────────────

    function freeze(string calldata reason) external onlyRole(GUARDIAN_ROLE) {
        if (frozen) return; // idempotent
        frozen = true;
        frozenAt = block.timestamp;
        emit Freeze(msg.sender, block.timestamp, reason);
    }

    function unfreeze() external onlyRole(GUARDIAN_ROLE) {
        if (!frozen) revert VaultNotFrozen();
        frozen = false;
        emit Unfreeze(msg.sender, block.timestamp);
    }

    // ─── Admin Security Functions ─────────────────────────────────────────────

    function emergencyUnfreeze() external onlyRole(DEFAULT_ADMIN_ROLE) {
        frozen = false;
        emit EmergencyUnfreeze(msg.sender, block.timestamp);
    }

    function setMaxWithdrawBps(uint256 bps) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(bps <= 10000, "Invalid bps");
        emit MaxWithdrawBpsUpdated(maxWithdrawBps, bps);
        maxWithdrawBps = bps;
    }

    function setFreezeDuration(uint256 duration) external onlyRole(DEFAULT_ADMIN_ROLE) {
        freezeDuration = duration;
    }

    function emergencyWithdraw(address _token, address to, uint256 amount) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (_token == address(token)) {
            totalDeposits -= amount;
        }
        IERC20(_token).safeTransfer(to, amount);
    }
}
