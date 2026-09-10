import { Bytes, BigInt, ethereum } from "@graphprotocol/graph-ts";
import { Agent, IndexStatus } from "../generated/schema";

/** The registry's Status enum, in declaration order. Kept as one function so a
 * new status cannot be added to the contract and silently index as "Unknown"
 * in three different files. */
export function statusName(status: i32): string {
  if (status == 0) return "Active";
  if (status == 1) return "Administration";
  if (status == 2) return "Liquidation";
  if (status == 3) return "Resolved";
  return "Unknown";
}

/** Estate.PriorityClass, in the order the waterfall pays them. */
export function priorityClassName(class_: i32): string {
  if (class_ == 0) return "Secured";
  if (class_ == 1) return "Administrative";
  if (class_ == 2) return "Unsecured";
  return "Unknown";
}

/** A log is unique by (txHash, logIndex). Concatenating the agent id instead
 * would collide whenever one transaction touches the same agent twice, which
 * executePlan does routinely. */
export function eventId(event: ethereum.Event): Bytes {
  return event.transaction.hash.concatI32(event.logIndex.toI32());
}

export function loadIndexStatus(): IndexStatus {
  let id = Bytes.fromUTF8("global");
  let status = IndexStatus.load(id);
  if (status == null) {
    status = new IndexStatus(id);
    status.agentCount = 0;
    status.heartbeatCount = 0;
    status.lastBlock = BigInt.zero();
    status.lastBlockTimestamp = BigInt.zero();
  }
  return status as IndexStatus;
}

export function touchIndexStatus(event: ethereum.Event): IndexStatus {
  let status = loadIndexStatus();
  status.lastBlock = event.block.number;
  status.lastBlockTimestamp = event.block.timestamp;
  return status;
}

/** Every handler except AgentRegistered has to cope with an agent it has never
 * seen. That is not defensive noise: `startBlock` can be moved forward, and a
 * partial index that drops heartbeats on the floor because registration fell
 * outside its range is worse than one that admits the gap. */
export function loadOrCreateAgent(id: Bytes, event: ethereum.Event): Agent {
  let agent = Agent.load(id);
  if (agent != null) return agent as Agent;

  agent = new Agent(id);
  agent.treasury = Bytes.empty();
  agent.estate = Bytes.empty();
  agent.status = "Active";
  agent.paymentDestination = Bytes.empty();
  agent.planLocked = false;
  agent.registeredAt = event.block.timestamp;
  agent.registeredAtBlock = event.block.number;
  agent.heartbeatCount = 0;
  agent.estateIsContract = false;

  let status = touchIndexStatus(event);
  status.agentCount = status.agentCount + 1;
  status.save();

  return agent as Agent;
}
