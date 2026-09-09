// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @notice Minimal ERC-20 surface. Declared locally rather than pulled from
/// OpenZeppelin because `lib/` carries forge-std only - adding a dependency
/// for three function signatures is not worth the install.
interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

/// @notice The registry surface Estate depends on. Kept to the single call it
/// actually needs so the two contracts stay loosely coupled.
interface IExecutorRegistry {
    function getStatus(bytes32 agentId) external view returns (uint8);
}

/// @notice Holds a failed agent's estate and pays its creditors out by priority
/// class. This is the half of the protocol that makes the payment flip mean
/// something: `ExecutorRegistry` decides that revenue should stop going to the
/// agent's treasury and start going here, and this contract decides who gets it
/// afterwards.
///
/// Deliberate design decisions worth stating, because each one is a place this
/// contract could have been theatre instead of a mechanism:
///
/// 1. `executePlan` only runs while the agent is in Liquidation (status 2).
///    Administration is a recoverable state - the agent may come back, and
///    distributing its funds to creditors while recovery is still possible
///    would be the single worst bug this protocol could have. Liquidation is
///    the terminal, trustee-declared state, and it is the only one that
///    unlocks payouts. This is also what makes Liquidation economically
///    distinct from Administration rather than a cosmetic enum value.
///
/// 2. `approvedPlanHash` commits to the exact claim set. Approving a plan and
///    then registering another claim before execution would otherwise let the
///    trustee (or a compromised trustee key) pay an address the approval never
///    covered. Execution recomputes the hash and reverts on any drift.
///
/// 3. Payment is pro-rata within a priority class when the estate cannot cover
///    that class in full, and strictly ordered across classes. An insolvent
///    estate is the normal case, not the exception - a waterfall that only
///    works when everyone can be paid in full is not a waterfall.
contract Estate {
    enum PriorityClass {
        Secured,
        Administrative,
        Unsecured
    }

    struct Claim {
        address creditor;
        uint256 allowedAmount;
        PriorityClass class;
        bool paid;
        uint256 paidAmount;
    }

    /// @dev Mirrors ExecutorRegistry.Status. Only Liquidation is referenced
    /// here, but the full set is spelled out so the mapping is auditable.
    uint8 internal constant STATUS_LIQUIDATION = 2;

    address public immutable usdc;
    address public immutable registry;
    bytes32 public immutable agentId;
    address public trustee;

    bytes32 public approvedPlanHash;
    bool public executed;

    mapping(bytes32 => Claim) public claims;
    bytes32[] public claimIds;

    event ClaimRegistered(
        bytes32 indexed claimId, address indexed creditor, uint256 allowedAmount, PriorityClass class
    );
    event PlanApproved(bytes32 indexed planHash, address indexed trustee);
    event ClaimPaid(bytes32 indexed claimId, address indexed creditor, uint256 amount);
    event PlanExecuted(bytes32 indexed planHash, uint256 totalPaid, uint256 shortfall);

    error NotTrustee();
    error PlanMismatch();
    error AgentNotInLiquidation(uint8 status);
    error AlreadyExecuted();
    error NoPlanApproved();
    error ClaimAlreadyRegistered();
    error NothingToDistribute();
    error TransferFailed();

    modifier onlyTrustee() {
        if (msg.sender != trustee) revert NotTrustee();
        _;
    }

    constructor(address _usdc, address _trustee, address _registry, bytes32 _agentId) {
        usdc = _usdc;
        trustee = _trustee;
        registry = _registry;
        agentId = _agentId;
    }

    /// @notice Registers an allowed claim against the estate. Claims are
    /// trustee-curated: this contract deliberately does not accept raw
    /// creditor submissions, because adjudicating whether a debt is real is
    /// not something a contract can do.
    function registerClaim(bytes32 claimId, address creditor, uint256 allowedAmount, PriorityClass class)
        external
        onlyTrustee
    {
        if (executed) revert AlreadyExecuted();
        if (claims[claimId].creditor != address(0)) revert ClaimAlreadyRegistered();

        claims[claimId] = Claim(creditor, allowedAmount, class, false, 0);
        claimIds.push(claimId);
        emit ClaimRegistered(claimId, creditor, allowedAmount, class);
    }

    /// @notice The hash a trustee must approve: a commitment to the exact
    /// ordered claim set that will be paid. Exposed as a view so a trustee (or
    /// a creditor auditing them) can compute it off-chain before approving.
    function currentPlanHash() public view returns (bytes32) {
        return keccak256(abi.encode(claimIds));
    }

    function approvePlan(bytes32 planHash) external onlyTrustee {
        if (executed) revert AlreadyExecuted();
        approvedPlanHash = planHash;
        emit PlanApproved(planHash, trustee);
    }

    function claimCount() external view returns (uint256) {
        return claimIds.length;
    }

    /// @notice Total still owed across every unpaid claim.
    function totalOutstanding() public view returns (uint256 total) {
        for (uint256 i = 0; i < claimIds.length; i++) {
            Claim storage c = claims[claimIds[i]];
            if (!c.paid) total += c.allowedAmount;
        }
    }

    /// @notice Pays creditors out of the estate's USDC balance, strictly by
    /// priority class, pro-rata within a class that cannot be covered in full.
    /// Permissionless by design: once a trustee has approved a plan and the
    /// registry says the agent is in Liquidation, execution is a mechanical
    /// step and should not depend on the trustee staying online to push it.
    function executePlan(bytes32 planHash) external {
        if (executed) revert AlreadyExecuted();
        if (approvedPlanHash == bytes32(0)) revert NoPlanApproved();
        if (planHash != approvedPlanHash) revert PlanMismatch();
        // Re-derive from live state: catches a claim registered after approval.
        if (currentPlanHash() != approvedPlanHash) revert PlanMismatch();

        uint8 status = IExecutorRegistry(registry).getStatus(agentId);
        if (status != STATUS_LIQUIDATION) revert AgentNotInLiquidation(status);

        uint256 available = IERC20(usdc).balanceOf(address(this));
        if (available == 0) revert NothingToDistribute();

        executed = true;
        uint256 totalPaid;

        // Secured, then Administrative, then Unsecured.
        for (uint8 class = 0; class <= uint8(PriorityClass.Unsecured); class++) {
            if (available == 0) break;

            uint256 classTotal = _classTotal(PriorityClass(class));
            if (classTotal == 0) continue;

            bool payInFull = available >= classTotal;
            uint256 classBudget = payInFull ? classTotal : available;

            for (uint256 i = 0; i < claimIds.length; i++) {
                Claim storage c = claims[claimIds[i]];
                if (c.paid || c.class != PriorityClass(class)) continue;

                // Pro-rata share when the class is underfunded. Integer
                // division truncates, so a few wei may be left behind rather
                // than over-paying the last creditor in the loop.
                uint256 amount = payInFull ? c.allowedAmount : (c.allowedAmount * classBudget) / classTotal;
                if (amount == 0) continue;

                c.paid = true;
                c.paidAmount = amount;
                available -= amount;
                totalPaid += amount;

                if (!IERC20(usdc).transfer(c.creditor, amount)) revert TransferFailed();
                emit ClaimPaid(claimIds[i], c.creditor, amount);
            }
        }

        uint256 shortfall = totalOutstanding();
        emit PlanExecuted(planHash, totalPaid, shortfall);
    }

    function _classTotal(PriorityClass class) internal view returns (uint256 total) {
        for (uint256 i = 0; i < claimIds.length; i++) {
            Claim storage c = claims[claimIds[i]];
            if (!c.paid && c.class == class) total += c.allowedAmount;
        }
    }
}
