# dashboard

The "vital signs" board for the demo. Three panels:

- **Heartbeat** — last `ping()` timestamp from the subgraph, a live
  countdown to `heartbeatInterval`, and a red/green status dot.
- **Name card** — the agent's ENS subname, its `executor:status` text
  record, and its currently-resolved payout address per coin type.
- **Creditor bars** — one bar per registered claim, colored by
  `PriorityClass`, filling in as `Estate.executePlan()` pays each out.

Reads exclusively from `packages/subgraph` and `packages/bazantic` - never
calls a chain RPC directly, so it stays fast during the demo.
