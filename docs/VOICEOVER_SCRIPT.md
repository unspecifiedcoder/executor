# Voiceover script — timestamped to the silent recording

The recording is **`media/executor-demo-silent.mp4`** — 1920×1080, 25fps, **3:20**,
**no audio track at all**. Every segment below is cut to a fixed length, so
these timestamps are exact: read each line inside its window and the picture
will match.

**ETHGlobal rules this satisfies** (from the event's own submission page):

| rule | this video |
|---|---|
| 2–4 minutes | 3:20 ✅ |
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

**One thing to know before you read it.** Everything in the middle six segments
is *one agent* — `0x96abf3c7…c36d4` — running the entire lifecycle, in order, on
public Sepolia. That is deliberate, and it is the thing to sound confident
about: an earlier cut proved the payment rail on one agent and the creditor
waterfall on another, which is a much weaker claim. This is one life.

---

## 0:00 – 0:22 · The problem
*(on screen: the live dashboard, drifting down into the on-chain history — a
column of real heartbeats arriving every 30 seconds)*

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

## 0:22 – 0:45 · The primitive
*(on screen: `getPaymentDestination` returning the treasury, then status Active)*

> Executor gives an agent a resolution plan it commits to before it fails.
>
> One contract on Sepolia. Every payment asks it the same question — get payment
> destination. While the agent is alive, the answer is its treasury.
>
> That's a live read against Sepolia, on an agent that is alive right now.

---

## 0:45 – 1:08 · It was genuinely alive
*(on screen: a GraphQL query to our subgraph returning eighteen heartbeats with
their gaps)*

> This is a different agent — one whose whole life already ran, start to finish.
>
> Here's its heartbeat history, out of our subgraph. Eighteen transactions, one
> every ninety-six seconds, for twenty-seven minutes. A signer proving liveness
> on an interval — and that signer is a different key from the owner, the
> trustee, and the recovery authority. Four separate authorities, on purpose.
>
> The gap column is an indexed field. It's a number the index computed while
> ingesting, not something the chain will hand you.

---

## 1:08 – 1:30 · A real payment, while alive
*(on screen: route-payment.sh reading the registry, then landing in the treasury)*

> Now a payment. The payer is never told where to send. The script reads get
> payment destination out of the registry at payment time and sends to exactly
> that address — the destination is not an argument you can pass it.
>
> Two hundred thousand units of real Circle USDC, into the treasury, at block
> eleven-six-seven-two-eight-nine-five.

---

## 1:30 – 1:52 · The agent dies
*(on screen: the TooEarly revert, then enterAdministration succeeding)*

> The heartbeat stops.
>
> Try it too early and the contract refuses — TooEarly. It won't take anyone's
> word that the agent is dead; the deadline has to have actually passed.
>
> Once it has, enter administration goes through. And look who called it — an
> address that is not the owner, not the signer, not the trustee, not the
> recovery key. Enter administration is permissionless. The contract checks the
> deadline, not the caller. Nothing here depends on a trustworthy party being
> awake.

---

## 1:52 – 2:14 · The same command, different money
*(on screen: the destination now returning the estate, then the two payments
stacked — treasury above, estate below)*

> Same question, same agent. The answer is now the estate contract.
>
> So run the identical command again. Same payer, same two hundred thousand
> USDC, same script — and the money lands somewhere else.
>
> Nothing about the payer changed. The agent's on-chain state did. That's the
> whole idea: the destination of a payment is late-bound to whether the payee is
> still alive.

---

## 2:14 – 2:40 · Creditors actually get paid
*(on screen: enterLiquidation by the trustee, then executePlan and the waterfall)*

> The estate isn't a forwarding address. The trustee declares liquidation — and
> only liquidation unlocks payouts, because an agent in administration might
> still recover, and paying its creditors while that's possible would be the
> worst bug this protocol could have.
>
> Then the waterfall runs, and anyone can run it. Two hundred thousand available
> against eight hundred and fifty thousand owed — insolvent, which is the normal
> case. Secured is paid in full. Administrative gets nothing. Unsecured gets
> nothing. The estate is drained to zero.
>
> And that is the same USDC that routed in ninety seconds earlier.

---

## 2:40 – 3:00 · The whole life, one query
*(on screen: one GraphQL request returning status, claims, execution, and every
status change)*

> Everything you just watched, in one request.
>
> The status. Every claim with what it was allowed and what it was actually
> paid. The execution, with its shortfall. And every status change — with who
> called it.
>
> That last column isn't in the event. It's the transaction sender, recovered
> while indexing. It's how you can see that a stranger moved this agent into
> administration, and the trustee only did the two steps that are actually the
> trustee's to make.
>
> This is what the dashboard reads. It replaced a log scan that paged the chain
> fifty thousand blocks at a time.

---

## 3:00 – 3:20 · Close, honestly
*(on screen: back to the live dashboard)*

> What's real: the registry, the flip, a hosted x402 service settling on Hedera,
> an ENS name that decides where money goes, a subgraph the dashboard actually
> depends on, and a settled estate — one agent, one life, all of it on a public
> chain. A hundred and four tests.
>
> What isn't: a human trustee still curates the claims, because a contract can't
> decide whether a debt is real. That part is deliberate.
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
