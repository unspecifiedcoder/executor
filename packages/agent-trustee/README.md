# agent-trustee

The Executor agent: takes over once `declareAdministration()` fires,
discovers creditors, proposes a payout waterfall, and executes it once
approved.

- `discover.ts` — queries the Subgraph MCP server (backed by
  `packages/subgraph`) plus the Agent0 subgraph to build the creditor list.
- `plan.ts` — turns discovered claims into a waterfall proposal and its
  `planHash`, matching `Estate.sol`'s `PriorityClass` ordering.
- `approve-ledger.ts` — routes the plan through the Key Ring CLI approval
  flow before it's submitted as `Estate.approvePlan()`.

**What to show the judge:** `discover.ts` pulling real creditor rows from
the subgraph, then `plan.ts`'s waterfall output matching what
`Estate.executePlan()` actually pays out on-chain.
