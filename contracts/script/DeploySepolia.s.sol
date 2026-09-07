// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script} from "forge-std/Script.sol";
import {Receiver} from "../src/Receiver.sol";
import {EnsAdapter} from "../src/adapters/EnsAdapter.sol";

/// @notice Deploys Receiver + EnsAdapter to Sepolia. Registration of the
/// living will itself (role grants, operator lockout) is a separate step -
/// see `RegisterAgent.s.sol`.
contract DeploySepolia is Script {
    function run() external returns (Receiver receiver, EnsAdapter ensAdapter) {
        address agent = vm.envAddress("AGENT_ADDRESS");
        uint64 heartbeatInterval = uint64(vm.envOr("HEARTBEAT_INTERVAL", uint256(1 hours)));
        address ensRegistry = vm.envAddress("ENS_REGISTRY");
        address ensResolver = vm.envAddress("ENS_UNIVERSAL_RESOLVER");

        vm.startBroadcast();
        receiver = new Receiver(agent, heartbeatInterval);
        ensAdapter = new EnsAdapter(ensRegistry, ensResolver);
        vm.stopBroadcast();
    }
}
