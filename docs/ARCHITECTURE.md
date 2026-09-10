# Architecture

What is deployed and running. For the parts that were designed but never
built, see "The superseded design" at the bottom — kept because
`ExecutorRegistry.sol`'s header refers to it.

## The flow

```
                                  ┌──────────────────────────────────┐
                                  │  ExecutorRegistry (Sepolia)      │
  heartbeatSigner ──heartbeat()──►│  0x2946…9e39                     │
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

The registry's `estate` field feeds that Hedera rail. The *other* rail — USDC
creditor claims — hangs off the same registry but settles on Sepolia:

```
   ExecutorRegistry (Sepolia)  ──getStatus(agentId)──►  Estate (Sepolia)
   0x2946…9e39                                          0x83f4…fC7F
                                                        USDC 0x1c7D…7238
   Liquidation / Resolved  ─────unlocks────────────►    executePlan()
                                                        │
                                                        ▼
                                              creditors, by priority class
```

The dashboard (`apps/dashboard`) reads the same contract over public RPC and
writes to it through two API routes.

## Chain map

| Chain | Thing | Responsibility |
|---|---|---|
| Sepolia | [`ExecutorRegistry` `0x2946…9e39`](https://sepolia.etherscan.io/address/0x2946B46c2EB5Ec532093877223Ef043b13729e39) | Liveness clock, status machine, payment-destination resolution |
| Sepolia | ENSv2 `PermissionedRegistry` `0x67b7…4b43` | Identity **and payment path**: `executor-hackathon-demo.eth`, resolver-admin role revoked |
| Sepolia | [`ExecutorResolver` `0xa5a6…4C5b`](https://sepolia.etherscan.io/address/0xa5a6d10E765B8A07c0662D204d3d3418E1e74C5b) | The name's ENS resolver. Derives `addr()` from `ExecutorRegistry` at call time — no stored address, so no stale record |
| Hedera testnet | (no contract) | Settlement rail. Payments are native HBAR to plain accounts |
| Sepolia | [`Estate` `0x83f4…fC7F`](https://sepolia.etherscan.io/address/0x83f447FAb4E1267Ca5fd6Ebe151a93b462EFfC7F) | Agent 2's estate. Creditor claims, trustee-approved plan hash, USDC distribution waterfall — **has run, twice** |
| Sepolia | [`Estate` `0xD67a…286f`](https://sepolia.etherscan.io/address/0xD67a10D5466d311C2f995744937c7b9e1734286f) | The demo agent's estate. Same contract, pre-`ZeroCreditor`-fix build; never funded, never used |
| Sepolia | Circle USDC `0x1c7D…7238` | The single ERC-20 the waterfall settles. `symbol()` `"USDC"`, `decimals()` `6` |

There is no cross-chain messaging. Both contracts sit on Sepolia and the
deployed registry bytecode is the same build `contracts/src/` holds —
`updatePlan` and `resolve` included, and both demonstrated on-chain (see
README). Off-chain services on other chains read Sepolia over RPC.

**Two rails, one failure.** Note that the plan's `estate` *field* holds
`0xDE3207F493fE4600DeEc424e0875ec943d712337`, which is not the `Estate`
contract. That address has no code on Sepolia — it is the EVM form of the
Hedera account `0.0.10423647`, and it is where x402 revenue is redirected when
the agent fails. The `Estate` contract is the separate, Sepolia-side rail that
pays USDC creditor claims, and it finds the agent's status by calling
`getStatus` on the registry rather than by being pointed at from it. Same
failure event, two destinations, two asset types. (This split is a property of
how the *demo* agent's plan was written, not of the protocol: agent 2's plan
points its `estate` field straight at its `Estate` contract, so both the
payment-destination flip and the waterfall land on the same address.) Nothing
automatically moves value from the Hedera rail into the `Estate` contract — a
trustee would have to bridge it, and that bridge is not implemented.

What the `Estate` deployments do and do not prove: `0x83f4…fC7F` has held real
Circle USDC, taken four trustee-registered claims across three priority
classes, and run `executePlan` twice — once while insolvent by 0.9 USDC, and
once *while the agent was already `Resolved`*. That second round was funded by
a fresh deposit, not by `resolve()`, which moves no money; what it demonstrates
is that the terminal state does not brick the estate, which is the property
that matters given `Resolved` is one-way and unordered with respect to
`executePlan`. `0xD67a…286f` has done
none of that and never will; it predates the `ZeroCreditor` fix. Everything
neither deployment exercised — the pull-payment escrow branch, the 200-claim
ceiling, reentrancy — is covered by 40 unit tests and by
`scripts/e2e-local.sh` end to end on anvil against a real ERC-20.

## Why one contract instead of two

The earlier design split liveness (`Receiver`, Sepolia) from funds (`Estate`,
Arc). Collapsing them removed the only hard problem in the system that had
nothing to do with the idea: keeping a mirror of liveness state in sync across
chains, and answering "was the mirror current when the payment was quoted".

Because the registry lives on Sepolia next to ENSv2, the ENS resolver can read
it in the same call — `ExecutorResolver.addr()` *is* a registry read, wrapped in
the ENS interface — so a payment quote is a function of state read at quote
time, with no mirror to keep in sync and no window in which the name and the
registry disagree.
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

This is verifiable on the live deployment, not only in tests. On
`0x2946…9e39` the demo plan was registered with a placeholder estate, amended
by `updatePlan`
([`0xa6e85bec…`](https://sepolia.etherscan.io/tx/0xa6e85bec3c4334659cb2b84aab274b48e9e75026a4947e3cee5ee2020eb6953c)),
then locked
([`0xff0d4257…`](https://sepolia.etherscan.io/tx/0xff0d42572a2565280a8a8500840c7d3f80f81085d4e02cbf735c7cde83f414c0)).
An `eth_call` of that same `updatePlan` from the owner now returns
`0x96cb9f37` — `PlanIsLocked()`. The exact copy-pasteable command is in the
README.

What `lockPlan` does not freeze: the status machine. `enterAdministration`,
`restoreActive`, `enterLiquidation` and `resolve` all still work on a locked
plan. The lock covers the plan's parties and timing, which is the part
creditors need pre-committed.

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
valued or sold first, and there is no code for it. The stub directory that used
to stand in for it has been deleted rather than left looking like a plan.

**`Estate.MAX_CLAIMS` is 200.** `executePlan` walks the claim array several
times per priority class, so an unbounded array is a gas-limit brick waiting to
happen. Measured at 12.2M gas for 200 claims across all three classes with a
real transfer each, against a 30M block. (9.4M before `_tryTransfer` began
verifying that the balance actually moved; two extra `balanceOf` reads per
payout is what that safety costs.) Bigger estates split across several `Estate` contracts, which the
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

- **Built, deployed, and run.** `Estate.sol`'s claims registry and payout
  waterfall — `registerClaim`, a trustee-approved plan hash covering the exact
  claim terms, `executePlan` paying by priority class with pro-rata splitting
  inside a class, pull-payment escrow for refused transfers, and repeatable
  rounds for late funds. 40 unit tests, plus `scripts/e2e-local.sh` end to end
  on anvil, plus a live Sepolia deployment at `0x83f447FAb4E1267Ca5fd6Ebe151a93b462EFfC7F`
  bound to Circle USDC that has settled an insolvent estate across two
  distribution rounds — see the README. Not on Arc. The trustee here is an EOA
  calling `approvePlan`, not the agent described above.
- **Not built.** The Chainlink CRE TEE workflow, the DON-signed solvency report,
  the trustee *agent*, the subgraph, and the CCTP v2 sweep. The directories that
  used to hold stubs for them — `packages/cre-workflow`, `packages/subgraph`,
  `packages/sweep`, `packages/bazantic`, `packages/agent-trustee`,
  `packages/agent-client`, `packages/shared` and `packages/optional/*` — have
  been deleted. They contained `console.log`s and
  `throw new Error("not implemented")`, and a reader had to open them to find
  that out. Git history keeps them.
- **Superseded.** `Receiver.sol` compiles and has unit tests but was never
  deployed; `ExecutorRegistry.sol` took over its role.
  `contracts/src/adapters/EnsAdapter.sol` targets an ENSv2 interface
  (`authorizeAddrRoles`, `revokeAdminRole`) that does not exist in ENSv2 at all;
  `ExecutorResolver.sol` is what the payment path actually uses.

The description above is recorded as history, not as a roadmap or a claim.
