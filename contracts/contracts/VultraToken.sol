// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title VultraToken
 * @notice ERC-20 governance & utility token for the Vultra-Node protocol.
 *         Symbol: VLT  |  Decimals: 18  |  Initial Supply: 10,000,000 VLT
 * @dev    In production this contract is deployed once and the address is
 *         passed to LiquidityVault on deployment. The `mint` function is
 *         owner-only and intended for testnet faucets only — remove or lock
 *         it before mainnet deployment.
 */
contract VultraToken is ERC20, Ownable {
    uint256 public constant INITIAL_SUPPLY = 10_000_000 * 10 ** 18; // 10M VLT

    constructor(address initialOwner)
        ERC20("Vultra Token", "VLT")
        Ownable(initialOwner)
    {
        _mint(initialOwner, INITIAL_SUPPLY);
    }

    /**
     * @notice Mint additional tokens.  TESTNET ONLY — remove before mainnet.
     * @param to      Recipient address
     * @param amount  Amount in wei (1 VLT = 1e18)
     */
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
}
