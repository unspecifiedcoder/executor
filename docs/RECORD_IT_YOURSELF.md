# Recording the demo — every step, and what to say

One take if you can. Target **3:30–4:00**; ETHGlobal **auto-rejects anything
over 4:00 at upload**, so treat four minutes as a wall.

Keep `./scripts/demo-day.sh` running in a terminal. Every command below is a
number in that menu, so you are never composing a command on camera.

---

## SETUP — before you press record

**Terminal 1** — `cd /mnt/c/Users/Pramod/GitHub/executor && ./scripts/demo-day.sh`
Press **1**. Everything must be green. If the demo agent is STALE, open a spare
terminal and press **9** there (it blocks its window), then re-run 1.

**Terminal 2** — spare, for the heartbeat runner.

**Browser window A** — the product, three tabs:
```
https://executor-dashboard.vercel.app
https://executor-dashboard.vercel.app/register
https://executor-dashboard.vercel.app/vitals
```

**Browser window B** — evidence, three tabs:
```
https://sepolia.etherscan.io/tx/0x731319100c29e25cf27270085ef91caaba946f9907cd14dfa67e33ef8ea243c5
https://sepolia.etherscan.io/tx/0x17b0f95681e3fea74423e06978d319ca1d57a20228480191f12c99d8816d37ad
(HashScan — press 3 in the menu first, it prints a fresh link. Open that.)
```

**MetaMask** on Sepolia with ~0.01 ETH.

Then:
- **Dismiss the cookie banners** on Etherscan and HashScan. They sit over the evidence.
- Terminal font **~16pt**. Default size is unreadable after compression.
- Close Slack, email, anything that can pop a notification.

> **Never export a private key in a window you are recording.** `demo-day.sh`
> loads them once at the top, before you start. A key on screen means the take
> is dead and the key is burned.

---

# THE TAKE

Each step: **what is on screen → what you do → what you say.**
Read flat and fast, like you find it mildly annoying to have to explain.

---

### 1 · THE HOOK — 0:00
**Screen:** `executor-dashboard.vercel.app`, top of page. Don't scroll.
**Do:** nothing. Let the analogy be read.

> Company fails? There's a process.
> Administration. Liquidation. Creditors. Paid in order.
>
> Agent fails? Nothing.
>
> The money just keeps arriving.
>
> Executor is the process. For software.

---

### 2 · MAKE ONE — ~0:15
**Screen:** switch to the `/register` tab. Click **CONNECT WALLET**, approve in
MetaMask.

> So let's make one.

---

### 3 · FOUR KEYS — ~0:20
**Do:** type the plan. Paste each field; don't type addresses by hand.

```
Agent label         courier-seven.eth
Heartbeat signer    0xC63adec9161CabA36935138b262267489D2d62D0
Trustee             0x108efe0989d08d3BCF49ca1A3A35548543CbA310
Recovery authority  0x86A85D90e605B6661808f7Cbe37565dCa49f323E
Treasury            0x7ea7f6e97E24F1ad03Db0bd544A0AeF4A1f07330
Estate              0xDE3207F493fE4600DeEc424e0875ec943d712337
Heartbeat interval  30
Grace period        15
```

**Scroll** so the green **4 of 4 authorities distinct** callout is visible as
you say the last two lines.

> Before anything goes wrong, it commits to a plan.
>
> Four keys. Owner. Heartbeat. Trustee. Recovery.
>
> Owner can't prove itself alive.
> Trustee can't bring it back.

*(30/15 is deliberate — it makes the agent flippable 45 seconds later, inside
this take.)*

---

### 4 · SIGNED — ~0:45
**Do:** click **[ REGISTER AGENT ]**. Sign in MetaMask.

> One transaction. Sepolia.

## ⏸ STOP TALKING
**until the page offers you a link to the agent.** The popup and the pending
state play out in silence. This is a real transaction confirming — narrating
over it is what people do when they are covering for something.

---

### 5 · IT EXISTS — ~1:00
**Do:** follow the page's own link to `/agent/<id>`. **Don't type a URL** — the
product handing you the next step is the point.

**Screen shows:** `Status active` · `Plan locked yes` · interval `30s` · grace
`15s` · treasury lit, estate on standby · one row of on-chain history.

> And now it exists.
>
> Every registered agent gets this. Its plan. Its history. Live.

---

### 6 · ALIVE — ~1:10
**Screen:** stay on the agent page.

> Now prove it's alive.
>
> Heartbeat. Fixed interval. Different key.
>
> Not the owner's.

---

### 7 · MONEY → TREASURY — ~1:20
**Do:** switch to the overview tab. Point at the green proof strip along the
bottom of the hero.

