---
name: executor-ui
description: Use when changing anything visual in apps/dashboard — components, globals.css, a new page or panel — or when recording the demo video. Carries the design tokens, the house rules, and the failure modes this UI has already hit.
---

# Executor dashboard UI

The dashboard argues that a payment's destination is late-bound to whether the
payee is alive. Every visual decision serves that one sentence. If a change does
not help a judge believe it, it does not belong.

## Before you write CSS

**Propose first, then wait.** Read the existing code, list the live data
bindings, and show a component tree or a throwaway mock. Do not write styles
until it is approved. Building ahead has already cost a wasted 3.5-minute video
take and hours of rework here.

**Show mocks locally, never as a published artifact.** Write the HTML to a
scratch dir, render it with headless Chrome, screenshot it, and send the PNG.

```bash
# /opt/google/chrome/chrome needs --no-sandbox in this environment
node -e '...' # playwright-core lives in the repo root node_modules
```

## Tokens — use them, never literals

Defined twice: `:root` in `apps/dashboard/app/globals.css`, and again scoped on
`.overview`. Scoped names differ from the global ones; check which scope you are
in before reaching for a colour.

```
ground      --bg #04060b   --raised #090e18
ink         --text #e6edf7  --dim #7c8ba3  --faint #3d4a60
hairlines   --border rgba(150,190,235,.11)  --border-strong …(.2)

state       --active #35f0c0   alive, receiving, success
            --administration #ffb545   lapsed, sealed, needs attention
            --liquidation #ff5470      terminal, destructive
            --succession #6ea8ff       links and hashes

inside .overview the same roles are named
            --alive / --lapsed / --terminal / --sealed-c

space  --s1 4 · s2 8 · s3 12 · s4 16 · s5 24 · s6 36 · s7 56 · s8 88
type   --t1 10 · t2 11 · t3 12 · t4 14 · t5 17 · t6 23 · t7 31 · t8 64
ease   --ease-settle (arriving)  --ease-press (input)  --ease-pop (rare)
```

**Semantic colour is not decoration.** Green means a live agent receiving
money; amber means a lapsed one. Never use them because a thing looks nice in
green.

## Type

Only two families are actually loaded (`@import` at the top of `globals.css`):

- **Instrument Serif** — headlines only, and italic for the one emphasised
  phrase. It is the single expressive gesture on the page.
- **IBM Plex Mono** — everything else. Instrument readouts are monospace, and
  most of this UI is a readout.

The token block still comments on **Archivo** and **Michroma**. Neither is
imported, so `--sans` falls through to the system stack and `--display` falls to
`--sans`. Treat that comment as stale; do not add fonts back without asking —
a heavy grotesque headline was tried here and rejected for reading as
AI-default.

## Layout rules

- `.overview` caps at 1180px. Pages are one column of full-bleed bands divided
  by hairlines, not a grid of cards.
- **Border is rationed.** On the overview it is spent on exactly two objects —
  the treasury and the estate — because they are what the page is about.
  Everything else is a plane divided by hairlines. Adding a bordered card
  anywhere else flattens that hierarchy.
- One breakpoint: `900px`. Honour `prefers-reduced-motion` on anything moving.
- Digits that line up get `font-variant-numeric: tabular-nums`.

## Hierarchy: the lesson this UI learned twice

**Size the thing that differs, not the thing that is important.**

The destination board originally set the Hedera account at 62px. But
`0.0.10423643` and `0.0.10423647` differ by one digit — both states looked
identical at a glance. The fix was to make the *word* the hero (TREASURY /
ESTATE, which share no letters) and demote the number to evidence.

Before sizing anything large, ask what it looks like in the *other* state. If
the two states are indistinguishable, you have sized the wrong element.

Related: an empty grey bar reads as a **loading skeleton that failed**, not as
"locked". The waterfall's sealed state needed amber diagonal hatching plus a
`SEALED` label before it stopped looking broken. State must be encoded in form,
not only in absence.

## Data, and what to do when it is missing

- `lib/subgraph.ts` — history and liveness. **No RPC fallback, by design.** If
  the subgraph fails, render an explicit error; never silently substitute an
  RPC read, because a page that quietly changes its source of truth is worse
  than one that admits it is blind.
- `lib/ens.ts` — live chain reads (status, plan, payment destination).
- `lib/proof.ts` — the agent-3 lifecycle. Every step carries a real transaction
  hash. **A step without a hash does not belong in that array.**
- `app/api/rail/route.ts` — the payment rail read live (gateway `/payto`, a real
  402 challenge, Hedera mirror node). Same stance: no cached fallback.

Error copy must name the right source. This page once said "This is an RPC
failure" while catching a *subgraph* error — in a design whose whole point is
which source is speaking.

## Claims must be checkable

Anything asserted on screen should be verifiable without trusting us:

- render the transaction hash and link it to the explorer;
- when the claim is a comparison ("same payer, different destination"), put
  **both** receipts on the same frame — a judge will not memorise a hash from
  fifty seconds ago;
