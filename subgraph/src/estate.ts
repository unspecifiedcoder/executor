import { BigInt, Bytes, dataSource, log } from "@graphprotocol/graph-ts";
import {
  ClaimRegistered,
  ClaimPaid,
  PayoutEscrowed,
  PayoutClaimed,
  PlanExecuted,
} from "../generated/templates/Estate/Estate";
import { Agent, Claim, Payout, PlanExecution } from "../generated/schema";
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
