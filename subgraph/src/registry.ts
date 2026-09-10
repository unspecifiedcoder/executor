import { Address, BigInt, DataSourceContext, Bytes } from "@graphprotocol/graph-ts";
import {
  AgentRegistered,
  PlanUpdated,
  PlanLocked,
  Heartbeat as HeartbeatEvent,
  StatusChanged,
  PaymentDestinationChanged,
} from "../generated/ExecutorRegistry/ExecutorRegistry";
import { Estate as EstateTemplate } from "../generated/templates";
import { Agent, Heartbeat, StatusChange, DestinationChange } from "../generated/schema";
import {
  statusName,
  eventId,
  loadOrCreateAgent,
  touchIndexStatus,
} from "./shared";

/** Spawn an Estate data source for whatever address the plan points at.
 *
 * The registry's `estate` field is an address, not necessarily a contract - an
 * agent can legitimately name an EOA, and one of ours does. Watching an EOA
 * costs nothing (it never emits) and guessing wrong in the other direction is
 * unrecoverable: graph-node cannot retroactively index a contract it was never
 * told to watch, so a missed template means re-deploying and re-syncing.
 *
 * The agent id rides along in the template context because Estate's events
 * carry a claimId, not an agentId, and the Estate contract's own `agentId()`
 * would cost an eth_call per event to rediscover something already known here. */
function watchEstate(estate: Address, agentId: Bytes): void {
  if (estate.equals(Address.zero())) return;
  let context = new DataSourceContext();
  context.setBytes("agentId", agentId);
  EstateTemplate.createWithContext(estate, context);
}

export function handleAgentRegistered(event: AgentRegistered): void {
  let agent = loadOrCreateAgent(event.params.agentId, event);
  agent.treasury = event.params.treasury;
  agent.estate = event.params.estate;
  agent.status = "Active";
  // A freshly registered agent is Active, so the destination is its treasury.
  // The registry does not emit PaymentDestinationChanged on registration, and
  // leaving this empty would render the dashboard's core field blank for every
  // agent that has not yet flipped.
  agent.paymentDestination = event.params.treasury;
  agent.registeredAt = event.block.timestamp;
  agent.registeredAtBlock = event.block.number;
  agent.save();

  watchEstate(event.params.estate, event.params.agentId);

  let status = touchIndexStatus(event);
  status.save();
}

export function handlePlanUpdated(event: PlanUpdated): void {
  let agent = loadOrCreateAgent(event.params.agentId, event);
  let previousEstate = agent.estate;
  agent.treasury = event.params.treasury;
  agent.estate = event.params.estate;
  if (agent.status == "Active") {
    agent.paymentDestination = event.params.treasury;
  } else {
    agent.paymentDestination = event.params.estate;
  }
  agent.save();

  // A plan can be repointed at a different estate before it is locked, and the
  // new one has to be watched from here on.
  if (!previousEstate.equals(event.params.estate as Bytes)) {
    watchEstate(event.params.estate, event.params.agentId);
  }

  let status = touchIndexStatus(event);
  status.save();
}

export function handlePlanLocked(event: PlanLocked): void {
  let agent = loadOrCreateAgent(event.params.agentId, event);
  agent.planLocked = true;
  agent.save();
}

export function handleHeartbeat(event: HeartbeatEvent): void {
  let agent = loadOrCreateAgent(event.params.agentId, event);

  let beat = new Heartbeat(eventId(event));
  beat.agent = agent.id;
  beat.timestamp = event.params.timestamp;
  beat.blockNumber = event.block.number;
  beat.blockTimestamp = event.block.timestamp;
  beat.txHash = event.transaction.hash;

  // Computed here so a consumer never has to fetch the whole series and diff
  // it - the gap is the unit the protocol's own deadline is expressed in.
  //
  // Deliberately NOT a liveness proof. A steady cadence is trivial to
  // manufacture: anyone holding the signer key can beat on a timer, and this
  // index cannot tell that apart from an agent that genuinely ran. What it
  // gives is observability - what the cadence *was*, and where it broke - which
  // is a different and much more defensible claim than authenticity.
  let previous = agent.lastHeartbeat;
  if (previous !== null) {
    beat.gapFromPrevious = event.params.timestamp.minus(previous as BigInt);
  }
  beat.save();

  agent.lastHeartbeat = event.params.timestamp;
  agent.heartbeatCount = agent.heartbeatCount + 1;
  agent.save();

  let status = touchIndexStatus(event);
  status.heartbeatCount = status.heartbeatCount + 1;
  status.save();
}

export function handleStatusChanged(event: StatusChanged): void {
  let agent = loadOrCreateAgent(event.params.agentId, event);
  let to = statusName(event.params.status);

  let change = new StatusChange(eventId(event));
  change.agent = agent.id;
  change.from = agent.status;
  change.to = to;
  change.blockNumber = event.block.number;
  change.blockTimestamp = event.block.timestamp;
  change.txHash = event.transaction.hash;
  // Recorded because `enterAdministration` is permissionless: the interesting
  // fact about a transition is often that whoever triggered it held no role.
  change.caller = event.transaction.from;
  change.save();

  agent.status = to;
  agent.save();

  let status = touchIndexStatus(event);
  status.save();
}

export function handlePaymentDestinationChanged(event: PaymentDestinationChanged): void {
  let agent = loadOrCreateAgent(event.params.agentId, event);

  let change = new DestinationChange(eventId(event));
  change.agent = agent.id;
  change.previousDestination = agent.paymentDestination;
  change.destination = event.params.destination;
  change.status = statusName(event.params.status);
  change.blockNumber = event.block.number;
  change.blockTimestamp = event.block.timestamp;
  change.txHash = event.transaction.hash;
  change.save();

  agent.paymentDestination = event.params.destination;
  agent.save();

  let status = touchIndexStatus(event);
  status.save();
}