- label units honestly. `200000` base units is `0.2 USDC` on Etherscan; showing
  `200000 USDC` next to a link that says `0.2` reads as a contradiction.

## Recording the demo

**Build → start → record, in that order, always.** Running `next build` while a
previous `next start` is still serving makes the browser request chunk
filenames the rebuild replaced; the last take captured half a `ChunkLoadError`
screen.

```bash
cd apps/dashboard && npx next build && npx next start -p 3100   # one shell
node scripts/record-demo/record-v2.mjs                          # another
```

- Recorder fires each transition **at** its mark, so animations play in the
  first ~2s of a slot and the screen is then static. Narration must *lead* each
  cut by 2–4s so the payoff word lands on it — starting a line at its mark puts
  the payoff 10–20s late.
- Never hold a still frame longer than ~20s.
- Kill strays by PID from `ss -ltnp`. `pkill -f "next ..."` matches your own
  shell command line and returns 144.
- ffmpeg at 1080p needs headroom; free memory before encoding or it dies with
  "Cannot allocate memory" and writes a truncated file.

## Things that break silently

- **The heartbeat runner dies with its shell**, and has gone stale for hours
  while the process was still alive. Verify on chain (subgraph `lastHeartbeat`),
  never with `ps`.
- **Never call `enterLiquidation` on the live demo agent** (`0x6574c8cc…cb37`).
  One-way; `restoreActive` cannot undo it.
- This is a **pnpm workspace**. `npm install` at the root breaks the lockfile
  and the Next build. Use `pnpm --filter @executor/dashboard add …`.

---

# PART II — DESIGN DIRECTION

Everything above is what this codebase has learned. Everything below is the
standard it is held to. Where the two disagree, **Part III reconciles them** —
read it before acting on anything in Part II.

## Role

You are not a generic frontend developer. You are a product designer,
interaction designer, creative technologist and hackathon demo designer working
on a project competing at ETHOnline 2026. Your job is to make Executor
**impossible to ignore and extremely easy to understand visually**.

Think like a combination of: Apple HIG, Linear, Stripe's developer experience,
Vercel's clarity, high-end fintech, Bloomberg's information density, a
world-class motion designer, and an ETHGlobal judge with two minutes of
attention.

The output must never look like a generic AI-generated SaaS dashboard.

## The problem the UI must convey

AI agents can earn money and owe money. When an autonomous agent stops
functioning permanently it may still hold assets, receive future revenue, owe
creditors, and carry outstanding obligations — and there is no resolution
process for software. Executor lets an agent commit to a resolution plan
*before* it fails.

```
AGENT ACTIVE → STOPS OPERATING → INACTIVITY VERIFIED → EXECUTOR ACTIVATES
→ ASSETS + FUTURE REVENUE ROUTED BY A PRECOMMITTED PLAN → CREDITORS PAID
```

The interface must make this understandable without a whitepaper.

## Primary goal — the 5 second test

A judge must understand the core idea within **five seconds**:

> "This AI agent has a financial life. If it dies, Executor automatically
> resolves its financial obligations."

Every screen must answer, visually: What is this? Who does it belong to? What
state is it in? What happens next? Why should I care? If visual hierarchy alone
cannot answer those, redesign the screen.

## Do not design a dashboard

Dashboards are boring, require reading, and make everything equally important.
Executor needs a **story** — mission control for an autonomous economic entity,
not an admin panel with cards.

**Extreme visual hierarchy.** One primary element, one primary action, one
primary story per screen. Everything else supports it. No ten equally-sized
cards. No "Total Balance / Active Users / Transactions" tiles.

**Attention design.** Optimise for low cognitive load and high visual signal:
large visual anchors, clear state changes, progressive disclosure, meaningful
motion, obvious before → after, strong contrast, minimal reading.

## State-driven design

Executor is fundamentally a state machine and the UI must exploit that. Show the
lifecycle as a visual system — timeline, connected nodes, execution pipeline,
flow — never as body text. The user must see **where the agent is** and **what
happens next** without documentation.

The state should change the emotional character of the whole interface.

## The WOW moment

Every demo needs one moment that makes a judge say *"Oh. I get it."* The
strongest candidate is simulating agent death: status changes, the visual system
transitions, revenue stops routing to the agent, Executor activates, the plan
appears, assets move through visible pathways, recipients are paid.

It should feel like watching a protocol execute. Do not bury it in a modal,
confirmation dialog or nested menu — **the main screen should transform**.

## Execution visualisation

When resolution activates, show value moving: animated lines, transaction
streams, nodes, directional flow. Movement explains the protocol. Do not render
literal ASCII diagrams.

## Information hierarchy

```
L1  AGENT STATE          L2  THE AGENT (identity, economic status)
L3  MONEY FLOW           L4  RESOLUTION PLAN (who gets what)
L5  TECHNICAL DETAIL     addresses, hashes, timestamps — never dominant
```

## Never make everything a card

