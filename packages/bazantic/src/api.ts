export interface EstateStatus {
  onchainStatus: "Alive" | "UnderAdministration" | "Liquidated";
  ensStatusText: string | null;
}

export async function getStatus(_address: `0x${string}`): Promise<EstateStatus> {
  // TODO: read Receiver.status() + EnsAdapter.statusOf() and merge.
  throw new Error("getStatus: not implemented");
}

export async function getClaims(_address: `0x${string}`): Promise<unknown[]> {
  // TODO: query packages/subgraph for this estate's registered claims.
  throw new Error("getClaims: not implemented");
}

export async function getPlan(_address: `0x${string}`): Promise<unknown | null> {
  // TODO: read Estate.approvedPlanHash() and resolve it against the
  // trustee's last proposed WaterfallPlan (kept off-chain, hash on-chain).
  throw new Error("getPlan: not implemented");
}
