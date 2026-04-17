// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {OrderBookFactory} from "../src/OrderBookFactory.sol";

/// @notice Deploy OrderBookFactory (ETH-only order book markets).
/// @dev Env:
///   - PRIVATE_KEY (required)
contract DeployOrderBookFactory is Script {
    function run() external returns (address factory) {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(pk);
        OrderBookFactory f = new OrderBookFactory();
        vm.stopBroadcast();

        factory = address(f);
        console2.log("OrderBookFactory:", factory);
    }
}

