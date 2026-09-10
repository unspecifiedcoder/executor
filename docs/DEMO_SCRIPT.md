# Demo video — shot-by-shot script

**Target: 4:30, hard cap 5:00** (Hedera's limit; ENS accepts video or live demo).
Record at 1920×1080. Everything below is real and currently live — no mockups,
no "imagine if". Every URL and hash here was verified before this script was
written.

**Before you hit record**
- Open tabs, in this order: dashboard, gateway 402, Etherscan registry, HashScan.
- Terminal ready in `packages/agent-debtor`, font size up (judges watch on laptops).
- Check the demo agent is **Active**:
  `cast call 0x2946B46c2EB5Ec532093877223Ef043b13729e39 "getStatus(bytes32)(uint8)" 0x6b7f61f16d01348d0b80bac1e63e0abb99eb377294a49d1f22181e912daf5255 --rpc-url https://ethereum-sepolia-rpc.publicnode.com`
  → must print `0`. If it prints `1`, hit RESET DEMO on /vitals first.
- Say the numbers out loud as they appear. Judges are half-listening; the
  spoken number is what makes them look up.

---

## 0:00 – 0:25 · The problem

**On screen:** https://executor-dashboard.vercel.app — the hero.

> "An autonomous agent earns money. It has obligations — an API bill, a
> compute provider, whoever it owes. Then it dies. The process stops, the key
> goes quiet, nobody's watching. Its revenue keeps arriving at a wallet nobody
> operates, and its creditors get nothing.
>
> Executor is a living will for that agent. When it stops heartbeating, its
> payment destination flips on-chain. No human in the loop."

Don't linger. The hero exists to set up the mechanism.

---

## 0:25 – 1:05 · The primitive, on a real chain

**On screen:** the FlowPanel on the right of the hero — Treasury lit, particles
flowing toward it.

> "One contract on Sepolia. Every payment asks it the same question:
> `getPaymentDestination`. While the agent is alive, that returns its
> treasury."

**Cut to terminal.** Run it live — do not read it off a slide:

```bash
cast call 0x2946B46c2EB5Ec532093877223Ef043b13729e39 \
  "getPaymentDestination(bytes32)(address)" \
  0x6b7f61f16d01348d0b80bac1e63e0abb99eb377294a49d1f22181e912daf5255 \
  --rpc-url https://ethereum-sepolia-rpc.publicnode.com
```

> "0x7ea7 — the treasury. That's live Sepolia, not a fixture."

---

## 1:05 – 1:50 · The paywall, hosted and payable by anyone

**On screen:** terminal.

> "Here's a real x402 service on Hedera, hosted — you can hit it right now."

```bash
curl -i https://executor-gateway.vercel.app/research
```

> "402 Payment Required. And look at the challenge — `payTo: 0.0.10423643`.
> The gateway didn't hardcode that. It read `getPaymentDestination` from
> Sepolia, on this request, and mapped it to a Hedera account."

**This is the idea nobody else will have. Say it plainly:**

> "The payment destination is late-bound to on-chain state. Same endpoint,
> same price — the money's destination is decided by whether the agent is
> still alive."

---

## 1:50 – 2:35 · Pay it while the agent is alive

```bash
GATEWAY_URL=https://executor-gateway.vercel.app/research \
  npx tsx src/pay-for-research.ts
```

> "One real paid request. Settled through Blocky402 on Hedera testnet."

**Cut to HashScan**, paste the settlement transaction id.

> "One million tinybars — a hundredth of an HBAR — credited to 0.0.10423643.
> The treasury. Remember that number."

---

## 2:35 – 3:20 · Kill it

**On screen:** https://executor-dashboard.vercel.app/vitals

> "Now the agent dies."

Click **SIMULATE FAILURE** → **STOP HEARTBEAT**.

Let the heartbeat waveform go flat and dashed. Let the burst animation play.
**Do not talk over the flip** — give it the two seconds.

> "That's a real transaction. The contract checked the heartbeat deadline had
> lapsed and moved the agent into administration. Notice nobody privileged did
> that — `enterAdministration` is permissionless. Any stranger can call it.
> That's the point: nothing depends on someone trustworthy being awake."

---

## 3:20 – 4:05 · The same command, different money

**Back to terminal. Identical command. Emphasise that.**

```bash
GATEWAY_URL=https://executor-gateway.vercel.app/research \
  npx tsx src/pay-for-research.ts
```

> "Same command. Same endpoint. Same price."

**Cut to HashScan** on the new settlement id.

> "0.0.10423647. The estate. The client changed nothing, the endpoint changed
> nothing — the agent's on-chain state changed, and the money followed."

**This is the moment the whole project exists for. Let it sit for a beat.**

---

## 4:05 – 4:30 · Creditors actually get paid

> This one is real and filmable — it ran on Sepolia with Circle's actual USDC.
> Use **agent 2's** estate, not the demo agent's:
> **`0x83f447FAb4E1267Ca5fd6Ebe151a93b462EFfC7F`**
> (agent `0x3bb9846e…cc67`). Its `ClaimPaid` / `PlanExecuted` events are the
> strongest artifact in the project.

**On screen:** Etherscan on the Estate contract `0x83f447FA…Eb832`, Events tab.

> "And the estate isn't a forwarding address. It's a contract holding real
> Circle USDC, with creditor claims ranked by priority — secured, then
> administrative, then unsecured — paid pro-rata when there isn't enough to go
> around. Which is the normal case in an insolvency."

Show the `executePlan` transaction and the `ClaimPaid` events.

> "Secured paid in full, administrative partially, unsecured nothing. That's a
> real waterfall on a public chain."

---

## 4:30 – 4:50 · Close on what's honest

Don't oversell here. Judges have seen forty projects overclaim today; being
the one team that draws its own line is worth more than another feature.

> "What's real: the registry, the flip, the hosted x402 gateway, the payments,
> the ENSv2 role lock, ENS in the payment path, and the estate. 104 tests, CI,
> and every address in the
> README is verifiable with one cast call.
>
> What isn't: a human trustee still curates the claims — because a contract
> can't decide whether a debt is real. And the ENS succession lock isn't
> permanent; it lapses if the name expires. That part is deliberate."

**End on the dashboard URL on screen for the last three seconds.**

---

## If you only have 90 seconds (backup cut)

Some judges skim. Have this ready:

1. `curl` the 402 → point at `payTo` (0:20)
2. Click the flip on /vitals (0:30)
3. `curl` again → `payTo` **changed** (0:20)
4. "Same endpoint. The agent died. The money went somewhere else." (0:20)

---

## Facts you may need on camera

| | |
|---|---|
| Dashboard | https://executor-dashboard.vercel.app |
| Gateway | https://executor-gateway.vercel.app/research |
| ExecutorRegistry (Sepolia) | `0x2946B46c2EB5Ec532093877223Ef043b13729e39` |
| Estate (Sepolia) | `0xD67a10D5466d311C2f995744937c7b9e1734286f` |
| USDC (real Circle Sepolia) | `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238` |
| Agent id | `0x6b7f61f1…5255` |
| Treasury / Estate on Hedera | `0.0.10423643` / `0.0.10423647` |
| ENS name | `executor-hackathon-demo.eth` (ENSv2, Sepolia) |
| Facilitator | Blocky402, `https://api.testnet.blocky402.com` |

**Do not say** "AI agent" about the paid endpoint — it serves a demo response.
Say "a paid service". The mechanism is the story, and it's strong enough
without dressing it up.
