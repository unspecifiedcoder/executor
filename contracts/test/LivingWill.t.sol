// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";

/// @notice The succession lock the dashboard reports as "engaged", tested against a mock
/// that models the real ENSv2 authorization rule rather than an invented one.
///
/// The live name is `executor-hackathon-demo.eth` on the Sepolia ENSv2 registry
/// (`PermissionedRegistry` at 0x67b728a792e789a8978b30cf1b3b641f19354b43). Its operator
/// 0x72db032c0dFB6E7502e16A73fabdab31712dc706 registered the name - receiving
/// `ETHRegistrar.REGISTRATION_ROLE_BITMAP` - and then revoked its own
/// `ROLE_SET_RESOLVER_ADMIN`. On-chain today:
///
///     hasRoles(tokenId, 1 << 24,  operator) == true    // ROLE_SET_RESOLVER, retained
///     hasRoles(tokenId, 1 << 152, operator) == false   // ROLE_SET_RESOLVER_ADMIN, burned
///     ownerOf(tokenId)                      == operator
///
/// Every assertion below was also confirmed by `eth_call` simulation against that live
/// contract, so these tests encode observed behavior, not a guess about it.
///
/// An earlier version of this file tested an `EnsAdapter` wrapper against a mock with
/// `authorizeAddrRoles`/`revokeAdminRole` methods. Those functions do not exist in ENSv2,
/// and routing the calls through a contract meant the adapter - not the operator - was the
/// role holder being checked, so the test could not fail for the right reason. It has been
/// rewritten against the real registry surface.
contract LivingWillTest is Test {
    MockPermissionedRegistry registry;

    address operator = makeAddr("operator");
    address outsider = makeAddr("outsider");

    uint256 tokenId = uint256(keccak256("executor-hackathon-demo"));

    /// @dev Cached in `setUp` on purpose: reading it inside a test would be an external
    /// call, and an external call between `vm.prank` and the call under test consumes the
    /// prank.
    uint256 resource;

    function setUp() public {
        registry = new MockPermissionedRegistry();
        resource = registry.getResource(tokenId);
        // Mirrors ETHRegistrar._register: the registrant receives the full registration
        // bitmap, including ROLE_SET_RESOLVER_ADMIN, at registration time.
        registry.mockRegister(tokenId, operator, RolesLib.REGISTRATION_ROLE_BITMAP);

        // The living-will step: the operator burns its own resolver admin role.
        vm.prank(operator);
        registry.revokeRoles(tokenId, RolesLib.ROLE_SET_RESOLVER_ADMIN, operator);
    }

    // --- the state the dashboard reads --------------------------------------

    function test_operatorKeepsResolverRoleButLosesItsAdmin() public view {
        assertTrue(
            registry.hasRoles(tokenId, RolesLib.ROLE_SET_RESOLVER, operator),
            "operator should still be able to set the resolver"
        );
        assertFalse(
            registry.hasRoles(tokenId, RolesLib.ROLE_SET_RESOLVER_ADMIN, operator),
            "resolver admin role should be burned"
        );
    }

    // --- the lock itself ----------------------------------------------------

    /// @dev The core property. Revoking X also requires admin(X), and admin roles are the
    /// only thing that confers authority, so once admin(X) is gone there is no path back.
    function test_operatorCannotRegrantResolverAdminToItself() public {
        vm.prank(operator);
        vm.expectRevert(
            abi.encodeWithSelector(
                MockPermissionedRegistry.EACCannotGrantRoles.selector,
                resource,
                RolesLib.ROLE_SET_RESOLVER_ADMIN,
                operator
            )
        );
        registry.grantRoles(tokenId, RolesLib.ROLE_SET_RESOLVER_ADMIN, operator);
    }

    /// @dev Holding a regular role grants no delegation power - `withAdminRolesApplied`
    /// discards the regular half of the bitmap entirely. So the operator cannot hand the
    /// retained resolver role to a fresh key it controls.
    function test_operatorCannotDelegateResolverRoleToAnotherAccount() public {
        vm.prank(operator);
        vm.expectRevert(
            abi.encodeWithSelector(
                MockPermissionedRegistry.EACCannotGrantRoles.selector,
                resource,
                RolesLib.ROLE_SET_RESOLVER,
                operator
            )
        );
        registry.grantRoles(tokenId, RolesLib.ROLE_SET_RESOLVER, outsider);
    }

    /// @dev Revocation is gated by the same admin role as granting, so the operator can no
    /// longer even give the resolver role up.
    function test_operatorCannotRevokeItsOwnResolverRole() public {
        vm.prank(operator);
        vm.expectRevert(
            abi.encodeWithSelector(
                MockPermissionedRegistry.EACCannotRevokeRoles.selector,
                resource,
                RolesLib.ROLE_SET_RESOLVER,
                operator
            )
        );
        registry.revokeRoles(tokenId, RolesLib.ROLE_SET_RESOLVER, operator);
    }

    /// @dev Token ownership is not a bypass: `PermissionedRegistry` gates every role change
    /// on the access-control bitmap and never consults `ownerOf`.
    function test_ownershipIsNotABypass() public {
        assertEq(registry.ownerOf(tokenId), operator, "operator still owns the name");

        vm.prank(operator);
        vm.expectRevert();
        registry.grantRoles(tokenId, RolesLib.ROLE_SET_RESOLVER_ADMIN, operator);
    }

    /// @dev Transferring the token moves the *already diminished* bitmap verbatim, so a
    /// round trip through another address cannot launder the missing role back in.
    function test_transferDoesNotRestoreTheRevokedRole() public {
        vm.prank(operator);
        registry.transfer(tokenId, operator, outsider);

        assertTrue(registry.hasRoles(tokenId, RolesLib.ROLE_SET_RESOLVER, outsider));
        assertFalse(registry.hasRoles(tokenId, RolesLib.ROLE_SET_RESOLVER_ADMIN, outsider));

        vm.prank(outsider);
        registry.transfer(tokenId, outsider, operator);

        assertTrue(registry.hasRoles(tokenId, RolesLib.ROLE_SET_RESOLVER, operator));
        assertFalse(
            registry.hasRoles(tokenId, RolesLib.ROLE_SET_RESOLVER_ADMIN, operator),
            "a transfer round trip must not restore the burned admin role"
        );
    }

    /// @dev Structural rule behind all of the above: at a token resource, admin roles are
    /// assigned only at registration and are revoke-only afterwards. Even an admin role the
    /// operator still holds cannot be granted to anyone.
    function test_adminRolesAreNeverGrantableAtATokenResource() public {
        assertTrue(
            registry.hasRoles(tokenId, RolesLib.ROLE_SET_SUBREGISTRY_ADMIN, operator),
            "precondition: subregistry admin was never revoked"
        );

        vm.prank(operator);
        vm.expectRevert();
        registry.grantRoles(tokenId, RolesLib.ROLE_SET_SUBREGISTRY_ADMIN, outsider);
    }

    // --- the limits of the lock ---------------------------------------------
    // These tests exist so the claim stays bounded. The lock is specifically about the
    // resolver axis; it is not a general freeze of the name.

    /// @dev The operator retained `ROLE_SET_SUBREGISTRY_ADMIN`, so it can still delegate
    /// subregistry control. Only the resolver axis is locked.
    function test_lockDoesNotCoverTheSubregistryAxis() public {
        vm.prank(operator);
        registry.grantRoles(tokenId, RolesLib.ROLE_SET_SUBREGISTRY, outsider);
        assertTrue(registry.hasRoles(tokenId, RolesLib.ROLE_SET_SUBREGISTRY, outsider));
    }

    /// @dev Root-scoped roles are OR'd into every resource, so a holder of root
    /// `ROLE_SET_RESOLVER_ADMIN` could re-grant the token-level resolver role. On the live
    /// Sepolia deployment that root slot has zero assignees, which is a fact about the
    /// deployment's current state rather than a property of the code - this test pins the
    /// mechanism so the project's wording stays honest about it.
    function test_rootAdminRoleHolderCouldStillGrantTheResolverRole() public {
        address rootAdmin = makeAddr("rootAdmin");
        registry.mockGrantRoot(RolesLib.ROLE_SET_RESOLVER_ADMIN, rootAdmin);

        vm.prank(rootAdmin);
        registry.grantRoles(tokenId, RolesLib.ROLE_SET_RESOLVER, outsider);
        assertTrue(registry.hasRoles(tokenId, RolesLib.ROLE_SET_RESOLVER, outsider));
    }
}

