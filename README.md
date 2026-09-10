# Executor

**An x402 endpoint whose payout account is decided by on-chain state, so that
when the agent behind it stops answering, the money it is still earning goes
somewhere reachable instead of into a dead account.**

---

## Judges: click these 4 things in 60 seconds

1. **The contract, on Sepolia** —
   [`0x2946B46c2EB5Ec532093877223Ef043b13729e39`](https://sepolia.etherscan.io/address/0x2946B46c2EB5Ec532093877223Ef043b13729e39)
   ([deployed](https://sepolia.etherscan.io/tx/0xe0975d0b2bf4590cf72d3eb84f057c2da49a0d60162916c930402439ca49129e)
   in block 11669841). Read `getPaymentDestination` with agent id
   `0x6b7f61f16d01348d0b80bac1e63e0abb99eb377294a49d1f22181e912daf5255`:

   ```bash
   # 0x7ea7…7330 — the treasury, because the agent is Active right now
   cast call 0x2946B46c2EB5Ec532093877223Ef043b13729e39 \
     "getPaymentDestination(bytes32)(address)" \
     0x6b7f61f16d01348d0b80bac1e63e0abb99eb377294a49d1f22181e912daf5255 \
     --rpc-url https://ethereum-sepolia-rpc.publicnode.com
   ```

   It returns the treasury `0x7ea7…7330` while the agent is Active and the
   estate payout address `0xDE32…2337` once it isn't.

2. **The plan lock, enforced on live chain** — the plan was
   [amended](https://sepolia.etherscan.io/tx/0xa6e85bec3c4334659cb2b84aab274b48e9e75026a4947e3cee5ee2020eb6953c)
   with `updatePlan`, then
   [locked](https://sepolia.etherscan.io/tx/0xff0d42572a2565280a8a8500840c7d3f80f81085d4e02cbf735c7cde83f414c0).
   The same `updatePlan` call, from the plan's own owner, now reverts:

   ```bash
   # reverts with 0x96cb9f37 = PlanIsLocked()
   cast call 0x2946B46c2EB5Ec532093877223Ef043b13729e39 \
     "updatePlan(bytes32,address,address,address,address,address,uint64,uint64)" \
     0x6b7f61f16d01348d0b80bac1e63e0abb99eb377294a49d1f22181e912daf5255 \
     0x72db032c0dFB6E7502e16A73fabdab31712dc706 \
     0x72db032c0dFB6E7502e16A73fabdab31712dc706 \
     0x72db032c0dFB6E7502e16A73fabdab31712dc706 \
     0x7ea7f6e97E24F1ad03Db0bd544A0AeF4A1f07330 \
     0xDE3207F493fE4600DeEc424e0875ec943d712337 \
     60 30 \
     --from 0x72db032c0dFB6E7502e16A73fabdab31712dc706 \
     --rpc-url https://ethereum-sepolia-rpc.publicnode.com
   ```

3. **Money that actually moved, on Hedera** — the same client account paid the
   same endpoint three times and landed in two different accounts:

   ```bash
   curl "https://testnet.mirrornode.hedera.com/api/v1/transactions?account.id=0.0.10423643"  # treasury: 1 payment
   curl "https://testnet.mirrornode.hedera.com/api/v1/transactions?account.id=0.0.10423647"  # estate:   2 payments
   ```

   Those three payments were made while the gateway read the **previous**
   registry `0x99AB…2521`; the gateway now reads `0x2946…9e39`. What they prove
   and what they don't is spelled out in `docs/PRIZES.md`.

4. **The ENS succession lock, verifiable without a wallet** — the operator of
   `executor-hackathon-demo.eth` burned its own `ROLE_SET_RESOLVER_ADMIN`:

   ```bash
   # false - the operator can no longer delegate control of the resolver
   cast call 0x67b728a792e789a8978b30cf1b3b641f19354b43 \
     "hasRoles(uint256,uint256,address)(bool)" \
     70819938539668139450264846801951294893386672383841701762255368442961331224578 \
     5708990770823839524233143877797980545530986496 \
     0x72db032c0dfb6e7502e16a73fabdab31712dc706 \
     --rpc-url https://ethereum-sepolia-rpc.publicnode.com
   ```

`docs/PRIZES.md` has the full artifact list, including what each of these does
and does not prove.

---

## What this actually is

Five pieces:

| Piece | Where | What it does | Deployed? |
|---|---|---|---|
| `ExecutorRegistry` | `contracts/src/ExecutorRegistry.sol` | One agent's resolution plan: heartbeat clock, status machine, `updatePlan`/`lockPlan`, `resolve`, and `getPaymentDestination()` | Sepolia [`0x2946…9e39`](https://sepolia.etherscan.io/address/0x2946B46c2EB5Ec532093877223Ef043b13729e39) |
| `Estate` | `contracts/src/Estate.sol` | Creditor claims, a trustee-approved plan hash, and a priority-class distribution waterfall with pull-payment fallback | Sepolia [`0xD67a…286f`](https://sepolia.etherscan.io/address/0xD67a10D5466d311C2f995744937c7b9e1734286f), bound to Circle USDC |
| x402 gateway | `packages/agent-debtor/src/gateway.ts` | A real x402 resource server on Hedera testnet whose `payTo` is re-read from the registry on every request | Runs locally against Hedera testnet |
| Dashboard | `apps/dashboard` | Next.js app doing live chain reads, plus two write routes that call `enterAdministration` / `restoreActive` | Runs locally |
| ENSv2 name | `executor-hackathon-demo.eth` | Identity, with the resolver-admin role irreversibly revoked | Sepolia |

### What is deployed, and what each deployment proves

Both contracts are on Sepolia, and the deployed registry is the same build as
`contracts/src/ExecutorRegistry.sol` — `updatePlan` and `resolve` included.

| Thing | Address | Deploy tx |
|---|---|---|
| `ExecutorRegistry` | [`0x2946B46c2EB5Ec532093877223Ef043b13729e39`](https://sepolia.etherscan.io/address/0x2946B46c2EB5Ec532093877223Ef043b13729e39) (block 11669841) | [`0xe0975d0b…9ca49129e`](https://sepolia.etherscan.io/tx/0xe0975d0b2bf4590cf72d3eb84f057c2da49a0d60162916c930402439ca49129e) |
| `Estate` | [`0xD67a10D5466d311C2f995744937c7b9e1734286f`](https://sepolia.etherscan.io/address/0xD67a10D5466d311C2f995744937c7b9e1734286f) | [`0xf234c5ff…d77cb049362`](https://sepolia.etherscan.io/tx/0xf234c5ff5a0f31b56ebdb43ae813f7f3920ec5fcf5d504d2ccdb1d77cb049362) |

The demo agent's plan was written in three transactions, in the order that makes
`lockPlan` mean something:

| Call | Transaction |
|---|---|
| `registerAgent` (placeholder estate) | [`0x0b6fc415…c09fb58bd9`](https://sepolia.etherscan.io/tx/0x0b6fc41588b58f2ac70108bd00150af983fb8ac54e7dfbca40331dc09fb58bd9) |
| `updatePlan` (amended to the real payout address) | [`0xa6e85bec…020eb6953c`](https://sepolia.etherscan.io/tx/0xa6e85bec3c4334659cb2b84aab274b48e9e75026a4947e3cee5ee2020eb6953c) |
| `lockPlan` | [`0xff0d4257…7cde83f414c0`](https://sepolia.etherscan.io/tx/0xff0d42572a2565280a8a8500840c7d3f80f81085d4e02cbf735c7cde83f414c0) |

`updatePlan` is not a function that exists only in tests — that middle
transaction is it running on Sepolia and changing the stored `estate` from the
placeholder to `0xDE32…2337`. And after `lockPlan`, the *same* call from the
*same* owner reverts, which you can check yourself without a wallet or a key:

```bash
# reverts with 0x96cb9f37 = PlanIsLocked()
cast call 0x2946B46c2EB5Ec532093877223Ef043b13729e39 \
  "updatePlan(bytes32,address,address,address,address,address,uint64,uint64)" \
  0x6b7f61f16d01348d0b80bac1e63e0abb99eb377294a49d1f22181e912daf5255 \
  0x72db032c0dFB6E7502e16A73fabdab31712dc706 \
  0x72db032c0dFB6E7502e16A73fabdab31712dc706 \
  0x72db032c0dFB6E7502e16A73fabdab31712dc706 \
  0x7ea7f6e97E24F1ad03Db0bd544A0AeF4A1f07330 \
  0xDE3207F493fE4600DeEc424e0875ec943d712337 \
  60 30 \
  --from 0x72db032c0dFB6E7502e16A73fabdab31712dc706 \
  --rpc-url https://ethereum-sepolia-rpc.publicnode.com
```

### Two settlement rails, and why the `estate` field is not the `Estate` contract

This trips people up on first read, so: the plan's `estate` field holds
`0xDE3207F493fE4600DeEc424e0875ec943d712337`, which is **not** the `Estate`
contract at `0xD67a…286f`. It is not a mistake. There are two settlement rails
for the same failed agent, and they carry different money:

- **x402 revenue settles on Hedera.** `0xDE32…2337` is an EVM address with no
  code on Sepolia; it is the Hedera-mapped payout account `0.0.10423647`. When
  the registry flips, the gateway resolves `getPaymentDestination()` through the
  mirror node and the *next HBAR payment* lands there. That is the rail the
  Hedera transaction IDs in `docs/PRIZES.md` are on.
- **Creditor claims settle on Sepolia in USDC.** `Estate` at `0xD67a…286f` is
  the contract that takes registered claims, a trustee-approved plan hash and a
  priority-class waterfall. Its constructor bound it to Circle's real Sepolia
  USDC `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238` (`symbol()` is `"USDC"`,
  `decimals()` is `6`), and its `registry()`, `trustee()` and `agentId()` getters
  read back the registry above, the operator, and the demo agent id.

```bash
cast call 0xD67a10D5466d311C2f995744937c7b9e1734286f "usdc()(address)" \
  --rpc-url https://ethereum-sepolia-rpc.publicnode.com     # 0x1c7D…7238
cast call 0xD67a10D5466d311C2f995744937c7b9e1734286f "registry()(address)" \
  --rpc-url https://ethereum-sepolia-rpc.publicnode.com     # 0x2946…9e39
```

Nothing automatically moves value from the Hedera rail to the Sepolia one. A
trustee would have to bridge it. That gap is real and is not implemented.

### What is *not* proven on-chain at this address

Being exact about it, because the addresses changed:

- **The lifecycle flip has not been run on `0x2946…9e39` yet.** The agent there
  is `Active` and has never entered Administration. The recorded
  `Active -> Administration -> Active` transactions in `docs/PRIZES.md` are
  against the previous deployment `0x99AB…2521`, and are labelled as such.
  The flip is reproducible on the new address — `enterAdministration` is
  permissionless and the heartbeat deadline has passed — via the dashboard's
  write route or a direct `cast send`.
- **`Estate` holds no funds and no claims yet.** Its USDC balance is zero and no
  `registerClaim` has been called on it. The waterfall itself is exercised by 34
  unit tests and by `./scripts/e2e-local.sh` end to end on a local anvil chain
  against a real ERC-20. Deployed and readable is not the same as exercised
  in production, and this README does not claim it is.

**The mechanism.** An agent registers a plan naming a treasury, an estate, a
heartbeat interval and a grace period. While it heartbeats, the registry is
`Active` and `getPaymentDestination()` returns the treasury. Once
`lastHeartbeat + interval + grace` passes, *anyone* can call
`enterAdministration()` — the contract checks eligibility, not the caller — and
the same function starts returning the estate. A named recovery authority can
call `restoreActive()`, because a missed heartbeat is not insolvency.

The x402 gateway supplies `payTo` as a `DynamicPayTo` callback rather than a
string, so it is evaluated per request. The endpoint URL, the price and the
agent's identity never change; only the destination does. The gateway resolves
the EVM address it gets back to a Hedera account ID via the mirror node REST
API, so this works for any registered agent rather than just the demo's two
accounts.

## Repo layout

Directories that run:

- `contracts/` — Foundry. `ExecutorRegistry.sol` and `Estate.sol` are both
  deployed on Sepolia (addresses above). `test/ExecutorRegistry.t.sol`
  (37 tests), `test/Estate.t.sol` (34 tests), `test/LivingWill.t.sol` (9 tests,
  ENSv2 role semantics) and `test/Receiver.t.sol` (4 tests, for the superseded
  contract) cover them — 84 in total.
- `packages/agent-debtor/src/gateway.ts` — the x402 resource server.
  `pay-for-research.ts` — the matching paying client.
- `apps/dashboard` — the Next.js dashboard.

Directories that do **not** run, kept only because earlier commits reference
them: `packages/optional`, `packages/sweep`, `packages/bazantic`,
`packages/subgraph`, `packages/cre-workflow`, `packages/agent-trustee`,
`packages/agent-client`, `demo/`. They contain stubs — `console.log`s and
`throw new Error("not implemented")`. `contracts/src/Receiver.sol` was never
deployed; `ExecutorRegistry.sol` supersedes it and says so in its header.
`contracts/src/adapters/EnsAdapter.sol` describes an ENSv2 registry interface
that does not exist and is unused.

An earlier version of this README described a two-chain system with an
`Estate` contract on Arc and a Chainlink CRE TEE performing confidential
solvency checks. The Arc deployment and the CRE TEE were never built and the
claims have been removed rather than softened. The `Estate` contract itself now
exists, is tested, and is deployed — on Sepolia, not on Arc.

## Running it

```bash
pnpm install
cd contracts && forge install

forge test                                    # 84 tests
pnpm -C apps/dashboard exec tsc --noEmit
pnpm -C apps/dashboard dev                    # dashboard on :3000

anvil &                                       # in another terminal
./scripts/e2e-local.sh                        # whole lifecycle on a local chain

pnpm --filter @executor/agent-debtor gateway  # x402 gateway on :3200
HEDERA_PRIVATE_KEY=... pnpm --filter @executor/agent-debtor pay
```

The dashboard reads Sepolia over a public RPC and needs no keys. The two write
routes under `apps/dashboard/app/api/actions/` need a funded Sepolia key in
`apps/dashboard/.env.local` as `OPERATOR_PRIVATE_KEY`; see `.env.example`.

There is no deployed public URL for the dashboard — run it locally.

## Honest limitations

- **The settlement half is deployed but has never settled anything.**
  `Estate.sol` implements creditor claims, a trustee-approved plan hash, a
  priority-class waterfall with pro-rata splitting inside a class, pull-payment
  fallback for refused transfers, and repeatable distribution rounds for late
  funds. It is live on Sepolia at `0xD67a…286f` against real Circle USDC — but
  it holds zero USDC, has zero registered claims, and has never run
  `executePlan` there. All of that behaviour is exercised by 34 unit tests and
  by `scripts/e2e-local.sh` on a local anvil chain. Treat it as reviewed,
  deployed code, not as a system that has processed a real insolvency.
- **The waterfall settles one ERC-20.** Non-USDC estate assets are not sold
  first, and nothing values them. `packages/optional/liquidation` was reserved
  for that and is a stub.
- **A claim ceiling.** `Estate.MAX_CLAIMS` is 200, because `executePlan` walks
  the claim array several times per priority class and an unbounded array is a
  gas-limit brick waiting to happen. Larger estates need to be split across
  several `Estate` contracts.
- **The paid resource is a hardcoded JSON string**, not an inference service.
  `GET /research` returns a fixed object; the point of the demo is where the
  payment lands, not what is being sold.
- **Payments are native HBAR**, not USDC.
- **The `planLocked` freeze is one-way and covers only the plan fields.**
  `ExecutorRegistry.updatePlan` is a real setter for the treasury, the estate,
  the trustee, the recovery authority, the heartbeat signer and the timing;
  `lockPlan` makes it revert with `PlanIsLocked`, on Sepolia today (see the
  `cast call` above), in `test_lockPlan_makesUpdatePlanRevert`, and in
  `scripts/e2e-local.sh` against the 4-byte selector. What it does *not* freeze
  is the status machine: `enterAdministration`, `restoreActive`,
  `enterLiquidation` and `resolve` all still work on a locked plan, by design.
- **The ENS lock is bounded**, in two ways spelled out in `docs/PRIZES.md`: it
  covers the resolver axis only, and it lasts until the name expires
  (2027-09-08), not forever.
- **`enterLiquidation` has no consumer in the x402 gateway.** The gateway
  treats Liquidation and Administration identically — both route payment to the
  estate, which is correct, but the gateway does not itself trigger or read the
  waterfall. The consumer that does exist is `Estate.executePlan`, which refuses
  to run in Administration.

## Prizes

`docs/PRIZES.md` — ENS, Hedera, x402. Nothing else is filed.
