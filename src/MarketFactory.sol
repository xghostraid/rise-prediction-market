// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {BinaryMarket} from "./BinaryMarket.sol";

/// @title MarketFactory
/// @notice Deploys new BinaryMarket instances (ETH or ERC20 collateral).
contract MarketFactory {
    uint256 public marketCount;
    mapping(uint256 => address) public marketById;

    event MarketCreated(
        uint256 indexed id,
        address indexed market,
        address indexed collateral,
        address oracle,
        uint64 tradingEndsAt,
        uint64 claimDelayAfterResolve,
        string question
    );

    /// @param collateral `address(0)` for native ETH; otherwise the ERC20 (e.g. USDC on RISE).
    /// @param claimDelayAfterResolve Seconds after resolution before claims unlock (e.g. 3600).
    function createMarket(
        address collateral,
        address oracle,
        uint64 tradingEndsAt,
        uint64 claimDelayAfterResolve,
        string calldata question
    ) external returns (address market) {
        BinaryMarket m = new BinaryMarket(collateral, oracle, tradingEndsAt, claimDelayAfterResolve, question);
        market = address(m);
        uint256 id = marketCount++;
        marketById[id] = market;
        emit MarketCreated(id, market, collateral, oracle, tradingEndsAt, claimDelayAfterResolve, question);
    }
}
