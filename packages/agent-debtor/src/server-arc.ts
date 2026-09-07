/**
 * The same paid service as server-hedera.ts, listed on Circle's Agent
 * Marketplace (Nanopayments) so it's payable from Arc as well. Shares the
 * ENS-resolved payout logic from server-hedera.ts rather than duplicating it.
 */
import { resolveCurrentPayTo, type ServerConfig } from "./server-hedera.js";

export async function startArcListing(config: ServerConfig): Promise<void> {
  const payTo = await resolveCurrentPayTo(config);
  // TODO: register the listing with Circle's Agent Marketplace SDK using
  // `payTo`, and mount the same handler server-hedera.ts exposes.
  console.log(`[agent-debtor:arc] would list on Circle Agent Marketplace, payTo=${payTo}`);
}
