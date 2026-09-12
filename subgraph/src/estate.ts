import { BigInt, Bytes, dataSource, log } from "@graphprotocol/graph-ts";
import {
  ClaimRegistered,
  PlanApproved,
  ClaimPaid,
  PayoutEscrowed,
  PayoutClaimed,
  PlanExecuted,
  SurplusSwept,
  ReturnedToTreasury,
} from "../generated/templates/Estate/Estate";
import { Agent, Claim, Payout, PlanApproval, PlanExecution } from "../generated/schema";
import { eventId, priorityClassName } from "./shared";

/** The agent this estate belongs to, put into the template context when the
 * registry spawned it. Estate's events carry a claimId and a creditor but no
 * agentId, so without this every payout would be an orphan row. */
function agentId(): Bytes {
  return dataSource.context().getBytes("agentId");
}

/** Claims are keyed by claimId within an estate. Two estates could in principle
 * mint the same claimId, so the stored key is scoped by the estate address. */
function claimKey(claimId: Bytes): Bytes {
  return dataSource.address().concat(claimId);
}

/** Seeing any event at all from this address proves it is a contract, not the
 * EOA an agent is also allowed to name. That distinction is worth recording:
 * "this agent has an estate" and "this agent has an estate that can run a
 * waterfall" are different claims, and only one of them is provable here. */
function markEstateIsContract(): Agent | null {
  let agent = Agent.load(agentId());
  if (agent == null) return null;
  if (!agent.estateIsContract) {
    agent.estateIsContract = true;
    agent.save();
  }
  return agent;
}

export function handleClaimRegistered(event: ClaimRegistered): void {
  let agent = markEstateIsContract();
  if (agent == null) {
    log.warning("ClaimRegistered for unknown agent, estate {}", [
      dataSource.address().toHexString(),
    ]);
    return;
  }

  let claim = new Claim(claimKey(event.params.claimId));
  claim.agent = agent.id;
  claim.estate = dataSource.address();
  claim.creditor = event.params.creditor;
  claim.allowedAmount = event.params.allowedAmount;
  claim.priorityClass = priorityClassName(event.params.class_);
  claim.amountPaid = BigInt.zero();
  claim.amountEscrowed = BigInt.zero();
  claim.registeredAtBlock = event.block.number;
  claim.save();
}

/** The trustee's commitment to the claim set that gates executePlan. Logged as
 * its own append-only row rather than folded into PlanExecuted, because an
 * approval can sit for a while - or forever, if the trustee stalls - before
 * any execution follows it, and that gap is itself worth being able to see. */
export function handlePlanApproved(event: PlanApproved): void {
  let agent = markEstateIsContract();
  if (agent == null) return;

  let approval = new PlanApproval(eventId(event));
  approval.agent = agent.id;
  approval.estate = dataSource.address();
  approval.planHash = event.params.planHash;
  approval.trustee = event.params.trustee;
  approval.blockNumber = event.block.number;
  approval.blockTimestamp = event.block.timestamp;
  approval.txHash = event.transaction.hash;
  approval.save();
}

/** Distribution is a repeatable round, so a claim can be paid more than once as
 * late funds arrive. These totals therefore accumulate rather than assign - a
 * second partial payment must not overwrite the record of the first. */
export function handleClaimPaid(event: ClaimPaid): void {
  let agent = markEstateIsContract();
  if (agent == null) return;

  let claim = Claim.load(claimKey(event.params.claimId));
  if (claim != null) {
    claim.amountPaid = claim.amountPaid.plus(event.params.amount);
    claim.save();
  }

  let payout = new Payout(eventId(event));
  payout.agent = agent.id;
  payout.estate = dataSource.address();
  payout.claim = claim == null ? null : claim.id;
  payout.creditor = event.params.creditor;
  payout.amount = event.params.amount;
  payout.kind = "PAID";
  payout.blockNumber = event.block.number;
  payout.blockTimestamp = event.block.timestamp;
  payout.txHash = event.transaction.hash;
  payout.save();
}

