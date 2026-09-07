import { verifyClaims, type RawClaimEvidence } from "./tee/claims.js";
import { checkInsolvent, type EstateBooks } from "./tee/solvency.js";

export interface LiquidationReport {
  verifiedClaims: ReturnType<typeof verifyClaims>;
  insolvent: boolean;
  reportBytes: `0x${string}`;
}

/**
 * CRE workflow entrypoint. Registers `verifyClaims` and `checkInsolvent`
 * as `handlerInTee` steps, then packages their output into the report
 * `Receiver.declareLiquidation()` expects, DON-signed.
 */
export async function runLiquidationCheck(
  evidence: RawClaimEvidence[],
  books: EstateBooks,
): Promise<LiquidationReport> {
  // TODO: replace direct calls with CRE's handlerInTee registration once
  // the SDK is wired up - this direct-call version is for local dev/tests.
  const verifiedClaims = verifyClaims(evidence);
  const insolvent = checkInsolvent(books);

  // TODO: encode (verifiedClaims, insolvent) and get it DON-signed via CRE.
  const reportBytes = "0x" as const;

  return { verifiedClaims, insolvent, reportBytes };
}
