export interface NonUsdcAsset {
  token: `0x${string}`;
  amount: bigint;
}

/**
 * Day 6 stretch. If the estate holds non-USDC assets, sell them into USDC
 * before the waterfall runs, so Estate.executePlan only ever pays out in
 * one denomination.
 */
export async function liquidateAsset(_asset: NonUsdcAsset): Promise<`0x${string}`> {
  // TODO: quote + execute via the Uniswap API (or CoW Protocol for MEV
  // protection on a larger sell), return the resulting swap tx hash.
  throw new Error("liquidateAsset: not implemented");
}
