# Executor, explained from scratch

Start at the top if you know nothing about this project. Each section assumes
only what came before it. Nothing here is aspirational — if it says something
exists, it is deployed and you can check it.

---

## 1. The problem, in plain language

Software can now earn money on its own. A program answers questions, processes
data or runs a trading strategy, and gets paid per request into a crypto wallet
it controls.

That same program also **owes** money. It pays for the model it calls, the
compute it runs on, the data it buys. Those are real bills to real counterparties.

Now it stops. The server dies, the key is lost, the operator walks away. And
here is the part nobody has solved:

- Its **revenue keeps arriving** at a wallet nobody is operating.
- The people it **owes get nothing**, and have no way to collect.

When a company fails there is an insolvency process — an administrator steps in,
assets are frozen, creditors are paid in a legally defined order. When software
fails there is nothing. The money just piles up in a dead wallet.

**Executor is that process, built as a smart contract.**

---

## 2. The one idea

Normally, where you send a payment is decided by **you**.

Executor flips it: where a payment goes is decided by **the payee's on-chain
state**.

```
             payer sends to "agent X"
                       │
                       ▼
        getPaymentDestination(agentX)  ← a contract answers
                       │
        ┌──────────────┴──────────────┐
        │                             │
   agent is alive               agent is dead
        │                             │
        ▼                             ▼
    its treasury                  its estate
 (the operator's wallet)     (pays creditors in order)
```

Same payer. Same amount. Same command. The money lands somewhere else, because
the agent's state changed.

We call this **late-bound payment destination**. It is the whole invention;
everything else in the repo exists to make it trustworthy.

---

## 3. How an agent proves it is alive

A **heartbeat**. The agent signs a tiny transaction on a schedule — every 96
seconds in our demo — that says nothing except "still here".

The plan sets two numbers:

- **interval** — how often a heartbeat is expected
- **grace** — how much lateness is tolerated

Miss `interval + grace` and the window has **lapsed**. That is the trigger.

> A heartbeat proves a key is signing. It does **not** prove the agent is
> solvent, or even doing useful work. That distinction matters and section 9
> comes back to it.

---

## 4. The four states

An agent is always in exactly one:

| state | meaning | who can move it here |
|---|---|---|
| **Active** | alive and answering. Payments → treasury | — |
| **Administration** | window lapsed. Payments → estate. **Recoverable** | *anyone* |
| **Liquidation** | past recovery. Payouts unlocked | trustee only |
| **Resolved** | wound up. Terminal | trustee only |

Two design choices worth understanding.

**Administration is triggered by anyone.** Not the owner, not us, not a trusted
admin. The contract checks the deadline, not the caller. A dead-man's switch
that needs a trusted party to be awake is not a dead-man's switch — so we made
it need nobody. In our demo, the address that flips the agent holds **none** of
its four roles.

**Administration does not pay anyone.** A missed heartbeat might be a server
reboot, not insolvency. So Administration only redirects *future* revenue, and a
**recovery authority** can put the agent back to Active. Creditors are paid only
after a human trustee declares **Liquidation**, which is one-way.

> This is the most important rule in the project: **creditors cannot be paid
> while the agent might still recover.**

---

## 5. The four authorities

A plan names four separate keys, and they are deliberately different people:

| role | can do | cannot do |
|---|---|---|
| **owner** | write and lock the plan | sign heartbeats, declare liquidation |
| **heartbeat signer** | prove liveness | touch the plan or the money |
| **trustee** | curate claims, declare liquidation, wind up | restore a lapsed agent |
| **recovery authority** | restore a lapsed agent | anything else |

If one key held all four, the agent has the state machine without the separation
— one person could fake liveness, declare insolvency and decide who gets paid.
The dashboard renders that case as a **fault**, in red.

---

## 6. `lockPlan` — why a promise has to be unbreakable

Before locking, an owner can change the plan: treasury, estate, trustee, timing.

`lockPlan()` makes `updatePlan()` revert **forever**. No unlock, no admin
override, no upgrade path.

That is the point. A plan you can quietly amend after creditors have relied on
it is not a commitment — it is a suggestion. Locking is what turns it into
something a lender can price.

---

## 7. The estate and the waterfall

The estate is **not** a forwarding address. It is a contract holding real USDC
with creditor claims ranked by class:

```
  SECURED          paid first, in full, as far as the money goes
  ADMINISTRATIVE   paid next, from whatever is left
  UNSECURED        paid last, usually nothing
```

Within a class that cannot be covered, claims are paid **pro-rata**, with the
truncation remainder handed out unit by unit so no dust is stranded.

Our demo settles an **insolvent** estate on purpose — 200,000 available against
850,000 owed:

| class | allowed | paid |
|---|---|---|
| Secured | 250,000 | **200,000** |
| Administrative | 200,000 | 0 |
| Unsecured | 400,000 | 0 |

