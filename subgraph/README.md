# Executor subgraph

Indexes `ExecutorRegistry` on Sepolia and, through a dynamic data source
template, every `Estate` any agent has ever pointed at.

**Live:** `https://api.studio.thegraph.com/query/1760047/executor/v0.1.2`

## Why this exists

The dashboard used to read agent history with chunked `eth_getLogs`. That is not
a stylistic complaint - `apps/dashboard/lib/ens.ts` carries the comment
`publicnode caps eth_getLogs at 50,000 blocks per request`, and the code pages
backwards from the head in 50k-block windows to work around it. It degrades as
the chain grows, it costs one round trip per window, and an earlier version of
it silently rendered an empty history once the deploy block fell out of range -
the worst possible failure for a panel labelled `live`.

Two things this index does that no `eth_call` can:

- **Heartbeat gaps.** `Heartbeat.gapFromPrevious` is computed at index time,
  which is the unit the protocol's own deadline is expressed in. Answering it
  from RPC means fetching the whole series and diffing it.

  This is **observability, not proof of liveness.** A steady cadence is trivial
  to manufacture - anyone holding the signer key can beat on a timer, and no
  index can tell that apart from an agent that genuinely ran. What this gives is
  what the cadence *was* and where it broke. Reading it as authenticity would be
  claiming a security property the design does not have.
- **Who called a transition.** `StatusChange.caller` is `transaction.from`,
  which is not in the event at all. It matters because `enterAdministration` is
  permissionless: the interesting fact is usually that the caller held no role.

## The one distinction worth reading the schema for

`Agent.estate` is whatever address the plan names. `Agent.estateIsContract` is
set only when that address has actually emitted an Estate event. The registry
lets an agent name an EOA, and one of ours does - so "this agent has an estate"
and "this agent has an estate that can run a waterfall" are different claims,
and only the second is provable here. Conflating them is how a demo ends up
claiming a waterfall it never ran.

## Query it

```graphql
{
  agent(id: "0x96abf3c7f8f72fdf248e91137fb471a442dccf3fcece378b2065616cb68c36d4") {
    status
    heartbeatCount
    claims(orderBy: priorityClass) { creditor priorityClass allowedAmount amountPaid }
    executions { totalPaid shortfall }
    statusChanges(orderBy: blockNumber) { from to caller }
  }
}
```

That returns the whole lifecycle - 18 heartbeats, the flip, secured paid 200000
of 250000 allowed while administrative and unsecured got nothing, shortfall
650000 - in one request.

## Develop

```bash
npm install
npx graph codegen && npx graph build
npx graph auth <deploy key from thegraph.com/studio>
npx graph deploy executor
```
