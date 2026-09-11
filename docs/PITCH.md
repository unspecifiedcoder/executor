# The pitch

Four minutes of demo, three of questions. This is what to say and, more
usefully, what to say when it goes badly.

---

## The one line

> **Nobody will give an autonomous agent credit, because there is no way to
> collect. We built the collection.**

## Who the customer actually is

Not the agent. **The creditor.**

An agent operator does not wake up wanting a living will. But the people an
agent owes — a compute provider, an inference API, a data vendor — have a real
problem today. Selling to an autonomous agent leaves you two options: demand
prepayment, or eat the risk. There is no third, because there is no process for
recovering from a wallet whose operator vanished.

Executor makes agent revenue **collateralisable**. An agent locks a plan naming
you as a secured creditor. You can now extend it credit, because if it stops
answering, its incoming revenue reroutes to an estate where you rank first. You
are not trusting the operator; you are trusting a contract the operator cannot
amend once you have relied on it.

---

## Four minutes

**0:00–0:30 · The problem, from the creditor's side.**
An agent buys inference from you every hour. It is earning — you can see the
revenue arriving. But you are invoicing an anonymous wallet with no recourse, so
you demand prepayment, and that kills half the market.

**0:30–1:00 · The primitive.**
One contract on Sepolia. Every payment asks it the same question:
`getPaymentDestination(agentId)`. Alive, it returns the treasury. Dead, it
returns the estate. Show it live, not on a slide.

**1:00–2:30 · The proof.** (the replay, on the dashboard)
- A payment lands in the treasury. The payer was never told where to send — the
  script reads the registry and sends there.
- The heartbeat stops. The trace flatlines. The window lapses.
- **A stranger** — an address holding none of the four roles — seals the
  treasury. The contract checks the deadline, not the caller.
- The identical command, same payer, same amount, lands in the **estate**.
- Liquidation. Then the waterfall: 200,000 against 850,000 owed. Secured is
  paid, administrative and unsecured get nothing. Insolvency, not a transfer.

**2:30–3:15 · Why it can be trusted.**
The plan is locked before failure, so it cannot be amended after creditors rely
on it. Triggering is permissionless, so nothing depends on us being awake.
Creditors cannot be paid while the agent might still recover — that gate is the
most important line in the project. 126 tests. And we found a fatal drain in our
own contract through adversarial review; the fix is in the repo alongside two
earlier attempts that did not work.

**3:15–4:00 · What is real and what is not.**
A human trustee curates claims, because a contract cannot decide whether a debt
is real. The ENS path and the waterfall are proven on two agents that no code
joins yet. Both are on the page and in the README.

**Close.** Register your own agent on the same contract. We do not hold a key
that could stop you.

---

## The questions that will actually be asked

### "What is actually in the estate? A dead agent stops earning."

The sharpest question anyone can ask, and it is fair.

> Correct — and that bounds where this works. It matters for recurring revenue:
> subscriptions, streaming payments, prepaid credit, in-flight settlements, a
> marketplace still billing on the agent's behalf. For an agent whose income
> stops dead the moment it does, the estate collects very little. We are not
> claiming otherwise.

Do not fight this one. Conceding it precisely is more convincing than defending
it badly.

### "The trustee is human. Isn't that the whole problem?"

> Yes, and deliberately. A contract cannot adjudicate whether a debt is real.
> What *is* enforced on chain: priority ordering, plan-hash drift, true
> balances, and the rule that creditors cannot be paid while the agent might
> recover. We automated what can be automated and named what cannot.

If pressed: an operator who controls their own trustee can defeat creditors.
That is inside the documented trust boundary. Say so.

### "Why would an operator ever opt in?"

> They would not, unprompted — the operator bears the cost and the creditor gets
> the benefit. This gets adopted when creditors have enough leverage to require
> it, the way suppliers require a credit check. We are building the primitive
> that has to exist before that demand can be expressed.

### "Your ENS demo and your waterfall are different agents."

Answer it before they find it.

> Correct, and it is in the README. The registry's `estate` field must resolve
> to a Hedera account for the payment rail, and the `Estate` contract lives on
> Sepolia — one field cannot be both. Two fields would dissolve it; the deployed
> registry has one, and the demo agent's plan is locked.

### "A heartbeat proves liveness, not solvency."

> Right. It proves a key is signing. An agent can beat while broke, or die
> solvent. The heartbeat is a dead-man's switch for *operation*, not a solvency
> oracle — and the protocol is careful about that: a lapse only moves the agent
> into Administration, which is recoverable. Nothing is paid out until a human
> trustee declares liquidation.

### "Isn't this early?"

> For agent insolvency, yes. For agent *credit*, no — that is blocked today, and
> this is the primitive that unblocks it.

Agree that it is early. Judges forgive early. They do not forgive a team that
cannot see it.

---

## Do not say

- **"AI agent"** about the paid endpoint. It is a paid service that runs an LLM
  query. Overclaiming it undoes the honest scoping everything else rests on.
- **"Fully automated."** The trustee is human and the Hedera to Sepolia bridge
  is manual.
- **"Trustless."** It is trust-*minimised*, and the minimisation is documented.

## If the live demo breaks

The replay is historical and cannot fail — it reads from the chain. If the
hosted dashboard is down, `README.md` has every transaction hash. If the
heartbeat runner has stopped, the live agent shows as lapsed: say so, and point
out that anyone in the room can flip it themselves, which is the design working.
