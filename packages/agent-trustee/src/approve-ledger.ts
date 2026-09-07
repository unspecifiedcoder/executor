import type { WaterfallPlan } from "./plan.js";

/**
 * Routes a proposed plan through the Key Ring CLI's approval flow before
 * it's submitted on-chain as `Estate.approvePlan(planHash)`.
 */
export async function approveViaKeyRing(_plan: WaterfallPlan): Promise<`0x${string}`> {
  // TODO: shell out to (or SDK-call) Key Ring CLI, present the plan for
  // human/policy approval, and return the resulting approval signature.
  throw new Error("approveViaKeyRing: not implemented");
}