/// @notice ENSv2 role constants, matching `RegistryRolesLib` and `ETHRegistrar`.
/// Roles are nybble-packed: a regular role sits at bit `N*4`, and its admin counterpart at
/// bit `N*4 + 128`.
library RolesLib {
    uint256 internal constant ROLE_SET_SUBREGISTRY = 1 << 20;
    uint256 internal constant ROLE_SET_RESOLVER = 1 << 24;
    uint256 internal constant ROLE_SET_SUBREGISTRY_ADMIN = ROLE_SET_SUBREGISTRY << 128;
    uint256 internal constant ROLE_SET_RESOLVER_ADMIN = ROLE_SET_RESOLVER << 128;
    uint256 internal constant ROLE_CAN_TRANSFER_ADMIN = 1 << 156;

    /// @dev `ETHRegistrar.REGISTRATION_ROLE_BITMAP` - what a registrant receives.
    uint256 internal constant REGISTRATION_ROLE_BITMAP = ROLE_SET_SUBREGISTRY
        | ROLE_SET_SUBREGISTRY_ADMIN | ROLE_SET_RESOLVER | ROLE_SET_RESOLVER_ADMIN
        | ROLE_CAN_TRANSFER_ADMIN;

    /// @dev Bit 0 of every nybble.
    uint256 internal constant ALL_ROLES =
        0x1111111111111111111111111111111111111111111111111111111111111111;

    /// @dev The whole authorization model, verbatim from `EACBaseRolesLib`: the regular half
    /// of the caller's bitmap is discarded, and the admin half is mirrored into both halves.
    /// Holding a regular role therefore confers no authority to grant or revoke anything.
    function withAdminRolesApplied(uint256 roleBitmap) internal pure returns (uint256) {
        roleBitmap >>= 128;
        return (roleBitmap << 128) | roleBitmap;
    }
}

