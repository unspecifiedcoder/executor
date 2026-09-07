// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @notice Lives on Sepolia. Tracks an agent's liveness via signed heartbeats
/// and flips the estate through the two-stage flow: Administration (liveness
/// only) then Liquidation (requires a DON-signed solvency/claims report).
///
/// Deliberately kept separate from `Estate` (which holds funds on Arc):
/// Receiver only ever answers "is this agent still alive, and has a
/// caretaker taken over" - it never moves money.
contract Receiver {
    enum Status {
        Alive,
        UnderAdministration,
        Liquidated
    }

    struct Plan {
        bytes32 planHash;
        address trustee;
        uint64 proposedAt;
    }

    address public immutable agent;
    uint64 public immutable heartbeatInterval;
    uint64 public lastPing;
    Status public status;

    mapping(bytes32 => Plan) public plans;
    mapping(address => address) public successors;

    event Heartbeat(uint64 timestamp);
    event AdministrationDeclared(uint64 timestamp);
    event LiquidationDeclared(bytes32 indexed reportHash, uint64 timestamp);
    event SuccessorAssigned(address indexed previous, address indexed successor);

    error TooEarly();
    error AlreadyFlipped();
    error InvalidReport();

    constructor(address _agent, uint64 _heartbeatInterval) {
        agent = _agent;
        heartbeatInterval = _heartbeatInterval;
        lastPing = uint64(block.timestamp);
    }

    /// @notice Signed by the agent's key on an interval. Only meaningful
    /// while `status == Alive`.
    function ping() external {
        if (msg.sender != agent) revert();
        lastPing = uint64(block.timestamp);
        emit Heartbeat(lastPing);
    }

    /// @notice Anyone can call once the heartbeat has lapsed - this only
    /// proves liveness has stopped, not insolvency. No funds move here.
    function declareAdministration() external {
        if (status != Status.Alive) revert AlreadyFlipped();
        if (block.timestamp < lastPing + heartbeatInterval) revert TooEarly();
        status = Status.UnderAdministration;
        emit AdministrationDeclared(uint64(block.timestamp));
    }

    /// @notice Requires the CRE workflow's DON-signed solvency/claims
    /// report. `_report`/`_signature` are verified against the DON's known
    /// signer set (verification wired up alongside the CRE integration).
    function declareLiquidation(bytes calldata _report, bytes calldata _signature) external {
        if (status != Status.UnderAdministration) revert AlreadyFlipped();
        // TODO: verify `_signature` over `_report` against the CRE DON's
        // registered signer set before accepting the flip.
        bytes32 reportHash = keccak256(_report);
        status = Status.Liquidated;
        emit LiquidationDeclared(reportHash, uint64(block.timestamp));
    }

    function assignSuccessor(address successor) external {
        if (msg.sender != agent) revert();
        successors[agent] = successor;
        emit SuccessorAssigned(agent, successor);
    }
}
