# Voiceover script — timestamped to the silent recording

The recording is **`media/executor-demo-silent.mp4`** — 1920×1080, 25fps, **3:34**,
**no audio track at all**. Every segment below is cut to a fixed length, so
these timestamps are exact: read each line inside its window and the picture
will match.

**ETHGlobal rules this satisfies** (from the event's own submission page):

| rule | this video |
|---|---|
| 2–4 minutes | 3:34 ✅ |
| ≥720p | 1080p ✅ |
| **human voice — TTS and AI voiceover are explicitly prohibited** | that is why you are reading this and not me |
| do not speed the video up | recorded at real time ✅ |
| do not record on a phone | screen capture ✅ |

**How to record it:** play the video, read along, capture your voice in anything
(Audacity, Voice Memos — your phone as a *microphone* is fine, just don't film
on it). Drop both into any editor and export. If a line runs long, pause between
sentences rather than rushing; the cut points are generous and all land on scene
changes, so joins are invisible.

**Tone:** explain it to a smart engineer who has never heard of this. Flat and
factual beats excited. Say the numbers out loud — spoken numbers make judges
look up.

**Three things to know before you read it.**

**Everything you see is the actual dashboard.** This is a screen recording of
`executor-dashboard.vercel.app`. A judge can open it and click the same buttons.

**The middle is one agent** — `0x96abf3c7…c36d4` — running the entire lifecycle,
in order, on public Sepolia, replayed from chain history with each step's
transaction one click away.

**Ten segments, and the fifth is the one that matters.** At 1:20 the payment
leaves aimed at the treasury, finds it sealed, and lands in the estate instead.
That shot runs 32 seconds — the longest hold in the cut. Do not talk over the
moment it deflects. Say the line, then stop and let it land.

---

## 0:00 – 0:12 · The problem
*(on screen: the overview at rest. Destination reads → treasury)*

> An autonomous agent earns money. It also owes money — an inference bill, a
> compute provider, whoever it buys from.
>
> Then it dies, and nothing stops. Its revenue keeps arriving at a wallet nobody
> operates, and the people it owes get nothing.

---

## 0:12 – 0:32 · It was genuinely alive
*(on screen: step 03, eighteen heartbeats, the trace beating)*

> Here is one agent's whole life, replayed from Sepolia.
>
> It was alive: eighteen heartbeats, one every ninety-six seconds, signed by a
> key that is not the owner's, not the trustee's, and not the recovery
> authority's. Four separate authorities, on purpose.
>
> And every payment asks the registry the same question — get payment
> destination. While it is alive, the answer is its treasury.

---

## 0:32 – 0:56 · A real payment, while alive
*(on screen: step 04, the packet flies and lands in TREASURY)*

> So here is a payment. The payer is never told where to send. The script reads
> get payment destination and sends to exactly that — the destination is not an
> argument you can pass it.
>
> Two hundred thousand units of real Circle USDC, into the treasury.
>
> Remember where that landed.

---

## 0:56 – 1:20 · The window lapses
*(on screen: step 06 — the trace flatlines, the clock hits 00:00, the treasury
takes a red SEALED stamp)*

> Now the heartbeat stops. The trace flatlines. The deadline runs out.
>
> And enter administration gets called — by an address holding none of the four
> roles. The contract checks the deadline, not the caller. Nothing here depends
> on a trustworthy party being awake.
>
> The treasury is sealed. It is no longer the destination.

---

## 1:20 – 1:52 · The same command
*(on screen: step 07. The packet leaves, aims at the treasury, hits the seal,
recoils, and deflects into the estate. **This is the shot — say the line, then
stop talking.**)*

> Same payer. Same two hundred thousand USDC. Same script.
>
> It aims at the treasury, finds it sealed, and the protocol sends it somewhere
> else.
>
> *(let it land — three or four seconds of silence)*
>
> Nothing about the payer changed. The agent's on-chain state did. That is the
> whole idea: the destination of a payment is late-bound to whether the payee is
> still alive.

---

## 1:52 – 2:12 · Only liquidation unlocks payouts
*(on screen: step 08, liquidation, the waterfall still shut)*

> The trustee declares liquidation. Only this unlocks payouts — an agent in
> administration might still recover, and paying its creditors while that is
> possible would be the worst bug this protocol could have.
>
> Until this moment the creditor book is closed, and the page says so.

---

## 2:12 – 2:36 · Creditors, in order
*(on screen: step 09, the waterfall fills — secured only)*

> Then the waterfall runs, and anyone can run it. Two hundred thousand available
> against eight hundred and fifty thousand owed — insolvent, which is the normal
> case.
>
> Secured is paid as far as the money goes. Administrative gets nothing.
> Unsecured gets nothing. Shortfall, six hundred and fifty thousand.
>
> And that is the same USDC that routed in a minute ago.

---

## 2:36 – 2:52 · Wound up
*(on screen: step 10, resolved)*

> The trustee winds it up. Terminal — and the estate can still pay out late
> revenue, because resolving first must not strand anyone.
>
> What you just watched is ten transactions on a public chain. Every step on
> that page links to the one that performed it.

---

## 2:52 – 3:06 · And this one is alive right now
*(on screen: /vitals — the live agent, trace running, countdown ticking)*

> That agent is finished. This one isn't.
>
> Same registry, same contract, beating right now.

---

## 3:06 – 3:34 · And you can make your own
*(on screen: /register — "One registry. Any agent. Your keys, your plan.")*

> And you can put your own agent on it. Same contract, your wallet, your keys,
> your gas — we hold nothing that could stop you. Register a plan, keep it
> alive, then stop, and watch anyone at all redirect its revenue.
>
> What's real: the registry, the flip, a hosted x402 service selling LLM queries
> on Hedera, an ENS name that decides where money goes, and a settled estate.
> A hundred and twenty-six tests.
>
> What isn't: a human trustee still curates the claims, because a contract can't
> decide whether a debt is real. And a dead agent stops earning — so this matters
> most where revenue outlives its operator. Both are on the page.
>
> Executor. When an agent fails, its obligations don't.

---

## If you fluff a line

Don't restart. Re-record that one segment and splice — every cut point above is
on a scene change, so joins are invisible.

## Words to avoid

- Don't call the paid endpoint an "AI agent" — it's a paid service that runs an
  LLM query. Overclaiming it is the one thing that would undo the honesty this
  project is scoring well on.
- Don't say "fully automated" — the trustee is human and the Hedera↔Sepolia
  bridge is manual. Both are in the README and neither costs you anything to
  admit.

## Every number spoken above, and where it came from

| claim | verify with |
|---|---|
| 18 heartbeats, 96s apart | `cast logs --address $REGISTRY "Heartbeat(bytes32,uint64)"` |
| pay #1 → treasury, block 11672895 | tx `0x731319100c29e25cf27270085ef91caaba946f9907cd14dfa67e33ef8ea243c5` |
| enterAdministration, block 11672930 | tx `0x345811aa27275686899f84ec30c6b5c602cf6cc0d60e5be1edbb263e6ae2ea8e` |
| pay #2 → estate, block 11672932 | tx `0x17b0f95681e3fea74423e06978d319ca1d57a20228480191f12c99d8816d37ad` |
| enterLiquidation, block 11672934 | tx `0x8a5121bb95318a52a292ebe4df962d5a04262634bdfc2ec7de69677e90a39242` |
| executePlan, secured paid 200000 | tx `0xb693dbab092d82cb70379969b7880bc3103874498bafe48682d0882e9a8bafc8` |
| resolve, terminal | tx `0xba2355020125ac12cfd06af36f0e6c3593281dcdfbfd81151a660149b2bceda9` |
| every number in the two Graph segments | one `curl` to the subgraph endpoint below |

Agent `0x96abf3c7f8f72fdf248e91137fb471a442dccf3fcece378b2065616cb68c36d4`,
estate `0xD52b37AD931F221A902fC7F43A9ed2D87Ce07C5F`, registry
`0x2946B46c2EB5Ec532093877223Ef043b13729e39`, USDC
`0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238` — all Sepolia.

Subgraph: `https://api.studio.thegraph.com/query/1760047/executor/v0.1.1` —
public, no key required.
