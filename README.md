# Executor

A living will for autonomous agents.

Agents transact unattended. When one goes dark — crashes, gets its key
compromised, or is simply retired — nothing today closes out its
obligations. **Executor** is a dead-man's-switch and succession protocol:
an agent registers a living will while healthy, and if it stops proving
liveness, a trustee agent takes over, verifies outstanding claims
confidentially, and pays creditors out of the estate in priority order.

## The two-stage flow

1. **Administration.** The agent (`agent-debtor`) heartbeats a signed
   `ping()` to `Receiver` (Sepolia) on an interval, while selling access to
   two paid services (Hedera x402 via Blocky402, Arc via Circle's Agent
   Marketplace). Miss enough pings and anyone can call
   `declareAdministration()` — the estate is now under caretaker control,
   but nothing has been proven insolvent yet.
2. **Liquidation.** A Chainlink CRE workflow runs claim verification and a
   solvency check inside a TEE (`handlerInTee`), so competing creditors'
   evidence never touches a public mempool. Its signed report unlocks
   `declareLiquidation()`, at which point the trustee agent
   (`agent-trustee`) proposes a payout waterfall, gets it approved, and
   `Estate.executePlan()` moves funds out by priority class.

See `docs/ARCHITECTURE.md` for the full chain map and who writes to what.

## Repo layout

- `contracts/` — Foundry: `Receiver` (Sepolia), `Estate` (Arc), the ENS
  adapter, deploy + registration scripts.
- `packages/shared` — TS types/ABIs shared across agents, ENS resolution
  helpers.
- `packages/agent-debtor` / `agent-client` / `agent-trustee` — the three
  agents in the demo.
- `packages/cre-workflow` — the Chainlink CRE confidential workflow.
- `packages/subgraph` — indexes `Receiver`/`Estate` events for the
  dashboard and the trustee's creditor discovery.
- `packages/sweep` — CCTP v2 script moving standing-approval funds from
  Sepolia to Arc.
- `packages/bazantic` — estate REST API + gateway config.
- `packages/optional/*` — stretch integrations (Hedera ATS claim tokens,
  non-USDC liquidation, World Selfie Check on claim filing).
- `apps/dashboard` — "vital signs" board: heartbeat, ENS name card,
  creditor bars.
- `demo/` — seed script and the scripted end-to-end run.

## Running it

```bash
just install
just deploy-sepolia
just deploy-arc
just register-agent
just dev      # in one terminal
just e2e      # in another
```

## Prizes

Per-sponsor "what to show the judge" pointers live in `docs/PRIZES.md`.
Required write-ups: `FEEDBACK.md` (Uniswap), `docs/WORLD_FEEDBACK.md`
(Selfie Check).
