# Executor — project brief

A complete handoff for anyone (human or AI) picking this up cold. Written to be
pasted whole. Nothing here is aspirational unless it says so.

---

## 1. The idea in one paragraph

An autonomous agent that earns money also owes money — an inference bill, a
compute provider, whoever it buys from. When the agent dies, nothing stops. Its
revenue keeps arriving at a wallet nobody operates, and its creditors have no
recourse, because there is no standard resolution process for an autonomous
software agent acting as an economic entity. Executor gives an
agent a **resolution plan it commits to before it fails**, and makes that plan
the thing payments actually consult. When the heartbeat stops, the payment
destination flips on-chain, and creditors are paid out of an estate by priority
class.

**The one-sentence primitive:** *the destination of a payment is late-bound to
the payee's on-chain liveness.* Same endpoint, same client, same price — the
money goes somewhere else because the agent's state changed.

---

## 2. What actually exists (all verifiable)

### Contracts — Solidity, Foundry, deployed to Sepolia

**`ExecutorRegistry`** — `0x2946B46c2EB5Ec532093877223Ef043b13729e39`
The state machine and the single source of truth.

- `Status`: `Active → Administration → Liquidation → Resolved`
- `registerAgent(...)` — stores a plan: heartbeat signer, trustee, recovery
  authority, treasury, estate, heartbeat interval, grace period
- `heartbeat(agentId)` — heartbeat-signer only; pushes the deadline out
- `enterAdministration(agentId)` — **permissionless**. The contract checks the
  deadline, not the caller. This is deliberate: nothing should depend on a
  trustworthy party being awake
- `restoreActive(agentId)` — recovery-authority only. A missed heartbeat is not
  insolvency
- `enterLiquidation(agentId)` — trustee only. Terminal; `restoreActive` no
  longer works from here
- `resolve(agentId)` — trustee only, from Liquidation. Terminal wind-up
- `updatePlan(...)` — owner only, and **reverts `PlanIsLocked` once locked**
- `lockPlan(agentId)` — one-way. This is what makes the plan a pre-commitment
- **`getPaymentDestination(agentId)`** — the primitive everything reads.
  Treasury while Active, estate otherwise

**`Estate`** — e.g. `0x83f447FAb4E1267Ca5fd6Ebe151a93b462EFfC7F`
Holds real Circle USDC and pays creditors.

- Claims are **trustee-curated** — a contract cannot adjudicate whether a debt
  is real, so it doesn't pretend to
- `approvedPlanHash` commits to the exact claim set (ids, creditors, amounts,
  classes) and is re-derived at execution; any drift reverts
- `executePlan` pays **strictly by priority class** (Secured → Administrative →
  Unsecured), **pro-rata within** an underfunded class, with truncation
  remainder handed out unit-by-unit so no dust is stranded
- **Gated on Liquidation/Resolved.** Creditors must not be paid while the agent
  might still recover — this is the most important line in the project
- Failed transfers (real USDC has a blocklist) **escrow to `withdrawable`** for
  the creditor to pull, rather than reverting the whole distribution. One
  blacklisted address cannot freeze everyone else's money
- Distribution is a **repeatable round** — late funds distribute on the same
  terms without double-paying
- `_tryTransfer` verifies by **balance delta**, so a token that returns `true`
  without moving funds cannot mark claims settled

**`ExecutorResolver`** — an ENS resolver that **derives `addr()` from
`ExecutorRegistry` at call time** rather than storing a copy, so the ENS record
structurally cannot go stale.

### Payment rail — x402 v2 on Hedera testnet

`packages/agent-debtor/src/gateway.ts`, hosted at
`https://executor-gateway.vercel.app/research`.

Express + `@x402/core` / `@x402/express` / `@x402/hedera`, settled through the
**Blocky402** facilitator. The interesting part is `DynamicPayTo`: `payTo` is
not configured — it is resolved **per request**, through ENS, from live Sepolia
state, then mapped to a Hedera account via the mirror node. A mismatch between
ENS and the registry is a **hard refusal to quote a price**, never a fallback.

### Identity — ENSv2 on Sepolia

`executor-hackathon-demo.eth`. The operator irreversibly burned
`ROLE_SET_RESOLVER_ADMIN` while keeping `ROLE_SET_RESOLVER` — a genuine one-way
narrowing of its own authority. The name is now **in the payment path**, not
decorative.

### Dashboard — Next.js 14 + viem

`https://executor-dashboard.vercel.app`. No mock data anywhere; every value is a
live chain read, and an RPC failure renders as an error rather than an empty
state, because a panel labelled "live" must be able to tell those apart.

---

## 3. Design decisions that look odd until explained

- **`enterAdministration` is permissionless.** Not an oversight. A dead-man's
  switch that needs a trusted party to fire it isn't one.
