# Where this project stands

Submission state and the live things that need attention. Everything else is in
the repo; this file is for what is **not** obvious from the code.

**Deadline: Sunday 13 September 2026, 12:00 EDT (21:30 IST).**

---

## Done

- Contracts deployed on Sepolia, **126 tests passing**, four rounds of
  adversarial review survived
- Subgraph live and load-bearing — the dashboard has no RPC fallback
- Dashboard deployed, three routes on one design system
- x402 gateway live on Hedera, ENS in the payment path
- **Demo video v2: `media/executor-demo-v2-silent.mp4`** — 3:10, 1920×1080,
  H.264, **no audio track** (ETHGlobal prohibits TTS/AI voiceover). Supersedes
  the 3:34 `executor-demo-silent.mp4`, which is kept as a fallback.
  v2 adds both USDC receipts on the deflection frame and fills the register
  form on camera.
- **Claim audit (2026-09-12).** Every claim in `docs/PRIZES.md` was verified
  against chain state, one track at a time. What it found and fixed:
  - The Graph: `PlanApproved` fired on-chain but had no handler. Fixed and
    redeployed as **v0.1.2** — all 8 `Estate.sol` events now indexed.
  - ENS: the transactions table documented the *superseded* resolver
    generation. Rewritten with the real current-generation hashes.
  - Hedera: the section said a fresh payment against the current registry was
    outstanding; it already existed. Corrected.
  - `SUBMISSION.md` claimed "44 of 61 commits" carry an AI trailer — the real
    numbers were 38 of 73, and the doc invited judges to check. Count removed.
  - The gateway URL in `SUBMISSION.md` returned 400 (it needs `?q=`).
  - UI said `200000 USDC` where Etherscan says `0.2 USDC`. Now labelled base
    units.

## Not done

1. **Record the voiceover.** The only thing on the critical path. Use
   `docs/VOICEOVER_CUES_v2.txt` (fitted to the v2 video, every line timed to
   land *on* its cut). A phone is fine as a *microphone* — the rule only bans
   filming on one.
2. **One ENS claim is still false.** The "both branches on live chain state"
   demo in `PRIZES.md` tells the reader to run a `cast call` that returns
   `0x0`, because agent 2 was never bound on the *current* resolver. The fix is
   one `bindNode` call from the admin key (`PRIVATE_KEY` in `.env` = `0x72db032c…dc706`,
   which is the resolver's `admin`); the dry run confirms it would return the
   documented `0x83f447FA…FfC7F`. Not done — it needs an approved on-chain
   write.
3. **Submit.** Copy is in `docs/SUBMISSION.md`. Three partner prizes:
   **ENS · Hedera · The Graph**. A partner's multiple tracks count as one
   selection, so tick every track each of them offers.

---

## The live agent needs a heartbeat, and it is not a daemon

The demo agent `0x6574c8cc…cb37` stays `Active` only while something is signing
heartbeats for it. That runner lives in whatever shell started it and **dies
with that shell**. It has gone stale once already.

```bash
cd /mnt/c/Users/Pramod/GitHub/executor
set -a && . ./.env.local && set +a
AGENT_ID=0x6574c8cc5e4ca438a061eb83708582b10658d3a1a7334a8d94b6f6a1960dcb37 \
HEARTBEAT_SIGNER_KEY="$AGENT3_SIGNER_KEY" BEAT_SECONDS=45 ./scripts/heartbeat.sh
```

Check it is actually landing — a running process is not proof:

```bash
curl -s -X POST https://api.studio.thegraph.com/query/1760047/executor/v0.1.2 \
  -H 'content-type: application/json' \
  -d '{"query":"{agent(id:\"0x6574c8cc5e4ca438a061eb83708582b10658d3a1a7334a8d94b6f6a1960dcb37\"){heartbeatCount lastHeartbeat}}"}'
```

Signer `0xC63adec9…62D0` burns ~31 microETH per beat. Top up from
`0x8046e631…9F00` (holds ~0.14 ETH) if it runs low.

**If it is stale during judging:** say so, and point out that anyone in the room
can flip it themselves. That is the design working, not a broken demo.

---

## The agents, and which is which

| agent | id | what it is for |
|---|---|---|
| **agent 4** | `0x6574c8cc…cb37` | **the live demo.** ENS + dashboard + gateway point here. Four distinct keys. Keep it Active |
| **agent 3** | `0x96abf3c7…c36d4` | the proof. Full lifecycle, Resolved, terminal. What the replay shows |
| agent 2 | `0x3bb9846e…cc67` | recovery and a second distribution round |
| agent 1 | `0x6b7f61f1…5255` | **retired** — all four roles on one key. Do not demo |

**Never call `enterLiquidation` on agent 4.** It is one-way and `restoreActive`
cannot undo it. `SIMULATE FAILURE` on `/vitals` only reaches Administration,
which the recovery authority `0x86A85D90…323E` can reverse.

---

## Key addresses

```
ExecutorRegistry   0x2946B46c2EB5Ec532093877223Ef043b13729e39   Sepolia
ExecutorResolver   0x52fccD0BaFeFfc0cb85aB50F90a3CFb7fB487E43   v2, ENS points here
  (previous)       0xa5a6d10E765B8A07c0662D204d3d3418E1e74C5b   still deployed, retired
Estate (agent 3)   0xD52b37AD931F221A902fC7F43A9ed2D87Ce07C5F
USDC (Circle)      0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238
ENS name           executor-hackathon-demo.eth  (ENSv2 beta, Sepolia)
Subgraph           https://api.studio.thegraph.com/query/1760047/executor/v0.1.2
Dashboard          https://executor-dashboard.vercel.app
Gateway            https://executor-gateway.vercel.app/research
```

---

## Things a judge will find, and where the answers live

| they ask | read |
|---|---|
| what is this? | `docs/EXPLAINER.md` |
| prove it | `README.md` — twelve linked transactions |
| how do you pitch it | `docs/PITCH.md` — with the six hard questions |
| what did AI write | `docs/AI_ATTRIBUTION.md` |
| what does it not do | `README.md` § Honest limitations, and `EXPLAINER.md` § 9 |

The sharpest question anyone can ask is **"a dead agent stops earning — what is
actually in the estate?"** The answer is prepared in `PITCH.md`. Do not
improvise it.

---

## Conventions

- **No `Co-Authored-By` trailers** on commits. AI use is disclosed in
  `docs/AI_ATTRIBUTION.md` instead, which is what the submission rules ask for.
- `scripts/check-docs.sh` runs in CI and fails when a number in the docs
  disagrees with what the repo produces. Run it after touching any doc.
- Build, **then** start, **then** record. Running `next build` while a previous
  `next start` is serving 404s a chunk and kills the page mid-recording.
