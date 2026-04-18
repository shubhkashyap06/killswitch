// SPDX-License-Identifier: MIT
pragma solidity >=0.8.20;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./TieredCircuitBreaker.sol";

interface IVaultWithEmergency {
    function freeze(string calldata reason) external;
    function emergencyUnfreeze() external;
    function emergencyWithdraw(address token, address to, uint256 amount) external;
}

/**
 * @title MasterController
 * @notice Global multisig wallet providing ultimate governance and emergency capabilities.
 *         Operates independently of AI consensus, preventing Skynet-style lockouts.
 */
contract MasterController is AccessControl {
    using SafeERC20 for IERC20;

    bytes32 public constant SIGNER_ROLE = keccak256("SIGNER_ROLE");

    uint256 public constant SIGNATURE_THRESHOLD = 3;
    uint256 public constant TIMELOCK_DELAY = 1 hours;

    struct Transaction {
        address target;
        bytes data;
        bool isEmergency; // Bypasses timelock
        uint256 executionTime;
        uint256 confirmations;
        bool executed;
    }

    Transaction[] public transactions;
    mapping(uint256 => mapping(address => bool)) public confirmed;

    event TransactionSubmitted(uint256 indexed txId, address target, bool isEmergency);
    event TransactionConfirmed(uint256 indexed txId, address signer);
    event TransactionExecuted(uint256 indexed txId);
    event MasterOverride(address masterWallet, string action);

    error NotSigner();
    error InvalidThreshold();
    error TimelockNotExpired();
    error AlreadyExecuted();
    error AlreadyConfirmed();
    error TxFailed();

    constructor(address[] memory initialSigners) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        for (uint256 i = 0; i < initialSigners.length; i++) {
            _grantRole(SIGNER_ROLE, initialSigners[i]);
        }
    }

    /**
     * @notice Submits a new governance or emergency action.
     */
    function submitTransaction(address target, bytes calldata data, bool isEmergency) external onlyRole(SIGNER_ROLE) returns (uint256 txId) {
        txId = transactions.length;
        transactions.push(Transaction({
            target: target,
            data: data,
            isEmergency: isEmergency,
            executionTime: isEmergency ? block.timestamp : block.timestamp + TIMELOCK_DELAY,
            confirmations: 0,
            executed: false
        }));
        
        emit TransactionSubmitted(txId, target, isEmergency);
        confirmTransaction(txId); // Auto-confirm for submitter
    }

    /**
     * @notice Multisig confirmation.
     */
    function confirmTransaction(uint256 txId) public onlyRole(SIGNER_ROLE) {
        if (transactions[txId].executed) revert AlreadyExecuted();
        if (confirmed[txId][msg.sender]) revert AlreadyConfirmed();

        confirmed[txId][msg.sender] = true;
        transactions[txId].confirmations++;
        
        emit TransactionConfirmed(txId, msg.sender);

        // Auto-execute if threshold is met
        if (transactions[txId].confirmations >= SIGNATURE_THRESHOLD) {
            _executeTransaction(txId);
        }
    }

    /**
     * @notice Executes confirmed transaction.
     */
    function _executeTransaction(uint256 txId) internal {
        Transaction storage txn = transactions[txId];
        if (block.timestamp < txn.executionTime) revert TimelockNotExpired();
        
        txn.executed = true;

        (bool success, ) = txn.target.call(txn.data);
        if (!success) revert TxFailed();

        emit TransactionExecuted(txId);
        if (txn.isEmergency) {
            emit MasterOverride(address(this), "EMERGENCY_ACTION_EXECUTED");
        }
    }

    // ────────────────────────────────────────────────────────────────────────
    // Helper Entrypoints (For UI simplicity / encoding)
    // ────────────────────────────────────────────────────────────────────────

    function encodeEmergencyGlobalFreeze(address circuitBreaker) external pure returns (address, bytes memory, bool) {
        return (
            circuitBreaker,
            abi.encodeWithSelector(TieredCircuitBreaker.setGlobalFreeze.selector, true, "MASTER_OVERRIDE"),
            true
        );
    }

    function encodeEmergencyWithdraw(address vault, address token, address coldWallet, uint256 amount) external pure returns (address, bytes memory, bool) {
        return (
            vault,
            abi.encodeWithSignature("emergencyWithdraw(address,address,uint256)", token, coldWallet, amount),
            true
        );
    }
}
