// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {ExecutorRegistry} from "../src/ExecutorRegistry.sol";

/// @notice Tests for the registry the x402 gateway and the dashboard read on
/// Sepolia (0x2946B46c2EB5Ec532093877223Ef043b13729e39, block 11669841).
/// Everything those two depend on is exercised here:
/// `getPaymentDestination` is read on every paid request, and the
/// Active -> Administration flip is the entire demo.
contract ExecutorRegistryTest is Test {
    ExecutorRegistry registry;

    bytes32 constant AGENT = keccak256("executor-hackathon-demo.eth");
    bytes32 constant UNREGISTERED = keccak256("nobody.eth");

    address owner = makeAddr("owner");
    address heartbeatSigner = makeAddr("heartbeatSigner");
    address trustee = makeAddr("trustee");
    address recoveryAuthority = makeAddr("recoveryAuthority");
    address treasury = makeAddr("treasury");
    address estate = makeAddr("estate");

    uint64 constant INTERVAL = 60;
    uint64 constant GRACE = 30;

    /// @dev `lastHeartbeat` is set to `block.timestamp` at registration, and the
    /// default test timestamp is 1, which makes off-by-one boundary tests hard to
    /// read. Warp somewhere realistic first.
    uint256 constant T0 = 1_700_000_000;

    function setUp() public {
        vm.warp(T0);
        registry = new ExecutorRegistry();
        vm.prank(owner);
        registry.registerAgent(
            AGENT, heartbeatSigner, trustee, recoveryAuthority, treasury, estate, INTERVAL, GRACE
        );
    }

    /// @dev The registration timestamp, which every deadline is measured from.
    function _lastHeartbeat() internal view returns (uint64) {
        (,,,,,,,, uint64 lastHeartbeat,,) = registry.plans(AGENT);
        return lastHeartbeat;
    }

    function _status() internal view returns (ExecutorRegistry.Status) {
        (,,,,,,,,, ExecutorRegistry.Status status,) = registry.plans(AGENT);
        return status;
    }

    // --- registration -------------------------------------------------------

    function test_registerAgent_storesPlanAndStartsActive() public view {
        (
            address planOwner,
            address signer,
            address planTrustee,
            address recovery,
            address planTreasury,
            address planEstate,
            uint64 interval,
            uint64 grace,
            uint64 lastHeartbeat,
            ExecutorRegistry.Status status,
            bool planLocked
        ) = registry.plans(AGENT);

        assertEq(planOwner, owner);
        assertEq(signer, heartbeatSigner);
        assertEq(planTrustee, trustee);
        assertEq(recovery, recoveryAuthority);
        assertEq(planTreasury, treasury);
        assertEq(planEstate, estate);
        assertEq(interval, INTERVAL);
        assertEq(grace, GRACE);
        assertEq(lastHeartbeat, uint64(T0));
        assertEq(uint8(status), uint8(ExecutorRegistry.Status.Active));
        assertFalse(planLocked);
    }

    /// @dev Registration is first-come-first-served and permanent: an agentId is
    /// claimed by whoever registers it, and a second registration cannot
    /// overwrite the first one's treasury out from under it.
    function test_registerAgent_revertsOnDuplicate() public {
        vm.prank(makeAddr("squatter"));
        vm.expectRevert(ExecutorRegistry.AgentAlreadyRegistered.selector);
        registry.registerAgent(
            AGENT,
            makeAddr("otherSigner"),
            trustee,
            recoveryAuthority,
            makeAddr("attackerTreasury"),
            estate,
            INTERVAL,
            GRACE
        );
    }

    // --- heartbeat ----------------------------------------------------------

    function test_heartbeat_updatesLastHeartbeat() public {
        vm.warp(T0 + 10);
        vm.prank(heartbeatSigner);
        registry.heartbeat(AGENT);
        assertEq(_lastHeartbeat(), uint64(T0 + 10));
    }

    function test_heartbeat_revertsForNonHeartbeatSigner() public {
        vm.prank(owner); // even the owner cannot heartbeat
        vm.expectRevert(ExecutorRegistry.NotHeartbeatSigner.selector);
        registry.heartbeat(AGENT);
    }

    function test_heartbeat_revertsForUnregisteredAgent() public {
        vm.prank(heartbeatSigner);
        vm.expectRevert(ExecutorRegistry.AgentNotFound.selector);
        registry.heartbeat(UNREGISTERED);
    }

    /// @dev A fresh heartbeat pushes the administration deadline out, which is
    /// the whole point of the dead-man's switch.
    function test_heartbeat_pushesAdministrationDeadlineOut() public {
        vm.warp(T0 + INTERVAL);
        vm.prank(heartbeatSigner);
        registry.heartbeat(AGENT);

        // Would have been eligible at T0 + 90; is now only eligible at T0 + 150.
        vm.warp(T0 + INTERVAL + GRACE);
        vm.expectRevert(ExecutorRegistry.TooEarly.selector);
        registry.enterAdministration(AGENT);
    }

    // --- enterAdministration boundary ---------------------------------------

    /// @dev The guard is `block.timestamp < lastHeartbeat + interval + grace`,
    /// so the deadline second itself is eligible. Tested from both sides.
    function test_enterAdministration_revertsOneSecondBeforeDeadline() public {
        vm.warp(uint256(_lastHeartbeat()) + INTERVAL + GRACE - 1);
        vm.expectRevert(ExecutorRegistry.TooEarly.selector);
        registry.enterAdministration(AGENT);
    }

    function test_enterAdministration_succeedsExactlyAtDeadline() public {
        vm.warp(uint256(_lastHeartbeat()) + INTERVAL + GRACE);
        registry.enterAdministration(AGENT);
        assertEq(uint8(_status()), uint8(ExecutorRegistry.Status.Administration));
    }

    /// @dev Deliberately permissionless: the contract checks eligibility, not the
    /// caller. A random address flipping the switch is the intended behavior.
    function test_enterAdministration_isPermissionless() public {
        vm.warp(uint256(_lastHeartbeat()) + INTERVAL + GRACE);
        vm.prank(makeAddr("randomBystander"));
        registry.enterAdministration(AGENT);
        assertEq(uint8(_status()), uint8(ExecutorRegistry.Status.Administration));
    }

    function test_enterAdministration_revertsIfNotActive() public {
        _enterAdministration();
        vm.expectRevert(
            abi.encodeWithSelector(
                ExecutorRegistry.WrongStatus.selector, ExecutorRegistry.Status.Administration
            )
        );
        registry.enterAdministration(AGENT);
    }

    function test_enterAdministration_revertsForUnregisteredAgent() public {
        vm.expectRevert(ExecutorRegistry.AgentNotFound.selector);
        registry.enterAdministration(UNREGISTERED);
    }

    // --- getPaymentDestination ----------------------------------------------
    // This is the function the x402 gateway re-reads on every request.

    function test_getPaymentDestination_isTreasuryWhileActive() public view {
        assertEq(registry.getPaymentDestination(AGENT), treasury);
    }

    function test_getPaymentDestination_flipsToEstateInAdministration() public {
        _enterAdministration();
        assertEq(registry.getPaymentDestination(AGENT), estate);
    }

    function test_getPaymentDestination_isEstateInLiquidation() public {
        _enterAdministration();
        vm.prank(trustee);
        registry.enterLiquidation(AGENT);
        assertEq(uint8(_status()), uint8(ExecutorRegistry.Status.Liquidation));
        assertEq(registry.getPaymentDestination(AGENT), estate);
    }

    function test_getPaymentDestination_revertsForUnregisteredAgent() public {
        vm.expectRevert(ExecutorRegistry.AgentNotFound.selector);
        registry.getPaymentDestination(UNREGISTERED);
    }

    /// @dev The round trip the demo actually performs: treasury -> estate ->
    /// treasury, with no redeploy and no change of endpoint.
    function test_getPaymentDestination_returnsToTreasuryAfterRestore() public {
        _enterAdministration();
        assertEq(registry.getPaymentDestination(AGENT), estate);

        vm.prank(recoveryAuthority);
        registry.restoreActive(AGENT);
        assertEq(registry.getPaymentDestination(AGENT), treasury);
    }

    // --- liquidation --------------------------------------------------------

    function test_enterLiquidation_revertsForNonTrustee() public {
        _enterAdministration();
        vm.prank(owner);
        vm.expectRevert(ExecutorRegistry.NotTrustee.selector);
        registry.enterLiquidation(AGENT);
    }

    function test_enterLiquidation_revertsWhileActive() public {
        vm.prank(trustee);
        vm.expectRevert(
            abi.encodeWithSelector(
                ExecutorRegistry.WrongStatus.selector, ExecutorRegistry.Status.Active
            )
        );
        registry.enterLiquidation(AGENT);
    }

    // --- restoreActive ------------------------------------------------------

    function test_restoreActive_revertsForNonRecoveryAuthority() public {
        _enterAdministration();
        vm.prank(owner); // the owner is not the recovery authority here
        vm.expectRevert(ExecutorRegistry.NotRecoveryAuthority.selector);
        registry.restoreActive(AGENT);
    }

    function test_restoreActive_resetsHeartbeatClock() public {
        _enterAdministration();
        uint256 restoreTime = block.timestamp + 5;
        vm.warp(restoreTime);

        vm.prank(recoveryAuthority);
        registry.restoreActive(AGENT);

        assertEq(uint8(_status()), uint8(ExecutorRegistry.Status.Active));
        assertEq(_lastHeartbeat(), uint64(restoreTime));

        // The grace window restarts from the restore, not from the old heartbeat.
        vm.warp(restoreTime + INTERVAL + GRACE - 1);
        vm.expectRevert(ExecutorRegistry.TooEarly.selector);
        registry.enterAdministration(AGENT);
    }

    function test_restoreActive_revertsWhileActive() public {
        vm.prank(recoveryAuthority);
        vm.expectRevert(
            abi.encodeWithSelector(
                ExecutorRegistry.WrongStatus.selector, ExecutorRegistry.Status.Active
            )
        );
        registry.restoreActive(AGENT);
    }

    // --- lockPlan -----------------------------------------------------------

    function test_lockPlan_setsFlag() public {
        vm.prank(owner);
        registry.lockPlan(AGENT);
        (,,,,,,,,,, bool planLocked) = registry.plans(AGENT);
        assertTrue(planLocked);
    }

    function test_lockPlan_revertsForNonOwner() public {
        vm.prank(trustee);
        vm.expectRevert(ExecutorRegistry.NotOwner.selector);
        registry.lockPlan(AGENT);
    }

    /// @dev The lock is load-bearing, not a published intention: `updatePlan`
    /// is a real setter for every field a creditor cares about, and locking is
    /// what takes it away. This is the property the flag exists to provide.
    function test_lockPlan_makesUpdatePlanRevert() public {
        vm.prank(owner);
        registry.lockPlan(AGENT);

        vm.prank(owner);
        vm.expectRevert(ExecutorRegistry.PlanIsLocked.selector);
        registry.updatePlan(
            AGENT,
            heartbeatSigner,
            trustee,
            recoveryAuthority,
            makeAddr("attackerTreasury"),
            estate,
            INTERVAL,
            GRACE
        );
    }

    /// @dev And the lock does not disturb the state machine it protects.
    function test_lockPlan_doesNotChangeLifecycleBehavior() public {
        vm.prank(owner);
        registry.lockPlan(AGENT);

        vm.warp(uint256(_lastHeartbeat()) + INTERVAL + GRACE);
        registry.enterAdministration(AGENT);
        assertEq(registry.getPaymentDestination(AGENT), estate);
    }

    // --- updatePlan ---------------------------------------------------------

    /// @dev The amend path exists because an Estate's address is not known
    /// until it is deployed, which is after the agent is registered. If it did
    /// not change what `getPaymentDestination` returns, it would be cosmetic.
    function test_updatePlan_changesPaymentDestination() public {
        address newTreasury = makeAddr("newTreasury");
        address newEstate = makeAddr("newEstate");

        vm.prank(owner);
        registry.updatePlan(
            AGENT,
            heartbeatSigner,
            trustee,
            recoveryAuthority,
            newTreasury,
            newEstate,
            INTERVAL,
            GRACE
        );

        assertEq(registry.getPaymentDestination(AGENT), newTreasury, "Active -> new treasury");

        _enterAdministration();
        assertEq(registry.getPaymentDestination(AGENT), newEstate, "Administration -> new estate");
    }

    function test_updatePlan_rewritesEveryField() public {
        address newSigner = makeAddr("newSigner");
        address newTrustee = makeAddr("newTrustee");
        address newRecovery = makeAddr("newRecovery");

        vm.prank(owner);
        registry.updatePlan(AGENT, newSigner, newTrustee, newRecovery, treasury, estate, 120, 60);

        (
            ,
            address signer,
            address planTrustee,
            address recovery,,,
            uint64 interval,
            uint64 grace,,,
        ) = registry.plans(AGENT);
        assertEq(signer, newSigner);
        assertEq(planTrustee, newTrustee);
        assertEq(recovery, newRecovery);
        assertEq(interval, 120);
        assertEq(grace, 60);

        // The new signer is the one that can heartbeat; the old one cannot.
        vm.prank(heartbeatSigner);
        vm.expectRevert(ExecutorRegistry.NotHeartbeatSigner.selector);
        registry.heartbeat(AGENT);

        vm.prank(newSigner);
        registry.heartbeat(AGENT);
    }

    function test_updatePlan_revertsForNonOwner() public {
        vm.prank(trustee); // not even the trustee may amend the plan
        vm.expectRevert(ExecutorRegistry.NotOwner.selector);
        registry.updatePlan(
            AGENT,
            heartbeatSigner,
            trustee,
            recoveryAuthority,
            makeAddr("attackerTreasury"),
            estate,
            INTERVAL,
            GRACE
        );
    }

    function test_updatePlan_emitsPlanUpdatedAndDestinationEvents() public {
        address newTreasury = makeAddr("newTreasury");
        address newEstate = makeAddr("newEstate");

        vm.expectEmit(true, false, false, true);
        emit ExecutorRegistry.PlanUpdated(AGENT, newTreasury, newEstate);
        vm.expectEmit(true, false, false, true);
        emit ExecutorRegistry.PaymentDestinationChanged(
            AGENT, newTreasury, ExecutorRegistry.Status.Active
        );

        vm.prank(owner);
        registry.updatePlan(
            AGENT,
            heartbeatSigner,
            trustee,
            recoveryAuthority,
            newTreasury,
            newEstate,
            INTERVAL,
            GRACE
        );
    }

    // --- resolve ------------------------------------------------------------

    function test_resolve_movesLiquidationToResolved() public {
        _enterLiquidation();
        vm.prank(trustee);
        registry.resolve(AGENT);
        assertEq(uint8(_status()), uint8(ExecutorRegistry.Status.Resolved));
    }

    /// @dev Once wound up, revenue still belongs to the estate - there is no
    /// treasury operator left to receive it.
    function test_resolve_leavesPaymentDestinationAtTheEstate() public {
        _enterLiquidation();
        vm.prank(trustee);
        registry.resolve(AGENT);
        assertEq(registry.getPaymentDestination(AGENT), estate);
    }

    function test_resolve_revertsForNonTrustee() public {
        _enterLiquidation();
        vm.prank(owner);
        vm.expectRevert(ExecutorRegistry.NotTrustee.selector);
        registry.resolve(AGENT);
    }

    function test_resolve_revertsWhileActive() public {
        vm.prank(trustee);
        vm.expectRevert(
            abi.encodeWithSelector(
                ExecutorRegistry.WrongStatus.selector, ExecutorRegistry.Status.Active
            )
        );
        registry.resolve(AGENT);
    }

    /// @dev Administration is recoverable, so it must not be closable. Skipping
    /// liquidation would wind an agent up that could still come back.
    function test_resolve_revertsFromAdministration() public {
        _enterAdministration();
        vm.prank(trustee);
        vm.expectRevert(
            abi.encodeWithSelector(
                ExecutorRegistry.WrongStatus.selector, ExecutorRegistry.Status.Administration
            )
        );
        registry.resolve(AGENT);
    }

    /// @dev Resolved is terminal: neither recovery nor a second wind-up.
    function test_resolve_isTerminal() public {
        _enterLiquidation();
        vm.prank(trustee);
        registry.resolve(AGENT);

        vm.prank(trustee);
        vm.expectRevert(
            abi.encodeWithSelector(
                ExecutorRegistry.WrongStatus.selector, ExecutorRegistry.Status.Resolved
            )
        );
        registry.resolve(AGENT);

        vm.prank(recoveryAuthority);
        vm.expectRevert(
            abi.encodeWithSelector(
                ExecutorRegistry.WrongStatus.selector, ExecutorRegistry.Status.Resolved
            )
        );
        registry.restoreActive(AGENT);
    }

    function test_resolve_emitsStatusAndDestinationEvents() public {
        _enterLiquidation();

        vm.expectEmit(true, false, false, true);
        emit ExecutorRegistry.StatusChanged(AGENT, ExecutorRegistry.Status.Resolved);
        vm.expectEmit(true, false, false, true);
        emit ExecutorRegistry.PaymentDestinationChanged(
            AGENT, estate, ExecutorRegistry.Status.Resolved
        );

        vm.prank(trustee);
        registry.resolve(AGENT);
    }

    // --- events -------------------------------------------------------------

    /// @dev The dashboard's "On-chain history" panel is built entirely from these
    /// two events, so their shape is load-bearing.
    function test_enterAdministration_emitsStatusAndDestinationEvents() public {
        vm.warp(uint256(_lastHeartbeat()) + INTERVAL + GRACE);

        vm.expectEmit(true, false, false, true);
        emit ExecutorRegistry.StatusChanged(AGENT, ExecutorRegistry.Status.Administration);
        vm.expectEmit(true, false, false, true);
        emit ExecutorRegistry.PaymentDestinationChanged(
            AGENT, estate, ExecutorRegistry.Status.Administration
        );

        registry.enterAdministration(AGENT);
    }

    function _enterAdministration() internal {
        vm.warp(uint256(_lastHeartbeat()) + INTERVAL + GRACE);
        registry.enterAdministration(AGENT);
    }

    function _enterLiquidation() internal {
        _enterAdministration();
        vm.prank(trustee);
        registry.enterLiquidation(AGENT);
    }
}
