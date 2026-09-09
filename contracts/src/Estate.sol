// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @notice Lives on Arc. Holds the estate's funds and pays out an approved
/// waterfall plan by priority class. Never touches liveness logic - that's
/// `Receiver`'s job on Sepolia; this contract only executes a plan it has
/// been told is valid.
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
    }

    address public immutable usdc;
    address public trustee;
    bytes32 public approvedPlanHash;

    mapping(bytes32 => Claim) public claims; // keyed by claimId
    bytes32[] public claimIds;

    event ClaimRegistered(bytes32 indexed claimId, address indexed creditor, uint256 allowedAmount);
    event PlanApproved(bytes32 indexed planHash, address indexed trustee);
    event PlanExecuted(bytes32 indexed planHash, uint256 totalPaid);

    error NotTrustee();
    error PlanMismatch();
    error InvalidSignature();

    constructor(address _usdc, address _trustee) {
        usdc = _usdc;
        trustee = _trustee;
    }

    /// @notice Populated from the CRE workflow's verified claims output -
    /// never from raw creditor-submitted evidence directly.
    function registerClaim(
        bytes32 claimId,
        address creditor,
        uint256 allowedAmount,
        PriorityClass class
    ) external {
        if (msg.sender != trustee) revert NotTrustee();
        claims[claimId] = Claim(creditor, allowedAmount, class, false);
        claimIds.push(claimId);
        emit ClaimRegistered(claimId, creditor, allowedAmount);
    }

    function approvePlan(bytes32 planHash) external {
        if (msg.sender != trustee) revert NotTrustee();
        approvedPlanHash = planHash;
        emit PlanApproved(planHash, trustee);
    }

    /// @notice Pays out registered claims in priority order (Secured before
    /// Administrative before Unsecured), draining pro-rata within a class if
    /// the estate can't cover it in full. `trusteeSig` must recover to
    /// `trustee` over `planHash` and the claim ordering being executed.
    function executePlan(bytes32 planHash, bytes calldata trusteeSig) external {
        if (planHash != approvedPlanHash) revert PlanMismatch();
        // TODO: recover `trusteeSig` over (planHash, claimIds) and require
        // it matches `trustee` before moving funds.
        // TODO: waterfall payout by PriorityClass, pro-rata within a class
        // when the estate balance is insufficient to pay that class in full.
        emit PlanExecuted(planHash, 0);
    }
}