/** A transfer the token refused - real USDC has a blocklist. The money is owed
 * and withdrawable, but it has not moved, and recording it as PAID would make
 * the index assert a settlement that never happened. */
export function handlePayoutEscrowed(event: PayoutEscrowed): void {
  let agent = markEstateIsContract();
  if (agent == null) return;

  let claim = Claim.load(claimKey(event.params.claimId));
  if (claim != null) {
    claim.amountEscrowed = claim.amountEscrowed.plus(event.params.amount);
    claim.save();
  }

  let payout = new Payout(eventId(event));
  payout.agent = agent.id;
  payout.estate = dataSource.address();
  payout.claim = claim == null ? null : claim.id;
  payout.creditor = event.params.creditor;
  payout.amount = event.params.amount;
  payout.kind = "ESCROWED";
  payout.blockNumber = event.block.number;
  payout.blockTimestamp = event.block.timestamp;
  payout.txHash = event.transaction.hash;
  payout.save();
}

/** PayoutClaimed carries no claimId - a creditor pulls their whole escrowed
 * balance across claims at once - so this row is deliberately not linked to a
 * Claim rather than guessing at one. */
export function handlePayoutClaimed(event: PayoutClaimed): void {
  let agent = markEstateIsContract();
  if (agent == null) return;

  let payout = new Payout(eventId(event));
  payout.agent = agent.id;
  payout.estate = dataSource.address();
  payout.claim = null;
  payout.creditor = event.params.creditor;
  payout.amount = event.params.amount;
  payout.kind = "CLAIMED";
  payout.blockNumber = event.block.number;
  payout.blockTimestamp = event.block.timestamp;
  payout.txHash = event.transaction.hash;
  payout.save();
}

export function handlePlanExecuted(event: PlanExecuted): void {
  let agent = markEstateIsContract();
  if (agent == null) return;

  let execution = new PlanExecution(eventId(event));
  execution.agent = agent.id;
  execution.estate = dataSource.address();
  execution.planHash = event.params.planHash;
  execution.totalPaid = event.params.totalPaid;
  execution.shortfall = event.params.shortfall;
  execution.blockNumber = event.block.number;
  execution.blockTimestamp = event.block.timestamp;
  execution.txHash = event.transaction.hash;
  execution.save();
}

/** Leftover balance once every claim is settled in full - late x402 revenue
 * with no creditor left to owe it to. Recorded as a Payout, not a new entity,
 * because it is the same shape as every other estate outflow; `creditor` here
 * is just the address the trustee chose to sweep to, and `claim` stays null
 * since nothing is owed against it. */
export function handleSurplusSwept(event: SurplusSwept): void {
  let agent = markEstateIsContract();
  if (agent == null) return;

  let payout = new Payout(eventId(event));
  payout.agent = agent.id;
  payout.estate = dataSource.address();
  payout.claim = null;
  payout.creditor = event.params.to;
  payout.amount = event.params.amount;
  payout.kind = "SWEPT";
  payout.blockNumber = event.block.number;
  payout.blockTimestamp = event.block.timestamp;
  payout.txHash = event.transaction.hash;
  payout.save();
}

/** The estate handing a recovered agent's balance back to its treasury. Also a
 * Payout: the recipient is the treasury rather than a creditor, but it is the
 * same "money left this estate" fact every other row here records. */
export function handleReturnedToTreasury(event: ReturnedToTreasury): void {
  let agent = markEstateIsContract();
  if (agent == null) return;

  let payout = new Payout(eventId(event));
  payout.agent = agent.id;
  payout.estate = dataSource.address();
  payout.claim = null;
  payout.creditor = event.params.treasury;
  payout.amount = event.params.amount;
  payout.kind = "RETURNED";
  payout.blockNumber = event.block.number;
  payout.blockTimestamp = event.block.timestamp;
  payout.txHash = event.transaction.hash;
  payout.save();
}
