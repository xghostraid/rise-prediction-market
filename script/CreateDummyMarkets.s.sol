// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {MarketFactory} from "../src/MarketFactory.sol";

/// @notice Create many ETH-collateral dummy markets (for UI / testing).
/// @dev Env:
///   - PRIVATE_KEY (required)
///   - MARKET_FACTORY (required) — the **MarketFactory contract** from `Deploy.s.sol` logs (`MarketFactory: 0x…`), not your wallet / deployer EOA
///   - ORACLE (optional; defaults to the address derived from PRIVATE_KEY)
///   - DUMMY_MARKET_COUNT (optional, default 5, max 25)
///   - TRADING_ENDS_AT (optional, unix sec; default now + 30 days)
///   - CLAIM_DELAY_SECONDS (optional, default 3600)
contract CreateDummyMarkets is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address factoryAddr = vm.envAddress("MARKET_FACTORY");
        MarketFactory factory = MarketFactory(factoryAddr);

        address oracle = vm.envOr("ORACLE", address(0));
        if (oracle == address(0)) {
            oracle = vm.addr(pk);
        }

        console2.log("MARKET_FACTORY", factoryAddr);
        console2.log("ORACLE", oracle);

        uint256 count = vm.envOr("DUMMY_MARKET_COUNT", uint256(5));
        require(count > 0 && count <= 25, "DUMMY_MARKET_COUNT must be 1-25");

        uint256 endsDefault = block.timestamp + 30 days;
        uint256 endsEnv = vm.envOr("TRADING_ENDS_AT", endsDefault);
        require(endsEnv > block.timestamp, "TRADING_ENDS_AT must be in the future");
        uint64 ends = uint64(endsEnv);

        uint256 delayEnv = vm.envOr("CLAIM_DELAY_SECONDS", uint256(3600));
        require(delayEnv <= type(uint64).max, "CLAIM_DELAY_SECONDS too large");
        uint64 claimDelay = uint64(delayEnv);

        vm.startBroadcast(pk);

        for (uint256 i = 0; i < count; i++) {
            string memory q = _dummyQuestion(i);
            address m = factory.createMarket(address(0), oracle, ends, claimDelay, q);
            console2.log("dummy market", i + 1, m);
            console2.log("  ", q);
        }

        vm.stopBroadcast();
    }

    function _dummyQuestion(uint256 i) internal view returns (string memory) {
        string memory suffix = _suffix(i % 8);
        return string.concat("Dummy #", vm.toString(i + 1), " - ", suffix);
    }

    function _suffix(uint256 m) private pure returns (string memory) {
        if (m == 0) return "Will RISE testnet daily activity grow in 2026?";
        if (m == 1) return "Will ETH/USD finish the month above 3500 (demo)?";
        if (m == 2) return "Placeholder: fictional championship outcome?";
        if (m == 3) return "Will average gas on RISE stay under 1 gwei?";
        if (m == 4) return "Demo: protocol TVL milestone this quarter?";
        if (m == 5) return "UI test: binary event resolution (not financial advice)";
        if (m == 6) return "Will testnet faucet demand spike next week?";
        return "Generic dummy outcome for feed testing";
    }
}
