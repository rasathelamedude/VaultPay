// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title MockTUSD
/// @notice Local-only virtual ERC20 for testing.
contract MockTUSD is ERC20, Ownable {
    uint256 public constant FAUCET_AMOUNT = 1_000 ether;
    uint256 public constant FAUCET_COOLDOWN = 1 hours;

    mapping(address account => uint256 timestamp) public lastFaucetAt;

    error FaucetCooldownActive(uint256 nextAvailableAt);
    error ZeroAddress();

    event FaucetClaimed(address indexed account, uint256 amount);

    constructor() ERC20("Talent USD", "tUSD") Ownable(msg.sender) {
        _mint(msg.sender, 1_000_000 ether);
    }

    function faucet() external {
        uint256 nextAvailableAt = lastFaucetAt[msg.sender] + FAUCET_COOLDOWN;
        if (lastFaucetAt[msg.sender] != 0 && block.timestamp < nextAvailableAt) {
            revert FaucetCooldownActive(nextAvailableAt);
        }

        lastFaucetAt[msg.sender] = block.timestamp;
        _mint(msg.sender, FAUCET_AMOUNT);

        emit FaucetClaimed(msg.sender, FAUCET_AMOUNT);
    }

    function ownerMint(address to, uint256 amount) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        _mint(to, amount);
    }
}
