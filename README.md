# Executor

**An x402 endpoint whose payout account is decided by on-chain state, so that
when the agent behind it stops answering, the money it is still earning goes
somewhere reachable instead of into a dead account.**

---

## Judges: click these 3 things in 60 seconds

1. **The contract, on Sepolia** —
   [`0x99AB8C07C0082CBdD0306B30BC52eA15e6dB2521`](https://sepolia.etherscan.io/address/0x99AB8C07C0082CBdD0306B30BC52eA15e6dB2521).
   Read `getPaymentDestination` with agent id
   `0x6b7f61f16d01348d0b80bac1e63e0abb99eb377294a49d1f22181e912daf5255`. It
   returns the treasury `0x7ea7…7330` while the agent is Active and the estate
   `0xDE32…2337` once it isn't. The
   [Administration flip](https://sepolia.etherscan.io/tx/0xf5bdb57acea6609007827ec07fb23cb7f2a2c2c71dda9f99812ee8cedb839efd)
   and the
   [restore](https://sepolia.etherscan.io/tx/0x69e3324b5562cd8c956ac82bec60755a29a1dfdc98f44b96fd90becaf6d13794)
   both happened.

2. **Money that actually moved, on Hedera** — the same client account paid the
   same endpoint three times and landed in two different accounts:

   ```bash
   curl "https://testnet.mirrornode.hedera.com/api/v1/transactions?account.id=0.0.10423643"  # treasury: 1 payment
   curl "https://testnet.mirrornode.hedera.com/api/v1/transactions?account.id=0.0.10423647"  # estate:   2 payments
   ```

3. **The ENS succession lock, verifiable without a wallet** — the operator of
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

Four pieces, all of them running:

| Piece | Where | What it does |
|---|---|---|
| `ExecutorRegistry` | `contracts/src/ExecutorRegistry.sol`, deployed on Sepolia | One agent's resolution plan: heartbeat clock, status machine, and `getPaymentDestination()` |
| x402 gateway | `packages/agent-debtor/src/gateway.ts` | A real x402 resource server on Hedera testnet whose `payTo` is re-read from the registry on every request |
| Dashboard | `apps/dashboard` | Next.js app doing live chain reads, plus two write routes that call `enterAdministration` / `restoreActive` |
| ENSv2 name | `executor-hackathon-demo.eth` | Identity, with the resolver-admin role irreversibly revoked |

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

- `contracts/` — Foundry. `ExecutorRegistry.sol` is the deployed contract;
  `test/ExecutorRegistry.t.sol` (25 tests) and `test/LivingWill.t.sol`
  (9 tests, ENSv2 role semantics) cover it.
- `packages/agent-debtor/src/gateway.ts` — the x402 resource server.
  `pay-for-research.ts` — the matching paying client.
- `apps/dashboard` — the Next.js dashboard.

Directories that do **not** run, kept only because earlier commits reference
them: `packages/optional`, `packages/sweep`, `packages/bazantic`,
`packages/subgraph`, `packages/cre-workflow`, `packages/agent-trustee`,
`packages/agent-client`, `demo/`. They contain stubs — `console.log`s and
`throw new Error("not implemented")`. `contracts/src/Estate.sol` and
`contracts/src/Receiver.sol` were never deployed; `ExecutorRegistry.sol`
supersedes `Receiver.sol` and says so in its header.
`contracts/src/adapters/EnsAdapter.sol` describes an ENSv2 registry interface
that does not exist and is unused.

An earlier version of this README described a two-chain system with an
`Estate` contract on Arc and a Chainlink CRE TEE performing confidential
solvency checks. None of that was built. It has been removed rather than
softened.

## Running it

```bash
pnpm install
cd contracts && forge install

forge test                                    # 41 tests
pnpm -C apps/dashboard exec tsc --noEmit
pnpm -C apps/dashboard dev                    # dashboard on :3000

pnpm --filter @executor/agent-debtor gateway  # x402 gateway on :3200
HEDERA_PRIVATE_KEY=... pnpm --filter @executor/agent-debtor pay
```

The dashboard reads Sepolia over a public RPC and needs no keys. The two write
routes under `apps/dashboard/app/api/actions/` need a funded Sepolia key in
`apps/dashboard/.env.local` as `OPERATOR_PRIVATE_KEY`; see `.env.example`.

There is no deployed public URL for the dashboard — run it locally.

## Honest limitations

- **One contract, one chain.** There is no estate settlement logic. The
  "estate" is an address that receives payments; nothing distributes from it.
  There are no creditor claims and no distribution waterfall.
- **The paid resource is a hardcoded JSON string**, not an inference service.
  `GET /research` returns a fixed object; the point of the demo is where the
  payment lands, not what is being sold.
- **Payments are native HBAR**, not USDC.
- **`planLocked` is a declaration, not an enforcement mechanism.** The
  registry has no setter for any plan field and `registerAgent` reverts on a
  duplicate id, so a plan is already immutable before the flag is set. The
  flag publishes that the owner has finished configuring.
  `test_lockPlan_doesNotChangeBehavior` documents this.
- **The ENS lock is bounded**, in two ways spelled out in `docs/PRIZES.md`: it
  covers the resolver axis only, and it lasts until the name expires
  (2027-09-08), not forever.
- **`enterLiquidation` exists on-chain but has no consumer.** The gateway
  treats Liquidation and Administration identically.

## Prizes

`docs/PRIZES.md` — ENS, Hedera, x402. Nothing else is filed.
