// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {OrderBookFactory} from "../src/OrderBookFactory.sol";

/// @notice Create dummy order book markets for UI testing.
/// @dev Env:
///   - PRIVATE_KEY (required)
///   - ORDERBOOK_FACTORY (required)
///   - ORACLE (optional; defaults to the address derived from PRIVATE_KEY)
///   - DUMMY_MARKET_COUNT (optional, default 3, max 100)
///   - TRADING_ENDS_AT (optional, unix sec; default now + 30 days)
///   - CLAIM_DELAY_SECONDS (optional, default 3600)
contract CreateDummyOrderBookMarkets is Script {
    uint256 internal constant MAX_DUMMY = 100;

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address factoryAddr = vm.envAddress("ORDERBOOK_FACTORY");
        OrderBookFactory factory = OrderBookFactory(factoryAddr);

        address oracle = vm.envOr("ORACLE", address(0));
        if (oracle == address(0)) oracle = vm.addr(pk);

        uint256 count = vm.envOr("DUMMY_MARKET_COUNT", uint256(3));
        require(count > 0 && count <= MAX_DUMMY, "DUMMY_MARKET_COUNT must be 1-100");

        uint256 endsDefault = block.timestamp + 30 days;
        uint256 endsEnv = vm.envOr("TRADING_ENDS_AT", endsDefault);
        require(endsEnv > block.timestamp, "TRADING_ENDS_AT must be future");
        uint64 ends = uint64(endsEnv);

        uint256 delayEnv = vm.envOr("CLAIM_DELAY_SECONDS", uint256(3600));
        require(delayEnv <= type(uint64).max, "CLAIM_DELAY_SECONDS too large");
        uint64 claimDelay = uint64(delayEnv);

        console2.log("ORDERBOOK_FACTORY", factoryAddr);
        console2.log("ORACLE", oracle);

        vm.startBroadcast(pk);
        uint256 startId = factory.marketCount();
        for (uint256 i = 0; i < count; i++) {
            uint256 g = startId + i;
            string memory q = string.concat("[Orderbook] #", vm.toString(g + 1), " - Demo market (dummy)");
            address m = factory.createMarket(address(0), 0, oracle, ends, claimDelay, q);
            console2.log("dummy orderbook market", i + 1, m);
        }
        vm.stopBroadcast();
    }
}

