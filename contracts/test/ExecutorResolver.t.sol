// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {ExecutorRegistry} from "../src/ExecutorRegistry.sol";
import {ExecutorResolver} from "../src/ExecutorResolver.sol";

/// @notice Tests for the ENS resolver that sits in the x402 gateway's money
/// path on Sepolia. The property that matters is the one in the contract's
/// docstring: there is no stored address, so an ENS `addr()` read and an
/// `ExecutorRegistry.getPaymentDestination()` read can never disagree, at any
/// point in the agent's lifecycle. Every status the registry can be in is
/// asserted against the resolver here, not just the Active -> Administration
/// flip the demo shows.
contract ExecutorResolverTest is Test {
    ExecutorRegistry registry;
    ExecutorResolver resolver;

    bytes32 constant AGENT = keccak256("executor-hackathon-demo.eth");
    /// @dev namehash("executor-hackathon-demo.eth") is computed off-chain and
    /// passed in; the resolver never derives it, so any value works as a key.
    bytes32 constant NODE = keccak256("node:executor-hackathon-demo.eth");
    bytes32 constant OTHER_NODE = keccak256("node:someone-else.eth");

    address admin = makeAddr("admin");
    address owner = makeAddr("owner");
    address heartbeatSigner = makeAddr("heartbeatSigner");
    address trustee = makeAddr("trustee");
    address recoveryAuthority = makeAddr("recoveryAuthority");
    address treasury = makeAddr("treasury");
    address estate = makeAddr("estate");

    uint64 constant INTERVAL = 60;
    uint64 constant GRACE = 30;
    uint256 constant T0 = 1_700_000_000;

    function setUp() public {
        vm.warp(T0);
        registry = new ExecutorRegistry();
        vm.prank(owner);
        registry.registerAgent(
            AGENT, heartbeatSigner, trustee, recoveryAuthority, treasury, estate, INTERVAL, GRACE
        );

        resolver = new ExecutorResolver(address(registry), admin);
        vm.prank(admin);
        resolver.bindNode(NODE, AGENT);
    }

    /// @dev Drives the registry into Administration the way the live demo does:
    /// let the heartbeat lapse past interval + grace, then have the trustee
    /// declare it.
    function _enterAdministration() private {
        vm.warp(T0 + INTERVAL + GRACE + 1);
        vm.prank(trustee);
        registry.enterAdministration(AGENT);
    }

    function test_addr_returnsTreasuryWhileActive() public view {
        assertEq(resolver.addr(NODE), payable(treasury));
        assertEq(resolver.addr(NODE), payable(registry.getPaymentDestination(AGENT)));
    }

    function test_addr_followsFlipToAdministration() public {
        assertEq(resolver.addr(NODE), payable(treasury));
        _enterAdministration();
        assertEq(resolver.addr(NODE), payable(estate));
    }

    /// @notice The core anti-staleness claim, asserted as an invariant across
    /// the whole lifecycle rather than at a single moment.
    function test_addr_neverDisagreesWithRegistry() public {
        assertEq(resolver.addr(NODE), payable(registry.getPaymentDestination(AGENT)));
        _enterAdministration();
        assertEq(resolver.addr(NODE), payable(registry.getPaymentDestination(AGENT)));

        vm.prank(recoveryAuthority);
        registry.restoreActive(AGENT);
        assertEq(resolver.addr(NODE), payable(registry.getPaymentDestination(AGENT)));
        assertEq(resolver.addr(NODE), payable(treasury));
    }

    function test_addrCoinType60_matchesEnsip1Addr() public view {
        bytes memory raw = resolver.addr(NODE, 60);
        assertEq(raw.length, 20);
        assertEq(address(bytes20(raw)), resolver.addr(NODE));
    }

    /// @notice A non-Ethereum coin type must return empty, not quietly hand
    /// back the Ethereum address for a chain where nobody controls it.
    function test_addrOtherCoinType_returnsEmpty() public view {
        assertEq(resolver.addr(NODE, 0).length, 0);
        assertEq(resolver.addr(NODE, 3030).length, 0);
    }

    /// @notice An unbound node must not resolve to anything payable. This is
    /// what stops the resolver being a catch-all that sends every unknown
    /// name's money to one address.
    function test_unboundNode_resolvesToZeroAndEmpty() public view {
        assertEq(resolver.addr(OTHER_NODE), payable(address(0)));
        assertEq(resolver.addr(OTHER_NODE, 60).length, 0);
        assertEq(resolver.text(OTHER_NODE, "executor:status"), "");
    }

    function test_text_statusTracksRegistry() public {
        assertEq(resolver.text(NODE, "executor:status"), "active");
        _enterAdministration();
        assertEq(resolver.text(NODE, "executor:status"), "administration");
    }

    function test_text_unknownKeyReturnsEmpty() public view {
        assertEq(resolver.text(NODE, "com.twitter"), "");
    }

    function test_text_exposesAgentIdAndRegistry() public view {
        assertEq(
            resolver.text(NODE, "executor:agentId"),
            "0x6b7f61f16d01348d0b80bac1e63e0abb99eb377294a49d1f22181e912daf5255"
        );
        // Asserted against the live registry address rather than a literal, so
        // this test cannot pass while pointing at the wrong contract.
        assertEq(
            resolver.text(NODE, "executor:registry"), _toHexAddress(address(registry))
        );
    }

    function test_bindNode_onlyAdmin() public {
        vm.expectRevert(ExecutorResolver.NotAdmin.selector);
        resolver.bindNode(OTHER_NODE, AGENT);
    }

    function test_bindNode_rejectsZeroAgentId() public {
        vm.prank(admin);
        vm.expectRevert(ExecutorResolver.ZeroAgentId.selector);
        resolver.bindNode(OTHER_NODE, bytes32(0));
    }

    /// @notice Rebinding is the misrouting hole the contract is built to close:
    /// it would let the name owner leave the resolver in place while silently
    /// repointing it at another agent's treasury.
    function test_bindNode_cannotRebind() public {
        vm.prank(admin);
        vm.expectRevert(ExecutorResolver.NodeAlreadyBound.selector);
        resolver.bindNode(NODE, keccak256("other-agent"));
    }

    function test_supportsInterface() public view {
        assertTrue(resolver.supportsInterface(0x01ffc9a7)); // ERC-165
        assertTrue(resolver.supportsInterface(0x3b3b57de)); // addr(bytes32)
        assertTrue(resolver.supportsInterface(0xf1cb7e06)); // addr(bytes32,uint256)
        assertTrue(resolver.supportsInterface(0x59d1d43c)); // text(bytes32,string)
        assertFalse(resolver.supportsInterface(0xdeadbeef));
    }

    /// @dev Guards the selector constants above against a signature typo: if
    /// the interface ids and the actual function signatures ever drift, ENS
    /// clients would silently decide this contract has no addr record.
    function test_interfaceIdsMatchSignatures() public view {
        assertTrue(resolver.supportsInterface(bytes4(keccak256("addr(bytes32)"))));
        assertTrue(resolver.supportsInterface(bytes4(keccak256("addr(bytes32,uint256)"))));
        assertTrue(resolver.supportsInterface(bytes4(keccak256("text(bytes32,string)"))));
    }

    function _toHexAddress(address value) private pure returns (string memory) {
        bytes memory raw = abi.encodePacked(value);
        bytes memory alphabet = "0123456789abcdef";
        bytes memory out = new bytes(42);
        out[0] = "0";
        out[1] = "x";
        for (uint256 i = 0; i < 20; i++) {
            out[2 + i * 2] = alphabet[uint8(raw[i]) >> 4];
            out[3 + i * 2] = alphabet[uint8(raw[i]) & 0x0f];
        }
        return string(out);
    }
}
