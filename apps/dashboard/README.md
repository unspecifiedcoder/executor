# dashboard

A Next.js app that reads `ExecutorRegistry` on Sepolia over a public RPC. No
subgraph, no indexer, no API layer between the page and the chain — every
number on it is an `eth_call` or an `eth_getLogs` made when the page renders.
Browsing it needs no keys.

## Routes

| Route | What it does |
|---|---|
| `/` | The landing page. Live `getStatus` / `getPaymentDestination` / `plans` for the demo agent, its event timeline, and the ENSv2 succession-lock row — that last one is a live `hasRoles` call for `ROLE_SET_RESOLVER_ADMIN`, not a constant. Each read renders its own "read failed" state instead of taking the page down. |
| `/vitals` | The vital-signs board, and the one to demo: status, a real countdown to `lastHeartbeat + heartbeatInterval + gracePeriod`, the current payment destination, and a history panel built from the registry's `StatusChanged` / `Heartbeat` / `PaymentDestinationChanged` logs. It can drive the flip and the restore through the two write routes below. |
| `/agent/[agentId]` | The same view for any registered agent id, not just the demo one. |
| `/register` | A form that registers a new agent plan from the visitor's own browser wallet (`window.ethereum`), then locks it. Nothing server-side signs here. |

## The two write routes

`app/api/actions/enter-administration` and `app/api/actions/restore-active`
sign and broadcast against the demo agent. They need a funded Sepolia key in
`apps/dashboard/.env.local` as `OPERATOR_PRIVATE_KEY` — see `.env.example` in
the repo root. Everything else is read-only.

`enterAdministration` is permissionless on the contract, so that route is not
granting authority the caller would not otherwise have; it is paying the gas.
`restoreActive` is not permissionless, and the route works only because the
demo agent's `recoveryAuthority` happens to be the operator key.

## Running it

```bash
pnpm -C apps/dashboard dev        # :3000
pnpm -C apps/dashboard exec tsc --noEmit
```
