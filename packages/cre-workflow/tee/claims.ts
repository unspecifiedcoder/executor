export enum PriorityClass {
  Secured = 0,
  Administrative = 1,
  Unsecured = 2,
}

export interface RawClaimEvidence {
  creditor: `0x${string}`;
  paymentTxHash: `0x${string}`;
  claimedAmount: bigint;
  supportingDocsUri?: string;
}

export interface VerifiedClaim {
  creditor: `0x${string}`;
  allowedAmount: bigint;
  class: PriorityClass;
}

/**
 * Runs inside the CRE TEE (`handlerInTee`). Cross-checks each claim's
 * payment evidence against on-chain history and any supporting docs,
 * producing the allowed amount and priority class - never the raw
 * evidence itself - as output.
 */
export function verifyClaims(_evidence: RawClaimEvidence[]): VerifiedClaim[] {
  // TODO: verify paymentTxHash actually occurred and matches claimedAmount,
  // classify by claim type (e.g. unfulfilled paid service -> Unsecured),
  // and return only the fields Estate.registerClaim needs.
  throw new Error("verifyClaims: not implemented");
}
