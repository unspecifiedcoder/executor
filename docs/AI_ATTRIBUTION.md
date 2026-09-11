# How this project was built, and where AI was used

ETHOnline requires that AI tool use be documented specifically, and that
submissions show meaningful contribution from the team rather than relying
entirely on AI. This is that document, written plainly, because a vague version
would be worth less than none.

**Short version:** Claude Code (Opus 5) wrote most of the source. The
architecture, the protocol design, the review method that found the worst bug in
it, and every judgement call about what to keep and what to withdraw were the
team's.

This document is the disclosure, not the commit trailers. Many commits carry a
`Co-Authored-By: Claude Opus 5` line and later ones do not — the convention was
dropped partway through, which is a formatting choice and says nothing about how
much of any given file was AI-written. Read this table instead; it covers the
whole repository, and `git log` will confirm every specific claim below.

---

## Who did what

| | Team | Claude Code |
|---|---|---|
| Protocol design — the state machine, the four authorities, what `getPaymentDestination` returns in each state | **Yes** | Implemented it |
| Contract structs, variables, and the shape of `AgentPlan` / `Claim` | **Specified** | Wrote the Solidity |
| Solidity source (`ExecutorRegistry`, `Estate`, `ExecutorResolver`) | Directed and reviewed | **Wrote** |
| 126 Foundry tests | Directed | **Wrote** |
| Subgraph, dashboard, x402 gateway, scripts | Directed | **Wrote** |
| The adversarial review method | **Invented and ran** | Executed both roles |
| Deciding what to fix, ship, and withdraw | **Yes** | Advised |
| Every transaction the tooling blocked — `setResolver`, key funding, all pushes | **Ran them** | Could not |
| UI direction and rejection of three designs | **Yes** | Built them |

---

## The part worth reading: how the bugs were actually found

The team's instruction, verbatim, early on:

> *"use 2 agents one agent as the judge other as the participant judge should be
> so brutal that it should be like eth judge, arc, hedera, ens and try to reject
> as much as he can from all aspects, participant should take their reviews make
> it better and comeback until all judges give it 100"*

That method — not the code generation — is what produced the contracts in this
repo. Four rounds, and it found real defects every round.

### Round 1 found six exploitable bugs in `Estate`

Four with working proof-of-concepts, including a claim-registration sentinel
collision that permanently froze an estate. All were in code Claude had written
and was confident in.

### Round 3 found a fatal drain — and the first two fixes were also wrong

`sweepSurplus` was gated on `totalOutstanding() == 0`, with a comment asserting
that money could not leave the estate while any creditor was short. That guard
is vacuously true before any claim is registered, so a trustee could empty the
estate and *then* curate the creditors who would find nothing left.

The correction took three attempts, and the record of that is the most useful
thing in this repo:

1. **First fix** added an `approvedPlanHash != 0` gate. Review defeated it: the
   trustee calls `approvePlan` themselves and it accepted *any* 32 bytes, so the
   gate asserted only that a function had been called.
2. **Second fix** validated the hash and required a non-empty claim set. Review
   defeated that too: a claim with `allowedAmount == 0` satisfies the length
   check while contributing nothing to `totalOutstanding()`.
3. **Third fix** rejected zero-amount claims at registration, which is where the
   value should never have been accepted.

Each attempt is a separate commit with the failing proof-of-concept written as a
test first. `test_sweepSurplus_zeroAmountClaimCannotUnlockADrain` and
`test_registerClaim_rejectsZeroAmount` are those PoCs, kept as regressions.

**The same round found that the fix for a second fatal bug had introduced a
third.** `returnToTreasury` — added so that revenue arriving during a
false-positive administration is not stranded after recovery — shipped without
an outstanding-claims gate, making it a permissionless way to strip registered
creditors. Caught, fixed, pinned by
`test_returnToTreasury_cannotStripRegisteredCreditors`.

### What that record is evidence of

An AI wrote code with a fatal flaw in it, and wrote two failed fixes for that
flaw. A human-designed review process caught all three. That is the honest shape
of this project, and it is the reason the contracts are worth trusting now.

---

## Corrections the team made that changed the work

These are not cosmetic. Each one reversed a direction Claude had taken:

- **"see seriously think for yourself is this the best UI u can do for this?"** —
  ended a stretch of defending a mediocre dashboard and started the redesign.
- **"cant you fix them, i have opus, you can use agentic workflow if required"** —
  Claude had claimed two gaps were structural and unfixable. Both were fixed:
  the hardcoded payout address, and ENS not being in the payment path.
- **"wont they ask ui and vid shows different?"** — caught that the demo video's
  middle 2:38 was a purpose-built HTML console, so the video and the live site
  were two different products. The lifecycle now lives in the dashboard and the
  video is a screen recording of it.
- **"still dont u think the font looks claud-ish?"** — the headline was a heavy
  grotesque, the default look of AI-generated pages. Now Instrument Serif, which
  suits a document about legal instruments.
- **"Read apps/dashboard first. List every live query. Propose a component tree.
  Do not write CSS until I approve the tree."** — a process correction after
  Claude built ahead of approval twice, once costing a wasted video take.
- **The decision to withdraw eight partner tracks** (Circle/Arc, Chainlink CRE,
  Uniswap, World, Ledger, Privy, Bazantic, and initially The Graph) rather than
  file on stubs. The Graph was later re-filed only after a real subgraph was
  built and made load-bearing.

---

## Spec-driven artifacts, as required

- **Review transcripts and findings** — summarised in this document and in
  `FEEDBACK.md`; every finding maps to a commit whose message states what was
  wrong, why the previous fix failed where applicable, and what test pins it.
- **Commit messages as the design record.** They are long on purpose. Each one
  states the problem, the reasoning, the rejected alternative, and the limits of
  the fix. `git log` is the planning artifact.
- **`docs/PRIZES.md`, `docs/SUBMISSION.md`, `docs/PROJECT_BRIEF.md`,
  `docs/ARCHITECTURE.md`** — scope, claims, and explicit non-claims.
- **`scripts/record-demo/`** — the video pipeline, including `prefetch.sh`,
  which pulls every value shown on screen from live Sepolia so no figure in the
  demo is hand-typed.
- **`scripts/check-docs.sh`** — added after a documented number was wrong in
  three consecutive review rounds. CI now fails when a claim in the docs
  disagrees with what the repo produces.

## What AI did not do

- Decide what the protocol should be
- Design the review process that found its own worst bugs
- Judge which partner tracks were honest to file
- Send any transaction: `setResolver`, agent registration, key funding and every
  `git push` were run by the team, several because the tooling refused
- Approve a single UI direction — three were rejected before the current one

## Standing instruction that shaped everything

> *"Never close a gap by claiming something isn't there. If it isn't built,
> delete the claim — don't dress it up."*

`README.md` carries a table of four fixes that are **in source but not deployed**,
including one that lets the live registry still accept an all-zero plan. Nothing
required us to disclose that. It is there because the instruction above was the
rule the project was held to.
