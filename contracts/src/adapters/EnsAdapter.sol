// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IEnsRegistry} from "../interfaces/IEnsRegistry.sol";
import {IEnsPermissionedResolver} from "../interfaces/IEnsPermissionedResolver.sol";

/// @notice The only contract in this repo that talks to ENSv2 directly.
/// Every other contract and every off-chain caller goes through here, so
/// when the ENSv2 beta's interface shifts, this file (and `shared/src/ens.ts`
/// on the TS side) are the only two places that need to change.
contract EnsAdapter {
    IEnsRegistry public immutable registry;
    IEnsPermissionedResolver public immutable resolver;

    // ENSIP-9/11 coin types this project reads/writes.
    uint256 public constant COIN_TYPE_ETH = 60;
    uint256 public constant COIN_TYPE_ARC = 3030;

    string public constant TEXT_KEY_STATUS = "executor:status";

    constructor(address _registry, address _resolver) {
        registry = IEnsRegistry(_registry);
        resolver = IEnsPermissionedResolver(_resolver);
    }

    function grantAddrRole(bytes32 node, uint256 coinType, address grantee) external {
        registry.authorizeAddrRoles(node, coinType, grantee, true);
    }

    function grantStatusTextRole(bytes32 node, address grantee) external {
        registry.authorizeTextRoles(node, TEXT_KEY_STATUS, grantee, true);
    }

    function lockOperator(bytes32 node, address operator) external {
        registry.revokeAdminRole(node, operator);
    }

    function setStatus(bytes32 node, string calldata status) external {
        resolver.setText(node, TEXT_KEY_STATUS, status);
    }

    function statusOf(bytes32 node) external view returns (string memory) {
        return resolver.text(node, TEXT_KEY_STATUS);
    }

    function payoutAddress(bytes32 node, uint256 coinType) external view returns (address) {
        bytes memory raw = resolver.addr(node, coinType);
        if (raw.length != 20) return address(0);
        return address(bytes20(raw));
    }
}
