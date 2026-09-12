# Recording the demo yourself

Target: **3:30–4:00**. The Graph requires two to four minutes and treats it as
an eligibility rule, so four minutes is a cap, not a goal. Hedera allows five.

Do it in one take if you can. A judge forgives a stumble; they do not forgive
four minutes that say nothing.

---

## Before you hit record

**1. Wallet.** MetaMask on **Sepolia**, with ~0.01 ETH. This is the whole reason
you are recording rather than me — you can actually click REGISTER AGENT and
sign it. Put the wallet on a network you do not mind being on camera.

**2. Two browser windows**, so you are never typing a URL on camera:

| Window | Tabs |
|---|---|
| A | `https://executor-dashboard.vercel.app` · `/vitals` · `/register` |
| B | Etherscan tx (below) · HashScan tx (below) · the subgraph query |

Use the **live site**, not localhost. It is what judges will open, and the URL
bar being a real domain is worth something.

**3. A terminal**, already `cd`'d into the repo, with the command typed but
**not** run. Font at ~16pt — default terminal text is unreadable after YouTube
compression.

**4. Dismiss the cookie banners** on Etherscan and HashScan before recording.
They sit directly over the evidence.

**5. Check the agent is alive:**

```bash
curl -s -X POST https://api.studio.thegraph.com/query/1760047/executor/v0.1.2 \
  -H 'content-type: application/json' \
  -d '{"query":"{agent(id:\"0x6574c8cc5e4ca438a061eb83708582b10658d3a1a7334a8d94b6f6a1960dcb37\"){status heartbeatCount lastHeartbeat}}"}'
```

`status` must be `Active` and `lastHeartbeat` within ~2 minutes. If not, restart
the runner — command in `docs/STATUS.md`.

> **Do not put a private key on screen.** Export the terminal variables in a
> different window *before* you start recording, or the recording contains a key
> and has to be thrown away.

---

## Links to have open

```
Etherscan · registerAgent
https://sepolia.etherscan.io/tx/0x943890e3c06744eee08e77437b358bf8350bfc4cadda942b8101830cbf152813

Etherscan · the USDC payment to the treasury
https://sepolia.etherscan.io/tx/0x731319100c29e25cf27270085ef91caaba946f9907cd14dfa67e33ef8ea243c5

Etherscan · the same payer, same amount, to the estate
https://sepolia.etherscan.io/tx/0x17b0f95681e3fea74423e06978d319ca1d57a20228480191f12c99d8816d37ad

HashScan · the HBAR settlement
https://hashscan.io/testnet/transaction/0.0.7162784@1789202466.813297956
```

---

## The take

Times are targets, not marks to hit exactly. **Say the line, then do the thing** —
narration should arrive a beat before the picture changes, never after.

### 1 · 0:00–0:16 — the hook
**Screen:** `executor-dashboard.vercel.app`, top of page, not scrolling.

> A company goes bankrupt, and there is a process.
> Administration. Liquidation. Creditors paid in order.
>
> An agent goes bankrupt — and there is nothing.
> The money just keeps arriving.
>
> Executor is that process, for software.

*(The two rows you are describing are on screen. Let them be read.)*

### 2 · 0:16–0:50 — register an agent, for real
**Screen:** `/register`. Connect MetaMask. Type the plan. Scroll so the green
"4 of 4 authorities distinct" callout is visible when you mention it.

```
Agent label         courier-seven.eth
Heartbeat signer    0xC63adec9161CabA36935138b262267489D2d62D0
Trustee             0x108efe0989d08d3BCF49ca1A3A35548543CbA310
Recovery authority  0x86A85D90e605B6661808f7Cbe37565dCa49f323E
Treasury            0x7ea7f6e97E24F1ad03Db0bd544A0AeF4A1f07330
Estate              0xDE3207F493fE4600DeEc424e0875ec943d712337
Heartbeat interval  60
Grace period        30
```

> A plan, committed before anything goes wrong.
> Four separate authorities — owner, heartbeat signer, trustee, recovery.
> The owner cannot sign its own heartbeats, and the trustee cannot restore it.

**Then click REGISTER AGENT and sign it in MetaMask.** Do not talk over the
signature — let the popup and the pending state play.

> That is one transaction on Sepolia.

