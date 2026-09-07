export interface SelfieVerificationResult {
  verified: boolean;
  worldIdNullifier: string;
}

/**
 * Day 6 stretch. Gates claim filing on a World Selfie Check, so one
 * creditor can't file duplicate claims under multiple addresses. See
 * docs/WORLD_FEEDBACK.md for the required write-up on this integration.
 */
export async function verifyClaimant(_proof: unknown): Promise<SelfieVerificationResult> {
  // TODO: verify the World ID selfie proof, extract the nullifier, and
  // reject claim filing if that nullifier has already filed against this
  // estate.
  throw new Error("verifyClaimant: not implemented");
}
