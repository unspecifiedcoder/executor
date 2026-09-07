// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {EnsAdapter} from "../src/adapters/EnsAdapter.sol";
import {IEnsRegistry} from "../src/interfaces/IEnsRegistry.sol";
import {IEnsPermissionedResolver} from "../src/interfaces/IEnsPermissionedResolver.sol";

/// @notice Proves the core safety property of RegisterAgent.s.sol's flow:
/// once the operator's admin role over the subname is revoked, it cannot
/// grant itself new roles, revoke Receiver's roles, or otherwise regain
/// control. This is the test the whole "living will" pitch rests on.
contract LivingWillTest is Test {
    EnsAdapter ensAdapter;
    MockEnsRegistry registry;
    MockEnsResolver resolver;

    bytes32 node = keccak256("atlas.acme.eth");
    address operator = makeAddr("operator");
    address receiver = makeAddr("receiver");

    function setUp() public {
        registry = new MockEnsRegistry();
        resolver = new MockEnsResolver();
        ensAdapter = new EnsAdapter(address(registry), address(resolver));

        registry.setOwner(node, operator);
    }

    function test_operatorCannotRegrantRolesAfterLock() public {
        vm.startPrank(operator);
        ensAdapter.grantAddrRole(node, ensAdapter.COIN_TYPE_ETH(), receiver);
        ensAdapter.grantStatusTextRole(node, receiver);
        ensAdapter.lockOperator(node, operator);
        vm.stopPrank();

        assertTrue(registry.isAdminRevoked(node, operator));

        vm.prank(operator);
        vm.expectRevert(MockEnsRegistry.AdminRevoked.selector);
        ensAdapter.grantAddrRole(node, ensAdapter.COIN_TYPE_ARC(), makeAddr("newGrantee"));
    }

    function test_receiverRolesSurviveOperatorLock() public {
        vm.startPrank(operator);
        ensAdapter.grantAddrRole(node, ensAdapter.COIN_TYPE_ETH(), receiver);
        ensAdapter.lockOperator(node, operator);
        vm.stopPrank();

        assertTrue(registry.hasAddrRole(node, ensAdapter.COIN_TYPE_ETH(), receiver));
    }
}

/// @dev Minimal mock capturing only the revocation-permanence behavior this
/// test suite needs - not a full ENSv2 registry implementation.
contract MockEnsRegistry is IEnsRegistry {
    error AdminRevoked();

    mapping(bytes32 => address) internal owners;
    mapping(bytes32 => mapping(address => bool)) internal adminRevoked;
    mapping(bytes32 => mapping(uint256 => mapping(address => bool))) internal addrRoles;

    function setOwner(bytes32 node, address account) external {
        owners[node] = account;
    }

    function authorizeAddrRoles(bytes32 node, uint256 coinType, address grantee, bool authorized)
        external
    {
        if (adminRevoked[node][msg.sender]) revert AdminRevoked();
        addrRoles[node][coinType][grantee] = authorized;
    }

    function authorizeTextRoles(bytes32 node, string calldata, address, bool) external view {
        if (adminRevoked[node][msg.sender]) revert AdminRevoked();
    }

    function revokeAdminRole(bytes32 node, address account) external {
        adminRevoked[node][account] = true;
    }

    function owner(bytes32 node) external view returns (address) {
        return owners[node];
    }

    function isAdminRevoked(bytes32 node, address account) external view returns (bool) {
        return adminRevoked[node][account];
    }

    function hasAddrRole(bytes32 node, uint256 coinType, address grantee) external view returns (bool) {
        return addrRoles[node][coinType][grantee];
    }
}

contract MockEnsResolver is IEnsPermissionedResolver {
    function setAddr(bytes32, uint256, bytes calldata) external {}
    function addr(bytes32, uint256) external pure returns (bytes memory) {
        return "";
    }
    function setText(bytes32, string calldata, string calldata) external {}
    function text(bytes32, string calldata) external pure returns (string memory) {
        return "";
    }
}
