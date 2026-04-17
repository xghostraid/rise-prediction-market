// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {OrderBookMarket} from "./OrderBookMarket.sol";

/// @title OrderBookFactory
/// @notice Deploys new OrderBookMarket instances (ETH or ERC-20 collateral).
contract OrderBookFactory {
    uint256 public marketCount;
    mapping(uint256 => address) public marketById;

    event OrderBookMarketCreated(
        uint256 indexed id,
        address indexed market,
        address indexed collateral,
        uint8 collateralDecimals,
        address oracle,
        uint64 tradingEndsAt,
        uint64 claimDelayAfterResolve,
        string question
    );

    function createMarket(
        address collateral,
        uint8 collateralDecimals,
        address oracle,
        uint64 tradingEndsAt,
        uint64 claimDelayAfterResolve,
        string calldata question
    ) external returns (address market) {
        OrderBookMarket m = new OrderBookMarket(
            collateral,
            collateralDecimals,
            oracle,
            tradingEndsAt,
            claimDelayAfterResolve,
            question
        );
        market = address(m);
        uint256 id = marketCount++;
        marketById[id] = market;
        emit OrderBookMarketCreated(
            id,
            market,
            collateral,
            collateralDecimals,
            oracle,
            tradingEndsAt,
            claimDelayAfterResolve,
            question
        );
    }
}

