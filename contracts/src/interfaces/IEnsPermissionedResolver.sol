// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @notice Resolver surface used to read/write records on a subname once
/// roles have been granted via `IEnsRegistry`.
interface IEnsPermissionedResolver {
    function setAddr(bytes32 node, uint256 coinType, bytes calldata addrBytes) external;
    function addr(bytes32 node, uint256 coinType) external view returns (bytes memory);

    function setText(bytes32 node, string calldata key, string calldata value) external;
    function text(bytes32 node, string calldata key) external view returns (string memory);
}
