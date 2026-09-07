// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {Receiver} from "../src/Receiver.sol";

contract ReceiverTest is Test {
    Receiver receiver;
    address agent = makeAddr("agent");
    uint64 constant HEARTBEAT_INTERVAL = 1 hours;

    function setUp() public {
        vm.prank(agent);
        receiver = new Receiver(agent, HEARTBEAT_INTERVAL);
    }

    function test_ping_updatesLastPing() public {
        vm.warp(block.timestamp + 10 minutes);
        vm.prank(agent);
        receiver.ping();
        assertEq(receiver.lastPing(), block.timestamp);
    }

    function test_declareAdministration_revertsBeforeIntervalLapses() public {
        vm.expectRevert(Receiver.TooEarly.selector);
        receiver.declareAdministration();
    }

    function test_declareAdministration_succeedsAfterMissedPings() public {
        vm.warp(block.timestamp + HEARTBEAT_INTERVAL + 1);
        receiver.declareAdministration();
        assertEq(uint8(receiver.status()), uint8(Receiver.Status.UnderAdministration));
    }

    function test_declareLiquidation_revertsBeforeAdministration() public {
        vm.expectRevert(Receiver.AlreadyFlipped.selector);
        receiver.declareLiquidation("", "");
    }
}
