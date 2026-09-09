// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @notice Minimal ERC-20 standing in for USDC. Not a faithful USDC (no permit,
/// no 6-decimal enforcement) - it exists so the Estate waterfall can be
/// exercised against real balance movements, in tests and in the local anvil
/// end-to-end run. Never deployed to a public network.
///
/// It does model the one USDC behaviour the waterfall has to survive: a
/// per-address blocklist. Real USDC's `blacklist(address)` makes `transfer`
/// revert for that address, and an estate that treats one refused payout as a
/// fatal error hands any single creditor a permanent brick on everyone else's
/// money. `setBlocked` reverts (like USDC); `setFailTransfers` returns false
/// globally (the other failure shape an ERC-20 can take).
contract MockUSDC {
    string public constant name = "Mock USDC";
    string public constant symbol = "mUSDC";
    uint8 public constant decimals = 6;

    mapping(address => uint256) public balanceOf;
    mapping(address => bool) public blocked;
    bool public failTransfers;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }

    function setFailTransfers(bool v) external {
        failTransfers = v;
    }

    function setBlocked(address account, bool v) external {
        blocked[account] = v;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        if (failTransfers) return false;
        require(!blocked[to] && !blocked[msg.sender], "blocked");
        require(balanceOf[msg.sender] >= amount, "insufficient");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}