- **Administration is recoverable; Liquidation is terminal.** They share a
  payment destination but differ in what they permit — that's the distinction,
  not the address.
- **The trustee is human.** Deliberate. What *is* enforced on-chain: plan-hash
  drift, priority ordering, true remaining balances, and the liquidation gate.
- **Two settlement rails.** x402 revenue settles on Hedera; creditor claims
  settle in USDC on Sepolia. The registry's `estate` field is the payment
  destination for the rail; the `Estate` *contract* is the claims venue. They
  are not the same address, and that is intentional.
- **`lockPlan` is one-way with no unlock.** A plan you can quietly amend after
  creditors have relied on it is not a pre-commitment.

---

## 4. What is NOT built — state this plainly, never paper over it

- **A human trustee curates claims.** Unfixable on-chain and not a gap we
  pretend to close.
- **The ENS succession lock is not permanent** — the name expires 2027-09-08 and
  re-registration issues a fresh role bitmap.
- **Withdrawn entirely:** Circle/Arc, Chainlink CRE, The Graph, Uniswap, World,
  Ledger, Privy, Bazantic. Each was scoped, none was built, all claims were
  pulled. Filing on a stub is an eligibility risk, not a long shot.

---

## 5. How this was built, and the standard it's held to

The project was developed against a **deliberately adversarial reviewer** — an
agent instructed to reject as much as possible, wearing five judge hats at once.
It ran four rounds and found something real every time, including six
exploitable bugs in the `Estate` contract, four of which it proved with working
exploits.

That process is the reason for the codebase's defining rule:

> **Never close a gap by claiming something isn't there. If it isn't built,
> delete the claim — don't dress it up.**

Concretely, this meant: withdrawing the Arc track rather than filing on stubs;
correcting docs in *both* directions when a deploy made them false; labelling
proof transactions that belong to a previous deployment; and shipping a README
that lists what does *not* work. The reviewer's own verdict was *"the most
honestly-scoped repo I've reviewed."* That is a deliberate asset, not modesty —
protect it.

**Scores across rounds** (on a compressed, hostile scale — not comparable to a
real judge): main 44 → 56 → 63 → 65; Hedera 61 → 64 → 58 → 65; x402 63 → 66 →
67 → 70; ENS 52 → 55 → 60 → 58.

---

## 6. Where it's going — the end state

Ordered by how much each closes the gap between "a demo" and "a system".

1. **An agent that visibly lives and then dies.** Continuous real heartbeats
   over hours, so the on-chain history reads as a life, not a scripted sequence.
   Currently the weakest part of the story.
2. **One agent that demonstrates the whole loop** — a payment routed *through*
   `getPaymentDestination` into an Estate that then pays creditors, all on one
   agent. Today the rail and the waterfall are proven on different agents.
3. **A real service behind the paywall.** Currently an LLM call; the honest end
   state is something an agent would genuinely buy on a schedule, which is what
   makes the revenue — and therefore the insolvency — real.
4. **Multi-asset estates.** One ERC-20 today. Real estates hold several assets
   and need valuation before a waterfall means anything.
5. **Cross-chain settlement.** Revenue arrives on Hedera; claims settle on
   Sepolia. Bridging that (CCTP was the original plan) is the missing plumbing.
6. **Creditor-facing UX.** Today a creditor needs `cast`. They should be able to
   see their claim, its class, and pull an escrowed payout from a page.

**The north star:** an agent operator registers a plan and locks it; the agent
runs and earns for months; when it dies, revenue reroutes with no human
involved, creditors are paid in priority order out of what actually exists, and
the whole thing is auditable by anyone with an RPC URL. Executor is the part
that decides *where the money goes and who gets it* — deliberately not an
agent framework, a wallet, or a payment protocol.

---

## 7. Live endpoints and addresses

| | |
|---|---|
| Dashboard | https://executor-dashboard.vercel.app |
| x402 gateway | https://executor-gateway.vercel.app/research |
| Repo | https://github.com/unspecifiedcoder/executor |
| ExecutorRegistry (Sepolia) | `0x2946B46c2EB5Ec532093877223Ef043b13729e39` |
| Estate w/ settled waterfall | `0x83f447FAb4E1267Ca5fd6Ebe151a93b462EFfC7F` |
| Circle USDC (Sepolia) | `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238` |
| ENS name | `executor-hackathon-demo.eth` (ENSv2, Sepolia) |
| Hedera treasury / estate | `0.0.10423643` / `0.0.10423647` |
| Facilitator | Blocky402 — `https://api.testnet.blocky402.com` |

Stack: Solidity/Foundry · Next.js 14 · viem · x402 v2 · Hedera SDK · pnpm
workspaces. Tests: Foundry (contracts) + `tsc`/`next build` in CI.
