# Voiceover script — timestamped to the silent recording

The recording is **`media/executor-demo-silent.mp4`** — 1920×1080, 25fps, **3:26**,
**no audio track at all**. Every segment below is cut to a fixed length, so
these timestamps are exact: read each line inside its window and the picture
will match.

**ETHGlobal rules this satisfies** (from the event's own submission page):

| rule | this video |
|---|---|
| 2–4 minutes | 3:26 ✅ |
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

**Two things to know before you read it.**

**Everything you see is the actual dashboard.** An earlier cut used a console
page built only for recording, so the video and the live site were two different
products. This is a screen recording of `executor-dashboard.vercel.app` — a
judge can open it and click the same buttons.

**The middle is one agent** — `0x96abf3c7…c36d4` — running the entire lifecycle,
in order, on public Sepolia, replayed from chain history with each step's
transaction one click away. Sound confident about that: an earlier cut proved
the payment rail on one agent and the waterfall on another, which is a much
weaker claim.

---

## 0:00 – 0:22 · The problem
*(on screen: the live dashboard, drifting down past the routing panel and the
liveness trace)*

> An autonomous agent earns money. It also owes money — an inference bill, a
> compute provider, whoever it buys from.
>
> Then it dies. The process stops, the key goes quiet, and nobody is watching.
> Its revenue keeps arriving at a wallet nobody operates, and the people it owes
> get nothing.
>
> We have given agents wallets, identities, and the ability to earn. What we
> haven't given them is a standard process for resolving what they owe when they
> stop operating.

---

## 0:22 – 0:40 · The primitive
*(on screen: the replay panel, at rest on step one)*

> Here is one agent's entire life, replayed from Sepolia.
>
> Every payment asks the registry the same question — get payment destination.
> Follow that line down: the agent's id, the registry, the answer. Right now the
> answer is its treasury.

---

## 0:40 – 0:50 · The plan is a pre-commitment
*(on screen: step 2, lock plan)*

> The plan is locked before anything goes wrong. From here, update plan reverts.
> The treasury, the estate, the timing — none of it can be changed, not even by
> the owner.

---

## 0:50 – 1:02 · It was genuinely alive
*(on screen: step 3, eighteen heartbeats)*

> Eighteen heartbeats, one every ninety-six seconds, signed by a key that is not
> the owner's, not the trustee's, and not the recovery authority's. Four separate
> authorities, on purpose.

---

## 1:02 – 1:18 · A real payment, while alive
*(on screen: step 4, the packet lands in TREASURY)*

> Now a payment. The payer is never told where to send — the script reads get
> payment destination and sends to exactly that. The destination is not an
> argument you can pass it.
>
> Two hundred thousand units of real Circle USDC, into the treasury.

---

## 1:18 – 1:30 · The agent dies
*(on screen: step 5, heartbeat stops)*

> The heartbeat stops. The deadline — interval plus grace — begins to lapse.

---

## 1:30 – 1:46 · Anyone can call it
*(on screen: step 6, enterAdministration, actor marked "stranger")*

> Enter administration. Look at who called it: an address holding none of the
> four roles. The contract checks the deadline, not the caller.
>
> Nothing here depends on a trustworthy party being awake.

---

## 1:46 – 2:06 · The same command, different money
*(on screen: step 7 — the lit face moves from TREASURY to ESTATE, and the packet
lands there instead. **This is the shot. Let it breathe.**)*

> Same payer. Same two hundred thousand USDC. Same script.
>
> And the money lands somewhere else.
>
> Nothing about the payer changed. The agent's on-chain state did. That is the
> whole idea: the destination of a payment is late-bound to whether the payee is
> still alive.

---

## 2:06 – 2:18 · Only liquidation unlocks payouts
*(on screen: step 8, enterLiquidation)*

> The trustee declares liquidation. Only this unlocks payouts — an agent in
> administration might still recover, and paying its creditors while that is
> possible would be the worst bug this protocol could have.

---

## 2:18 – 2:36 · Creditors, in order
*(on screen: step 9, the waterfall filling)*

> Then the waterfall runs, and anyone can run it. Two hundred thousand available
> against eight hundred and fifty thousand owed — insolvent, which is the normal
> case.
>
> Secured is paid as far as the money goes. Administrative gets nothing.
> Unsecured gets nothing. Shortfall, six hundred and fifty thousand.
>
> And that is the same USDC that routed in a moment ago.

---

## 2:36 – 2:46 · Wind-up
*(on screen: step 10, resolve)*

> The trustee winds it up. Terminal — and the estate can still pay out late
> revenue, because resolving first must not strand anyone.

---

## 2:46 – 3:06 · What the index gives you
*(on screen: the liveness history panel)*

> This agent's cadence — heartbeat count, median gap, longest gap, against the
> deadline the contract enforces. Those are aggregates over the whole series, so
> they come from our subgraph rather than a contract call.
>
> Read that as observability, not proof of work. A regular cadence is cheap to
> manufacture, and we say so on the panel.

---

## 3:06 – 3:26 · Close, honestly
*(on screen: back at the top of the live dashboard)*

> What's real: the registry, the flip, a hosted x402 service settling on Hedera,
> an ENS name that decides where money goes, a subgraph the dashboard depends on,
> and a settled estate. A hundred and twenty-six tests.
>
> What isn't: a human trustee still curates the claims, because a contract can't
> decide whether a debt is real. And the ENS name and the waterfall are proven on
> two different agents — no code joins them yet. Both are on the page.
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