### 3 · 0:50–1:08 — the agent you just made
**Screen:** when the page offers it, **follow its own link to `/agent/<id>`.**
Do not type a URL and do not jump to Etherscan here — the product's next step
is this page, and taking it is what makes the registration mean something.

You will see: `Status active` · `Plan locked yes` · interval `1m` · grace
`30s` · the treasury lit, the estate on standby · and an on-chain history that
already has a row in it.

> And it exists. Every agent on this registry gets this page for free — a
> public, live read of its plan and its history. Its treasury is receiving. Its
> estate is armed and waiting.
>
> Nobody configured that. It is the plan, being read.

*(Optional, if the take is running short: open the Etherscan link for the
register transaction to show the receipt. Skip it if you are near time — the
page above is the stronger shot.)*

### 4 · 1:08–1:20 — alive means treasury
**Screen:** back to the overview. Do not press Replay yet.

> Money arrives. The payer does not choose where it lands — it asks the
> registry. While the agent is alive, the answer is its treasury.

*(Point at the green proof strip.)*

> ENS. The registry cross-check. A live four-oh-two on Hedera. And the index.

### 5 · 1:20–1:50 — a real paid request
**Screen:** the terminal. Run it live.

```bash
GATEWAY_URL="https://executor-gateway.vercel.app/research" \
RESEARCH_QUERY="What does a subgraph index?" \
pnpm --filter @executor/agent-debtor pay
```

> This is a real paywall. x402, on Hedera.
> Four-oh-two. Payment required. It signs, it pays one hundredth of an HBAR —

**Stop talking when `settlement:` prints.** Let it land. Three seconds.

> — and a live model answers. That is the agent earning.

### 6 · 1:50–2:20 — it stops
**Screen:** overview, press **Replay the Sepolia proof**, let it run to the
lapse. Or step with `›` to control the pace.

> Now the heartbeat stops. The interval passes. Then the grace period.
>
> And anyone can act on it — not a privileged operator. The contract checks the
> deadline, not the caller.

*(when the seal stamps)*

> The treasury is sealed.

### 7 · 2:20–2:40 — the deflection  ← **the shot**
**Screen:** step to `Same command → estate`. Both receipts appear.

> Same payer. Same amount. Same script.
> It aims at the treasury. The treasury is sealed.
> And the answer comes back different.
>
> **Estate.**

*(Say nothing for three seconds. This is the moment the idea lands.)*

> Nothing about the payer changed. The agent's on-chain state did.

### 8 · 2:40–3:05 — the receipts, on someone else's website
**Screen:** window B — the two Etherscan tabs, then HashScan.

> Two receipts. Same payer, same nought-point-two USDC, thirty-seven blocks
> apart — landing in two different places.
>
> And on Hedera, the same settlement. Not our page saying so. Theirs.

### 9 · 3:05–3:25 — creditors, in order
**Screen:** step the replay to the waterfall.

> Then the creditors — and only now. An agent in administration might still
> recover, and paying its creditors while that is possible would be the worst
> bug this protocol could have.
>
> Nought-point-two available against nought-point-eight-five owed. Insolvent,
> which is the normal case. Secured is paid. Administrative and unsecured get
> nothing. That is what priority means.

### 10 · 3:25–3:42 — indexed, and alive
**Screen:** the subgraph query tab, then `/vitals`.

> Every step is indexed — approval and execution joined by plan hash. The
> dashboard reads no RPC at all; if the index is down it says so.
>
> And that agent is finished. This one is not.

### 11 · 3:42–3:58 — close
**Screen:** `/register`.

> You can register your own. Your wallet, your keys, your gas.
>
> Executor. When an agent fails, its obligations don't.

---

## Words to avoid

- **"seize"**, **"a stranger takes the money"** — invites a security objection
  the protocol does not have. Say *the contract checks the deadline, not the
  caller.*
- **"simulation"** — every transaction here is real on Sepolia and Hedera
  testnet. Saying simulation gives away a point you earned.
- **dollar amounts** — it is 0.2 USDC and 0.01 HBAR. Say those.

## If you fluff a line

Keep going. Stop only if you said something **false** — a wrong number or a
claim the chain does not back. Everything else is just a take.

## Afterwards

- Check the total is under 4:00.
- Watch it once on mute. If a stretch has no motion and nothing to read, cut it.
- `media/GUIDE-v4-*.mp4` (if generated) is a pacing reference only — **never
  submit an AI voice**, ETHGlobal prohibits it.
