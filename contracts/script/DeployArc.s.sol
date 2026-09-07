// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script} from "forge-std/Script.sol";
import {Estate} from "../src/Estate.sol";

contract DeployArc is Script {
    function run() external returns (Estate estate) {
        address usdc = vm.envAddress("ARC_USDC_ADDRESS");
        address trustee = vm.envAddress("TRUSTEE_ADDRESS");

        vm.startBroadcast();
        estate = new Estate(usdc, trustee);
        vm.stopBroadcast();
    }
}
