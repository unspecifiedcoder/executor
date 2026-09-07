export interface SweepConfig {
  agentAddress: `0x${string}`;
  estateAddress: `0x${string}`;
  amount: bigint;
  sourceDomain: number; // CCTP domain for Sepolia
  destDomain: number; // CCTP domain for Arc
}

export interface SweepResult {
  burnTxHash: `0x${string}`;
  mintTxHash: `0x${string}`;
}

/**
 * Pulls the agent's standing USDC approval (granted during RegisterAgent),
 * burns it on Sepolia via CCTP v2, and mints into `Estate` on Arc.
 */
export async function sweepToEstate(_config: SweepConfig): Promise<SweepResult> {
  // TODO: call CCTP v2's TokenMessenger.depositForBurn on Sepolia using the
  // agent's standing approval, then poll Circle's attestation API and call
  // MessageTransmitter.receiveMessage on Arc to mint into Estate.
  throw new Error("sweepToEstate: not implemented");
}
