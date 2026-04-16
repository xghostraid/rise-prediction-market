// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {MarketFactory} from "../src/MarketFactory.sol";

/// @notice Create one ETH-collateral market and optionally one USDC market on an existing factory.
/// @dev Env:
///   - PRIVATE_KEY (required)
///   - MARKET_FACTORY (required) — address from `Deploy.s.sol`
///   - ORACLE (required) — address allowed to resolve markets
///   - USDC_ADDRESS (optional) — if set, also creates an ERC20-collateral market
///   - TRADING_ENDS_AT (optional) — unix timestamp when trading closes; default now + 7 days
///   - CLAIM_DELAY_SECONDS (optional) — delay after resolve before claims; default 3600 (1h)
contract CreateMarkets is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        MarketFactory factory = MarketFactory(vm.envAddress("MARKET_FACTORY"));
        address oracle = vm.envAddress("ORACLE");

        uint256 endsDefault = block.timestamp + 7 days;
        uint256 endsEnv = vm.envOr("TRADING_ENDS_AT", endsDefault);
        require(endsEnv > block.timestamp, "TRADING_ENDS_AT must be in the future");
        uint64 ends = uint64(endsEnv);

        uint256 delayEnv = vm.envOr("CLAIM_DELAY_SECONDS", uint256(3600));
        require(delayEnv <= type(uint64).max, "CLAIM_DELAY_SECONDS too large");
        uint64 claimDelay = uint64(delayEnv);

        vm.startBroadcast(pk);

        address ethMarket = factory.createMarket(
            address(0),
            oracle,
            ends,
            claimDelay,
            "RISE: public prediction market (ETH collateral)"
        );
        console2.log("ETH market:", ethMarket);

        address usdc = vm.envOr("USDC_ADDRESS", address(0));
        if (usdc != address(0)) {
            address usdcMarket = factory.createMarket(
                usdc,
                oracle,
                ends,
                claimDelay,
                "RISE: public prediction market (USDC collateral)"
            );
            console2.log("USDC market:", usdcMarket);
        } else {
            console2.log("USDC_ADDRESS unset; skipping USDC market");
        }

        vm.stopBroadcast();
    }
}
