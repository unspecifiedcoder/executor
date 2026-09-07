export interface ClaimTokenParams {
  claimId: `0x${string}`;
  creditor: string; // Hedera account ID
  claimedAmount: bigint;
}

/**
 * Day 6 stretch. Mints a Hedera ATS token representing a filed claim, so
 * creditors can trade their claim position while liquidation is pending
 * instead of waiting on the full waterfall payout.
 */
export async function mintClaimToken(_params: ClaimTokenParams): Promise<string> {
  // TODO: use HEDERA_ATS_TOKEN_ID and the Hedera SDK to mint a token unit
  // representing this claim, tagged with claimId as metadata.
  throw new Error("mintClaimToken: not implemented");
}
