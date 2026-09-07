export interface PaymentRequest {
  agentEnsName: string;
  amount: bigint;
  chain: "hederaTestnet" | "arcTestnet";
}

export interface ClaimEvidence {
  paymentTxHash: `0x${string}`;
  amount: bigint;
  reason: string;
}

/** Pay agent-debtor for a service call, via x402 (Hedera) or Nanopayments (Arc). */
export async function payForService(_request: PaymentRequest): Promise<`0x${string}`> {
  // TODO: dispatch to @x402/hedera or the Circle Agent Stack kit's
  // Nanopayments client depending on `request.chain`.
  throw new Error("payForService: not implemented");
}

/** Package up evidence of an unfulfilled payment for the trustee's claims process. */
export function buildClaimEvidence(request: PaymentRequest, txHash: `0x${string}`): ClaimEvidence {
  return { paymentTxHash: txHash, amount: request.amount, reason: "service not delivered" };
}
