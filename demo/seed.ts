/**
 * Registers atlas.acme.eth (or DEMO_ENS_ROOT), funds the demo wallets,
 * and creates 3 creditors with pre-built evidence, so `run-e2e.ts` starts
 * from a known state instead of a fresh empty deployment.
 */
export interface SeedResult {
  ensName: string;
  agentAddress: `0x${string}`;
  creditorAddresses: [`0x${string}`, `0x${string}`, `0x${string}`];
}

export async function seed(): Promise<SeedResult> {
  // TODO:
  // 1. Register the demo subname on ENSv2 Sepolia (or reuse if it exists).
  // 2. Fund agent + 3 creditor wallets with Sepolia/Arc testnet ETH/USDC.
  // 3. Have each creditor make one paid request to agent-debtor, so there's
  //    real evidence for the trustee to discover post-liquidation.
  throw new Error("seed: not implemented");
}
