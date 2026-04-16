// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {MarketFactory} from "../src/MarketFactory.sol";

/// @notice Deploy MarketFactory to RISE Testnet (or any chain).
/// @dev Usage: PRIVATE_KEY=0x... forge script script/Deploy.s.sol:Deploy --rpc-url rise_testnet --broadcast
contract Deploy is Script {
    function run() external returns (MarketFactory factory) {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(pk);
        factory = new MarketFactory();
        vm.stopBroadcast();
        console2.log("MarketFactory:", address(factory));
    }
}
