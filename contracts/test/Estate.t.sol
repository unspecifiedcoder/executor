// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {Estate} from "../src/Estate.sol";
import {MockUSDC} from "./mocks/MockUSDC.sol";

contract MockRegistry {
    uint8 public status;
    address public destination;

    function setStatus(uint8 s) external {
        status = s;
    }

    function setDestination(address d) external {
        destination = d;
    }

    function getStatus(bytes32) external view returns (uint8) {
        return status;
    }

    /// Mirrors the real registry: the treasury while Active, the estate
    /// otherwise. Tests that care set it explicitly.
    function getPaymentDestination(bytes32) external view returns (address) {
        return destination;
    }
}

/// @notice A token that calls back into the estate mid-distribution. The
/// realistic reentrancy surface for this contract: `executePlan` hands control
/// to `usdc.transfer` while the waterfall is half-applied. It completes the
/// transfer normally afterwards, so a passing test proves the *nested* call was
/// rejected rather than that the token merely broke.
contract ReenteringToken {
    mapping(address => uint256) public balanceOf;
    address public estate;
    bool public reenteredAndFailed;
    bool private entered;

    function setEstate(address e) external {
        estate = e;
    }

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        if (!entered && estate != address(0)) {
            entered = true;
            bytes32 planHash = EstateLike(estate).approvedPlanHash();
            try EstateLike(estate).executePlan(planHash) {
                reenteredAndFailed = false;
            } catch {
                reenteredAndFailed = true;
            }
        }
        require(balanceOf[msg.sender] >= amount, "insufficient");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}

interface EstateLike {
    function executePlan(bytes32) external;
    function approvedPlanHash() external view returns (bytes32);
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

    function _claim(bytes32 id, address creditor, uint256 amount, Estate.PriorityClass class)
        internal
    {
        vm.prank(trustee);
        estate.registerClaim(id, creditor, amount, class);
    }

    /// An estate with an approved plan whose every claim is paid in full, left
    /// at Liquidation. The starting point for testing the gates that are not
    /// about outstanding claims.
    function _settledEstateAtLiquidation() internal {
        _claim(bytes32(uint256(0xfeed)), makeAddr("settled"), 1_000, Estate.PriorityClass.Secured);
        bytes32 planHash = _approveCurrent();
        usdc.mint(address(estate), 1_000);
        registry.setStatus(LIQUIDATION);
        estate.executePlan(planHash);
        require(estate.totalOutstanding() == 0, "helper: claim not settled");
    }

    function _approveCurrent() internal returns (bytes32 planHash) {
        planHash = estate.currentPlanHash();
        vm.prank(trustee);
        estate.approvePlan(planHash);
    }

    // --- access control -----------------------------------------------------

    function test_registerClaim_revertsForNonTrustee() public {
        vm.expectRevert(Estate.NotTrustee.selector);
        estate.registerClaim(
            bytes32(uint256(1)), makeAddr("c"), 100, Estate.PriorityClass.Unsecured
        );
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

        (
            address storedCreditor,
            uint256 amount,
            Estate.PriorityClass class,
            bool paid,
            bool registered,
            uint256 paidAmount
        ) = estate.claims(bytes32(uint256(1)));
        assertEq(storedCreditor, creditor);
        assertEq(amount, 100);
        assertEq(uint8(class), uint8(Estate.PriorityClass.Secured));
        assertFalse(paid);
        assertTrue(registered);
        assertEq(paidAmount, 0);
    }

    /// The `registered` flag is the existence sentinel, and it has to be
    /// unset for an id nobody registered - otherwise it is not a sentinel.
    function test_registerClaim_unknownIdIsNotRegistered() public view {
        (,,,, bool registered,) = estate.claims(keccak256("never-registered"));
        assertFalse(registered);
    }

    /// A claim payable to the zero address is refused outright. It is refused
    /// on its own merits - an allowed amount owed to nobody still counts
    /// towards its priority class and dilutes every real creditor in that
    /// class pro-rata - and refusing it also closes the door the freeze below
    /// came through.
    function test_registerClaim_rejectsZeroCreditor() public {
        vm.prank(trustee);
        vm.expectRevert(Estate.ZeroCreditor.selector);
        estate.registerClaim(bytes32(uint256(1)), address(0), 100, Estate.PriorityClass.Unsecured);
        assertEq(estate.claimCount(), 0);
    }