Shortfall: 650,000. Somebody loses, which is what insolvency *is*. A demo where
everyone gets paid is demonstrating a transfer, not a waterfall.

Other properties, each because of a specific failure we had to design against:

- **Blocked payouts escrow, not revert.** Real USDC has a blocklist. One
  blacklisted creditor must not freeze everyone else's distribution, so a
  refused transfer is booked to `withdrawable` for that creditor to pull.
- **Distribution is repeatable.** Late revenue distributes on the same terms
  without paying anyone twice.
- **Transfers are verified by balance delta.** A token that returns `true`
  without moving funds cannot mark a claim settled.
- **`executePlan` re-derives the plan hash.** A claim registered after approval
  invalidates the commitment rather than sneaking into the payout.

---

## 8. The three other pieces

### The payment rail — x402 on Hedera

A live paid endpoint: `GET /research?q=...` returns HTTP **402 Payment
Required**, you pay 0.01 HBAR, and it runs your prompt through an LLM and
returns the answer.

The interesting part is not the LLM. It is that the endpoint's `payTo` is **not
configured**. It is resolved per request from live Sepolia state. Same URL, same
price — the destination depends on whether the agent is alive.

### Identity — ENSv2

`executor-hackathon-demo.eth` is the payment path, not decoration. The gateway
resolves the name → a resolver → `addr(node, 60)` and pays whatever comes back.

The resolver stores **no address**. It derives the answer from the registry at
the moment it is called, so the ENS record cannot go stale and misroute revenue.
The operator also irreversibly burned its ability to delegate control of that
resolver.

### History — The Graph

A subgraph indexes every agent's lifecycle. The dashboard reads history from it
rather than scanning logs over RPC.

Two things it answers that a contract call cannot: the **gap between
heartbeats** (computed at index time, over the whole series) and **who called a
transition** — `transaction.from`, which appears in no event, and which is how
you can see that a stranger flipped the agent.

---

## 9. What this does *not* do

Read this section before believing anything above.

- **A dead agent stops earning.** The protocol reroutes *future* revenue — but
  revenue usually stops for the same reason the agent did. This matters most
  where income outlives the operator: subscriptions, streaming payments, prepaid
  credit, in-flight settlements. For an agent whose income dies with it, the
  estate collects very little.
- **The trustee is human, and can lie.** A contract cannot adjudicate whether a
  debt is real. A trustee who colludes with the operator can register fake
  creditors. What is enforced on-chain is priority ordering, plan-hash drift,
  true balances, and the liquidation gate — not honesty.
- **The incentive runs backwards.** The operator bears the cost of locking a
  plan; the creditor gets the benefit. Adoption needs creditors with enough
  leverage to demand it.
- **The operator can drain the treasury first.** Only revenue arriving *after*
  the flip is protected.
- **Liveness is not solvency.** An agent can beat while broke.
- **One ERC-20, 200 claims max.** Real estates hold several assets.
- **The two rails are not joined.** Revenue settles on Hedera; creditor claims
  settle in USDC on Sepolia. A human bridges between them. No code does.

---

## 10. Check it yourself

Nothing below needs a wallet.

```bash
RPC=https://ethereum-sepolia-rpc.publicnode.com
REG=0x2946B46c2EB5Ec532093877223Ef043b13729e39
AGENT=0x96abf3c7f8f72fdf248e91137fb471a442dccf3fcece378b2065616cb68c36d4

# the primitive, on a finished agent
cast call $REG "getStatus(bytes32)(uint8)" $AGENT --rpc-url $RPC            # 3 = Resolved
cast call $REG "getPaymentDestination(bytes32)(address)" $AGENT --rpc-url $RPC
```

The two transfers that make the whole argument, both on Sepolia:

```
pay #1  block 11672895  0xbFe5551e…16EA → 0x29eA9aE5…5557  (treasury)
pay #2  block 11672932  0xbFe5551e…16EA → 0xD52b37AD…7C5F  (estate)
        same payer          same 200,000 USDC          same script
```

And to drive it yourself: register an agent at
[`/register`](https://executor-dashboard.vercel.app/register), keep it alive
with `scripts/heartbeat.sh`, stop, and watch anyone at all redirect its revenue.
We hold no key that could stop you.

---

## Where to go next

| | |
|---|---|
| Transaction-by-transaction proof | [`README.md`](../README.md) |
| Track-specific claims | [`docs/PRIZES.md`](PRIZES.md) |
| The pitch and the hard questions | [`docs/PITCH.md`](PITCH.md) |
| Architecture and trust boundaries | [`docs/ARCHITECTURE.md`](ARCHITECTURE.md) |
| How this was built, and with what | [`docs/AI_ATTRIBUTION.md`](AI_ATTRIBUTION.md) |