> Now money arrives.
>
> The payer doesn't choose the destination.
>
> An ENS name resolves it.
> The registry decides it.
> Hedera settles it. One hundredth of an HBAR.
>
> Agent alive? Treasury.

---

### 8 · A REAL PAID REQUEST — ~1:35
**Do:** switch to Terminal 1. Press **3**.

> And this isn't a mock.
>
> Paywall. Hedera.
>
> 402. Payment required.
>
> It signs. It pays.

## ⏸ STOP TALKING
**until `settlement: success` is fully printed.** Watch it with them.

> The model answers. That's revenue. The agent is earning.

*(The menu prints a fresh HashScan link. Copy it into window B now — you'll
need it at step 12.)*

---

### 9 · IT STOPS — ~2:00
**Do:** back to the agent page. Its deadline has passed — nothing is beating it.

> Then — heartbeats stop.
>
> The window expires.
>
> Anyone can trigger it.
>
> The contract checks the deadline. Not the caller.

---

### 10 · THE FLIP — ~2:15  ← **the shot**
**Do:** Terminal 1, press **6**. Paste the agent id when asked (press **4**
first if you need it from the label). It prints the destination before, sends
`enterAdministration`, and prints it after.

**Then reload the agent page.** It now reads `administration`.

> Same agent. Same registry. Same question.
>
> **Estate.**

## ⏸ STOP TALKING — three full seconds
Count them. One. Two. Three. You will want to talk over this. Don't — it's the
moment the whole idea lands.

> The payer didn't change.
>
> The agent's on-chain state did.

---

### 11 · THE RECEIPTS — ~2:35
**Do:** window B, the two Etherscan tabs. Show one, then the other.

> Two receipts.
>
> Same payer. Same nought-point-two USDC. Thirty-seven blocks apart.
>
> Different destinations.

*(If asked later: these are from the 10th on purpose — a finished insolvency is
the only kind that has a waterfall to show.)*

---

### 12 · THEIRS — ~2:55
**Do:** the fresh HashScan tab from step 8.

> And the HBAR settlement?
>
> Hedera's own explorer.
>
> Not our page. Theirs.

---

### 13 · CREDITORS — ~3:10
**Do:** overview tab → press **Replay the Sepolia proof**, then step forward
with **›** until the creditor bars fill. **Scroll down so the bars fill the
screen** — they sit below the fold and this is the beat that needs them.

**Screen shows:** SECURED full, ADMINISTRATIVE empty, UNSECURED empty,
shortfall 0.65.

> Now the creditors. And only now.
>
> An agent in administration might still recover. Paying its creditors while
> that's possible would be the worst bug this protocol could have.
>
> Available: nought-point-two. Owed: nought-point-eight-five.
>
> Insolvent. Which is the normal case.
>
> Secured gets paid.
>
> Administrative and unsecured? Nothing.

---

### 14 · THE GRAPH — ~3:30
**Do:** Terminal 1, press **8**.

> Every step is indexed.
>
> The Graph.
>
> Approval. Execution. Joined by the plan hash.
>
> No RPC in the dashboard.

---

### 15 · CLOSE — ~3:40
**Do:** back to `/register`.

> Register your own.
>
> Your wallet. Your keys. Your gas.
>
> Executor.
>
> When an agent fails — its obligations don't.

**Stop recording after a beat of silence.**

---

## AFTERWARDS

- Check the total is **under 4:00**.
- Watch it once on mute. Any stretch with no motion and nothing to read: cut it.
- Press **7** in the menu to restore your agent to Active (tidy, not required).
- Leave the heartbeat runner going until judging is over.

## THE THREE SILENCES — the hardest and most valuable part

| After | Until | Why |
|---|---|---|
| "One transaction. Sepolia." | the agent link appears | a real transaction confirming |
| "It signs. It pays." | `settlement: success` printed | let the settlement land |
| "**Estate.**" | three full seconds | the idea needs room |

## WORDS TO AVOID

- **"seize"**, **"a stranger takes the money"** — invites a security objection
  the protocol doesn't have. Say *the contract checks the deadline, not the
  caller*.
- **"simulation"** — everything here is real on testnet. Saying simulation
  gives away a point you earned.
- **dollar amounts** — it is 0.2 USDC and 0.01 HBAR. Say those.

## IF YOU FLUFF A LINE

Keep going. Stop only if you said something **false** — a wrong number, or a
claim the chain doesn't back. Everything else is just a take.

## IF YOU RUN LONG

Cut from step 13 only, in this order: *"Which is the normal case"*, then
*"And only now"*. Never cut the partner names (steps 7 and 14) and never
shorten the three silences.
