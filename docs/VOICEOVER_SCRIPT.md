# Voiceover script — timestamped to the silent recording

The screen recording is `executor-demo-silent.mp4` (1920×1080, no audio). Every
segment below is cut to a fixed length, so these timestamps are exact — read
each line inside its window and the picture will match.

**ETHGlobal rules this has to satisfy** (verified from the event's own
submission page):
- 2–4 minutes total ✅ (this is **3:00**)
- ≥720p ✅ (1080p)
- **Human voice — text-to-speech and AI voiceover are explicitly prohibited.**
  That is why you are reading this and not me.
- Do not speed the video up
- Do not record on a phone

**How to record it:** play the silent video, read along, capture your voice in
anything (Audacity, Voice Memos, your phone as a *mic* is fine — just don't
film on it). Then drop both into any editor and export. If a line runs long,
pause between sentences rather than rushing — the cut points are generous.

Tone: explain it to a smart engineer who has never heard of this. Flat and
factual beats excited. Say the numbers out loud — spoken numbers make judges
look up.

---

## 0:00 – 0:22 · The problem
*(on screen: the live dashboard)*

> An autonomous agent earns money. It also owes money — an inference bill, a
> compute provider, whoever it buys from.
>
> Then it dies. The process stops, the key goes quiet, and nobody is watching.
> Its revenue keeps arriving at a wallet nobody operates, and the people it owes
> get nothing. There is no insolvency process for software.

---

## 0:22 – 0:45 · The primitive
*(on screen: terminal — `getPaymentDestination` returning the treasury)*

> Executor gives the agent a resolution plan it commits to before it fails.
>
> One contract on Sepolia. Every payment asks it the same question — get payment
> destination. While the agent is alive, the answer is its treasury. This is a
> live read, right now.

---

## 0:45 – 1:08 · It was genuinely alive
*(on screen: the heartbeat history on chain)*

> This agent was alive. That's its heartbeat history on Sepolia — a signer
> proving liveness on an interval, each one a real transaction.
>
> Its plan is locked. The treasury, the estate, the timing — none of it can be
> changed now, not even by the owner. Lock plan is one way.

---

## 1:08 – 1:30 · A real payment, while alive
*(on screen: routed payment landing in the treasury)*

> Here's a payment. The payer never gets told where to send — it reads the
> destination out of the registry at payment time, and sends there.
>
> Two hundred thousand units of real Circle USDC, into the treasury.

---

## 1:30 – 1:52 · The agent dies
*(on screen: the heartbeat stopping, then enterAdministration)*

> Now the heartbeat stops.
>
> The window lapses, and enter administration is called. Notice who called it —
> nobody privileged. The contract checks the deadline, not the caller. Any
> stranger can do this. That's the point: nothing depends on a trustworthy party
> being awake.

---

## 1:52 – 2:14 · The same command, different money
*(on screen: identical routed payment landing in the estate)*

> Same command. Same payer. Same agent.
>
> But the money went somewhere else — into the estate contract — because the
> agent's on-chain state changed and the payment asked the protocol where to go.
>
> That's the whole idea: the destination of a payment is late-bound to whether
> the payee is still alive.

---

## 2:14 – 2:40 · Creditors actually get paid
*(on screen: liquidation, then the waterfall paying out)*

> The estate isn't a forwarding address. The trustee declares liquidation — and
> only liquidation unlocks payouts, because an agent in administration might
> still recover, and paying its creditors while that's possible would be the
> worst bug this protocol could have.
>
> Then the waterfall runs. Secured first, in full. Administrative next, split
> pro-rata. Unsecured last, and there's nothing left for them. Real USDC, on a
> public chain.

---

## 2:40 – 3:00 · Close, honestly
*(on screen: the dashboard)*

> What's real: the registry, the flip, a hosted x402 service on Hedera, an ENS
> name that decides where money goes, and a settled estate. A hundred and four
> tests.
>
> What isn't: a human trustee still curates the claims — because a contract
> can't decide whether a debt is real. That part is deliberate.
>
> Executor. When an agent fails, its obligations don't.

---

## If you fluff a line

Don't restart the whole thing. Record that one segment again and splice — the
cut points above are all on scene changes, so joins are invisible.

## Words to avoid

- Don't call the paid endpoint an "AI agent" — it's a paid service that runs an
  LLM query. Overclaiming it is the one thing that would undo the honesty this
  project is scoring well on.
- Don't say "fully automated" — the trustee is human and the bridge is manual.
  Both are stated in the README and neither costs you anything to admit.
