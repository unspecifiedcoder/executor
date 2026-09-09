// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {Estate} from "../src/Estate.sol";
import {MockUSDC} from "./mocks/MockUSDC.sol";

contract MockRegistry {
    uint8 public status;

    function setStatus(uint8 s) external {
        status = s;
    }

    function getStatus(bytes32) external view returns (uint8) {
        return status;
    }
}

contract EstateTest is Test {
    Estate estate;
    MockUSDC usdc;
    MockRegistry registry;

    address trustee = makeAddr("trustee");
    bytes32 constant AGENT_ID = keccak256("test-agent");

    uint8 constant ACTIVE = 0;
    uint8 constant ADMINISTRATION = 1;
    uint8 constant LIQUIDATION = 2;
    uint8 constant RESOLVED = 3;

    function setUp() public {
        usdc = new MockUSDC();
        registry = new MockRegistry();
        estate = new Estate(address(usdc), trustee, address(registry), AGENT_ID);
    }

    function _claim(bytes32 id, address creditor, uint256 amount, Estate.PriorityClass class) internal {
        vm.prank(trustee);
        estate.registerClaim(id, creditor, amount, class);
    }

    function _approveCurrent() internal returns (bytes32 planHash) {
        planHash = estate.currentPlanHash();
        vm.prank(trustee);
        estate.approvePlan(planHash);
    }

    // --- access control -----------------------------------------------------

    function test_registerClaim_revertsForNonTrustee() public {
        vm.expectRevert(Estate.NotTrustee.selector);
        estate.registerClaim(bytes32(uint256(1)), makeAddr("c"), 100, Estate.PriorityClass.Unsecured);
    }

    function test_approvePlan_revertsForNonTrustee() public {
        vm.expectRevert(Estate.NotTrustee.selector);
        estate.approvePlan(bytes32(uint256(1)));
    }

    function test_registerClaim_rejectsDuplicateId() public {
        _claim(bytes32(uint256(1)), makeAddr("c"), 100, Estate.PriorityClass.Unsecured);
        vm.prank(trustee);
        vm.expectRevert(Estate.ClaimAlreadyRegistered.selector);
        estate.registerClaim(bytes32(uint256(1)), makeAddr("c2"), 50, Estate.PriorityClass.Secured);
    }

    function test_registerClaim_storesClaim() public {
        address creditor = makeAddr("creditor");
        _claim(bytes32(uint256(1)), creditor, 100, Estate.PriorityClass.Secured);

        (address storedCreditor, uint256 amount, Estate.PriorityClass class, bool paid, uint256 paidAmount) =
            estate.claims(bytes32(uint256(1)));
        assertEq(storedCreditor, creditor);
        assertEq(amount, 100);
        assertEq(uint8(class), uint8(Estate.PriorityClass.Secured));
        assertFalse(paid);
        assertEq(paidAmount, 0);
    }

    // --- the liquidation gate ----------------------------------------------

    /// The single most important property in this contract: an agent in
    /// Administration may still recover, so its creditors must NOT be paid out
    /// from under it.
    function test_executePlan_revertsWhileMerelyInAdministration() public {
        _claim(bytes32(uint256(1)), makeAddr("c"), 100, Estate.PriorityClass.Unsecured);
        bytes32 planHash = _approveCurrent();
        usdc.mint(address(estate), 100);
        registry.setStatus(ADMINISTRATION);

        vm.expectRevert(abi.encodeWithSelector(Estate.AgentNotInLiquidation.selector, ADMINISTRATION));
        estate.executePlan(planHash);
    }

    function test_executePlan_revertsWhileActive() public {
        _claim(bytes32(uint256(1)), makeAddr("c"), 100, Estate.PriorityClass.Unsecured);
        bytes32 planHash = _approveCurrent();
        usdc.mint(address(estate), 100);
        registry.setStatus(ACTIVE);

        vm.expectRevert(abi.encodeWithSelector(Estate.AgentNotInLiquidation.selector, ACTIVE));
        estate.executePlan(planHash);
    }

    /// Resolved is downstream of Liquidation, so a wound-up estate should not
    /// still be executable.
    function test_executePlan_revertsOnceResolved() public {
        _claim(bytes32(uint256(1)), makeAddr("c"), 100, Estate.PriorityClass.Unsecured);
        bytes32 planHash = _approveCurrent();
        usdc.mint(address(estate), 100);
        registry.setStatus(RESOLVED);

        vm.expectRevert(abi.encodeWithSelector(Estate.AgentNotInLiquidation.selector, RESOLVED));
        estate.executePlan(planHash);
    }

    // --- plan integrity -----------------------------------------------------

    function test_executePlan_revertsWithoutApproval() public {
        _claim(bytes32(uint256(1)), makeAddr("c"), 100, Estate.PriorityClass.Unsecured);
        registry.setStatus(LIQUIDATION);
        usdc.mint(address(estate), 100);

        // Resolved before arming the cheatcode: expectRevert applies to the very
        // next call, and evaluating this as an argument would consume it.
        bytes32 planHash = estate.currentPlanHash();

        vm.expectRevert(Estate.NoPlanApproved.selector);
        estate.executePlan(planHash);
    }

    /// Approving a plan then sneaking in another claim must invalidate it -
    /// otherwise approval covers a claim set nobody agreed to.
    function test_executePlan_revertsIfClaimAddedAfterApproval() public {
        _claim(bytes32(uint256(1)), makeAddr("c1"), 100, Estate.PriorityClass.Unsecured);
        bytes32 planHash = _approveCurrent();

        _claim(bytes32(uint256(2)), makeAddr("attacker"), 500, Estate.PriorityClass.Secured);

        registry.setStatus(LIQUIDATION);
        usdc.mint(address(estate), 600);

        vm.expectRevert(Estate.PlanMismatch.selector);
        estate.executePlan(planHash);
    }

    function test_executePlan_revertsOnWrongHash() public {
        _claim(bytes32(uint256(1)), makeAddr("c"), 100, Estate.PriorityClass.Unsecured);
        _approveCurrent();
        registry.setStatus(LIQUIDATION);
        usdc.mint(address(estate), 100);

        vm.expectRevert(Estate.PlanMismatch.selector);
        estate.executePlan(keccak256("not the plan"));
    }

    function test_executePlan_revertsOnEmptyEstate() public {
        _claim(bytes32(uint256(1)), makeAddr("c"), 100, Estate.PriorityClass.Unsecured);
        bytes32 planHash = _approveCurrent();
        registry.setStatus(LIQUIDATION);

        vm.expectRevert(Estate.NothingToDistribute.selector);
        estate.executePlan(planHash);
    }

    function test_executePlan_cannotRunTwice() public {
        _claim(bytes32(uint256(1)), makeAddr("c"), 100, Estate.PriorityClass.Unsecured);
        bytes32 planHash = _approveCurrent();
        registry.setStatus(LIQUIDATION);
        usdc.mint(address(estate), 100);

        estate.executePlan(planHash);
        vm.expectRevert(Estate.AlreadyExecuted.selector);
        estate.executePlan(planHash);
    }

    // --- the waterfall ------------------------------------------------------

    function test_waterfall_paysAllInFullWhenSolvent() public {
        address secured = makeAddr("secured");
        address admin = makeAddr("admin");
        address unsecured = makeAddr("unsecured");

        _claim(bytes32(uint256(1)), secured, 300, Estate.PriorityClass.Secured);
        _claim(bytes32(uint256(2)), admin, 200, Estate.PriorityClass.Administrative);
        _claim(bytes32(uint256(3)), unsecured, 500, Estate.PriorityClass.Unsecured);

        bytes32 planHash = _approveCurrent();
        registry.setStatus(LIQUIDATION);
        usdc.mint(address(estate), 1000);

        estate.executePlan(planHash);

        assertEq(usdc.balanceOf(secured), 300);
        assertEq(usdc.balanceOf(admin), 200);
        assertEq(usdc.balanceOf(unsecured), 500);
        assertEq(estate.totalOutstanding(), 0);
    }

    /// Secured is paid in full, Administrative takes what's left, Unsecured
    /// gets nothing. This is the case that matters - estates are usually short.
    function test_waterfall_respectsPriorityWhenInsolvent() public {
        address secured = makeAddr("secured");
        address admin = makeAddr("admin");
        address unsecured = makeAddr("unsecured");

        _claim(bytes32(uint256(1)), secured, 300, Estate.PriorityClass.Secured);
        _claim(bytes32(uint256(2)), admin, 200, Estate.PriorityClass.Administrative);
        _claim(bytes32(uint256(3)), unsecured, 500, Estate.PriorityClass.Unsecured);

        bytes32 planHash = _approveCurrent();
        registry.setStatus(LIQUIDATION);
        usdc.mint(address(estate), 400); // covers Secured, half of Administrative

        estate.executePlan(planHash);

        assertEq(usdc.balanceOf(secured), 300, "secured paid in full first");
        assertEq(usdc.balanceOf(admin), 100, "administrative takes the remainder");
        assertEq(usdc.balanceOf(unsecured), 0, "unsecured gets nothing");
    }

    /// Two creditors in the same class with an underfunded pot split it in
    /// proportion to their claims, not first-come-first-served.
    function test_waterfall_prorataWithinAClass() public {
        address a = makeAddr("a");
        address b = makeAddr("b");

        _claim(bytes32(uint256(1)), a, 750, Estate.PriorityClass.Unsecured);
        _claim(bytes32(uint256(2)), b, 250, Estate.PriorityClass.Unsecured);

        bytes32 planHash = _approveCurrent();
        registry.setStatus(LIQUIDATION);
        usdc.mint(address(estate), 100); // 10% of the 1000 claimed

        estate.executePlan(planHash);

        assertEq(usdc.balanceOf(a), 75, "75% of the pot");
        assertEq(usdc.balanceOf(b), 25, "25% of the pot");
    }

    function test_executePlan_bubblesUpTransferFailure() public {
        _claim(bytes32(uint256(1)), makeAddr("c"), 100, Estate.PriorityClass.Unsecured);
        bytes32 planHash = _approveCurrent();
        registry.setStatus(LIQUIDATION);
        usdc.mint(address(estate), 100);
        usdc.setFailTransfers(true);

        vm.expectRevert(Estate.TransferFailed.selector);
        estate.executePlan(planHash);
    }

    function testFuzz_waterfall_neverOverpays(uint96 pot, uint96 claimA, uint96 claimB) public {
        vm.assume(claimA > 0 && claimB > 0 && pot > 0);
        vm.assume(uint256(claimA) + uint256(claimB) < type(uint96).max);

        address a = makeAddr("fa");
        address b = makeAddr("fb");
        _claim(bytes32(uint256(1)), a, claimA, Estate.PriorityClass.Unsecured);
        _claim(bytes32(uint256(2)), b, claimB, Estate.PriorityClass.Unsecured);

        bytes32 planHash = _approveCurrent();
        registry.setStatus(LIQUIDATION);
        usdc.mint(address(estate), pot);

        estate.executePlan(planHash);

        assertLe(usdc.balanceOf(a), claimA, "never pays a creditor more than its allowed claim");
        assertLe(usdc.balanceOf(b), claimB, "never pays a creditor more than its allowed claim");
        assertLe(usdc.balanceOf(a) + usdc.balanceOf(b), pot, "never distributes more than it holds");
    }
}