    /// The permanent-freeze regression, end to end.
    ///
    /// While `claims[id].creditor != address(0)` was the existence sentinel, a
    /// claim registered with a zero creditor did not set it. The same id then
    /// passed the duplicate check a second time and was pushed into `claimIds`
    /// twice. `_classTotal` counted it twice, two allocation slots settled
    /// against one `Claim`, `paidAmount` overshot `allowedAmount`, and from
    /// then on every `allowedAmount - paidAmount` reverted with an arithmetic
    /// panic - inside `totalOutstanding()`, which both `executePlan` and
    /// `sweepSurplus` call. Estate funds frozen forever, with no admin path
    /// out.
    ///
    /// This asserts the whole chain: the duplicate cannot be created, the
    /// claim array does not grow, the waterfall still runs, and the estate can
    /// still be swept afterwards.
    function test_registerClaim_zeroCreditorCannotFreezeTheEstate() public {
        address real = makeAddr("real-creditor");
        _claim(bytes32(uint256(1)), real, 100, Estate.PriorityClass.Secured);

        bytes32 ghost = keccak256("ghost");
        for (uint256 i = 0; i < 2; i++) {
            vm.prank(trustee);
            vm.expectRevert(Estate.ZeroCreditor.selector);
            estate.registerClaim(ghost, address(0), 500, Estate.PriorityClass.Unsecured);
        }

        assertEq(estate.claimCount(), 1, "the ghost claim never entered claimIds");
        assertEq(estate.totalOutstanding(), 100);

        bytes32 planHash = _approveCurrent();
        usdc.mint(address(estate), 2000);
        registry.setStatus(LIQUIDATION);

        // Both of these reverted with panic 0x11 under the old sentinel.
        estate.executePlan(planHash);
        assertEq(usdc.balanceOf(real), 100);
        assertEq(estate.totalOutstanding(), 0);

        vm.prank(trustee);
        uint256 swept = estate.sweepSurplus(trustee);
        assertEq(swept, 1900);
        assertEq(usdc.balanceOf(address(estate)), 0, "no funds left frozen in the estate");
    }

    /// A token that returns `true` from `transfer` and moves nothing must not
    /// be able to turn an unpaid creditor into a settled one. `_tryTransfer`
    /// defines success as this contract's balance falling, not as the token
    /// saying so, so a lying token lands in the same escrow branch as a
    /// blacklist and the creditor can still pull once the token behaves.
    function test_tokenThatReportsSuccessWithoutPayingIsEscrowed() public {
        address creditor = makeAddr("creditor");
        _claim(bytes32(uint256(1)), creditor, 100, Estate.PriorityClass.Unsecured);
        bytes32 planHash = _approveCurrent();
        usdc.mint(address(estate), 100);
        registry.setStatus(LIQUIDATION);

        usdc.setLieOnTransfer(true);
        estate.executePlan(planHash);

        assertEq(usdc.balanceOf(creditor), 0, "nothing actually moved");
        assertEq(usdc.balanceOf(address(estate)), 100, "the funds are still here");
        assertEq(estate.withdrawable(creditor), 100, "and they are booked to the creditor");
        assertEq(estate.totalEscrowed(), 100);
        assertEq(estate.distributable(), 0, "escrowed funds are not distributable");

        usdc.setLieOnTransfer(false);
        vm.prank(creditor);
        estate.claimPayout();
        assertEq(usdc.balanceOf(creditor), 100);
    }

    /// The same guard on the pull path: `claimPayout` must not burn a credit
    /// against a transfer that reported success and moved nothing.
    function test_claimPayout_preservesCreditAgainstALyingToken() public {
        address creditor = makeAddr("creditor");
        _claim(bytes32(uint256(1)), creditor, 100, Estate.PriorityClass.Unsecured);
        bytes32 planHash = _approveCurrent();
        usdc.mint(address(estate), 100);
        registry.setStatus(LIQUIDATION);

        usdc.setBlocked(creditor, true);
        estate.executePlan(planHash);
        assertEq(estate.withdrawable(creditor), 100);

        usdc.setBlocked(creditor, false);
        usdc.setLieOnTransfer(true);
        vm.prank(creditor);
        vm.expectRevert(Estate.TransferFailed.selector);
        estate.claimPayout();
        assertEq(estate.withdrawable(creditor), 100, "the credit survived");
    }

