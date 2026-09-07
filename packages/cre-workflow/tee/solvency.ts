export interface EstateBooks {
  usdcBalance: bigint;
  totalAllowedClaims: bigint;
}

/**
 * Runs inside the CRE TEE. Compares the estate's on-chain balance against
 * the sum of allowed claims from `verifyClaims`. The boolean output (not
 * the underlying balances/claim breakdown) is what ends up in the
 * DON-signed report `Receiver.declareLiquidation()` consumes.
 */
export function checkInsolvent(books: EstateBooks): boolean {
  return books.usdcBalance < books.totalAllowedClaims;
}
