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

> `packages/agent-debtor/src/server-hedera.ts` is a stub whose `startServer`
> only logs "would listen on…". It is not part of this claim; `gateway.ts` is
> the real server.

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
([`0x99AB8C07C0082CBdD0306B30BC52eA15e6dB2521`](https://sepolia.etherscan.io/address/0x99AB8C07C0082CBdD0306B30BC52eA15e6dB2521),
Sepolia), covered by 25 tests in `contracts/test/ExecutorRegistry.t.sol`.
`getPaymentDestination` — the function the gateway calls on every request — is
tested in all four statuses plus the unregistered case.

The transition is permissionless and time-triggered: once
`lastHeartbeat + heartbeatInterval + gracePeriod` has passed, anyone can call
`enterAdministration`. Transactions on Sepolia:

| Event | Transaction |
|---|---|
| `AgentRegistered` | [`0xe4999556…79848d`](https://sepolia.etherscan.io/tx/0xe499955683c1e92b34a9fe4fe157b00ae37b53ef60fcff8ab41eb84c1f79848d) |
| `PlanLocked` | [`0xf0b97ba5…ad7d31`](https://sepolia.etherscan.io/tx/0xf0b97ba514204322b011744f660c7b8d4d6562ca2402bc34fada3c2bd7ad7d31) |
| `StatusChanged` → Administration | [`0xf5bdb57a…839efd`](https://sepolia.etherscan.io/tx/0xf5bdb57acea6609007827ec07fb23cb7f2a2c2c71dda9f99812ee8cedb839efd) |
| `StatusChanged` → Active (restore) | [`0x69e3324b…6d13794`](https://sepolia.etherscan.io/tx/0x69e3324b5562cd8c956ac82bec60755a29a1dfdc98f44b96fd90becaf6d13794) |

Agent id `0x6b7f61f16d01348d0b80bac1e63e0abb99eb377294a49d1f22181e912daf5255`.
