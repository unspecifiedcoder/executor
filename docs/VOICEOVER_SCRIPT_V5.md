# Executor — demo narration, v5

For **`media/executor-demo-v5-silent.mp4`** (**3:48**). Supersedes v3, which was
written for marks that no longer exist.

A ten-second dwell was cut from 0:37-0:47 - the register form was already
fully filled and just sitting there - so every beat after it moved ten seconds
earlier. ETHGlobal auto-rejects anything over four minutes at upload, and 3:58
was two seconds of margin.

Short beats. One idea each. Read it flat and fast — the pauses do the work.
Every number spoken is on screen at the moment it is said, and every
transaction shown was made during the take.

Hard rule: **2:00-4:00, enforced at upload** - anything outside is rejected
automatically. At 3:48 you have twelve seconds of headroom, which is enough to
breathe but not enough to ramble.

---

### 0:00 — the hook
*(overview hero — the analogy is on screen)*

> A company goes bankrupt, and there is a process.
> Administration. Liquidation. Creditors paid in order.
>
> An agent goes bankrupt — and there is nothing.
> The money just keeps arriving.
>
> Executor is that process, for software.

### 0:14 — a wallet, and a plan
*(/register, wallet connecting)*

> So here is an agent being born.

### 0:24 — four authorities
*(the fields filling in)*

> A plan it commits to before anything goes wrong.
> Four separate keys — owner, heartbeat signer, trustee, recovery.
> The owner cannot sign its own heartbeats. The trustee cannot restore it.

### 0:40 — signed
*(REGISTER AGENT clicked — do not talk over the signature)*

> One transaction on Sepolia.

### 0:58 — it exists, and it is beating
*(the agent's page; heartbeats landing)*

> And it exists. Every agent on this registry gets that page for free — a live
> read of its plan and its history.
>
> Now it has to prove it is alive. A heartbeat, on a fixed interval, signed by
> a key that is not the owner's.

### 1:24 — where the money goes
*(the rail, treasury lit)*

> Money arrives. The payer does not choose where it lands — it asks the
> registry. Alive means treasury.

### 1:36 — a real paid request
*(terminal — the settlement block must land in silence)*

> And the money is real. A paywall, on Hedera.
> Four-oh-two. Payment required. It signs, it pays one hundredth of an HBAR —
>
> *(silence while `settlement: success` prints — about four seconds)*
>
> — and a live model answers. That is the agent earning.

### 2:00 — the heartbeats stop
*(the agent's page, deadline passing)*

> Then the heartbeats stop.
> The interval passes. Then the grace period.
>
> And now anyone can act on it. Not a privileged operator, not us — the
> contract checks the deadline, not the caller.

### 2:18 — the destination changed  ← **the shot**
*(the same page, reloaded: administration)*

> Same agent. Same registry. Same question.
>
> **Estate.**
>
> *(three seconds of silence)*
>
> Nothing about the payer changed. The agent's on-chain state did.

### 2:42 — someone else's website
*(Etherscan)*

> Two receipts. Same payer, same nought-point-two USDC, thirty-seven blocks
> apart — landing in two different places.

### 3:00 — and on Hedera
*(HashScan)*

> And the HBAR settlement, on Hedera's own explorer. Not our page saying so.
> Theirs.

### 3:18 — creditors, in order
*(the waterfall pouring)*

> Then the creditors — and only now. An agent in administration might still
> recover, and paying its creditors while that is possible would be the worst
> bug this protocol could have.
>
> Nought-point-two available against nought-point-eight-five owed. Insolvent,
> which is the normal case.
> Secured is paid. Administrative and unsecured get nothing.
>
> That is what priority means, and the contract enforces it.

### 3:36 — indexed
*(the subgraph answering its own query)*

> Every step is indexed — approval and execution joined by plan hash.

### 3:44 — close
*(/register)*

> Register your own. Your wallet, your keys, your gas.
>
> Executor. When an agent fails, its obligations don't.

---

## Words to avoid

- **"seize"**, **"a stranger takes the money"** — invites a security objection
  the protocol does not have. Say *the contract checks the deadline, not the
  caller.*
- **"simulation"** — every transaction in this video is real on Sepolia and
  Hedera testnet. Saying simulation gives away a point you earned.
- **dollar amounts** — it is 0.2 USDC and 0.01 HBAR. Say those.

## What actually happened during this take

Five real Sepolia transactions, in this order:

| | |
|---|---|
| `registerAgent` | from clicking the button on camera |
| `heartbeat` ×3 | signed by the heartbeat key, not the owner's |
| `enterAdministration` | after the window lapsed, by an address holding none of the four roles |

The payment destination moved `0x7ea7f6e9…07330` → `0xDE3207F4…12337` as a
result. Nothing in the video is a re-enactment, so none of it needs hedging.

## Numbers spoken, and where each comes from

| Spoken | On screen | Source |
|---|---|---|
| four separate keys | the register form | `registerAgent` arguments |
| one hundredth of an HBAR | 1,000,000 tinybars | the live 402 challenge |
| nought-point-two USDC | 0.2 USDC | `usdc(200000)`, matches Etherscan |
| nought-point-eight-five owed | 0.85 USDC | `AGENT3_TOTALS.owed` |
| thirty-seven blocks apart | 37 | computed from the two receipts |
