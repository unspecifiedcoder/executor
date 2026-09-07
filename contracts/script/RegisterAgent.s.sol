// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script} from "forge-std/Script.sol";
import {EnsAdapter} from "../src/adapters/EnsAdapter.sol";

/// @notice The living will, as a single script run: set records, grant the
/// Receiver the addr/text roles it needs to act on the agent's behalf, then
/// irreversibly revoke the operator's own admin role over the subname.
///
/// This is the product. `LivingWill.t.sol` asserts step 4 can't be undone.
contract RegisterAgent is Script {
    function run() external {
        bytes32 node = vm.envBytes32("AGENT_ENS_NODE");
        address ensAdapterAddr = vm.envAddress("ENS_ADAPTER_ADDRESS");
        address receiver = vm.envAddress("RECEIVER_ADDRESS");
        address operator = vm.envAddress("OPERATOR_ADDRESS");

        EnsAdapter ensAdapter = EnsAdapter(ensAdapterAddr);

        vm.startBroadcast();

        // 1. Grant Receiver addr roles for coin types 60 (ETH/Sepolia) and
        //    3030 (Arc), so it can update payout routing during Liquidation.
        ensAdapter.grantAddrRole(node, ensAdapter.COIN_TYPE_ETH(), receiver);
        ensAdapter.grantAddrRole(node, ensAdapter.COIN_TYPE_ARC(), receiver);

        // 2. Grant Receiver the executor:status text role, so it can flip
        //    the public status record as the agent moves through stages.
        ensAdapter.grantStatusTextRole(node, receiver);

        // 3. (standing USDC approvals for the sweep step happen off-chain,
        //    against the agent's own wallet - see packages/sweep)

        // 4. Revoke the operator's own admin role. After this, the operator
        //    cannot undo steps 1-2 or re-take control of the subname.
        ensAdapter.lockOperator(node, operator);

        vm.stopBroadcast();
    }
}
