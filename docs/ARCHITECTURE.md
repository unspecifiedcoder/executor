# Architecture

What is deployed and running. For the parts that were designed but never
built, see "The superseded design" at the bottom — kept because
`ExecutorRegistry.sol`'s header refers to it.

## The flow

```
                                  ┌──────────────────────────────────┐
                                  │  ExecutorRegistry (Sepolia)      │
  heartbeatSigner ──heartbeat()──►│  0x99AB…2521                     │
                                  │                                  │
  anyone ──enterAdministration()─►│  Active ──► Administration ──► Liquidation
       (only after the deadline)  │     ▲            │                 │
                                  │     └─restoreActive()             │
  recoveryAuthority ─────────────►│       (recoveryAuthority only)     │
                                  │                                  │
  trustee ──enterLiquidation()───►│  getPaymentDestination(agentId)   │
                                  └───────────────┬──────────────────┘
                                                  │  read on every request
                                                  ▼
                             ┌────────────────────────────────────────┐
   client ──GET /research───►│  x402 gateway (:3200)                  │
          ◄──402 + payTo─────│  packages/agent-debtor/src/gateway.ts  │
          ──X-PAYMENT───────►│  payTo = DynamicPayTo callback         │
                             └───────────────┬────────────────────────┘
                                             │ EVM addr ─► Hedera account
                                             ▼  (mirror node REST)
                                   Hedera testnet, native HBAR
                                   treasury 0.0.10423643
                                   estate   0.0.10423647
```

The dashboard (`apps/dashboard`) reads the same contract over public RPC and
writes to it through two API routes.

## Chain map

| Chain | Thing | Responsibility |
|---|---|---|
| Sepolia | `ExecutorRegistry` `0x99AB…2521` | Liveness clock, status machine, payment-destination resolution |
| Sepolia | ENSv2 `PermissionedRegistry` `0x67b7…4b43` | Identity: `executor-hackathon-demo.eth`, resolver-admin role revoked |
| Hedera testnet | (no contract) | Settlement rail. Payments are native HBAR to plain accounts |
| local anvil only | `Estate` | Creditor claims and the distribution waterfall. **No public deployment** |

There is no second chain holding funds and no cross-chain messaging. The
registry is the only contract this project deployed to a public network — and
the Sepolia address runs an *earlier build* of it than `contracts/src/` holds:
`updatePlan` and `resolve` do not exist on that bytecode, and both selectors
revert with empty data against it. `Estate` exists in source, is covered by 34
unit tests, and runs end to end in `scripts/e2e-local.sh` against a local chain.
It has no address anyone can read.

## Why one contract instead of two

The earlier design split liveness (`Receiver`, Sepolia) from funds (`Estate`,
Arc). Collapsing them removed the only hard problem in the system that had
nothing to do with the idea: keeping a mirror of liveness state in sync across
chains, and answering "was the mirror current when the payment was quoted".

Because the registry lives on Sepolia next to ENSv2 and is read directly by
off-chain services, a payment quote is a function of state read at quote time.
Services on other chains reading Sepolia over RPC is ordinary multi-chain
plumbing, not a trust assumption the contract has to solve.

## Who writes what

- `heartbeat(agentId)` — the `heartbeatSigner` only. Not the owner.
- `enterAdministration(agentId)` — **permissionless**, gated only by
  `block.timestamp >= lastHeartbeat + heartbeatInterval + gracePeriod`. This is
  deliberate: a dead-man's switch that needs a privileged caller to fire has
  the same failure mode as the thing it is protecting against.
- `restoreActive(agentId)` — the named `recoveryAuthority` only. A missed
  heartbeat is unavailability, not insolvency.
- `enterLiquidation(agentId)` — the `trustee` only. Insolvency needs judgment,
  so it is not time-triggered. The x402 gateway does not distinguish it from
  Administration (both route to the estate); the thing that does consume it is
  `Estate.executePlan`, which refuses to distribute in Administration.
- `resolve(agentId)` — the `trustee` only, and only from Liquidation. Terminal.
  Payment destination stays the estate afterwards, because late revenue belongs
  to the estate and there is no treasury operator left.
- `updatePlan(agentId, …)` — the owner only, and only before `lockPlan`.
- `lockPlan(agentId)` — the owner only. Makes `updatePlan` revert; see below.
- `Estate.registerClaim` / `approvePlan` / `sweepSurplus` — the estate's
  `trustee` only. `Estate.executePlan` is permissionless: once the plan is
  approved and the registry says the agent is past recovery, execution is
  mechanical and must not depend on the trustee staying online.
- `Estate.claimPayout()` — the creditor themselves, for a payout the token
  refused to accept at distribution time.

## `planLocked`, and what it actually stops