    /// And on the sweep path, where a lying token would otherwise emit
    /// `SurplusSwept` for money that never left.
    function test_sweepSurplus_revertsAgainstALyingToken() public {
        _settledEstateAtLiquidation();
        usdc.mint(address(estate), 500);
        usdc.setLieOnTransfer(true);
        vm.prank(trustee);
        vm.expectRevert(Estate.TransferFailed.selector);
        estate.sweepSurplus(trustee);
        assertEq(usdc.balanceOf(address(estate)), 500);
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

        vm.expectRevert(
            abi.encodeWithSelector(Estate.AgentNotInLiquidation.selector, ADMINISTRATION)
        );
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

    /// Resolved is downstream of Liquidation and one-way, and nothing orders
    /// `ExecutorRegistry.resolve()` against `executePlan()`. If Resolved were
    /// refused here, a trustee who resolved first would brick the estate
    /// permanently. Resolved adds no authority - it is reachable only from
    /// Liquidation, and only by the same trustee - so it pays out too.
    function test_executePlan_stillRunsOnceResolved() public {
        address c = makeAddr("c");
        _claim(bytes32(uint256(1)), c, 100, Estate.PriorityClass.Unsecured);
        bytes32 planHash = _approveCurrent();
        usdc.mint(address(estate), 100);
        registry.setStatus(RESOLVED);

        estate.executePlan(planHash);
        assertEq(usdc.balanceOf(c), 100, "resolving before executing must not strand the estate");
    }

    /// The exact ordering the judge's PoC exercised: resolve() first, then
    /// discover the estate was never distributed.
    function test_executePlan_resolveBeforeExecuteDoesNotBrickTheEstate() public {
        address secured = makeAddr("secured");
        address unsecured = makeAddr("unsecured");
        _claim(bytes32(uint256(1)), secured, 300, Estate.PriorityClass.Secured);
        _claim(bytes32(uint256(2)), unsecured, 200, Estate.PriorityClass.Unsecured);
        bytes32 planHash = _approveCurrent();
        usdc.mint(address(estate), 500);

        registry.setStatus(LIQUIDATION);
        registry.setStatus(RESOLVED); // trustee winds up before pushing the plan

        estate.executePlan(planHash);
        assertEq(usdc.balanceOf(secured), 300);
        assertEq(usdc.balanceOf(unsecured), 200);
        assertEq(estate.totalOutstanding(), 0);
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

    /// A second round with nothing new to hand out is a no-op that reverts,
    /// not a second payment. `executed` closes the claim set, not the contract.
    function test_executePlan_secondRoundWithNoNewFundsReverts() public {
        address c = makeAddr("c");
        _claim(bytes32(uint256(1)), c, 100, Estate.PriorityClass.Unsecured);
        bytes32 planHash = _approveCurrent();
        registry.setStatus(LIQUIDATION);
        usdc.mint(address(estate), 100);

        estate.executePlan(planHash);
        assertTrue(estate.executed());
        assertEq(usdc.balanceOf(c), 100);

        vm.expectRevert(Estate.NothingToDistribute.selector);
        estate.executePlan(planHash);
        assertEq(usdc.balanceOf(c), 100, "a re-run must never pay a settled claim twice");
    }

    function test_registerClaim_revertsAfterFirstDistribution() public {
        _claim(bytes32(uint256(1)), makeAddr("c"), 100, Estate.PriorityClass.Unsecured);
        bytes32 planHash = _approveCurrent();
        registry.setStatus(LIQUIDATION);
        usdc.mint(address(estate), 100);
        estate.executePlan(planHash);

        vm.prank(trustee);
        vm.expectRevert(Estate.AlreadyExecuted.selector);
        estate.registerClaim(
            bytes32(uint256(2)), makeAddr("late"), 100, Estate.PriorityClass.Secured
        );
    }

    function test_registerClaim_revertsPastTheClaimCeiling() public {
        for (uint256 i = 0; i < estate.MAX_CLAIMS(); i++) {
            _claim(bytes32(i + 1), makeAddr("c"), 1, Estate.PriorityClass.Unsecured);
        }
        vm.prank(trustee);
        vm.expectRevert(Estate.TooManyClaims.selector);
        estate.registerClaim(
            bytes32(uint256(9999)), makeAddr("c"), 1, Estate.PriorityClass.Unsecured
        );
    }

    /// The plan hash has to commit to the terms, not just the ids - otherwise
    /// "approved" says nothing about who gets paid what.
    function test_currentPlanHash_commitsToCreditorAmountAndClass() public {
        _claim(bytes32(uint256(1)), makeAddr("c1"), 100, Estate.PriorityClass.Unsecured);
        bytes32 h = estate.currentPlanHash();

        Estate other = new Estate(address(usdc), trustee, address(registry), AGENT_ID);
        vm.prank(trustee);
        other.registerClaim(
            bytes32(uint256(1)), makeAddr("c2"), 100, Estate.PriorityClass.Unsecured
        );
        assertTrue(h != other.currentPlanHash(), "a different creditor must change the hash");

        Estate third = new Estate(address(usdc), trustee, address(registry), AGENT_ID);
        vm.prank(trustee);
        third.registerClaim(
            bytes32(uint256(1)), makeAddr("c1"), 101, Estate.PriorityClass.Unsecured
        );
        assertTrue(h != third.currentPlanHash(), "a different amount must change the hash");

        Estate fourth = new Estate(address(usdc), trustee, address(registry), AGENT_ID);
        vm.prank(trustee);
        fourth.registerClaim(bytes32(uint256(1)), makeAddr("c1"), 100, Estate.PriorityClass.Secured);
        assertTrue(h != fourth.currentPlanHash(), "a different priority class must change the hash");
    }

    /// The hash must NOT drift as claims get paid, or the second distribution
    /// round could never re-derive the approved plan.
    function test_currentPlanHash_isStableAcrossDistributionRounds() public {
        _claim(bytes32(uint256(1)), makeAddr("c"), 1000, Estate.PriorityClass.Unsecured);
        bytes32 planHash = _approveCurrent();
        registry.setStatus(LIQUIDATION);
        usdc.mint(address(estate), 100);

        estate.executePlan(planHash);
        assertEq(estate.currentPlanHash(), planHash, "settlement progress is not a plan term");
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

    /// The true shortfall after a partial pro-rata round. This used to report 0:
    /// `paid` was set on a partial payment and `totalOutstanding` skipped every
    /// `paid` claim, so an estate that had handed out 100 against 1000 of claims
    /// announced itself square.
    function test_executePlan_reportsTrueShortfallAfterProRata() public {
        address a = makeAddr("a");
        address b = makeAddr("b");
        _claim(bytes32(uint256(1)), a, 750, Estate.PriorityClass.Unsecured);
        _claim(bytes32(uint256(2)), b, 250, Estate.PriorityClass.Unsecured);

        bytes32 planHash = _approveCurrent();
        registry.setStatus(LIQUIDATION);
        usdc.mint(address(estate), 100);

        vm.expectEmit(true, false, false, true);
        emit Estate.PlanExecuted(planHash, 100, 900);
        estate.executePlan(planHash);

        assertEq(estate.totalOutstanding(), 900, "creditors are still owed 900");
    }

    // --- refused payouts: escrow and pull ------------------------------------

    /// The griefing vector this contract used to have: real USDC can blacklist
    /// an address, and a distribution that reverts on one refused transfer lets
    /// any single creditor - or anyone who can get one blacklisted - freeze the
    /// entire estate for everybody else. Everyone else must still be paid, and
    /// the blocked creditor must still be able to collect later.
    function test_blockedCreditorDoesNotBrickTheDistribution() public {
        address blockedSecured = makeAddr("blockedSecured");
        address admin = makeAddr("admin");
        address unsecured = makeAddr("unsecured");

        _claim(bytes32(uint256(1)), blockedSecured, 300, Estate.PriorityClass.Secured);
        _claim(bytes32(uint256(2)), admin, 200, Estate.PriorityClass.Administrative);
        _claim(bytes32(uint256(3)), unsecured, 500, Estate.PriorityClass.Unsecured);

        bytes32 planHash = _approveCurrent();
        registry.setStatus(LIQUIDATION);
        usdc.mint(address(estate), 1000);
        usdc.setBlocked(blockedSecured, true);

        estate.executePlan(planHash);

        assertEq(usdc.balanceOf(blockedSecured), 0, "blocked creditor could not be pushed");
        assertEq(usdc.balanceOf(admin), 200, "everyone else is paid anyway");
        assertEq(usdc.balanceOf(unsecured), 500, "everyone else is paid anyway");
        assertEq(estate.withdrawable(blockedSecured), 300, "their share is booked, not lost");
        assertEq(estate.totalEscrowed(), 300);
        assertEq(estate.totalOutstanding(), 0, "the claim is settled - the funds are just held");

        // ...and once the blacklist lifts, they pull it themselves.
        usdc.setBlocked(blockedSecured, false);
        vm.prank(blockedSecured);
        estate.claimPayout();

        assertEq(usdc.balanceOf(blockedSecured), 300);
        assertEq(estate.withdrawable(blockedSecured), 0);
        assertEq(estate.totalEscrowed(), 0);
        assertEq(usdc.balanceOf(address(estate)), 0);
    }

    /// Escrowed funds are not somebody else's to distribute.
    function test_escrowedFundsAreExcludedFromLaterRounds() public {
        address blocked = makeAddr("blocked");
        address other = makeAddr("other");
        _claim(bytes32(uint256(1)), blocked, 100, Estate.PriorityClass.Secured);
        _claim(bytes32(uint256(2)), other, 100, Estate.PriorityClass.Unsecured);

        bytes32 planHash = _approveCurrent();
        registry.setStatus(LIQUIDATION);
        usdc.mint(address(estate), 100);
        usdc.setBlocked(blocked, true);

        estate.executePlan(planHash); // 100 goes to Secured, refused, escrowed
        assertEq(estate.totalEscrowed(), 100);
        assertEq(estate.distributable(), 0, "the held 100 is not free money");

        vm.expectRevert(Estate.NothingToDistribute.selector);
        estate.executePlan(planHash);
        assertEq(usdc.balanceOf(other), 0);
    }

    function test_claimPayout_revertsWithNothingOwed() public {
        vm.prank(makeAddr("stranger"));
        vm.expectRevert(Estate.NothingToClaim.selector);
        estate.claimPayout();
    }

    /// A failed pull must leave the credit intact, not burn it.
    function test_claimPayout_preservesCreditWhenStillBlocked() public {
        address blocked = makeAddr("blocked");
        _claim(bytes32(uint256(1)), blocked, 100, Estate.PriorityClass.Secured);
        bytes32 planHash = _approveCurrent();
        registry.setStatus(LIQUIDATION);
        usdc.mint(address(estate), 100);
        usdc.setBlocked(blocked, true);
        estate.executePlan(planHash);

        vm.prank(blocked);
        vm.expectRevert(Estate.TransferFailed.selector);
        estate.claimPayout();

        assertEq(estate.withdrawable(blocked), 100, "credit survives a failed pull");
    }

    /// A token that returns false rather than reverting takes the same path.
    function test_transferReturningFalseIsEscrowedNotFatal() public {
        address c = makeAddr("c");
        _claim(bytes32(uint256(1)), c, 100, Estate.PriorityClass.Unsecured);
        bytes32 planHash = _approveCurrent();
        registry.setStatus(LIQUIDATION);
        usdc.mint(address(estate), 100);
        usdc.setFailTransfers(true);

        estate.executePlan(planHash);
        assertEq(estate.withdrawable(c), 100);
    }

    // --- dust, late funds, and the sweep -------------------------------------

    /// Pro-rata truncation used to strand its remainder forever, because
    /// `executed` was one-way and there was no sweep. The remainder is now
    /// handed out in claim order in the same round: 100 across three equal
    /// claims is 34/33/33, not 33/33/33 with a unit left in the contract.
    /// A unit that small can never survive another round's division, so
    /// deferring it would be the same bug with more steps.
    function test_proRataLeavesNoTruncationDust() public {
        address a = makeAddr("a");
        address b = makeAddr("b");
        address c = makeAddr("c");
        _claim(bytes32(uint256(1)), a, 100, Estate.PriorityClass.Unsecured);
        _claim(bytes32(uint256(2)), b, 100, Estate.PriorityClass.Unsecured);
        _claim(bytes32(uint256(3)), c, 100, Estate.PriorityClass.Unsecured);

        bytes32 planHash = _approveCurrent();
        registry.setStatus(LIQUIDATION);
        usdc.mint(address(estate), 100);

        estate.executePlan(planHash);

        assertEq(usdc.balanceOf(a), 34, "the remainder goes to the first claim in order");
        assertEq(usdc.balanceOf(b), 33);
        assertEq(usdc.balanceOf(c), 33);
        assertEq(usdc.balanceOf(address(estate)), 0, "no stranded dust");
        assertEq(estate.totalOutstanding(), 200);
    }

    /// `ExecutorRegistry.resolve()` promises that "anything that arrives late
    /// belongs to the estate". That is only true if a late payment can still be
    /// distributed.
    function test_lateFundsAreDistributedByAnotherRound() public {
        address secured = makeAddr("secured");
        address unsecured = makeAddr("unsecured");
        _claim(bytes32(uint256(1)), secured, 300, Estate.PriorityClass.Secured);
        _claim(bytes32(uint256(2)), unsecured, 500, Estate.PriorityClass.Unsecured);

        bytes32 planHash = _approveCurrent();
        registry.setStatus(LIQUIDATION);
        usdc.mint(address(estate), 400);
        estate.executePlan(planHash);
        assertEq(usdc.balanceOf(secured), 300);
        assertEq(usdc.balanceOf(unsecured), 100);

        // A last x402 payment lands after the agent is wound up.
        registry.setStatus(RESOLVED);
        usdc.mint(address(estate), 250);
        estate.executePlan(planHash);

        assertEq(usdc.balanceOf(secured), 300, "already settled - not paid again");
        assertEq(usdc.balanceOf(unsecured), 350, "late funds flow down the same waterfall");
        assertEq(estate.totalOutstanding(), 150);
    }

    function test_sweepSurplus_returnsFundsOnceEveryClaimIsSettled() public {
        address c = makeAddr("c");
        address residual = makeAddr("residual");
        _claim(bytes32(uint256(1)), c, 100, Estate.PriorityClass.Unsecured);
        bytes32 planHash = _approveCurrent();
        registry.setStatus(LIQUIDATION);
        usdc.mint(address(estate), 100);
        estate.executePlan(planHash);

        usdc.mint(address(estate), 40); // late money, nobody left to owe it to
        vm.expectRevert(Estate.NothingToDistribute.selector);
        estate.executePlan(planHash);

        vm.prank(trustee);
        estate.sweepSurplus(residual);
        assertEq(usdc.balanceOf(residual), 40);
        assertEq(usdc.balanceOf(address(estate)), 0);
    }

    /// The sweep must never be a way around the waterfall.
    function test_sweepSurplus_revertsWhileAnyClaimIsShort() public {
        _claim(bytes32(uint256(1)), makeAddr("c"), 1000, Estate.PriorityClass.Unsecured);
        bytes32 planHash = _approveCurrent();
        registry.setStatus(LIQUIDATION);
        usdc.mint(address(estate), 100);
        estate.executePlan(planHash);

        vm.prank(trustee);
        vm.expectRevert(abi.encodeWithSelector(Estate.ClaimsOutstanding.selector, 900));
        estate.sweepSurplus(makeAddr("residual"));
    }

    function test_sweepSurplus_revertsForNonTrustee() public {
        vm.expectRevert(Estate.NotTrustee.selector);
        estate.sweepSurplus(makeAddr("residual"));
    }

    /// The sweep may not take escrowed payouts either - those are already owed
    /// to a named creditor who just could not be pushed.
    function test_sweepSurplus_cannotTakeEscrowedPayouts() public {
        address blocked = makeAddr("blocked");
        _claim(bytes32(uint256(1)), blocked, 100, Estate.PriorityClass.Unsecured);
        bytes32 planHash = _approveCurrent();
        registry.setStatus(LIQUIDATION);
        usdc.mint(address(estate), 100);
        usdc.setBlocked(blocked, true);
        estate.executePlan(planHash);

        assertEq(estate.totalOutstanding(), 0, "settled, but held");
        vm.prank(trustee);
        vm.expectRevert(Estate.NothingToDistribute.selector);
        estate.sweepSurplus(makeAddr("residual"));
    }

    // --- reentrancy ----------------------------------------------------------

    /// A hostile token is the realistic reentrancy surface here: `executePlan`
    /// hands control to `usdc.transfer` mid-waterfall. The guard is explicit
    /// rather than an accident of where a flag is set.
    function test_executePlan_isNotReentrant() public {
        ReenteringToken token = new ReenteringToken();
        Estate hostile = new Estate(address(token), trustee, address(registry), AGENT_ID);
        token.setEstate(address(hostile));

        vm.prank(trustee);
        hostile.registerClaim(
            bytes32(uint256(1)), makeAddr("c1"), 50, Estate.PriorityClass.Unsecured
        );
        vm.prank(trustee);
        hostile.registerClaim(
            bytes32(uint256(2)), makeAddr("c2"), 50, Estate.PriorityClass.Unsecured
        );

        bytes32 planHash = hostile.currentPlanHash();
        vm.prank(trustee);
        hostile.approvePlan(planHash);
        registry.setStatus(LIQUIDATION);
        token.mint(address(hostile), 100);

        hostile.executePlan(planHash);

        // The reentrant call was rejected; the outer round still completed and
        // paid each claim exactly once.
        assertTrue(token.reenteredAndFailed(), "the nested executePlan must have been rejected");
        assertEq(hostile.totalOutstanding(), 0);
        assertEq(token.balanceOf(makeAddr("c1")) + token.balanceOf(makeAddr("c2")), 100);
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

    // --- sweepSurplus: the door that had no lock -----------------------------
    //
    // `sweepSurplus` is gated on `totalOutstanding() == 0`, and the comment
    // above it claims that means "while any creditor is short, the only way
    // money leaves this contract is executePlan or claimPayout". That guard is
    // vacuous before any claim exists: `totalOutstanding()` sums over
    // `claimIds`, so an empty claim set makes it 0 and the gate passes. Without
    // a status check as well, a trustee could move the entire balance out at
    // any point in the agent's life - including while it was Active and
    // healthy, or in the Administration window it is supposed to be able to
    // recover from.

    function test_sweepSurplus_revertsWhileAgentIsActive() public {
        _settledEstateAtLiquidation();
        usdc.mint(address(estate), 500_000);
        registry.setStatus(ACTIVE);
        vm.prank(trustee);
        vm.expectRevert(abi.encodeWithSelector(Estate.AgentNotInLiquidation.selector, ACTIVE));
        estate.sweepSurplus(trustee);
        assertEq(usdc.balanceOf(address(estate)), 500_000, "estate must keep the funds");
    }

    function test_sweepSurplus_revertsDuringRecoverableAdministration() public {
        _settledEstateAtLiquidation();
        usdc.mint(address(estate), 1_000_000);
        registry.setStatus(ADMINISTRATION);
        vm.prank(trustee);
        vm.expectRevert(
            abi.encodeWithSelector(Estate.AgentNotInLiquidation.selector, ADMINISTRATION)
        );
        estate.sweepSurplus(trustee);
        assertEq(usdc.balanceOf(address(estate)), 1_000_000, "administration is recoverable");
    }

    /// The waterfall-jumping case: sweep first, register claims afterwards.
    /// Ordering alone must not let the trustee decide creditors get nothing.
    function test_sweepSurplus_revertsBeforeAnyPlanIsApproved() public {
        usdc.mint(address(estate), 300_000);
        registry.setStatus(LIQUIDATION);
        vm.prank(trustee);
        vm.expectRevert(Estate.NoPlanApproved.selector);
        estate.sweepSurplus(trustee);
        assertEq(usdc.balanceOf(address(estate)), 300_000, "an empty claim set is not a paid one");
    }

    /// What the function is actually for: late revenue arriving after every
    /// creditor has been paid in full. That still works.
    function test_sweepSurplus_stillWorksOnceEveryClaimIsSettled() public {
        _claim(bytes32(uint256(1)), makeAddr("c1"), 100_000, Estate.PriorityClass.Secured);
        bytes32 planHash = _approveCurrent();
        usdc.mint(address(estate), 100_000);
        registry.setStatus(LIQUIDATION);
        estate.executePlan(planHash);
        assertEq(estate.totalOutstanding(), 0, "creditor paid in full");

        usdc.mint(address(estate), 42_000); // late revenue
        vm.prank(trustee);
        uint256 swept = estate.sweepSurplus(trustee);
        assertEq(swept, 42_000);
        assertEq(usdc.balanceOf(trustee), 42_000);
    }

    // --- returnToTreasury: administration has to be recoverable for the money,
    // not just for the status ------------------------------------------------

    function test_returnToTreasury_sendsFundsBackOnceAgentRecovers() public {
        address treasury = makeAddr("treasury");
        registry.setDestination(treasury);

        // revenue arrives during a (permissionlessly triggered) administration
        registry.setStatus(ADMINISTRATION);
        usdc.mint(address(estate), 750_000);

        // ...the agent turns out to be fine and is restored
        registry.setStatus(ACTIVE);
        uint256 returned = estate.returnToTreasury();

        assertEq(returned, 750_000);
        assertEq(usdc.balanceOf(treasury), 750_000, "revenue follows the agent back");
        assertEq(usdc.balanceOf(address(estate)), 0);
    }

    function test_returnToTreasury_revertsWhileInAdministration() public {
        registry.setDestination(makeAddr("treasury"));
        usdc.mint(address(estate), 100_000);
        registry.setStatus(ADMINISTRATION);
        vm.expectRevert(abi.encodeWithSelector(Estate.AgentNotActive.selector, ADMINISTRATION));
        estate.returnToTreasury();
    }

    /// The important negative: this must never become a way to empty an estate
    /// that is actually resolving.
    function test_returnToTreasury_revertsInLiquidationAndResolved() public {
        registry.setDestination(makeAddr("treasury"));
        usdc.mint(address(estate), 100_000);

        registry.setStatus(LIQUIDATION);
        vm.expectRevert(abi.encodeWithSelector(Estate.AgentNotActive.selector, LIQUIDATION));
        estate.returnToTreasury();

        registry.setStatus(RESOLVED);
        vm.expectRevert(abi.encodeWithSelector(Estate.AgentNotActive.selector, RESOLVED));
        estate.returnToTreasury();

        assertEq(usdc.balanceOf(address(estate)), 100_000, "a resolving estate keeps its funds");
    }

    /// A creditor who could not be paid in an earlier round has money booked to
    /// them here. Returning "the balance" must not include it.
    function test_returnToTreasury_cannotTakeEscrowedPayouts() public {
        address blocked = makeAddr("blocked");
        address treasury = makeAddr("treasury");
        registry.setDestination(treasury);

        _claim(bytes32(uint256(7)), blocked, 50_000, Estate.PriorityClass.Secured);
        bytes32 planHash = _approveCurrent();
        usdc.mint(address(estate), 50_000);
        usdc.setBlocked(blocked, true);
        registry.setStatus(LIQUIDATION);
        estate.executePlan(planHash);
        assertEq(estate.withdrawable(blocked), 50_000, "payout escrowed, not sent");

        // agent recovers; the escrowed payout is not the treasury's to take
        registry.setStatus(ACTIVE);
        vm.expectRevert(Estate.NothingToDistribute.selector);
        estate.returnToTreasury();

        usdc.mint(address(estate), 9_000); // fresh revenue on top of the escrow
        assertEq(estate.returnToTreasury(), 9_000, "only the unescrowed part moves");
        assertEq(estate.withdrawable(blocked), 50_000, "creditor keeps their booked payout");
    }
}
