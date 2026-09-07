# cre-workflow

Chainlink CRE workflow that runs claims verification and the solvency
check inside a TEE (`handlerInTee`), so competing creditors' evidence
never touches a public mempool before the estate's obligations are
settled.

- `tee/claims.ts` — takes raw creditor evidence, returns
  `(creditor, allowedAmount, class)` per claim.
- `tee/solvency.ts` — takes the estate's books, returns an `insolvent`
  boolean.
- `workflow.ts` — registers both as `handlerInTee` entrypoints and produces
  the DON-signed report that `Receiver.declareLiquidation()` requires.

Run `just simulate` (wraps `simulate.sh`) for a local CRE CLI simulation.
Its output logs are kept alongside this README for hackathon submission,
since a live DON run isn't guaranteed to be reproducible on demand.

**What to show the judge:** the simulation log, and the DON signature
verification succeeding against `Receiver.sol`'s check in
`declareLiquidation()`.
