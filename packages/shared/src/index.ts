export * from "./chains.js";
export * from "./ens.js";

// ABIs are generated from Foundry build artifacts, not hand-written:
//   forge build && ./scripts/export-abis.sh
// keeping the source of truth in contracts/out/ and this package's
// generated re-export in sync. Placeholder until that script lands.
export const ABIS_GENERATED = false;
