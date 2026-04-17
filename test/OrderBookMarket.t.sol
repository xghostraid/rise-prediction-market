// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {OrderBookMarket} from "../src/OrderBookMarket.sol";

contract OrderBookMarketTest is Test {
    OrderBookMarket m;
    address oracle = address(0xBEEF);
    address alice = address(0xA11CE);
    address bob = address(0xB0B);

    function setUp() external {
        vm.warp(1_700_000_000);
        m = new OrderBookMarket(address(0), 0, oracle, uint64(block.timestamp + 1 days), 0, "Q?");
        vm.deal(alice, 10 ether);
        vm.deal(bob, 10 ether);
    }

    function testPlaceTakeResolveClaimYes() external {
        // Alice places a buy YES order at 60 cents for size=2 (requires 120 wei).
        vm.prank(alice);
        uint256 oid = m.placeLimit{value: 60 * 2}(OrderBookMarket.Side.BuyYes, 60, 2);

        // Bob takes it by selling YES (deposit 40 cents each = 80 wei).
        vm.prank(bob);
        m.take{value: 40 * 2}(oid, 2);

        assertEq(m.yesShares(alice), 2);
        assertEq(m.noShares(bob), 2);

        // End trading + resolve YES.
        vm.warp(block.timestamp + 2 days);
        vm.prank(oracle);
        m.resolve(true);

        uint256 aliceBalBefore = alice.balance;
        vm.prank(alice);
        m.claim();
        assertEq(alice.balance, aliceBalBefore + 200);

        vm.prank(bob);
        vm.expectRevert();
        m.claim();
    }
}

