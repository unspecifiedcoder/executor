# Executor — what to say, and when to stop talking

For **`media/executor-demo-v5-silent.mp4`** — 3:48 (228.36s).

Read it **flat and fast**, like you find it mildly annoying to have to explain.
Do NOT put a dramatic pause after every fragment — the short lines exist so you
can breathe naturally, not so you can perform. Read dramatically and it becomes
a movie trailer; read plainly and it sounds like someone who knows what they
built.

**Watch the video, not the timer.** Every pause is cued by something happening
on screen, so you can perform the whole thing without looking at a clock.

The time on each heading is there as an **anchor, not a target** — if you lose
your place, or want to pick up mid-way through a retake, that is what it is
for. Drifting a second or two either side changes nothing.

---

## The three long silences — the most important thing in this script

They feel unbearable while recording. They are the best seconds in the video.
Do not fill them.

| After you say | At about | How long | What is on screen | Why you stop |
|---|---|---|---|
| "One transaction. Sepolia." | 0:40 | ~16s | the signature, then the transaction being mined | a real transaction confirming — talking over it is what people do when they are covering for something |
| "One hundredth of an HBAR." | 1:42 | ~20s | the terminal printing the settlement | let `settlement: success` land on its own |
| "Estate." | 2:18 | 3s | the page has flipped to the estate | this is the whole video; words would bury it |

Everything else is a breath between fragments, not a pause.

---

# THE SCRIPT

### 1 · THE HOOK  ·  0:00
*Hero on screen. Start immediately.*

> Company fails? There's a process.
> Administration. Liquidation. Creditors. Paid in order.
>
> Agent fails? Nothing.
>
> The money just keeps arriving.
>
> Executor is the process. For software.

**→ finish around the cut to `/register`.** Still talking when the form
appears? Fine. Keep going.

### 2 · BORN  ·  0:15
*Wallet connecting.*

> So let's make one.

### 3 · FOUR KEYS  ·  0:18
*The fields filling in.*

> Before anything goes wrong, it commits to a plan.
>
> Four keys.
>
> Owner.
> Heartbeat.
> Trustee.
> Recovery.
>
> Owner can't prove itself alive.
> Trustee can't bring it back.

**→ then stop.** The filled form sits for a moment. Nothing until the button
is clicked.

### 4 · SIGNED  ·  0:38
*The moment REGISTER AGENT is clicked.*

> One transaction. Sepolia.

# SILENCE — about 16 seconds
*The signature goes out, then it is mined. Say nothing. Resume when the
agent's own page appears.*

### 5 · IT EXISTS  ·  0:57
*The agent's page.*

> And now it exists.
>
> Every registered agent gets this.
>
> Its plan.
> Its history.
>
> Live.

### 6 · ALIVE / HEARTBEAT  ·  1:05
*Heartbeats landing.*

> Now prove it's alive.
>
> Heartbeat.
> Fixed interval.
> Different key.
>
> Not the owner's.

**→ then wait** for the cut back to the rail.

### 7 · MONEY → TREASURY  ·  1:13
*The rail. The green proof strip is on screen — all three partners at once.*

> Now money arrives.
>
> The payer doesn't choose the destination.
>
> An ENS name resolves it.
> The registry decides it.
> Hedera settles it.
>
> Agent alive?
>
> Treasury.

### 8 · THE PAYWALL  ·  1:33
*The terminal starts typing.*

> And this isn't a mock.
>
> Paywall.
> Hedera.
>
> 402. Payment required.
>
> It signs.
> It pays.
>
> One hundredth of an HBAR.

# SILENCE — about 20 seconds
*The settlement block prints itself out. Watch it with them. Resume once
`settlement: success` is fully on screen.*

### 9 · EARNING → FAILURE  ·  2:02

> The model answers.
>
> That's revenue.
>
> The agent is earning.
>
> Then — heartbeats stop.
>
> The window expires.
>
> Anyone can trigger it.
>
> The contract checks the deadline. Not the caller.

