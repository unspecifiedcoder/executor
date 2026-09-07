// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {Estate} from "../src/Estate.sol";

contract EstateTest is Test {
    Estate estate;
    address usdc = makeAddr("usdc");
    address trustee = makeAddr("trustee");

    function setUp() public {
        estate = new Estate(usdc, trustee);
    }

    function test_registerClaim_revertsForNonTrustee() public {
        vm.expectRevert(Estate.NotTrustee.selector);
        estate.registerClaim(bytes32(uint256(1)), makeAddr("creditor"), 100, Estate.PriorityClass.Unsecured);
    }

    function test_registerClaim_storesClaim() public {
        address creditor = makeAddr("creditor");
        vm.prank(trustee);
        estate.registerClaim(bytes32(uint256(1)), creditor, 100, Estate.PriorityClass.Secured);

        (address storedCreditor, uint256 amount, Estate.PriorityClass class, bool paid) =
            estate.claims(bytes32(uint256(1)));
        assertEq(storedCreditor, creditor);
        assertEq(amount, 100);
        assertEq(uint8(class), uint8(Estate.PriorityClass.Secured));
        assertFalse(paid);
    }

    function test_executePlan_revertsOnHashMismatch() public {
        vm.expectRevert(Estate.PlanMismatch.selector);
        estate.executePlan(bytes32(uint256(999)), "");
    }

    // TODO: once the waterfall payout logic lands, add:
    // - full payout when the estate can cover every class
    // - pro-rata split within a class when funds run out mid-class
    // - Secured class fully paid before any Unsecured claim moves
}
