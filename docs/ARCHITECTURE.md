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

There is no second chain holding funds and no cross-chain messaging. The
registry is the only contract this project deployed.

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
  so it is not time-triggered. **Nothing downstream consumes this status** —
  the gateway treats Liquidation and Administration identically.
- `lockPlan(agentId)` — the owner only. Sets a flag; see below.

## Two things that are weaker than they look

**`planLocked` does not enforce anything.** No plan field has a setter, and
`registerAgent` reverts on a duplicate id, so every field except `lastHeartbeat`
and `status` is already immutable from registration. The flag is a published
declaration that the owner has finished configuring, not a freeze.
`test_lockPlan_doesNotChangeBehavior` asserts the behavior is identical either
way.

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

**None of it was built.** `Receiver.sol` and `Estate.sol` compile and have unit
tests but were never deployed. `packages/cre-workflow`, `packages/subgraph`,
`packages/sweep`, `packages/bazantic`, `packages/agent-trustee` and
`packages/optional/*` are stubs. `contracts/src/adapters/EnsAdapter.sol` targets
an ENSv2 interface (`authorizeAddrRoles`, `revokeAdminRole`) that does not exist
in ENSv2 at all.

The description above is recorded as history, not as a roadmap or a claim.
