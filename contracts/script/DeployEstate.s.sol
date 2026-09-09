// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script} from "forge-std/Script.sol";
import {Estate} from "../src/Estate.sol";

/// @notice Deploys an Estate bound to an already-deployed ExecutorRegistry and
/// a specific agent. Chain-agnostic on purpose: this was `DeployArc.s.sol` and
/// assumed Circle's Arc, but an Estate only needs an ERC-20 and the registry
/// whose status it reads, so it runs against anvil or Sepolia unchanged.
contract DeployEstate is Script {
    function run() external returns (Estate estate) {
        address usdc = vm.envAddress("ESTATE_USDC_ADDRESS");
        address trustee = vm.envAddress("TRUSTEE_ADDRESS");
        address registry = vm.envAddress("EXECUTOR_REGISTRY_ADDRESS");
        bytes32 agentId = vm.envBytes32("AGENT_ID");

        vm.startBroadcast();
        estate = new Estate(usdc, trustee, registry, agentId);
        vm.stopBroadcast();
    }
}
