# agent-debtor

The agent that will "die" during the demo. Sells two paid services while
alive, and heartbeats liveness to `Receiver` the whole time.

- `server-hedera.ts` — x402-gated service, fronted by Blocky402. `payTo` is
  resolved from the agent's ENS record per request via `@executor/shared`'s
  `resolvePayoutAddress`, not hardcoded.
- `server-arc.ts` — the same service, also listed on Circle's Agent
  Marketplace (Nanopayments) so it's payable from Arc.
- `heartbeat.ts` — signs and sends `ping()` to `Receiver` on an interval.
- `kill.ts` — the demo switch: stops the heartbeat and both servers.

**What to show the judge:** `heartbeat.ts` running, then `pnpm kill`, then
the dashboard's heartbeat indicator going stale after `HEARTBEAT_INTERVAL`.
