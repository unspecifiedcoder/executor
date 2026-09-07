import { keccak256, encodePacked } from "viem";
import type { CreditorRecord } from "./discover.js";

export enum PriorityClass {
  Secured = 0,
  Administrative = 1,
  Unsecured = 2,
}

export interface WaterfallEntry extends CreditorRecord {
  class: PriorityClass;
  allowedAmount: bigint;
}

export interface WaterfallPlan {
  entries: WaterfallEntry[];
  planHash: `0x${string}`;
}

/**
 * Builds a payout waterfall from discovered creditors + the CRE workflow's
 * verified `allowedAmount`/class per claim. Ordering here must match
 * Estate.sol's PriorityClass enum exactly - the planHash is what
 * `Estate.approvePlan` / `executePlan` check against.
 */
export function buildWaterfallPlan(entries: WaterfallEntry[]): WaterfallPlan {
  const sorted = [...entries].sort((a, b) => a.class - b.class);
  const perEntry = sorted.map((e) =>
    encodePacked(["address", "uint256", "uint8"], [e.creditor, e.allowedAmount, e.class]),
  );
  const planHash = keccak256(encodePacked(perEntry.map(() => "bytes"), perEntry));
  return { entries: sorted, planHash };
}
