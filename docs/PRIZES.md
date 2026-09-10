# Prize pointers

Three tracks: **ENS**, **Hedera**, **x402**. Every claim below points at a file
that runs and, where the claim is about state, an on-chain artifact you can
check yourself without trusting us.

Nothing else is filed. Earlier drafts of this file listed Circle/Arc, The
Graph, Uniswap, World, Key Ring, Bazantic and Chainlink CRE. None of those
were built — the directories they pointed at contain stubs — so the claims
have been withdrawn rather than reworded.

---

## ENS

**Claim:** an ENSv2 name whose operator has irreversibly given up the ability
to delegate control of its resolver, and a dashboard that reads that fact live
rather than asserting it.

| | |
|---|---|
| Name | `executor-hackathon-demo.eth` (ENSv2 beta, Sepolia) |
| Registry | [`0x67b728a792e789a8978b30cf1b3b641f19354b43`](https://sepolia.etherscan.io/address/0x67b728a792e789a8978b30cf1b3b641f19354b43) (`PermissionedRegistry`) |
| Operator | `0x72db032c0dFB6E7502e16A73fabdab31712dc706` |
| tokenId | `70819938539668139450264846801951294893386672383841701762255368442961331224578` |

**Code that runs:**

- `apps/dashboard/lib/ens.ts` — `getNameState()` and `hasRole()` read
  `findTokenId` / `ownerOf` / `getExpiry` / `hasRoles` straight off the
  registry. The homepage's "Succession lock: engaged" row is the result of a
  live `hasRoles` call, not a constant.
- `contracts/test/LivingWill.t.sol` — nine tests against a mock that models
  ENSv2's real `EnhancedAccessControl` rules: the nybble-packed admin-role
  convention, `withAdminRolesApplied` discarding the regular half of a bitmap,
  and `PermissionedRegistry._getSettableRoles`'s `>> 128` that makes admin
  roles ungrantable at a token resource while leaving them revokable.

**Verify it yourself** (no wallet, no trust):

```bash
# ROLE_SET_RESOLVER (1 << 24) - operator still holds it -> true
cast call 0x67b728a792e789a8978b30cf1b3b641f19354b43 \
  "hasRoles(uint256,uint256,address)(bool)" \
  70819938539668139450264846801951294893386672383841701762255368442961331224578 \
  16777216 0x72db032c0dfb6e7502e16a73fabdab31712dc706 \
  --rpc-url https://ethereum-sepolia-rpc.publicnode.com

# ROLE_SET_RESOLVER_ADMIN (1 << 152) - burned -> false
cast call 0x67b728a792e789a8978b30cf1b3b641f19354b43 \
  "hasRoles(uint256,uint256,address)(bool)" \
  70819938539668139450264846801951294893386672383841701762255368442961331224578 \
  5708990770823839524233143877797980545530986496 \
  0x72db032c0dfb6e7502e16a73fabdab31712dc706 \
  --rpc-url https://ethereum-sepolia-rpc.publicnode.com
```

**What that does and does not prove.** It proves the operator can still point
the name at a resolver but can no longer grant `ROLE_SET_RESOLVER` to any
other address, re-grant itself the admin role, or revoke the role from itself
— all three revert, because in ENSv2 only an admin role confers authority and
admin roles cannot be re-granted at a token resource. Token ownership is not a
bypass, and an ERC-1155 transfer moves the already-diminished bitmap verbatim.

It does **not** prove permanence. The name expires 2027-09-08; after expiry
plus grace, re-registration bumps the resource version and the new registrant
receives a full role bitmap. A holder of *root*-scoped `ROLE_SET_RESOLVER_ADMIN`
could also still grant the token-level role — that slot has zero assignees on
this deployment today, which is a fact about deployment state, not a property
of the code. `test_rootAdminRoleHolderCouldStillGrantTheResolverRole` and
`test_lockDoesNotCoverTheSubregistryAxis` pin both limits so the claim stays
bounded.

> `contracts/src/adapters/EnsAdapter.sol` and `contracts/src/interfaces/IEnsRegistry.sol`
> are **not** part of this claim. They describe an invented registry surface
> (`authorizeAddrRoles`, `revokeAdminRole`) that does not exist in ENSv2, they
> were never deployed, and nothing in the running system calls them.

---

## Hedera

**Claim:** a working x402 resource server on Hedera testnet, paid in native
HBAR, whose payout account is decided per request by on-chain state rather
than configuration.

**Code that runs:** `packages/agent-debtor/src/gateway.ts`

```bash
pnpm --filter @executor/agent-debtor gateway   # serves :3200
HEDERA_PRIVATE_KEY=... pnpm --filter @executor/agent-debtor pay
```

- Express + `@x402/express` `paymentMiddleware`, facilitator
  [Blocky402](https://api.testnet.blocky402.com), scheme
  `ExactHederaScheme` on `hedera:testnet`.
- Price is 1,000,000 tinybars (0.01 HBAR) of native HBAR (asset `0.0.0`),
  quoted directly in tinybars because native HBAR has no $-conversion oracle.
- `payTo` is a `DynamicPayTo` function, not a string. Every request calls
  `ExecutorRegistry.getPaymentDestination()` on Sepolia, then resolves the
  returned EVM address to a Hedera account ID through the mirror node REST
  API (`/api/v1/accounts/{evmAddress}`). That lookup is general, not a table
  of our two accounts — an address with no Hedera account produces an explicit
  error rather than a fallback destination.

`packages/agent-debtor/src/pay-for-research.ts` is the matching client: it
takes the 402, builds and signs the payment, and retries with `X-PAYMENT`.

**On-chain artifacts.** The same client account `0.0.10423620` paid the same
endpoint three times. Where the money landed changed with registry state:

| Hedera transaction ID | Destination | Amount |
|---|---|---|
| `0.0.7162784-1788886472-421979737` | `0.0.10423647` (estate) | 0.01 HBAR |
| `0.0.7162784-1788886683-635972128` | `0.0.10423643` (treasury) | 0.01 HBAR |
| `0.0.7162784-1788886851-151829638` | `0.0.10423647` (estate) | 0.01 HBAR |

```bash
curl "https://testnet.mirrornode.hedera.com/api/v1/transactions?account.id=0.0.10423643"
curl "https://testnet.mirrornode.hedera.com/api/v1/transactions?account.id=0.0.10423647"
```

Treasury `0.0.10423643` ↔ EVM `0x7ea7f6e97E24F1ad03Db0bd544A0AeF4A1f07330`,
estate `0.0.10423647` ↔ EVM `0xDE3207F493fE4600DeEc424e0875ec943d712337` — the
two addresses stored in the agent's plan.

> **Read this before treating the table as proof of the current deployment.**
> Those three payments were made while `gateway.ts` was pointed at the
> **previous** registry, `0x99AB8C07C0082CBdD0306B30BC52eA15e6dB2521`. The
> registry has since been redeployed at
> [`0x2946B46c2EB5Ec532093877223Ef043b13729e39`](https://sepolia.etherscan.io/address/0x2946B46c2EB5Ec532093877223Ef043b13729e39)
> and `gateway.ts` now reads that address. The payments themselves are real,
> still on the Hedera mirror node, and still show one client account landing in
> two different destinations without the endpoint, the price or the agent id
> changing — that is the mechanism, and it is unaffected by which registry
> instance was consulted.
>
> What they do **not** prove is that the gateway reads `0x2946…9e39`. That is a
> claim about the current source, checkable by reading
> `packages/agent-debtor/src/gateway.ts` (the address is a single named
> constant) — not by these transaction IDs. The flip has not been re-run
> against the new registry: doing so means broadcasting a Sepolia
> `enterAdministration` and fresh HBAR payments, and we would rather label the
> existing artifacts honestly than quietly let them imply an address they
> predate.
>
> **Update:** the Sepolia half of that is now done. `0x2946…9e39` has been
> flipped for real — twice on agent 2 and once, there and back, on the demo
> agent (see the lifecycle table in the root README). What is still outstanding
> is a *fresh HBAR payment* made while the gateway reads `0x2946…9e39`, which
> is what would let the Hedera table above stand on its own. It has not been
> made, and the table is still labelled as belonging to the previous registry.

> `packages/agent-debtor/src/server-hedera.ts` used to sit next to `gateway.ts`
> as a stub whose `startServer` only logged "would listen on…". It has been
> deleted, along with `server-arc.ts`, `heartbeat.ts` and `kill.ts`. `gateway.ts`
> is the only server in this package and always was the real one.

---

## x402

**Claim:** x402 used for something the protocol does not give you for free —
the payment destination is *late-bound to on-chain state*, so the same
resource, the same URL and the same agent identity keep working while the
money moves somewhere else.

Same file as above, `packages/agent-debtor/src/gateway.ts`. The relevant
mechanism is that `payTo` is supplied as a `DynamicPayTo` callback:

```ts
const dynamicPayTo: DynamicPayTo = async () => resolveHederaPayTo();
```

so it is evaluated while building each 402 challenge. A conventional x402
server hardcodes `payTo` at boot; if the operator behind it disappears, the
endpoint keeps collecting into an account nobody can reach. Here the
destination is a function of `ExecutorRegistry` status:

- `Active` → treasury
- `Administration` / `Liquidation` → estate

The supporting contract is `contracts/src/ExecutorRegistry.sol`
([`0x2946B46c2EB5Ec532093877223Ef043b13729e39`](https://sepolia.etherscan.io/address/0x2946B46c2EB5Ec532093877223Ef043b13729e39),
Sepolia, block 11669841), covered by 37 tests in
`contracts/test/ExecutorRegistry.t.sol`. `getPaymentDestination` — the function
the gateway calls on every request — is tested in all four statuses plus the
unregistered case.

Where the redirected money is meant to end up is also deployed, on the other
settlement rail: `contracts/src/Estate.sol` is live at
[`0xD67a10D5466d311C2f995744937c7b9e1734286f`](https://sepolia.etherscan.io/address/0xD67a10D5466d311C2f995744937c7b9e1734286f)
([deploy tx](https://sepolia.etherscan.io/tx/0xf234c5ff5a0f31b56ebdb43ae813f7f3920ec5fcf5d504d2ccdb1d77cb049362)),
constructor-bound to Circle's real Sepolia USDC
[`0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238`](https://sepolia.etherscan.io/address/0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238)
(`symbol()` is `"USDC"`, `decimals()` is `6`). It reads the same registry via
`getStatus` and refuses to distribute until Liquidation. Its 40 tests cover
priority classes, pro-rata splitting, pull-payment escrow and repeat rounds.

**That contract has now run on Sepolia, with real Circle USDC.** Not at
`0xD67a…286f` — that deployment predates a fix and was never funded — but at
[`0x83f447FAb4E1267Ca5fd6Ebe151a93b462EFfC7F`](https://sepolia.etherscan.io/address/0x83f447FAb4E1267Ca5fd6Ebe151a93b462EFfC7F),
the estate of a second agent whose entire lifecycle was driven publicly. 0.5
USDC against 1.4 USDC of claims: secured paid in full, both administrative
claims split the remainder pro-rata, unsecured got nothing, and a second round
after late revenue finished the administrative class:

| | Transaction |
|---|---|
| `executePlan` round 1 (insolvent, 0.9 USDC shortfall) | [`0xd5c45ef3…f7f65b327f`](https://sepolia.etherscan.io/tx/0xd5c45ef3d20a67beb6e9bbc94a25f11380147af580c0682e516ecdf7f65b327f) |
| `executePlan` round 2 (after `resolve()`) | [`0xae50be9a…6f2f495521`](https://sepolia.etherscan.io/tx/0xae50be9a3ce584a0952e3a51f590b94bdd247d04687f0b60d429ca6f2f495521) |

The full 21-transaction table, including which of four distinct role keys
signed each step, is in the root `README.md`.

Note that the plan's `estate` *field* is `0xDE32…2337`, the Hedera-mapped
payout account, **not** the `Estate` contract. Two rails settle the same
failure: x402 revenue on Hedera, USDC creditor claims on Sepolia. See
`docs/ARCHITECTURE.md` for why, and for what does not bridge between them.

The transition is permissionless and time-triggered: once
`lastHeartbeat + heartbeatInterval + gracePeriod` has passed, anyone can call
`enterAdministration`.

**On the current registry `0x2946…9e39`,** the plan was written in the order
that makes the lock mean something:

| Event | Transaction |
|---|---|
| contract deployed (block 11669841) | [`0xe0975d0b…a49129e`](https://sepolia.etherscan.io/tx/0xe0975d0b2bf4590cf72d3eb84f057c2da49a0d60162916c930402439ca49129e) |
| `AgentRegistered` (placeholder estate) | [`0x0b6fc415…9fb58bd9`](https://sepolia.etherscan.io/tx/0x0b6fc41588b58f2ac70108bd00150af983fb8ac54e7dfbca40331dc09fb58bd9) |
| `PlanUpdated` — `updatePlan` amending the estate to `0xDE32…2337` | [`0xa6e85bec…0eb6953c`](https://sepolia.etherscan.io/tx/0xa6e85bec3c4334659cb2b84aab274b48e9e75026a4947e3cee5ee2020eb6953c) |
| `PlanLocked` | [`0xff0d4257…e83f414c0`](https://sepolia.etherscan.io/tx/0xff0d42572a2565280a8a8500840c7d3f80f81085d4e02cbf735c7cde83f414c0) |

The lock is load-bearing there, not declarative: an `eth_call` of the same
`updatePlan` from the plan owner now returns `0x96cb9f37` = `PlanIsLocked()`.
The copy-pasteable command is in the README.

**On the previous registry `0x99AB…2521`,** which these docs cited until the
redeploy, the lifecycle flip was demonstrated end to end. Kept because it is
the only recorded `Active -> Administration -> Active` round trip, and labelled
so nobody mistakes it for the current address:

| Event | Transaction |
|---|---|
| `AgentRegistered` | [`0xe4999556…79848d`](https://sepolia.etherscan.io/tx/0xe499955683c1e92b34a9fe4fe157b00ae37b53ef60fcff8ab41eb84c1f79848d) |
| `PlanLocked` | [`0xf0b97ba5…ad7d31`](https://sepolia.etherscan.io/tx/0xf0b97ba514204322b011744f660c7b8d4d6562ca2402bc34fada3c2bd7ad7d31) |
| `StatusChanged` → Administration | [`0xf5bdb57a…839efd`](https://sepolia.etherscan.io/tx/0xf5bdb57acea6609007827ec07fb23cb7f2a2c2c71dda9f99812ee8cedb839efd) |
| `StatusChanged` → Active (restore) | [`0x69e3324b…6d13794`](https://sepolia.etherscan.io/tx/0x69e3324b5562cd8c956ac82bec60755a29a1dfdc98f44b96fd90becaf6d13794) |

That earlier build had no `updatePlan` and no `resolve`; the current one has
both, which is why the redeploy happened.

**The flip has since been run on `0x2946…9e39` too**, so the table above is
history rather than the only evidence:

| Event | Agent | Transaction |
|---|---|---|
| `StatusChanged` → Administration | demo | [`0x47a310d6…12e5bfb3dc`](https://sepolia.etherscan.io/tx/0x47a310d6fac2fd00add0192d01bc0d1514d9ce34e037132798641912e5bfb3dc) |
| `StatusChanged` → Active (restore) | demo | [`0x69d859e2…32c9fe13720`](https://sepolia.etherscan.io/tx/0x69d859e25676aac5468d6d175c9c30395fe016a7f5ba033b831cd32c9fe13720) |
| the full Active → … → Resolved walk | agent 2 | see the root `README.md` |

The demo agent was left `Active`. `enterAdministration` is permissionless and
its window reopens 90 seconds after the restore, so treat `getStatus` as the
authority on where it is right now.

Demo agent id `0x6b7f61f16d01348d0b80bac1e63e0abb99eb377294a49d1f22181e912daf5255`.
Agent 2 id `0x3bb9846eddba2c5c78b94bbc2be970db97c11731d2588aa86d375e281183cc67`.
