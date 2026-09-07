import {
  Heartbeat as HeartbeatEvent,
  AdministrationDeclared,
  LiquidationDeclared,
  SuccessorAssigned,
} from "../generated/Receiver/Receiver";
import { Heartbeat, AdministrationEvent, LiquidationEvent, Succession } from "../generated/schema";

export function handleHeartbeat(event: HeartbeatEvent): void {
  const entity = new Heartbeat(event.transaction.hash);
  entity.timestamp = event.params.timestamp;
  entity.save();
}

export function handleAdministrationDeclared(event: AdministrationDeclared): void {
  const entity = new AdministrationEvent(event.transaction.hash);
  entity.timestamp = event.params.timestamp;
  entity.save();
}

export function handleLiquidationDeclared(event: LiquidationDeclared): void {
  const entity = new LiquidationEvent(event.transaction.hash);
  entity.reportHash = event.params.reportHash;
  entity.timestamp = event.params.timestamp;
  entity.save();
}

export function handleSuccessorAssigned(event: SuccessorAssigned): void {
  const entity = new Succession(event.transaction.hash);
  entity.previous = event.params.previous;
  entity.successor = event.params.successor;
  entity.save();
}
