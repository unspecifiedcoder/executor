# Bazantic recipe: Estate REST API

Exposes read-only estate state (status, creditor list, plan, payout
history) over REST, fronted by the Bazantic gateway so it's callable by
non-crypto-native tooling (e.g. the judge's browser, no wallet needed).

**Endpoints:**
- `GET /estate/:address/status` — current `Receiver.status()` + ENS
  `executor:status` text record.
- `GET /estate/:address/claims` — registered claims from the subgraph.
- `GET /estate/:address/plan` — the approved waterfall plan, if any.

**Gateway config:** see `gateway.config.json` in this package for the
Bazantic routing rules mapping these paths to `src/api.ts`.
