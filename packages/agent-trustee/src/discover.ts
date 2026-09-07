export interface CreditorRecord {
  creditor: `0x${string}`;
  claimedAmount: bigint;
  evidenceUri: string;
}

/**
 * Pulls the creditor list for `estateAddress` by combining two sources:
 * Receiver/Estate events (via the Subgraph MCP server, indexing
 * packages/subgraph) and the Agent0 subgraph's record of this agent's
 * prior obligations.
 */
export async function discoverCreditors(_estateAddress: `0x${string}`): Promise<CreditorRecord[]> {
  // TODO: query Subgraph MCP for ClaimRegistered-adjacent events, and the
  // Agent0 subgraph for this agent's declared obligations, then merge.
  throw new Error("discoverCreditors: not implemented");
}