Cards are containers, not design. Reach for canvas space, typography, lines,
layers, grouping, composition, scale and motion **before** adding a container.

## Visual style

Feel: premium, futuristic, financial, autonomous, trustworthy, technical.
Not crypto-bro, not generic SaaS, not gaming UI, not cyberpunk cliché.

Avoid excessive neon, rainbow gradients, glowing purple, generic glassmorphism,
excessive blur, floating cards, coin icons.

## Colour as information

Neutral/calm = active · amber = warning · orange = at risk · red = terminated ·
electric accent = executing · green = resolved. Never all at once; the current
state should influence the colour environment.

## Typography

Very large, very clear, very deliberate. `ACTIVE` may matter more than a page
title. Large numbers, short labels, monospace for technical data, strong
contrast between primary and secondary.

Never write "Welcome back, Ravi!" or "Here's what's happening today."

## Microcopy

Confident, technical, precise, minimal. Prefer verbs, nouns, status, numbers.

```
BAD   "Your agent appears to currently be functioning normally…"
GOOD  AGENT HEALTHY
BAD   "Click here to begin the execution process."
GOOD  EXECUTE PLAN
BAD   "Your funds will be distributed to the beneficiaries you configured."
GOOD  PRECOMMITTED DISTRIBUTION
```

## Interaction and motion

Every interaction must answer **what changed?** — state, number, flow, timeline,
node. Animation must communicate **causality**, not decoration. The app should
feel *alive*, not *busy*.

## Build for the demo

This is a hackathon, not enterprise completeness. Do not build settings, user
management, profile pages or notification systems. Build one excellent story: an
active agent → it earns and owes → its precommitted plan → trigger failure →
watch resolution → verify the outcome.

## Design for screenshots

Any random frame should say *this is a protocol for autonomous agent
resolution*. Avoid screens that require interaction before becoming interesting.

## Tests to apply before shipping

- **Squint test** — at a squint you must still see agent, state, money flow,
  next action. If everything is one visual weight, redesign.
- **No-text test** — remove 70% of the words. Is Agent → Failure → Executor →
  Distribution still legible? If not, fix the visuals, do not add text.
- **Generic UI detector** — could this component belong to any fintech SaaS?
  Then redesign it.
- **Dribbble detector** — pretty but explains nothing? Redesign it.
- **Judge test** — they have seen 30 projects, are tired, and will not scroll,
  read docs, hover tooltips or navigate pages to understand the idea.

## Before writing UI code, deliver

1. **Design concept** — the visual metaphor.
2. **User attention path** — the order the eye travels.
3. **Primary screen composition** — dominant, secondary, supporting.
4. **WOW moment** — the exact interaction.
5. **Why this is not generic** — explicitly.

Only then implement.

## After implementing, critique — do not say "looks great"

Is the idea visible in 5 seconds? Is it distinctive? Too many cards? One
dominant anchor? Understandable without reading? Does motion explain causality?
Does it look AI-generated? Would it stand out among 50 projects? **What is the
weakest part — then fix it.**

## Prohibitions

No generic dashboard · no sidebar with ten links · no wall of cards · no
meaningless statistics · no lorem ipsum · no generic SaaS copy · no gradient or
glassmorphism overuse · no hiding the core interaction · no scrolling required
to grasp the concept · no decorative animation · no crypto clichés.

## Quality bar

The judge should finish thinking **"I haven't seen this before."** Do not stop
at clean, modern, or professional. The target is **memorable and immediately
understandable**.

---

# PART III — WHERE THE DIRECTION MEETS THE CHAIN

Part II is the aspiration. This repo has one rule that outranks it: **nothing on
screen may claim something the chain does not say.** Four specific collisions:

**State names are fixed by the contract.** `AGENT_STATUS_LABEL` in
`lib/ens.ts` is `active · administration · liquidation · resolved`. Part II's
"AT RISK / RESOLUTION PENDING / EXECUTING" are not states this protocol has.
Invent a label and the UI contradicts `getStatus()`, which a judge can call.
Design *around* the four real states — the drama is already there, because
Administration is recoverable and Liquidation is not.

**Money is testnet and small.** Real figures are `200000` base units
(= 0.2 USDC) and 0.01 HBAR. Part II's `$12,480` is illustrative only. Never
render an invented balance; a fabricated number is the one thing that would end
this submission. If a figure looks unimpressive, that is the honest cost of it
being real.

**The agent has a real name.** `executor-hackathon-demo.eth`, resolving through
ENSv2. Not `EXECUTOR-01`.

**"Simulate termination" already exists** as `[ SIMULATE FAILURE ]` on
`/vitals`, and it sends a **real transaction**. It reaches Administration only —
never wire it to `enterLiquidation`, which is one-way.

One tension worth naming rather than hiding: Part II says avoid glow and neon,
while the live UI uses `text-shadow` glow on state words and the heartbeat
trace. That is a deliberate instrument-display reference, not decoration. Keep
it rationed to state and vitals; if it spreads to ordinary text, it has become
the cliché Part II warns about.
