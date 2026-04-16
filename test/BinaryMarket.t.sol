// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {MarketFactory} from "../src/MarketFactory.sol";
import {BinaryMarket} from "../src/BinaryMarket.sol";
import {MockERC20} from "./MockERC20.sol";

contract BinaryMarketTest is Test {
    MarketFactory internal factory;
    BinaryMarket internal marketEth;

    address internal oracle = address(0xBEEF);
    address internal alice = address(0xA11CE);
    address internal bob = address(0xB0B);

    function setUp() public {
        factory = new MarketFactory();
        uint64 ends = uint64(block.timestamp + 1 days);
        address m = factory.createMarket(
            address(0),
            oracle,
            ends,
            0,
            "Will RISE hit 100k TPS on public testnet?"
        );
        marketEth = BinaryMarket(payable(m));
    }

    function test_parimutuelYesWins_eth() public {
        vm.deal(alice, 10 ether);
        vm.deal(bob, 10 ether);

        vm.prank(alice);
        marketEth.betYes{value: 3 ether}(3 ether);

        vm.prank(bob);
        marketEth.betNo{value: 1 ether}(1 ether);

        vm.warp(marketEth.tradingEndsAt() + 1);

        vm.prank(oracle);
        marketEth.resolve(true);

        uint256 aliceBefore = alice.balance;
        vm.prank(alice);
        marketEth.claim();
        assertEq(alice.balance - aliceBefore, 4 ether);

        vm.prank(bob);
        vm.expectRevert(BinaryMarket.NothingToClaim.selector);
        marketEth.claim();
    }

    function test_parimutuelYesWins_usdc() public {
        MockERC20 usdc = new MockERC20("Mock USDC", "mUSDC", 6);
        uint64 ends = uint64(block.timestamp + 1 days);
        address m = factory.createMarket(
            address(usdc),
            oracle,
            ends,
            0,
            "Will RISE public testnet exceed 100k TPS?"
        );
        BinaryMarket market = BinaryMarket(payable(m));

        usdc.mint(alice, 1_000_000e6);
        usdc.mint(bob, 1_000_000e6);

        vm.startPrank(alice);
        usdc.approve(address(market), type(uint256).max);
        market.betYes(300e6);
        vm.stopPrank();

        vm.startPrank(bob);
        usdc.approve(address(market), type(uint256).max);
        market.betNo(100e6);
        vm.stopPrank();

        vm.warp(ends + 1);
        vm.prank(oracle);
        market.resolve(true);

        uint256 aliceBefore = usdc.balanceOf(alice);
        vm.prank(alice);
        market.claim();
        assertEq(usdc.balanceOf(alice) - aliceBefore, 400e6);
    }

    function test_revertResolveBeforeTradingEnd() public {
        vm.deal(alice, 1 ether);
        vm.prank(alice);
        marketEth.betYes{value: 1 ether}(1 ether);

        vm.prank(oracle);
        vm.expectRevert(BinaryMarket.TooEarlyToResolve.selector);
        marketEth.resolve(true);
    }

    function test_claim_delay_blocks_claim_until_open() public {
        uint64 ends = uint64(block.timestamp + 1 days);
        address m = factory.createMarket(address(0), oracle, ends, 1 hours, "Delayed claims");
        BinaryMarket market = BinaryMarket(payable(m));

        vm.deal(alice, 2 ether);
        vm.prank(alice);
        market.betYes{value: 1 ether}(1 ether);

        vm.warp(ends + 1);
        vm.prank(oracle);
        market.resolve(true);

        vm.prank(alice);
        vm.expectRevert(BinaryMarket.ClaimsNotOpen.selector);
        market.claim();

        vm.warp(block.timestamp + 1 hours);
        vm.prank(alice);
        market.claim();
    }

    function test_revertEthSentToUsdcMarket() public {
        MockERC20 usdc = new MockERC20("Mock USDC", "mUSDC", 6);
        uint64 ends = uint64(block.timestamp + 1 days);
        address m = factory.createMarket(address(usdc), oracle, ends, 0, "USDC market");
        BinaryMarket market = BinaryMarket(payable(m));

        vm.deal(alice, 1 ether);
        vm.prank(alice);
        vm.expectRevert(BinaryMarket.EthNotAccepted.selector);
        market.betYes{value: 1 ether}(1 ether);
    }
}
