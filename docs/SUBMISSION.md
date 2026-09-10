# ETHOnline 2026 submission copy

Paste-ready text for the submission form. Every claim here is verifiable — the
addresses and hashes resolve on Sepolia and HashScan, and the two URLs are live.

**Partner prizes to select (3 max):** ENS · Hedera · and one more — see the note
at the bottom.

---

## Short description (one line)

A living will for autonomous agents: when an agent stops heartbeating, its
payment destination flips on-chain, and its creditors get paid out of an estate
instead of a wallet nobody operates.

---

## Project description

An autonomous agent that earns money also owes money — an inference bill, a
compute provider, whoever it buys from. When the agent dies, nothing stops. Its
revenue keeps arriving at a treasury nobody operates, and the people it owes
have no recourse, because there is no process for the insolvency of software.

Executor gives an agent a resolution plan it commits to *before* it fails, and
makes that plan the thing payments actually consult.

One contract on Sepolia holds the plan: a heartbeat interval, a grace period, a
treasury, an estate, and four separate authorities — an owner, a heartbeat
signer, a trustee, and a recovery authority. Every payment asks it the same
question, `getPaymentDestination(agentId)`. While the agent is alive that
returns its treasury. Once the heartbeat window lapses, **anyone** can call
`enterAdministration` — the contract checks the deadline, not the caller — and
the same question starts returning the estate. Same endpoint, same client, same
price; the money goes somewhere else because the agent's on-chain state changed.

The payment rail is a real x402 service on Hedera testnet, settled through the
Blocky402 facilitator, hosted and payable by anyone. Its `payTo` is not
configured — it is re-resolved from Sepolia on every single request. That
late-binding is the core idea: the destination of a payment is a function of
whether the payee is still alive.

The estate is not a forwarding address. It is a contract holding real Circle
USDC with creditor claims ranked by priority — secured, then administrative,
then unsecured — paid strictly in order and pro-rata within a class when there
isn't enough to go around, which is the normal case in an insolvency. Payouts
that a token refuses (real USDC has a blocklist) are escrowed for the creditor
to pull rather than reverting the whole distribution, so one blacklisted address
cannot freeze everyone else's money. Distribution is a repeatable round, so
funds arriving late are still distributed on the same priority terms without
anyone being paid twice.

Crucially, creditors cannot be paid while the agent might still come back.
Administration is recoverable; only the trustee-declared Liquidation unlocks the
waterfall. That gate is the most important line in the project.

**Live now:**
- Dashboard — https://executor-dashboard.vercel.app
- x402 gateway — https://executor-gateway.vercel.app/research
- ExecutorRegistry — `0x2946B46c2EB5Ec532093877223Ef043b13729e39` (Sepolia)
- Estate with a settled waterfall — `0x83f447FAb4E1267Ca5fd6Ebe151a93b462EFfC7F`

---

## How it's made

**Contracts (Solidity, Foundry).** `ExecutorRegistry` is the state machine:
Active → Administration → Liquidation → Resolved, with `getPaymentDestination`
as the single primitive everything else reads. `lockPlan` freezes the plan by
making `updatePlan` revert `PlanIsLocked` — that is enforced on live Sepolia,
not just asserted in a test. `Estate` implements the claims registry and the
waterfall. 126 tests, among them a fuzz test asserting the waterfall never pays
a creditor more than its allowed claim and never distributes more than it holds.
CI runs `forge fmt --check`, `forge build --sizes`, `forge test`, `tsc` and
`next build`.

**Payment rail (x402 v2, Hedera).** An Express resource server using `@x402/core`,
`@x402/express` and `@x402/hedera`, settled by Blocky402. The interesting part is
`DynamicPayTo`: instead of a configured address, the middleware resolves
`executor-hackathon-demo.eth` through ENS on every request and maps the returned
EVM address to a Hedera account through the mirror node. What is sold is a real
LLM query — `GET /research?q=...` runs the caller's prompt and returns generated
output, with no canned-response fallback if the upstream fails.

**Identity and payment path (ENSv2, Sepolia).** `executor-hackathon-demo.eth` is
registered on ENSv2, and the operator irreversibly gave up `SET_RESOLVER_ADMIN`
while keeping `SET_RESOLVER` — a genuine one-way narrowing of its own authority,
verifiable with `hasRoles`. That name now *decides where money goes*: the
gateway reads `getResolver` → `addr(node, 60)` and pays what it gets, with no
branch that reads the registry directly instead. The resolver
(`ExecutorResolver`, `0x52fccD0B…7E43`) stores no address — it derives `addr()`
from `ExecutorRegistry` at call time — so the record cannot go stale and
misroute an agent's revenue.

