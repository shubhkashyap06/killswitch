// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title  ReentrancyAttacker
 * @notice Simulates a rapid-drain ERC-20 attack against the Vultra LiquidityVault.
 *         The vault uses ReentrancyGuard, so true reentrancy is blocked.
 *         This contract instead models the realistic threat: a malicious EOA
 *         contract that loops rapid micro-withdrawals to trigger the
 *         monitoring engine's circuit breaker.
 *
 *         FOR EDUCATIONAL / DEMO PURPOSES ONLY — DO NOT USE IN PRODUCTION
 */

interface IERC20 {
    function approve(address spender, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

interface IVault {
    function deposit(uint256 amount) external;
    function withdraw(uint256 amount) external;
    function balances(address user) external view returns (uint256);
    function totalDeposits() external view returns (uint256);
    function frozen() external view returns (bool);
}

contract ReentrancyAttacker {
    IVault  public vault;
    IERC20  public token;
    address public owner;

    uint256 public totalExtracted;
    uint256 public attackRounds;
    bool    public attackRunning;

    event AttackStarted(uint256 depositAmount, uint256 rounds);
    event RoundExecuted(uint256 round, uint256 amount, uint256 vaultRemainder);
    event AttackBlocked(uint256 round, string reason);
    event AttackComplete(uint256 totalExtracted, bool vaultFrozen);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor(address _vault, address _token) {
        vault = IVault(_vault);
        token = IERC20(_token);
        owner = msg.sender;
    }

    /**
     * @notice Fund this contract with VLT tokens prior to attacking.
     *         Call token.transfer(address(this), amount) from outside.
     */

    /**
     * @notice Execute the rapid-drain attack sequence.
     * @param depositAmount    Amount of VLT to deposit as cover (must be pre-funded).
     * @param withdrawAmount   Amount per withdrawal round (must be <= 30% of pool).
     * @param rounds           Number of withdrawal attempts.
     */
    function attack(
        uint256 depositAmount,
        uint256 withdrawAmount,
        uint256 rounds
    ) external onlyOwner {
        require(!attackRunning, "Attack already running");
        require(token.balanceOf(address(this)) >= depositAmount, "Insufficient VLT");

        attackRunning = true;
        totalExtracted = 0;
        attackRounds = rounds;

        emit AttackStarted(depositAmount, rounds);

        // Phase 1: Establish a deposit footprint to look legitimate
        token.approve(address(vault), depositAmount);
        vault.deposit(depositAmount);

        // Phase 2: Rapid micro-withdrawals — triggers monitoring engine
        for (uint256 i = 1; i <= rounds; i++) {
            if (vault.frozen()) {
                emit AttackBlocked(i, "Vault frozen by Guardian");
                break;
            }

            uint256 myBalance = vault.balances(address(this));
            if (myBalance == 0) {
                emit AttackBlocked(i, "Attacker balance drained");
                break;
            }

            uint256 actualWithdraw = withdrawAmount <= myBalance ? withdrawAmount : myBalance;

            try vault.withdraw(actualWithdraw) {
                totalExtracted += actualWithdraw;
                emit RoundExecuted(i, actualWithdraw, vault.totalDeposits());
            } catch Error(string memory reason) {
                emit AttackBlocked(i, reason);
                break;
            } catch {
                emit AttackBlocked(i, "Reverted (frozen or cap exceeded)");
                break;
            }
        }

        attackRunning = false;
        emit AttackComplete(totalExtracted, vault.frozen());
    }

    /// @notice Exfiltrate stolen VLT back to attacker EOA
    function exfiltrate() external onlyOwner {
        uint256 bal = token.balanceOf(address(this));
        require(bal > 0, "Nothing to exfiltrate");
        token.transfer(owner, bal);
    }

    /// @notice Query current status
    function getStatus() external view returns (
        uint256 contractVLT,
        uint256 vaultVLT,
        uint256 myVaultDeposit,
        bool    vaultFrozen
    ) {
        return (
            token.balanceOf(address(this)),
            vault.totalDeposits(),
            vault.balances(address(this)),
            vault.frozen()
        );
    }
}
