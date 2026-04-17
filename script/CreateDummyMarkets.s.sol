// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {MarketFactory} from "../src/MarketFactory.sol";

/// @notice Create many ETH-collateral dummy markets (for UI / testing).
/// @dev Env:
///   - PRIVATE_KEY (required)
///   - MARKET_FACTORY (required)
///   - ORACLE (optional; defaults to the address derived from PRIVATE_KEY)
///   - DUMMY_MARKET_COUNT (optional, default 5, max 150)
///   - TRADING_ENDS_AT (optional, unix sec; default now + 30 days)
///   - CLAIM_DELAY_SECONDS (optional, default 3600)
contract CreateDummyMarkets is Script {
    uint256 internal constant MAX_DUMMY = 150;

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
        require(count > 0 && count <= MAX_DUMMY, "DUMMY_MARKET_COUNT must be 1-150");

        uint256 endsDefault = block.timestamp + 30 days;
        uint256 endsEnv = vm.envOr("TRADING_ENDS_AT", endsDefault);
        require(endsEnv > block.timestamp, "TRADING_ENDS_AT must be in the future");
        uint64 ends = uint64(endsEnv);

        uint256 delayEnv = vm.envOr("CLAIM_DELAY_SECONDS", uint256(3600));
        require(delayEnv <= type(uint64).max, "CLAIM_DELAY_SECONDS too large");
        uint64 claimDelay = uint64(delayEnv);

        vm.startBroadcast(pk);

        // Continue titles from existing markets so batches do not all say "#1 … #N".
        uint256 startId = factory.marketCount();

        for (uint256 i = 0; i < count; i++) {
            uint256 g = startId + i;
            string memory q = _dummyQuestion(g);
            address m = factory.createMarket(address(0), oracle, ends, claimDelay, q);
            console2.log("dummy market", i + 1, m);
            console2.log("  ", q);
        }

        vm.stopBroadcast();
    }

    function _dummyQuestion(uint256 globalIdx) internal view returns (string memory) {
        return string.concat(
            _category(globalIdx % 5),
            " #",
            vm.toString(globalIdx + 1),
            " - ",
            _suffix(globalIdx % 40)
        );
    }

    /// @dev Polymarket-style *dummy* buckets (not real events; UI feed testing only).
    function _category(uint256 c) private pure returns (string memory) {
        if (c == 0) return "[Crypto]";
        if (c == 1) return "[Politics]";
        if (c == 2) return "[Sports]";
        if (c == 3) return "[Science]";
        return "[Culture]";
    }

    function _suffix(uint256 m) private pure returns (string memory) {
        if (m == 0) return "Will ETH close above 4000 this quarter? (dummy)";
        if (m == 1) return "Will BTC dominance stay above 50 percent? (dummy)";
        if (m == 2) return "Will a major L2 hit 1B TVL in 2026? (dummy)";
        if (m == 3) return "Will stablecoin supply grow YoY? (dummy)";
        if (m == 4) return "Will RISE testnet txs exceed 500k daily? (dummy)";
        if (m == 5) return "Mock: fictional primary outcome A vs B? (dummy)";
        if (m == 6) return "Mock: turnout above 60 percent? (dummy)";
        if (m == 7) return "Mock: bill passes committee stage? (dummy)";
        if (m == 8) return "Mock: debate poll swing over 3 points? (dummy)";
        if (m == 9) return "Mock: third-party candidate over 5 percent? (dummy)";
        if (m == 10) return "Will Team Alpha win the finals? (dummy)";
        if (m == 11) return "Will total points be over 210? (dummy)";
        if (m == 12) return "Will star player play game 1? (dummy)";
        if (m == 13) return "Will underdog cover the spread? (dummy)";
        if (m == 14) return "Will overtime occur? (dummy)";
        if (m == 15) return "Will new model beat benchmark by 5 percent? (dummy)";
        if (m == 16) return "Will fusion milestone headline Q4? (dummy)";
        if (m == 17) return "Will climate target metric improve YoY? (dummy)";
        if (m == 18) return "Will rocket launch succeed on first window? (dummy)";
        if (m == 19) return "Will trial meet primary endpoint? (dummy)";
        if (m == 20) return "Will box office exceed opening weekend target? (dummy)";
        if (m == 21) return "Will streaming show renew for season 2? (dummy)";
        if (m == 22) return "Will award go to expected nominee? (dummy)";
        if (m == 23) return "Will album debut at number one? (dummy)";
        if (m == 24) return "Will festival sell out in 24h? (dummy)";
        if (m == 25) return "Will Fed cut rates before July? (dummy)";
        if (m == 26) return "Will unemployment stay below 4.5 percent? (dummy)";
        if (m == 27) return "Will oil finish the week higher? (dummy)";
        if (m == 28) return "Will USD index dip below 100? (dummy)";
        if (m == 29) return "Will housing starts beat consensus? (dummy)";
        if (m == 30) return "Will major bridge volume double MoM? (dummy)";
        if (m == 31) return "Will new token launch top DEX day 1? (dummy)";
        if (m == 32) return "Will oracle dispute window shrink? (dummy)";
        if (m == 33) return "Will LST yield spread narrow? (dummy)";
        if (m == 34) return "Will perp volume ATH this month? (dummy)";
        if (m == 35) return "Will airdrop claim rate exceed 70 percent? (dummy)";
        if (m == 36) return "Will sequencer uptime stay 99.9 percent? (dummy)";
        if (m == 37) return "Will mempool congestion return? (dummy)";
        if (m == 38) return "Will gas under 0.1 gwei persist? (dummy)";
        return "Generic placeholder outcome for feed density (dummy)";
    }
}