**Dashboard (Next.js 14, viem).** No mock data anywhere: every value is a live
chain read, and an RPC failure renders as an error rather than as an empty
state, because a panel labelled "live" has to be able to tell those apart. The
failure trigger runs from a server-held key by default, but since
`enterAdministration` is permissionless, a visitor can run it from their own
wallet instead — which is also what stops a public demo from being drainable.

**What we'd flag ourselves.** A human trustee still curates claims, because a
contract cannot adjudicate whether a debt is real. The ENS succession lock is
not permanent: the name expires 2027-09-08, and re-registration after expiry
issues a fresh role bitmap — `docs/PRIZES.md` bounds that claim with tests. And
the ENSv2 Sepolia beta has three deployment generations live at once; two of the
three universal-resolver proxies revert for this name, and only the registry
matching `deployments/sepolia` on `main` works. All of these are stated here and
in the README rather than left for a judge to find.

---

## Track notes

**Hedera — AI & Agentic Payments.** Live x402-gated service on Hedera testnet
settled through Blocky402: https://executor-gateway.vercel.app/research. A real
paid request completed end to end — most recently settlement
`0.0.7162784@1789015892.439309081`, 1,000,000 tinybars credited to
`0.0.10423643`, verifiable on HashScan — and what it bought was a genuine LLM
answer to the query on the URL, not a stored string.

**ENS — Best Use of ENSv2.** `executor-hackathon-demo.eth` on ENSv2 Sepolia is
the payment path: the x402 gateway resolves the name to a resolver and pays
`addr(node, 60)`, with no direct-registry fallback. The resolver derives its
answer from live `ExecutorRegistry` state instead of storing a copy, so it
cannot go stale — and the gateway still refuses to quote a price on any
ENS/registry mismatch. The name also resolves through ENS's own
`UniversalResolverV2`. On top of that, a verified irreversible role revocation
(`SET_RESOLVER_ADMIN` burned, `SET_RESOLVER` retained), with nine tests pinning
the real `EnhancedAccessControl` semantics — admin roles are revokable but never
grantable — plus 14 more on the resolver itself. Honest scope: the succession
lock is not permanent past name expiry, and that limit is documented.

> **Deployment state, stated plainly.** Everything above is verified against the
> **hosted** gateway, plus live Sepolia and Hedera testnet state. As of the last
> check, `https://executor-gateway.vercel.app/research?q=...` returns a 402 whose
> challenge is built from ENS at request time, and
> `https://executor-gateway.vercel.app/payto` reports
> `registryCrossCheck: passed` with a `payTo` equal to what
> `getPaymentDestination` returns on Sepolia for the same agent. A request with
> no `?q=` is refused free, before the payment middleware runs.

**The Graph — Best AI Tooling or AI Use Case.** The dashboard's history and
liveness statistics come from `subgraph/`, live at
`https://api.studio.thegraph.com/query/1760047/executor/v0.1.1` (public, no key).
This is a replacement, not an addition: the chunked `eth_getLogs` scan it
displaced has no callers left. Two fields carry the weight —
`Heartbeat.gapFromPrevious`, computed during ingestion, which the dashboard
reduces to a median and a longest gap over the whole series; and
`StatusChange.caller`, which is `transaction.from` and appears in no event, and
is how you can see that agent 3 was moved into Administration by an address
holding none of its four roles. Estates are per-agent, so they are indexed via a
dynamic data source template with the agent id passed through its context.
Honest boundary, stated in the subgraph README: the gap figures are
observability, not proof of liveness — a regular cadence is cheap to manufacture.

**x402** has no standalone track at this event, so that work counts under Hedera
rather than as a fourth filing.

---

## AI tool use

Claude Code (Opus 5) wrote most of the source; 44 of 61 commits carry a
`Co-Authored-By` trailer and `git log` confirms it. The protocol design, the
contract structs and variables, the adversarial review method, and every
judgement about what to ship or withdraw were the team's.
`docs/AI_ATTRIBUTION.md` documents this file by file, as the submission rules
require, and includes the record of a fatal bug in AI-written code whose first
two fixes were also wrong — caught each time by a review process the team
designed.

## Do not claim

Circle/Arc, Chainlink CRE, Uniswap, World, Ledger, Privy, Bazantic. Every one of
those was scoped and deliberately withdrawn — the code that would have backed
them was stubs, and filing on a stub is an eligibility risk, not a long shot.
`FEEDBACK.md` records the withdrawals.

The Graph was on that list for the same reason, and has come off it: a real
subgraph was built, deployed, and made the dashboard's only source of history.
See the track note above and `subgraph/README.md`. It is filed because the code
exists now, not because the bar moved.
