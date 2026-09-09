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
/// 1. `executePlan` runs only once the agent has passed the point of no return -
///    Liquidation (status 2) or the terminal Resolved (status 3). Administration
///    is a recoverable state: the agent may come back, and distributing its
///    funds to creditors while recovery is still possible would be the single
///    worst bug this protocol could have. Liquidation is the trustee-declared
///    state that unlocks payouts, which is what makes it economically distinct
///    from Administration rather than a cosmetic enum value.
///
/// 2. `approvedPlanHash` commits to the exact claim set - every claim's id,
///    creditor, allowed amount and priority class, in order. Approving a plan
///    and then registering another claim (or one with different terms) before
///    execution would otherwise let the trustee, or a compromised trustee key,
///    pay an address the approval never covered. Execution recomputes the hash
///    and reverts on any drift.
///
/// 3. Payment is pro-rata within a priority class when the estate cannot cover
///    that class in full, and strictly ordered across classes. An insolvent
///    estate is the normal case, not the exception - a waterfall that only
///    works when everyone can be paid in full is not a waterfall.
///
/// 4. A payout that the token refuses (real USDC has a blacklist) does not
///    revert the distribution. The creditor's share is booked to
///    `withdrawable` and pulled later via `claimPayout()`. A push-only
///    waterfall hands any single creditor - or anyone who can get a creditor
///    blacklisted - a permanent brick on everyone else's money.
///
/// 5. Distribution is a repeatable round, not a one-shot. Claims track
///    `paidAmount` and a round only ever pays `allowedAmount - paidAmount`, so
///    running it again after pro-rata truncation dust or a late payment arrives
///    distributes the new balance on the same priority terms without any risk
///    of paying a creditor twice. Once nothing is owed, `sweepSurplus` returns
///    what is left over.
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

    /// @dev Mirrors ExecutorRegistry.Status. Administration (1) and Active (0)
    /// are deliberately absent from the payout gate; the full set is spelled
    /// out so the mapping is auditable.
    uint8 internal constant STATUS_LIQUIDATION = 2;
    uint8 internal constant STATUS_RESOLVED = 3;

    /// @dev `executePlan` walks the whole claim array once per priority class,
    /// several times over (subtotal, allocate, remainder, settle), so its cost
    /// grows as O(classes * claims) with a constant that is not small - and the
    /// array is unbounded from this contract's point of view. The cap keeps a
    /// full distribution inside one block by construction rather than by hope:
    /// measured at 9.4M gas for 200 claims spread across all three classes with
    /// a real token transfer each, against a 30M block. An estate with more
    /// creditors than that should be split across several Estate contracts,
    /// which the registry already supports by pointing `estate` at whichever
    /// one holds the funds.
    uint256 public constant MAX_CLAIMS = 200;

    address public immutable usdc;
    address public immutable registry;
    bytes32 public immutable agentId;
    /// @dev Immutable: there was never a setter, and a trustee that can be
    /// swapped after creditors have registered against this estate is a
    /// different trust model than the one documented. Deploy a new Estate and
    /// re-point the registry to change trustee.
    address public immutable trustee;

    bytes32 public approvedPlanHash;
    /// @notice True once at least one distribution round has run. It closes the
    /// claim set and the approval to further edits; it does NOT close the
    /// contract to further rounds.
    bool public executed;

    /// @notice Payouts a creditor is owed but could not be pushed. Held by this
    /// contract and excluded from every later round's distributable balance.
    mapping(address => uint256) public withdrawable;
    /// @notice Sum of `withdrawable`. Tracked rather than recomputed so the
    /// distributable balance is an O(1) read.
    uint256 public totalEscrowed;

    mapping(bytes32 => Claim) public claims;
    bytes32[] public claimIds;

    uint256 private _reentrancyLock;

    event ClaimRegistered(
        bytes32 indexed claimId,
        address indexed creditor,
        uint256 allowedAmount,
        PriorityClass class
    );
    event PlanApproved(bytes32 indexed planHash, address indexed trustee);
    event ClaimPaid(bytes32 indexed claimId, address indexed creditor, uint256 amount);
    event PayoutEscrowed(bytes32 indexed claimId, address indexed creditor, uint256 amount);
    event PayoutClaimed(address indexed creditor, uint256 amount);
    event PlanExecuted(bytes32 indexed planHash, uint256 totalPaid, uint256 shortfall);
    event SurplusSwept(address indexed to, uint256 amount);

    error NotTrustee();
    error PlanMismatch();
    error AgentNotInLiquidation(uint8 status);
    error AlreadyExecuted();
    error NoPlanApproved();
    error ClaimAlreadyRegistered();
    error NothingToDistribute();
    error TransferFailed();
    error NothingToClaim();
    error ClaimsOutstanding(uint256 outstanding);
    error TooManyClaims();
    error Reentrancy();

    modifier onlyTrustee() {
        if (msg.sender != trustee) revert NotTrustee();
        _;
    }

    /// @dev Explicit, not a side effect of where a flag happens to be set. Every
    /// function that moves tokens carries it.
    modifier nonReentrant() {
        if (_reentrancyLock == 1) revert Reentrancy();
        _reentrancyLock = 1;
        _;
        _reentrancyLock = 0;
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
    function registerClaim(
        bytes32 claimId,
        address creditor,
        uint256 allowedAmount,
        PriorityClass class
    ) external onlyTrustee {
        if (executed) revert AlreadyExecuted();
        if (claims[claimId].creditor != address(0)) revert ClaimAlreadyRegistered();
        if (claimIds.length >= MAX_CLAIMS) revert TooManyClaims();

        claims[claimId] = Claim(creditor, allowedAmount, class, false, 0);
        claimIds.push(claimId);
        emit ClaimRegistered(claimId, creditor, allowedAmount, class);
    }

    /// @notice The hash a trustee must approve: a commitment to the exact
    /// ordered claim set that will be paid - id, creditor, allowed amount and
    /// priority class for every claim. Exposed as a view so a trustee (or a
    /// creditor auditing them) can compute it off-chain before approving.
    ///
    /// @dev Deliberately excludes `paid` / `paidAmount`. Those are settlement
    /// progress, not terms: including them would make the hash drift after the
    /// first distribution round and lock out every subsequent one.
    function currentPlanHash() public view returns (bytes32) {
        uint256 n = claimIds.length;
        address[] memory creditors = new address[](n);
        uint256[] memory amounts = new uint256[](n);
        uint8[] memory classes = new uint8[](n);
        for (uint256 i = 0; i < n; i++) {
            Claim storage c = claims[claimIds[i]];
            creditors[i] = c.creditor;
            amounts[i] = c.allowedAmount;
            classes[i] = uint8(c.class);
        }
        return keccak256(abi.encode(claimIds, creditors, amounts, classes));
    }

    function approvePlan(bytes32 planHash) external onlyTrustee {
        if (executed) revert AlreadyExecuted();
        approvedPlanHash = planHash;
        emit PlanApproved(planHash, trustee);
    }

    function claimCount() external view returns (uint256) {
        return claimIds.length;
    }

    /// @notice Total still owed across every claim: the sum of
    /// `allowedAmount - paidAmount`, not the sum of untouched claims. A claim
    /// paid 100 of an allowed 1000 still leaves 900 outstanding, and reporting
    /// that as zero is how a shortfall gets understated.
    function totalOutstanding() public view returns (uint256 total) {
        for (uint256 i = 0; i < claimIds.length; i++) {
            Claim storage c = claims[claimIds[i]];
            total += c.allowedAmount - c.paidAmount;
        }
    }

    /// @notice Balance this contract may still distribute: everything it holds
    /// except payouts already booked to a creditor who could not be paid.
    function distributable() public view returns (uint256) {
        uint256 balance = IERC20(usdc).balanceOf(address(this));
        return balance > totalEscrowed ? balance - totalEscrowed : 0;
    }

    /// @notice Pays creditors out of the estate's distributable USDC balance,
    /// strictly by priority class, pro-rata within a class that cannot be
    /// covered in full. Permissionless by design: once a trustee has approved a
    /// plan and the registry says the agent is past recovery, execution is a
    /// mechanical step and should not depend on the trustee staying online to
    /// push it.
    ///
    /// Re-runnable. Each round pays only what a claim is still owed, so calling
    /// it again after late funds arrive - or after the previous round's
    /// truncation dust - is a second distribution on the same terms, not a
    /// double payment. With nothing left to distribute it reverts
    /// `NothingToDistribute`.
    function executePlan(bytes32 planHash) external nonReentrant {
        if (approvedPlanHash == bytes32(0)) revert NoPlanApproved();
        if (planHash != approvedPlanHash) revert PlanMismatch();
        // Re-derive from live state: catches a claim registered after approval.
        if (currentPlanHash() != approvedPlanHash) revert PlanMismatch();

        // Both terminal states pay out. Resolved is reachable only from
        // Liquidation and only by the trustee, so accepting it adds no new
        // authority - but refusing it means a trustee who calls
        // `ExecutorRegistry.resolve()` before `executePlan()` bricks the estate
        // permanently, since Resolved is one-way and nothing orders the two
        // calls. Fixing it on this side rather than by making `resolve()`
        // require a finished estate is deliberate: the registry holds no
        // reference to any Estate contract and cannot ask one whether it is
        // done, an agent's funds may be spread across more than one Estate, and
        // `resolve()` already documents that late funds belong to the estate -
        // which is only true if the estate can still pay them out.
        uint8 status = IExecutorRegistry(registry).getStatus(agentId);
        if (status != STATUS_LIQUIDATION && status != STATUS_RESOLVED) {
            revert AgentNotInLiquidation(status);
        }

        uint256 available = distributable();
        if (available == 0) revert NothingToDistribute();

        executed = true;
        uint256 totalPaid;
        uint256 n = claimIds.length;
        uint256[] memory allocation = new uint256[](n);

        // Secured, then Administrative, then Unsecured.
        for (uint8 class = 0; class <= uint8(PriorityClass.Unsecured); class++) {
            if (available == 0) break;

            uint256 classTotal = _classTotal(PriorityClass(class));
            if (classTotal == 0) continue;

            bool payInFull = available >= classTotal;
            uint256 classBudget = payInFull ? classTotal : available;

            // Pass 1: allocate. Integer division truncates when the class is
            // underfunded, so this deliberately under-spends the budget.
            uint256 allocated;
            for (uint256 i = 0; i < n; i++) {
                Claim storage c = claims[claimIds[i]];
                if (c.class != PriorityClass(class)) continue;
                uint256 owed = c.allowedAmount - c.paidAmount;
                if (owed == 0) continue;

                uint256 amount = payInFull ? owed : (owed * classBudget) / classTotal;
                allocation[i] = amount;
                allocated += amount;
            }

            // Pass 2: hand out the truncation remainder, one unit at a time, in
            // claim order. The remainder is strictly smaller than the number of
            // claims in the class (each claim loses less than one unit to
            // truncation), so a single sweep always clears it. Without this the
            // dust is simply stranded - it is too small to ever survive another
            // round's pro-rata division, and it is owed to somebody.
            uint256 remainder = classBudget - allocated;
            for (uint256 i = 0; i < n && remainder > 0; i++) {
                Claim storage c = claims[claimIds[i]];
                if (c.class != PriorityClass(class)) continue;
                if (c.allowedAmount - c.paidAmount <= allocation[i]) continue;
                allocation[i] += 1;
                remainder -= 1;
            }

            // Pass 3: settle. Effects before interaction, and the `paid` flag
            // now means "fully settled" rather than "we tried once".
            for (uint256 i = 0; i < n; i++) {
                uint256 amount = allocation[i];
                if (amount == 0) continue;
                allocation[i] = 0;

                Claim storage c = claims[claimIds[i]];
                c.paidAmount += amount;
                c.paid = c.paidAmount >= c.allowedAmount;
                available -= amount;
                totalPaid += amount;

                if (_tryTransfer(c.creditor, amount)) {
                    emit ClaimPaid(claimIds[i], c.creditor, amount);
                } else {
                    // The token refused this creditor - a blacklist, a
                    // reverting receiver hook, a contract that has since
                    // self-destructed. Book it and move on; the rest of the
                    // estate is not held hostage to one address.
                    withdrawable[c.creditor] += amount;
                    totalEscrowed += amount;
                    emit PayoutEscrowed(claimIds[i], c.creditor, amount);
                }
            }
        }

        // Holding a balance with nothing owed against it is not a distribution.
        // Reverting keeps `PlanExecuted(…, 0, 0)` out of the log - the event a
        // creditor reads to learn what a round actually did - and points the
        // caller at `sweepSurplus`, which is where residual money belongs.
        if (totalPaid == 0) revert NothingToDistribute();

        emit PlanExecuted(planHash, totalPaid, totalOutstanding());
    }

    /// @notice Pull the payouts a push could not deliver. The counterpart to
    /// the escrow branch in `executePlan`: a creditor blacklisted at
    /// distribution time collects here once they are not.
    function claimPayout() external nonReentrant returns (uint256 amount) {
        amount = withdrawable[msg.sender];
        if (amount == 0) revert NothingToClaim();

        withdrawable[msg.sender] = 0;
        totalEscrowed -= amount;

        if (!_tryTransfer(msg.sender, amount)) {
            // Still refused. Revert so the credit survives for a later attempt
            // rather than being burned on a failed pull.
            revert TransferFailed();
        }
        emit PayoutClaimed(msg.sender, amount);
    }

    /// @notice Returns whatever is left once every claim is settled in full.
    /// Without this, an estate that is paid up but still receiving late x402
    /// revenue accumulates funds no one can ever move.
    ///
    /// Gated on `totalOutstanding() == 0` so it can never be used to jump the
    /// waterfall: while any creditor is short, the only way money leaves this
    /// contract is `executePlan` or `claimPayout`.
    function sweepSurplus(address to) external onlyTrustee nonReentrant returns (uint256 amount) {
        uint256 outstanding = totalOutstanding();
        if (outstanding != 0) revert ClaimsOutstanding(outstanding);

        amount = distributable();
        if (amount == 0) revert NothingToDistribute();

        if (!_tryTransfer(to, amount)) revert TransferFailed();
        emit SurplusSwept(to, amount);
    }

    /// @dev A transfer that neither reverts nor returns false. Uses a low-level
    /// call so a token that returns nothing (the original USDT shape) is not
    /// mistaken for a failure, and so a token that reverts does not take the
    /// whole distribution with it.
    function _tryTransfer(address to, uint256 amount) internal returns (bool) {
        (bool success, bytes memory data) =
            usdc.call(abi.encodeWithSelector(IERC20.transfer.selector, to, amount));
        if (!success) return false;
        if (data.length == 0) return true;
        if (data.length < 32) return false;
        return abi.decode(data, (bool));
    }

    function _classTotal(PriorityClass class) internal view returns (uint256 total) {
        for (uint256 i = 0; i < claimIds.length; i++) {
            Claim storage c = claims[claimIds[i]];
            if (c.class == class) total += c.allowedAmount - c.paidAmount;
        }
    }
}
