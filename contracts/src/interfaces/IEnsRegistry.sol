// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @notice Minimal surface of the ENSv2 registry this project depends on.
/// @dev Kept intentionally thin: the ENSv2 beta is still moving, and every
/// call into it is routed through `EnsAdapter` so only this interface and
/// that one contract need to change when it does.
interface IEnsRegistry {
    /// @notice Grant a role scoped to a specific record (e.g. an addr/text
    /// role for one subname) rather than the whole namespace.
    function authorizeAddrRoles(bytes32 node, uint256 coinType, address grantee, bool authorized)
        external;

    function authorizeTextRoles(bytes32 node, string calldata key, address grantee, bool authorized)
        external;

    /// @notice Irreversibly burn the caller's own admin role over `node`.
    /// Used by `RegisterAgent.s.sol` to lock the operator out after the
    /// Receiver has been granted its roles - see `LivingWill.t.sol`.
    function revokeAdminRole(bytes32 node, address account) external;

    function owner(bytes32 node) external view returns (address);
}