### 10 · THE FLIP  ·  2:14  ← the shot
*The page reloads. It reads administration.*

> Same agent. Same registry. Same question.
>
> **Estate.**

# SILENCE — 3 seconds
*Count it. One. Two. Three. You will want to talk over this. Don't.*

### 11 · NOTHING CHANGED  ·  2:21

> The payer didn't change.
>
> The agent's on-chain state did.

**→ then wait** for Etherscan.

### 12 · THE RECEIPTS  ·  2:34
*Etherscan.*

> Two receipts.
>
> Same payer.
> Same nought-point-two USDC.
> Thirty-seven blocks apart.
>
> Different destinations.

### 13 · THEIRS  ·  2:53
*HashScan.*

> And the HBAR settlement?
>
> Hedera's own explorer.
>
> Not our page.
>
> Theirs.

### 14 · CREDITORS  ·  3:06
*The waterfall pours. This beat has room — do not rush it.*

> Now the creditors.
>
> And only now.
>
> An agent in administration might still recover. Paying its creditors while
> that's possible would be the worst bug this protocol could have.
>
> Available: nought-point-two.
> Owed: nought-point-eight-five.
>
> Insolvent. Which is the normal case.
>
> Secured gets paid.
>
> Administrative and unsecured?
>
> Nothing.

### 15 · THE GRAPH  ·  3:25
*The subgraph answering its own query.*

> Every step is indexed.
>
> The Graph.
>
> Approval. Execution. Joined by the plan hash.
>
> No RPC in the dashboard.

### 16 · REGISTER + CLOSE  ·  3:34
*Back on `/register`.*

> Register your own.
>
> Your wallet.
> Your keys.
> Your gas.
>
> Executor.
>
> When an agent fails —
>
> its obligations don't.

*Stop. About six seconds of video remain. Let it run out.*

---

## Two lines that were changed, and why

**"This isn't a mock"** — an earlier draft said *"this isn't fake money."* It is
testnet HBAR and testnet USDC. A judge who knows that hears an overclaim on the
one subject this project cannot afford to overclaim. The 402 is real, the
settlement is real, the model answers for real. That is enough.

**"An ENS name resolves it. The registry decides it."** — an earlier draft had
the ENS name *choosing* the destination. It does not: it resolves, and the
registry decides based on liveness. As written it invited "so whoever controls
the name controls the money?" — the one security question not worth handing
anybody.

## Words to avoid

- **"seize"**, **"a stranger takes the money"** — invites a security objection
  the protocol does not have. Say *the contract checks the deadline, not the
  caller*.
- **"simulation"** — every transaction here is real on Sepolia and Hedera
  testnet. Saying simulation gives away a point you earned.
- **dollar amounts** — it is 0.2 USDC and 0.01 HBAR. Say those.

## If you are running long

Cut from segment 14 only, in this order: *"Which is the normal case"*, then
*"And only now"*. Never cut the partner names in segments 7 and 15, and never
shorten the three silences.

## What actually happened during this take

Five real Sepolia transactions: `registerAgent` from the clicked button, three
`heartbeat`s signed by the heartbeat key, and `enterAdministration` once the
window lapsed. The payment destination moved `0x7ea7f6e9…07330` →
`0xDE3207F4…12337` as a result. Nothing is a re-enactment, so nothing needs
hedging.

## Numbers spoken, and where each comes from

| Spoken | On screen | Source |
|---|---|---|
| four keys | the register form | `registerAgent` arguments |
| one hundredth of an HBAR | 1,000,000 tinybars | the live 402 challenge |
| nought-point-two USDC | 0.2 USDC | `usdc(200000)`, matches Etherscan |
| nought-point-eight-five owed | 0.85 USDC | `AGENT3_TOTALS.owed` |
| thirty-seven blocks apart | 37 | computed from the two receipts |
