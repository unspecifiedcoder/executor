// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

interface IExecutorRegistry {
    function getPaymentDestination(bytes32 agentId) external view returns (address);
    function getStatus(bytes32 agentId) external view returns (uint8);
}

/// @notice An ENS resolver whose `addr()` record is *derived*, not stored.
///
/// The problem this exists to solve: putting an agent's payout address into an
/// ordinary ENS record makes ENS load-bearing for money, but it also makes the
/// record a cache. The moment `ExecutorRegistry` flips an agent from Active to
/// Administration, a stored record still names the treasury, and every payer
/// resolving that name sends funds to an address the estate no longer controls.
/// A stale record that silently misroutes money is strictly worse than not
/// using ENS at all - so this resolver has no setter for `addr` and no stored
/// address to go stale. Each `addr()` call reads `ExecutorRegistry` at the
/// block it is called in, so ENS resolution and registry state cannot disagree.
///
/// What is still genuinely load-bearing about the ENS layer: the name's owner
/// chooses, through ENSv2's own `setResolver`, which contract answers for the
/// name. Point the name at a different resolver and the money goes somewhere
/// else. That authority - and, in this deployment, the fact that the operator
/// has irreversibly burned `ROLE_SET_RESOLVER_ADMIN` and so can never delegate
/// it - is the ENS-native security property being demonstrated.
///
/// Implements ENSIP-1 `addr(bytes32)` and ENSIP-9/11 `addr(bytes32,uint256)`
/// so ordinary ENS clients can read it, plus `text(bytes32,string)` for the
/// human-readable status.
contract ExecutorResolver {
    /// @dev ENSIP-11 coin type for Ethereum mainnet-format addresses.
    uint256 public constant COIN_TYPE_ETH = 60;

    string public constant TEXT_KEY_STATUS = "executor:status";
    string public constant TEXT_KEY_AGENT_ID = "executor:agentId";
    string public constant TEXT_KEY_REGISTRY = "executor:registry";

    IExecutorRegistry public immutable executorRegistry;

    /// @notice The account allowed to bind nodes to agent ids. Binding is the
    /// only mutable state here, and it is one-way per node (see `bindNode`).
    address public immutable admin;

    /// @notice namehash(name) => ExecutorRegistry agent id. Zero means this
    /// resolver does not answer for that name.
    mapping(bytes32 => bytes32) public agentIdOf;

    event NodeBound(bytes32 indexed node, bytes32 indexed agentId);

    error NotAdmin();
    error NodeAlreadyBound();
    error ZeroAgentId();

    constructor(address _executorRegistry, address _admin) {
        executorRegistry = IExecutorRegistry(_executorRegistry);
        admin = _admin;
    }

    /// @notice Binds an ENS node to an agent id, once and permanently.
    /// @dev Deliberately not re-bindable. A re-bindable mapping would reopen
    /// exactly the misrouting hole this contract exists to close: the name
    /// owner could leave the resolver in place while quietly repointing it at
    /// a different agent's treasury. To change where a bound name resolves,
    /// the owner must use ENSv2's `setResolver` - a visible, on-chain act
    /// against the name itself, governed by `ROLE_SET_RESOLVER`.
    function bindNode(bytes32 node, bytes32 agentId) external {
        if (msg.sender != admin) revert NotAdmin();
        if (agentId == bytes32(0)) revert ZeroAgentId();
        if (agentIdOf[node] != bytes32(0)) revert NodeAlreadyBound();
        agentIdOf[node] = agentId;
        emit NodeBound(node, agentId);
    }

    /// @notice ENSIP-1. Returns the agent's current payment destination.
    /// @dev Returns `address(0)` for an unbound node rather than reverting,
    /// because that is what ENSIP-1 specifies for "no record" - and a caller
    /// that treats address(0) as a payable destination is broken regardless.
    /// The gateway in this repo refuses to quote a price on a zero result.
    function addr(bytes32 node) public view returns (address payable) {
        bytes32 agentId = agentIdOf[node];
        if (agentId == bytes32(0)) return payable(address(0));
        return payable(executorRegistry.getPaymentDestination(agentId));
    }

    /// @notice ENSIP-9/11. Only coin type 60 (Ethereum) is answered; every
    /// other chain returns empty, rather than silently reusing the Ethereum
    /// address for a chain where it may not be controllable.
    function addr(bytes32 node, uint256 coinType) public view returns (bytes memory) {
        if (coinType != COIN_TYPE_ETH) return "";
        address a = addr(node);
        if (a == address(0)) return "";
        return abi.encodePacked(a);
    }

    /// @notice ENSIP-5 text records, derived the same way `addr` is.
    function text(bytes32 node, string calldata key) external view returns (string memory) {
        bytes32 agentId = agentIdOf[node];
        if (agentId == bytes32(0)) return "";

        bytes32 k = keccak256(bytes(key));
        if (k == keccak256(bytes(TEXT_KEY_STATUS))) {
            uint8 status = executorRegistry.getStatus(agentId);
            if (status == 0) return "active";
            if (status == 1) return "administration";
            if (status == 2) return "liquidation";
            if (status == 3) return "resolved";
            return "unknown";
        }
        if (k == keccak256(bytes(TEXT_KEY_AGENT_ID))) return _toHex(agentId);
        if (k == keccak256(bytes(TEXT_KEY_REGISTRY))) {
            return _toHexAddress(address(executorRegistry));
        }
        return "";
    }

    /// @notice ERC-165. `0x3b3b57de` = addr(bytes32), `0xf1cb7e06` =
    /// addr(bytes32,uint256), `0x59d1d43c` = text(bytes32,string).
    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return interfaceId == 0x01ffc9a7 || interfaceId == 0x3b3b57de || interfaceId == 0xf1cb7e06
            || interfaceId == 0x59d1d43c;
    }

    function _toHex(bytes32 value) private pure returns (string memory) {
        return _toHexBytes(abi.encodePacked(value));
    }

    function _toHexAddress(address value) private pure returns (string memory) {
        return _toHexBytes(abi.encodePacked(value));
    }

    function _toHexBytes(bytes memory raw) private pure returns (string memory) {
        bytes memory alphabet = "0123456789abcdef";
        bytes memory out = new bytes(2 + raw.length * 2);
        out[0] = "0";
        out[1] = "x";
        for (uint256 i = 0; i < raw.length; i++) {
            out[2 + i * 2] = alphabet[uint8(raw[i]) >> 4];
            out[3 + i * 2] = alphabet[uint8(raw[i]) & 0x0f];
        }
        return string(out);
    }
}