/// @dev Models the authorization rules of ENSv2's `EnhancedAccessControl` +
/// `PermissionedRegistry` that this test suite depends on: the admin-role convention, the
/// root-resource OR, and - the point of the whole file - `PermissionedRegistry`'s override
/// making admin roles ungrantable at a token resource while leaving them revokable.
///
/// Deliberately NOT modeled, because no assertion here depends on them: per-role assignee
/// counting in the upper 3 bits of each nybble, token regeneration on role change,
/// expiry-driven resource versioning, and approved-operator role inheritance. The lock
/// lasts until the name expires, not forever - see `docs/ARCHITECTURE.md`.
contract MockPermissionedRegistry {
    error EACCannotGrantRoles(uint256 resource, uint256 roleBitmap, address account);
    error EACCannotRevokeRoles(uint256 resource, uint256 roleBitmap, address account);
    error EACInvalidRoleBitmap(uint256 roleBitmap);
    error EACRootResourceNotAllowed();
    error TransferDisallowed(uint256 tokenId, address from);

    uint256 public constant ROOT_RESOURCE = 0;

    mapping(uint256 => mapping(address => uint256)) internal _roles;
    mapping(uint256 => address) internal _owners;

    /// @dev The mock keeps resource == tokenId. The real registry derives the resource from
    /// the labelhash plus a version counter; that indirection is irrelevant here because no
    /// test changes the version.
    function getResource(uint256 anyId) public pure returns (uint256) {
        return anyId;
    }

    function ownerOf(uint256 tokenId) external view returns (address) {
        return _owners[tokenId];
    }

    function mockRegister(uint256 tokenId, address owner, uint256 roleBitmap) external {
        _owners[tokenId] = owner;
        _roles[getResource(tokenId)][owner] = roleBitmap;
    }

    function mockGrantRoot(uint256 roleBitmap, address account) external {
        _roles[ROOT_RESOURCE][account] |= roleBitmap;
    }

    /// @dev Root-scoped roles apply at every resource.
    function _effectiveRoles(uint256 resource, address account) internal view returns (uint256) {
        return _roles[ROOT_RESOURCE][account] | _roles[resource][account];
    }

    /// @dev `PermissionedRegistry._getSettableRoles`: the `>> 128` for non-root resources is
    /// what makes admin roles unassignable after registration.
    function _getSettableRoles(uint256 resource, address account) internal view returns (uint256) {
        if (resource != ROOT_RESOURCE && _owners[resource] == address(0)) return 0;
        uint256 roleBitmap = RolesLib.withAdminRolesApplied(_effectiveRoles(resource, account));
        return resource == ROOT_RESOURCE ? roleBitmap : roleBitmap >> 128;
    }

    /// @dev Not overridden by `PermissionedRegistry` - no `>> 128`. Admin roles stay
    /// revokable, which is why burning one is a one-way door.
    function _getRevokableRoles(uint256 resource, address account) internal view returns (uint256) {
        return RolesLib.withAdminRolesApplied(_effectiveRoles(resource, account));
    }

    function hasRoles(uint256 anyId, uint256 roleBitmap, address account)
        public
        view
        returns (bool)
    {
        uint256 resource = getResource(anyId);
        return (_effectiveRoles(resource, account) & roleBitmap) == roleBitmap;
    }

    function grantRoles(uint256 anyId, uint256 roleBitmap, address account)
        external
        returns (bool)
    {
        uint256 resource = getResource(anyId);
        if (resource == ROOT_RESOURCE) revert EACRootResourceNotAllowed();
        if (roleBitmap & ~RolesLib.ALL_ROLES != 0) revert EACInvalidRoleBitmap(roleBitmap);

        uint256 settable = _getSettableRoles(resource, msg.sender);
        if (roleBitmap & ~settable != 0) {
            revert EACCannotGrantRoles(resource, roleBitmap, msg.sender);
        }

        uint256 previous = _roles[resource][account];
        _roles[resource][account] = previous | roleBitmap;
        return _roles[resource][account] != previous;
    }

    function revokeRoles(uint256 anyId, uint256 roleBitmap, address account)
        external
        returns (bool)
    {
        uint256 resource = getResource(anyId);
        if (resource == ROOT_RESOURCE) revert EACRootResourceNotAllowed();
        if (roleBitmap & ~RolesLib.ALL_ROLES != 0) revert EACInvalidRoleBitmap(roleBitmap);

        uint256 revokable = _getRevokableRoles(resource, msg.sender);
        if (roleBitmap & ~revokable != 0) {
            revert EACCannotRevokeRoles(resource, roleBitmap, msg.sender);
        }

        uint256 previous = _roles[resource][account];
        _roles[resource][account] = previous & ~roleBitmap;
        return _roles[resource][account] != previous;
    }

    /// @dev `PermissionedRegistry._update` + `_transferRoles`: gated on the sender holding
    /// `ROLE_CAN_TRANSFER_ADMIN`, and it moves the existing bitmap across unchanged.
    function transfer(uint256 tokenId, address from, address to) external {
        uint256 resource = getResource(tokenId);
        if (!hasRoles(tokenId, RolesLib.ROLE_CAN_TRANSFER_ADMIN, from)) {
            revert TransferDisallowed(tokenId, from);
        }
        uint256 srcRoles = _roles[resource][from];
        _roles[resource][from] = 0;
        _roles[resource][to] |= srcRoles;
        _owners[tokenId] = to;
    }
}
