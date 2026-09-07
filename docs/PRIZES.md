# Prize pointers

One section per sponsor track. Each links to the exact code to show a
judge, not just a description.

## ENS

`contracts/src/adapters/EnsAdapter.sol` + `contracts/script/RegisterAgent.s.sol`.
The living-will registration in one script run, and
`contracts/test/LivingWill.t.sol` proving the operator's admin role can't
be regranted after `lockOperator()`.

## Circle (Arc + Agent Marketplace + CCTP)

`packages/agent-debtor/src/server-arc.ts` (Nanopayments listing),
`packages/sweep/src/sweep.ts` (CCTP v2 transfer to `Estate` on Arc),
`contracts/src/Estate.sol` (Arc-native funds custody).

## Hedera

`packages/agent-debtor/src/server-hedera.ts` (x402 via Blocky402),
`packages/optional/ats-claims` (stretch: ATS claim tokens).

## Chainlink CRE

`packages/cre-workflow/` end to end: `tee/claims.ts`, `tee/solvency.ts`,
`workflow.ts`, and `simulation.log` from `just simulate` as the
submission artifact.

## The Graph

`packages/subgraph/` indexing `Receiver` events, consumed by both
`apps/dashboard` and `agent-trustee/src/discover.ts`.

## Uniswap (required feedback)

Used in `packages/optional/liquidation` for non-USDC asset sales before
the waterfall runs. Feedback write-up: `../FEEDBACK.md`.

## World (Selfie Check)

`packages/optional/world-selfie/` gating claim filing. Required write-up:
`WORLD_FEEDBACK.md`.

## Key Ring

`packages/agent-trustee/src/approve-ledger.ts` - the plan approval flow
before `Estate.approvePlan()` is called.

## Bazantic

`packages/bazantic/` - the estate REST API, so judges can inspect estate
state without a wallet.
