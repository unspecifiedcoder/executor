// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @notice Canonical, single-chain source of truth for an agent's resolution plan and its
/// current payment destination. Lives on Sepolia, alongside ENSv2, so it can call the ENS
/// adapter directly in the same transaction when the destination changes - no cross-chain
/// relayer, no "was the mirror in sync" question. Off-chain services (the payment gateway,
/// the dashboard) read this contract's state over plain RPC to decide behavior on other
/// chains (Hedera for the x402 payment rail, Arc for estate settlement) - that's normal
/// multi-chain plumbing, not a trust assumption this contract has to solve.
///
/// Supersedes `Receiver.sol`'s role from the earlier two-contract design: liveness tracking
/// and payment-destination resolution now live together here.
contract ExecutorRegistry {
    enum Status {
        Active,
        Administration,
        Liquidation,
        Resolved
    }

    struct AgentPlan {
        address owner;
        address heartbeatSigner;
        address trustee;
        address recoveryAuthority;
        address treasury;
        address estate;
        uint64 heartbeatInterval;
        uint64 gracePeriod;
        uint64 lastHeartbeat;
        Status status;
        bool planLocked;
    }

    mapping(bytes32 => AgentPlan) public plans;

    event AgentRegistered(bytes32 indexed agentId, address treasury, address estate);
    event PlanUpdated(bytes32 indexed agentId, address treasury, address estate);
    event PlanLocked(bytes32 indexed agentId);
    event Heartbeat(bytes32 indexed agentId, uint64 timestamp);
    event PaymentDestinationChanged(bytes32 indexed agentId, address destination, Status status);
    event StatusChanged(bytes32 indexed agentId, Status status);

    error NotOwner();
    error NotHeartbeatSigner();
    error NotTrustee();
    error NotRecoveryAuthority();
    error PlanIsLocked();
    error AgentNotFound();
    error AgentAlreadyRegistered();
    error TooEarly();
    error WrongStatus(Status current);
    error ZeroAddress();

    modifier onlyOwner(bytes32 agentId) {
        if (msg.sender != plans[agentId].owner) revert NotOwner();
        _;
    }

    /// @notice Registers a new agent's resolution plan. Callable freely until locked -
    /// nothing here is load-bearing for creditors until `lockPlan` is called.
    function registerAgent(
        bytes32 agentId,
        address heartbeatSigner,
        address trustee,
        address recoveryAuthority,
        address treasury,
        address estate,
        uint64 heartbeatInterval,
        uint64 gracePeriod
    ) external {
        if (plans[agentId].owner != address(0)) revert AgentAlreadyRegistered();
        _requireNoZeroAddress(heartbeatSigner, trustee, recoveryAuthority, treasury, estate);

        plans[agentId] = AgentPlan({
            owner: msg.sender,
            heartbeatSigner: heartbeatSigner,
            trustee: trustee,
            recoveryAuthority: recoveryAuthority,
            treasury: treasury,
            estate: estate,
            heartbeatInterval: heartbeatInterval,
            gracePeriod: gracePeriod,
            lastHeartbeat: uint64(block.timestamp),
            status: Status.Active,
            planLocked: false
        });

        emit AgentRegistered(agentId, treasury, estate);
        emit PaymentDestinationChanged(agentId, treasury, Status.Active);
    }

    /// @dev None of the five plan addresses may be zero, and the reasons are
    /// not symmetrical:
    ///
    ///   * a zero `estate` burns the agent's revenue the moment it flips - the
    ///     payment destination becomes address(0) and every payer sends there;
    ///   * a zero `recoveryAuthority` makes `restoreActive` permanently
    ///     unreachable, because it compares against `msg.sender` and no one can
    ///     transact as address(0). Combined with `lockPlan`, that is an agent
    ///     which can never come back from a missed heartbeat;
    ///   * a zero `heartbeatSigner` is an agent that can never prove liveness,
    ///     so it lapses into Administration once and stays there;
    ///   * a zero `trustee` removes the only party who can declare Liquidation,
    ///     stranding creditors in the one state that never pays out;
    ///   * a zero `treasury` burns revenue while the agent is perfectly healthy.
    ///
    /// Every one of those is unrecoverable after `lockPlan`, which is why this
    /// is a revert at registration rather than something a UI warns about.
    function _requireNoZeroAddress(
        address heartbeatSigner,
        address trustee,
        address recoveryAuthority,
        address treasury,
        address estate
    ) private pure {
        if (
            heartbeatSigner == address(0) || trustee == address(0)
                || recoveryAuthority == address(0) || treasury == address(0) || estate == address(0)
        ) revert ZeroAddress();
    }

    /// @notice Amends an unlocked plan. This function is what gives `lockPlan`
    /// its meaning: before locking, an owner can still move the treasury, the
    /// estate, or the timing; after locking, every one of those is frozen and
    /// this call reverts. Without an amend path, `planLocked` would be a flag
    /// nothing reads and "pre-committed" would be an accident of the contract
    /// having no setters, not a property anyone chose.
    function updatePlan(
        bytes32 agentId,
        address heartbeatSigner,
        address trustee,
        address recoveryAuthority,
        address treasury,
        address estate,
        uint64 heartbeatInterval,
        uint64 gracePeriod
    ) external onlyOwner(agentId) {
        AgentPlan storage plan = plans[agentId];
        if (plan.planLocked) revert PlanIsLocked();
        // Same rule as registration: an amend must not be a way to reach a
        // state registration refuses.
        _requireNoZeroAddress(heartbeatSigner, trustee, recoveryAuthority, treasury, estate);

        plan.heartbeatSigner = heartbeatSigner;
        plan.trustee = trustee;
        plan.recoveryAuthority = recoveryAuthority;
        plan.treasury = treasury;
        plan.estate = estate;
        plan.heartbeatInterval = heartbeatInterval;
        plan.gracePeriod = gracePeriod;

        emit PlanUpdated(agentId, treasury, estate);
        emit PaymentDestinationChanged(agentId, getPaymentDestination(agentId), plan.status);
    }

    /// @notice Freezes heartbeatSigner/trustee/recoveryAuthority/treasury/estate/heartbeatInterval/
    /// gracePeriod permanently by making `updatePlan` revert. This is the actual pre-commitment:
    /// without it, the plan stays owner-mutable, which is not something creditors or a trustee
    /// should have to trust. One-way by construction - there is no unlock.
    function lockPlan(bytes32 agentId) external onlyOwner(agentId) {
        plans[agentId].planLocked = true;
        emit PlanLocked(agentId);
    }

    /// @notice Signed by the agent's heartbeat key on an interval. Only meaningful while Active.
    function heartbeat(bytes32 agentId) external {
        AgentPlan storage plan = plans[agentId];
        if (plan.owner == address(0)) revert AgentNotFound();
        if (msg.sender != plan.heartbeatSigner) revert NotHeartbeatSigner();
        plan.lastHeartbeat = uint64(block.timestamp);
        emit Heartbeat(agentId, plan.lastHeartbeat);
    }

    /// @notice Permissionless: the contract checks eligibility, not the caller. Flips the
    /// payment destination from treasury to estate.
    function enterAdministration(bytes32 agentId) external {
        AgentPlan storage plan = plans[agentId];
        if (plan.owner == address(0)) revert AgentNotFound();
        if (plan.status != Status.Active) revert WrongStatus(plan.status);
        if (block.timestamp < plan.lastHeartbeat + plan.heartbeatInterval + plan.gracePeriod) {
            revert TooEarly();
        }

        plan.status = Status.Administration;
        emit StatusChanged(agentId, Status.Administration);
        emit PaymentDestinationChanged(agentId, plan.estate, Status.Administration);
    }

    /// @notice A missed heartbeat isn't insolvency - this lets a recovered agent resume
    /// without going through liquidation. Single named authority, not an ambiguous
    /// owner-or-trustee multisig.
    function restoreActive(bytes32 agentId) external {
        AgentPlan storage plan = plans[agentId];
        if (msg.sender != plan.recoveryAuthority) revert NotRecoveryAuthority();
        if (plan.status != Status.Administration) revert WrongStatus(plan.status);

        plan.status = Status.Active;
        plan.lastHeartbeat = uint64(block.timestamp);
        emit StatusChanged(agentId, Status.Active);
        emit PaymentDestinationChanged(agentId, plan.treasury, Status.Active);
    }

    /// @notice Unavailability and insolvency are different questions - this one needs human
    /// judgment, so it's trustee-only rather than time-triggered.
    function enterLiquidation(bytes32 agentId) external {
        AgentPlan storage plan = plans[agentId];
        if (msg.sender != plan.trustee) revert NotTrustee();
        if (plan.status != Status.Administration) revert WrongStatus(plan.status);

        plan.status = Status.Liquidation;
        emit StatusChanged(agentId, Status.Liquidation);
        emit PaymentDestinationChanged(agentId, plan.estate, Status.Liquidation);
    }

    /// @notice Closes the estate out once its creditors have been paid, moving the
    /// agent to its terminal state. Trustee-only and reachable only from Liquidation,
    /// which is the same authority and the same one-way path that opened it.
    ///
    /// Until this existed, `Status.Resolved` was declared by the enum, rendered by the
    /// dashboard as the final lifecycle stage, and assignable by nothing - a stage the
    /// protocol could never actually reach.
    function resolve(bytes32 agentId) external {
        AgentPlan storage plan = plans[agentId];
        if (msg.sender != plan.trustee) revert NotTrustee();
        if (plan.status != Status.Liquidation) revert WrongStatus(plan.status);

        plan.status = Status.Resolved;
        emit StatusChanged(agentId, Status.Resolved);
        // Destination stays the estate: the agent is wound up, and anything that
        // arrives late belongs to the estate, not to a treasury nobody operates.
        emit PaymentDestinationChanged(agentId, plan.estate, Status.Resolved);
    }

    /// @notice The primitive the payment gateway actually calls, on every request.
    function getPaymentDestination(bytes32 agentId) public view returns (address) {
        AgentPlan storage plan = plans[agentId];
        if (plan.owner == address(0)) revert AgentNotFound();
        return plan.status == Status.Active ? plan.treasury : plan.estate;
    }

    function getStatus(bytes32 agentId) external view returns (Status) {
        return plans[agentId].status;
    }
}