`ExecutorRegistry.updatePlan` is a real setter for the treasury, the estate, the
trustee, the recovery authority, the heartbeat signer, the interval and the
grace period. It exists because an `Estate` address is not known until it is
deployed, which is after the agent is registered. `lockPlan` is what takes that
power away: afterwards `updatePlan` reverts `PlanIsLocked`, permanently.
`test_lockPlan_makesUpdatePlanRevert` asserts it, and `scripts/e2e-local.sh`
asserts it on-chain against the 4-byte error selector.

One caveat, in the wrong direction: the Sepolia deployment predates
`updatePlan`. On `0x99AB…2521` the flag is set to true with nothing for it to
stop. The enforcement is real in the source and unverifiable at that address.

## Things that are weaker than they look

**The ENS role revocation is bounded.** Revoking the operator's
`ROLE_SET_RESOLVER_ADMIN` means it can no longer grant the resolver role to
anyone, re-grant itself the admin role, or revoke the role from itself — and
neither token ownership nor an ERC-1155 transfer restores it. But:

- It covers the **resolver axis only**. The operator kept
  `ROLE_SET_SUBREGISTRY_ADMIN` and can still delegate subregistry control.
- It lasts **until the name expires** (2027-09-08). After expiry plus grace,
  re-registration bumps the resource version and the new registrant receives a
  full role bitmap, including the admin role. Renewal before expiry preserves
  the revocation; re-registration after it does not.
- A holder of **root-scoped** `ROLE_SET_RESOLVER_ADMIN` could still grant the
  token-level role. That slot has zero assignees on this deployment today,
  which is deployment state rather than a code guarantee.

`contracts/test/LivingWill.t.sol` asserts all of these, including the two
limits, against a mock modelling ENSv2's real `EnhancedAccessControl` rules.

**The estate trusts its trustee to be honest about the claims.** `registerClaim`
is trustee-only and adjudicates nothing: a contract cannot decide whether a debt
is real. What the contract *does* enforce is that the claim set cannot change
after approval — `currentPlanHash()` commits to every claim's id, creditor,
allowed amount and priority class, and `executePlan` re-derives it and reverts
on drift — and that a partly-paid claim reports its true remaining balance. A
dishonest trustee is out of scope; a trustee whose key is stolen between
approval and execution is not.

**The waterfall settles exactly one ERC-20.** Non-USDC estate assets are not
valued or sold first. `packages/optional/liquidation` was reserved for that and
is a stub.

**`Estate.MAX_CLAIMS` is 200.** `executePlan` walks the claim array several
times per priority class, so an unbounded array is a gas-limit brick waiting to
happen. Measured at 9.4M gas for 200 claims across all three classes with a real
transfer each. Bigger estates split across several `Estate` contracts, which the
registry supports by pointing `estate` at whichever one holds the funds.

## The superseded design

The original plan, referenced by `ExecutorRegistry.sol`'s header comment and by
the files still in `contracts/src/` and `packages/`:

> `Receiver` on Sepolia tracks liveness and ENS role custody. `Estate` on Arc
> holds funds, a claims registry, and a payout waterfall. A Chainlink CRE
> workflow verifies creditor claims and checks solvency inside a TEE, and its
> DON-signed report is what unlocks `declareLiquidation()`. A trustee agent
> proposes a distribution plan; `Estate.executePlan()` pays creditors by
> priority class. A subgraph indexes both contracts. CCTP v2 sweeps funds from
> Sepolia to Arc.

**Most of it was not built, and one clause of it was.** Taking them apart:

- **Built, local only.** `Estate.sol`'s claims registry and payout waterfall —
  `registerClaim`, a trustee-approved plan hash covering the exact claim terms,
  `executePlan` paying by priority class with pro-rata splitting inside a class,
  pull-payment escrow for refused transfers, and repeatable rounds for late
  funds. 34 unit tests, plus `scripts/e2e-local.sh` end to end on anvil. Not on
  Arc, not on any testnet, no address to read. The trustee here is an EOA
  calling `approvePlan`, not the agent described above.
- **Not built.** The Chainlink CRE TEE workflow, the DON-signed solvency report,
  the trustee *agent*, the subgraph, and the CCTP v2 sweep.
  `packages/cre-workflow`, `packages/subgraph`, `packages/sweep`,
  `packages/bazantic`, `packages/agent-trustee` and `packages/optional/*` are
  stubs — `console.log`s and `throw new Error("not implemented")`.
- **Superseded.** `Receiver.sol` compiles and has unit tests but was never
  deployed; `ExecutorRegistry.sol` took over its role.
  `contracts/src/adapters/EnsAdapter.sol` targets an ENSv2 interface
  (`authorizeAddrRoles`, `revokeAdminRole`) that does not exist in ENSv2 at all.

The description above is recorded as history, not as a roadmap or a claim.
