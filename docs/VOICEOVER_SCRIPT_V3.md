# Executor — demo narration, v3

Short beats. One idea each. Read it flat and fast; the pauses do the work, not
the delivery. Nothing here is a claim the chain does not back — every number
appears on screen at the moment it is spoken.

Target **≤ 4:00** — The Graph requires two to four minutes, Hedera allows five.
Four minutes is the binding cap.

---

### 0:00 — the hook
*(overview hero — the analogy is already on screen)*

> A company goes bankrupt, and there is a process.
> Administration. Liquidation. Creditors paid in order.
>
> An agent goes bankrupt — and there is nothing.
> The money just keeps arriving.

### 0:14 — the one line
> Executor is that process, for software.

### 0:20 — a real agent, registered
*(the new agent's page — register tx on screen)*

> This agent was registered a few minutes ago. One transaction on Sepolia.
> Four separate keys: owner, heartbeat signer, trustee, recovery authority.
> The owner cannot sign its own heartbeats.

### 0:34 — it has to prove it is alive
*(heartbeat trace)*

> And it has to prove it is alive. A heartbeat, on a fixed interval, signed by
> a key that is not the owner's.

### 0:44 — where the money goes
*(the rail, treasury lit)*

> Money arrives. The payer does not choose where it lands — it asks the
> registry. Alive means treasury.

### 0:56 — the money is real
*(terminal)*

> This is a real paywall. x402, on Hedera.

### 1:04 — the paid request
*(terminal output running — let it run, do not talk over the settlement line)*

> Four-oh-two. Payment required.
> It signs. It pays one hundredth of an HBAR. It gets an answer from a live
> model — and the payment settles on Hedera.
>
> *(silence while `settlement: success` prints)*
>
> That is the agent earning.

### 1:26 — it stops
*(heartbeat flatlines)*

> Now the heartbeat stops.

### 1:34 — the deadline
*(countdown hits zero)*

> The interval passes. Then the grace period.

### 1:42 — the seal
*(SEALED stamp)*

> And anyone can act on it. Not a privileged operator — the contract checks the
> deadline, not the caller.
>
> The treasury is sealed.

### 1:56 — the same command
*(step 07, the deflection)*

> Same payer. Same amount. Same script.
> It aims at the treasury. The treasury is sealed.
> And the answer comes back different.

### 2:10 — the estate
*(the packet lands — say the word, then stop)*

> Estate.
>
> *(three seconds of silence)*
>
> Nothing about the payer changed. The agent's on-chain state did.

### 2:26 — the receipts
*(both receipts on the frame, then Etherscan)*

> Two receipts. Same payer. Same nought-point-two USDC. Two different
> destinations, thirty-seven blocks apart. Both of them on Etherscan.

### 2:44 — Hedera
*(HashScan)*

> And on Hedera, the same client account has landed in both the treasury and
> the estate. Different accounts, same endpoint, same price.

### 2:58 — creditors
*(waterfall unlocked)*

> Then the creditors. And only now — an agent in administration might still
> recover, and paying its creditors while that is possible would be the worst
> bug this protocol could have.

### 3:12 — the waterfall
*(the pour)*

> Nought-point-two available against nought-point-eight-five owed.
> Insolvent — which is the normal case.
> Secured is paid. Administrative and unsecured get nothing.
> That is what priority means, and the contract enforces it.

### 3:30 — indexed
*(proof strip / subgraph)*

> Every step is indexed. The dashboard reads no RPC at all — if the subgraph is
> down, it says so rather than guessing.

### 3:42 — the invitation
*(/register)*

> You can register your own. Your wallet, your keys, your gas.
> We hold nothing that could stop you.

### 3:52 — close
> Executor. When an agent fails, its obligations don't.

---

## Words to avoid

- **"seize"**, **"a stranger takes"** — invites a security objection the
  protocol does not have. It is a precommitted plan activating, and the phrase
  that carries it is *the contract checks the deadline, not the caller*.
- **"simulation"** — every transaction in this video is real on Sepolia and
  Hedera testnet. Saying simulation gives away a point we have earned.
- **dollar figures** — the amounts are 0.2 USDC and 0.01 HBAR. Say them.

## Numbers spoken, and where each comes from

| Spoken | On screen | Source |
|---|---|---|
| four separate keys | the register form / agent page | `registerAgent` args |
| one hundredth of an HBAR | 1,000,000 tinybars | the 402 challenge |
| nought-point-two USDC | 0.2 USDC | `usdc(200000)`, matches Etherscan |
| nought-point-eight-five owed | 0.85 USDC | `AGENT3_TOTALS.owed` |
| thirty-seven blocks apart | 37 | `step.block - step.compare.block` |
