# Executor

**An x402 endpoint whose payout account is decided by on-chain state, so that
when the agent behind it stops answering, the money it is still earning goes
somewhere reachable instead of into a dead account.**

---

## Judges: the one thing to look at

**One agent, one life, on public Sepolia — and a payment that changed
destination without the payer changing anything.**

Agent 3 — `0x96abf3c7f8f72fdf248e91137fb471a442dccf3fcece378b2065616cb68c36d4` —
was registered under four distinct role keys, locked, heartbeat eighteen times
on a real interval, paid while it was alive, left to die, pushed into
Administration by a stranger, **paid again by the identical command**,
liquidated by its trustee, and wound up. Every line below is on a public chain
and checkable without a wallet or a key.

### The full lifecycle

| # | Step | Sent by (role) | Block | Transaction |
|---|---|---|---|---|
| 1 | `registerAgent` | **owner** `0xe21Ce561…D38F` | 11672753 | [`0xf018c159…e7d752846e`](https://sepolia.etherscan.io/tx/0xf018c159706e519e36bed163e20861e808b333461596fbedc53736e7d752846e) |
| 2 | `lockPlan` — the plan is now frozen | **owner** | 11672754 | [`0x06a2c27b…8755a250c9`](https://sepolia.etherscan.io/tx/0x06a2c27bf82111e168269c0f825609b25090cf4afefa9b3d56cc118755a250c9) |
| 3 | `heartbeat` ×18, ~96s apart | **heartbeat signer** `0xC63adec9…62D0` | 11672758–11672892 | [first](https://sepolia.etherscan.io/tx/0x9bbf8da4fbf481ccff417e182f20fbaa5c123d760a86a623b7d6799e25c48bf6) · [last](https://sepolia.etherscan.io/tx/0x8d59f3183f6077a8f17b07481c8f7007944c03952e5184ba20de9373a7335ce6) |
| 4 | `registerClaim` ×3 — Secured / Administrative / Unsecured | **trustee** `0x108efe09…A310` | 11672772–11672775 | [`0xcb70b07a…4d91c68489`](https://sepolia.etherscan.io/tx/0xcb70b07a48e39a33a01d9c20c930dc42fcc39bacafe1faf92fd55b4d91c68489) · [`0x7c6518b1…01247a2759`](https://sepolia.etherscan.io/tx/0x7c6518b1a66dcba9608631f7887c1aa9dd7e6293c98a56efc4689001247a2759) · [`0xac559003…bf9e5f3aa0`](https://sepolia.etherscan.io/tx/0xac55900389faa0acdb4c74cc859281d9479a51e3ed73b101a1f038bf9e5f3aa0) |
| 5 | `approvePlan` — commits to the exact claim set | **trustee** | 11672776 | [`0xffba6a80…a4d5e633af`](https://sepolia.etherscan.io/tx/0xffba6a807d522fd5b17785e25e441b34ec2cf0849dc69c2ee39dfca4d5e633af) |
| **6** | **routed payment → treasury `0x29eA9aE5…5557`** | payer `0xbFe5551e…16EA` | 11672895 | [**`0x73131910…ef8ea243c5`**](https://sepolia.etherscan.io/tx/0x731319100c29e25cf27270085ef91caaba946f9907cd14dfa67e33ef8ea243c5) |
| 7 | *heartbeat stops. the window lapses.* | — | — | — |
| 8 | `enterAdministration` | *anyone* — `0x72db032c…c706`, **holds none of the four roles** | 11672930 | [`0x345811aa…3e6ae2ea8e`](https://sepolia.etherscan.io/tx/0x345811aa27275686899f84ec30c6b5c602cf6cc0d60e5be1edbb263e6ae2ea8e) |
| **9** | **the same command → estate `0xD52b37AD…7C5F`** | payer `0xbFe5551e…16EA` | 11672932 | [**`0x17b0f956…d8816d37ad`**](https://sepolia.etherscan.io/tx/0x17b0f95681e3fea74423e06978d319ca1d57a20228480191f12c99d8816d37ad) |
| 10 | `enterLiquidation` — the human judgement call | **trustee** | 11672934 | [`0x8a5121bb…7e90a39242`](https://sepolia.etherscan.io/tx/0x8a5121bb95318a52a292ebe4df962d5a04262634bdfc2ec7de69677e90a39242) |
| **11** | **`executePlan` — the waterfall** | *anyone* (same stranger) | 11672939 | [**`0xb693dbab…2e9a8bafc8`**](https://sepolia.etherscan.io/tx/0xb693dbab092d82cb70379969b7880bc3103874498bafe48682d0882e9a8bafc8) |
| 12 | `resolve` — terminal wind-up | **trustee** | 11672942 | [`0xba235502…49b2bceda9`](https://sepolia.etherscan.io/tx/0xba2355020125ac12cfd06af36f0e6c3593281dcdfbfd81151a660149b2bceda9) |

### Rows 6 and 9 are the entire project

Both were sent by the same address, to the same contract (Circle USDC
`0x1c7D4B19…7238`), for the same amount, by the same script. The only thing that
differed is 37 blocks of elapsed time, in which the agent died.

```bash
# scripts/route-payment.sh takes an agent id. It does NOT take a destination.
$ cast call $REGISTRY "getPaymentDestination(bytes32)(address)" $AGENT3
# ...and sends to exactly whatever that returned.
```

That distinction is the whole reason this is a protocol rather than two
addresses someone funded by hand. The obvious way to fake this demo is to send
money to wallet A, then send money to wallet B, and narrate it as a flip. Here
the payer cannot do that even if it wants to: the destination is not one of its
inputs.

The `Transfer` events are the proof, decoded from the two receipts:

```text
row 6   200000 USDC   0xbFe5551e…16EA -> 0x29eA9aE5…5557   (treasury)
row 9   200000 USDC   0xbFe5551e…16EA -> 0xD52b37AD…7C5F   (estate)
row 11  200000 USDC   0xD52b37AD…7C5F -> 0x77b31B4a…C35a   (secured creditor)
```

Read the third line against the second: **the USDC the waterfall paid out is the
USDC that routed in.**

### What the waterfall did, under scarcity

`executePlan` ran with 200000 units available against 850000 owed. Nobody was
made whole, which is the normal case in an insolvency and the only case worth
demonstrating:

| Class | Creditor | Allowed | Paid |
|---|---|---|---|
| Secured | `0x77b31B4a…C35a` | 250000 | **200000** |
| Administrative | `0xb081dc53…042f` | 200000 | 0 |
| Unsecured | `0x356895DE…810b` | 400000 | 0 |
| | | | estate drained to **0**, shortfall **650000** |

Strict priority, not pro-rata across classes: secured is paid as far as the
money goes and the rest get nothing.

### Four keys, and a stranger

The five addresses in the table are five different keys. Agent 3's owner cannot
heartbeat, its trustee cannot restore it, and the address that pushed it into
Administration and later ran the waterfall — `0x72db032c…c706` — holds **none**
of its roles. That is the design working, not a shortcut:
`enterAdministration` checks the deadline, not the caller, because a dead-man's
switch that needs a trusted party to be awake is not one.

The estate is a real contract, and provably this agent's:

```bash
$ cast codesize 0xD52b37AD931F221A902fC7F43A9ed2D87Ce07C5F   # 6539
$ cast call 0xD52b37AD931F221A902fC7F43A9ed2D87Ce07C5F "agentId()(bytes32)"
0x96abf3c7f8f72fdf248e91137fb471a442dccf3fcece378b2065616cb68c36d4
```

### Verify the current state yourself

```bash
RPC=https://ethereum-sepolia-rpc.publicnode.com
REG=0x2946B46c2EB5Ec532093877223Ef043b13729e39
A3=0x96abf3c7f8f72fdf248e91137fb471a442dccf3fcece378b2065616cb68c36d4

cast call $REG "getStatus(bytes32)(uint8)" $A3 --rpc-url $RPC              # 3 = Resolved
cast call $REG "getPaymentDestination(bytes32)(address)" $A3 --rpc-url $RPC # the estate
```

Or query the subgraph for the whole life in one request:

```bash
curl -s https://api.studio.thegraph.com/query/1760047/executor/v0.1.1 \
  -H 'content-type: application/json' -d '{"query":"{ agent(id:\"'$A3'\"){ status heartbeatCount executions{ totalPaid shortfall } claims{ priorityClass allowedAmount amountPaid } statusChanges(orderBy:blockNumber){ from to caller } } }"}'
```

---

## The second agent: recovery, and life after `resolve()`

Agent 3 above is the cleaner story, but it never recovered and it only ran the
waterfall once. Agent 2 covers the two properties it does not: **a missed
heartbeat that gets walked back**, and **an estate that still pays after the
agent has been wound up**. 21 transactions, same public chain, same rules.

One thing agent 2 deliberately does *not* prove, and the reason it is no longer
the headline: its estate was funded by hand (step 8 below). Nothing in agent 2's
history shows money *routing* to a destination the protocol chose. That is
agent 3's rows 6 and 9, and it is the claim that matters most.

Agent 2 — `0x3bb9846eddba2c5c78b94bbc2be970db97c11731d2588aa86d375e281183cc67` —
was registered under four **distinct** role keys, heartbeat once from its
heartbeat signer, let the window lapse, was pushed into Administration by a
stranger, pulled back to Active by its recovery authority, dropped again,
liquidated by its trustee, and then paid its creditors out of an estate holding
less than half of what it owed.

### The full lifecycle, on Sepolia

| # | Step | Sent by (role) | Transaction |
|---|---|---|---|
| 1 | `registerAgent` (estate = placeholder) | **owner** `0x99dD…D085` | [`0x3ead1a4e…3425a7f9a2`](https://sepolia.etherscan.io/tx/0x3ead1a4e7c674cadfb9d85c580efbcf67752adb7003d7a0e997a3a3425a7f9a2) |
| 2 | `Estate` deployed, bound to Circle USDC | operator | [`0x7e82cd00…ee6c62feb2`](https://sepolia.etherscan.io/tx/0x7e82cd004ef3cc5eae8c5699d06f04f2f5d6f7fa33f286e1445104ee6c62feb2) |
| 3 | `updatePlan` — estate amended to the real contract | **owner** | [`0xb8f1e4b4…21bb9086f9`](https://sepolia.etherscan.io/tx/0xb8f1e4b40a201bb2c7330bf30853d940e98fd0af61212386268b9a21bb9086f9) |
| 4 | `lockPlan` — the plan is now frozen | **owner** | [`0x6c0ad580…4a508ba6a2f5`](https://sepolia.etherscan.io/tx/0x6c0ad580d0cc83e644f997331935d388a9a7c03b8689da952a9f4a508ba6a2f5) |
| 5 | `heartbeat` | **heartbeat signer** `0xB3E8…2F17` | [`0x867c5b4d…7b7010f7e25d`](https://sepolia.etherscan.io/tx/0x867c5b4d068d2ad518d7b69386c7722b9ed45d15a56c02334c629b7010f7e25d) |
| 6 | `enterAdministration` — the window lapsed | *anyone* (operator, holds none of the four roles) | [`0xce331993…14b4422b0f314c4108a`](https://sepolia.etherscan.io/tx/0xce331993eb3b909ef591214b3fbf529eadf5add7ad2ca19b4422b0f314c4108a) |
| 7 | `restoreActive` — a missed heartbeat is not insolvency | **recovery authority** `0xcB51…1901` | [`0xb378d97e…1105403f45e8`](https://sepolia.etherscan.io/tx/0xb378d97e3c6e1816f7419d29b48ca0ea51251a913eeff49dc24d1105403f45e8) |
| 8 | 0.5 USDC transferred into the estate | operator | [`0x6735b7aa…ccadddd1a5c`](https://sepolia.etherscan.io/tx/0x6735b7aa13696d93c6fbbd2acc1c783d751b8df0b8c982fd1dd44ccadddd1a5c) |
| 9 | `registerClaim` — Secured, 0.20 USDC | **trustee** `0xd09e…ED8C` | [`0xe91f8769…3bd9b25168`](https://sepolia.etherscan.io/tx/0xe91f8769baaaeb713e4ab329c3992cd5961d5a13d26d70f976527b3bd9b25168) |
| 10 | `registerClaim` — Administrative, 0.40 USDC | **trustee** | [`0xe091b515…85d09fa91a5c`](https://sepolia.etherscan.io/tx/0xe091b5158369fd8c07fa5e2f26e15bac452772a8af65ee45f57385d09fa91a5c) |
| 11 | `registerClaim` — Administrative, 0.30 USDC | **trustee** | [`0x807876f5…9f8c417718c6c`](https://sepolia.etherscan.io/tx/0x807876f527627d79be7c34fb56465377541700f3c7e0470f3d29f8c417718c6c) |
| 12 | `registerClaim` — Unsecured, 0.50 USDC | **trustee** | [`0x48ecd757…cad67974b7bc`](https://sepolia.etherscan.io/tx/0x48ecd7578c6356c3868df0e864465720c8a187440ae2e95d3c99cad67974b7bc) |
| 13 | `approvePlan` — commits to the exact claim set | **trustee** | [`0x2e8153a6…934c011d26b`](https://sepolia.etherscan.io/tx/0x2e8153a639f757414c56bb30e7d5920cb56f2a3c9d5ee616b133f934c011d26b) |
| 14 | `enterAdministration` again | *anyone* | [`0x010cffcb…b5c81b2a127`](https://sepolia.etherscan.io/tx/0x010cffcb1282ee103870878513d17088e3445b2a6145d98dc45b3b5c81b2a127) |
| 15 | `enterLiquidation` — the human judgement call | **trustee** | [`0x5155823f…1df32ab2c6ac`](https://sepolia.etherscan.io/tx/0x5155823f2040e7230afdfafba47ded09277c11e8aab3f88d388c1df32ab2c6ac) |
| **16** | **`executePlan` — the waterfall, round 1** | *anyone* | [**`0xd5c45ef3…f7f65b327f`**](https://sepolia.etherscan.io/tx/0xd5c45ef3d20a67beb6e9bbc94a25f11380147af580c0682e516ecdf7f65b327f) |
| 17 | `resolve` — terminal state, **before** the estate is finished | **trustee** | [`0xff2d9200…692760e6179`](https://sepolia.etherscan.io/tx/0xff2d9200ac65ff3a8a4bf95db8d12aa1cdf1fbe79ee5a9fb02dd3692760e6179) |
| 18 | late revenue: another 0.5 USDC arrives | operator | [`0x7477e4dd…49d3a6ca5d8f`](https://sepolia.etherscan.io/tx/0x7477e4dde3e2b0afd731b61d72ecfaee86c43c63ff20b640f53149d3a6ca5d8f) |
| **19** | **`executePlan` — round 2, run while the agent is Resolved** | *anyone* | [**`0xae50be9a…6f2f495521`**](https://sepolia.etherscan.io/tx/0xae50be9a3ce584a0952e3a51f590b94bdd247d04687f0b60d429ca6f2f495521) |

**What steps 17–19 do and do not prove.** Round 2 was *funded* by step 18 — the
fresh 0.5 USDC — and by nothing else. `resolve()` moved no money and unlocked
no money; reading the table as "`resolve()` enabled round 2" gets the causality
backwards, and the ordering alone would be a coincidence worth nothing. The
property actually demonstrated is stronger than a sequence: **reaching the
terminal `Resolved` state does not brick the estate.** `Resolved` is one-way
and nothing in the protocol orders `resolve()` against `executePlan()`, so a
trustee who winds the agent up first would, on a naive implementation, strand
every creditor still owed money and every unit of late revenue permanently.
Step 19 is the live proof that this deployment is not that implementation:
called at a point of no return, on an agent the registry reports as `Resolved`,
the waterfall still ran and still paid. `Estate.executePlan` accepts status 2
*and* status 3 for exactly this reason, and
`test_executePlan_stillRunsOnceResolved` pins it.

The whole of it renders in the dashboard, which reads any agent id, not just
the demo one: `pnpm -C apps/dashboard dev`, then
`/agent/0x3bb9846eddba2c5c78b94bbc2be970db97c11731d2588aa86d375e281183cc67`.
The history panel there is served by the subgraph in `subgraph/`, not by an RPC
log scan - see [subgraph/README.md](subgraph/README.md) for why that swap was
made and what it does and does not let us claim.

The remaining two are the recoverable flip, re-run on the original demo agent —
[`enterAdministration`](https://sepolia.etherscan.io/tx/0x47a310d6fac2fd00add0192d01bc0d1514d9ce34e037132798641912e5bfb3dc)
then
[`restoreActive`](https://sepolia.etherscan.io/tx/0x69d859e25676aac5468d6d175c9c30395fe016a7f5ba033b831cd32c9fe13720),
so that agent's history panel has real `StatusChanged` events too. Its
`enterLiquidation` was deliberately *not* called: liquidation is one-way, and
that agent is the live dashboard demo. It was left Active.

### What the waterfall actually did

The estate held **0.5 USDC** against **1.4 USDC** of allowed claims. That is the
interesting case: strict priority across classes, pro-rata inside the class that
runs out, and truncation dust that has to go somewhere.

| Creditor | Class | Allowed | Round 1 | Round 2 | Final |
|---|---|---|---|---|---|
| `0x3AFf06C6…6087cb` | Secured | 0.200000 | **0.200000** (in full, first) | — | 0.200000 |
| `0x8e8D8415…6083a9` | Administrative | 0.400000 | 0.171429 | +0.228571 | 0.400000 |
| `0x72F0E1d0…9fA455` | Administrative | 0.300000 | 0.128571 | +0.171429 | 0.300000 |
| `0xBe8fE696…C7514c` | Unsecured | 0.500000 | **0** (estate exhausted) | +0.100000 | 0.100000 |

Round 1's Administrative split is the arithmetic worth checking: 0.3 USDC left
against 0.7 USDC of Administrative claims, so `400000 * 300000 / 700000` =
171428 and `300000 * 300000 / 700000` = 128571 — 299999 of the 300000. The
missing unit is not stranded: `executePlan`'s remainder pass hands it to the
first claim still short, which is why the log says 171429. The two
`PlanExecuted` events report shortfalls of 900000 and then 400000 — the real
numbers, not zero.

Check the payouts yourself:

```bash
for c in 0x3AFf06C662A51F1B701C1499ac50F8F56d6087cb \
         0x8e8D8415cf0e527e06a04E0A0FD5D3B4ae6083a9 \
         0x72F0E1d0327CE912C3baE2D1f555e50CeB9fA455 \
         0xBe8fE696404eBA73fEe09e7d8F6c9eCD3BC7514c; do
  cast call 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238 \
    "balanceOf(address)(uint256)" $c \
    --rpc-url https://ethereum-sepolia-rpc.publicnode.com
done
# 200000  400000  300000  100000
```

### Agent 2's four roles are four different addresses

The judge's fair criticism of the original demo agent was that its owner,
heartbeat signer, trustee and recovery authority are all
`0x72db…c706`, which means separation of powers was declared and never
exercised. On agent 2 it is exercised, and the transaction table above shows
which key signed what. The negative side is checkable too — these are `eth_call`s,
so they cost nothing and prove *which* guard fired:

```bash
REG=0x2946B46c2EB5Ec532093877223Ef043b13729e39
AID=0x3bb9846eddba2c5c78b94bbc2be970db97c11731d2588aa86d375e281183cc67
RPC=https://ethereum-sepolia-rpc.publicnode.com

# 0x92af0fc8 = NotHeartbeatSigner()  - the owner cannot heartbeat
cast call $REG "heartbeat(bytes32)" $AID \
  --from 0x99dDbaE5142bb0C2FE5B46A571adb04437d2D085 --rpc-url $RPC

# 0x054ac53f = NotRecoveryAuthority() - the trustee cannot restore
cast call $REG "restoreActive(bytes32)" $AID \
  --from 0xd09e929E440c6743164D63CC806A1c7A39DfED8C --rpc-url $RPC

# 0x359011cc + 3 = WrongStatus(Resolved) - not even the recovery authority
# can walk a resolved agent back. This is what makes liquidation terminal.
cast call $REG "restoreActive(bytes32)" $AID \
  --from 0xcB5161bdE9671aE5EC613ab05AC631E1Bc7f1901 --rpc-url $RPC

# 0x5aa309bb = NotTrustee() - a stranger cannot register a claim
cast call 0x83f447FAb4E1267Ca5fd6Ebe151a93b462EFfC7F \
  "registerClaim(bytes32,address,uint256,uint8)" \
  $(cast keccak "forged") 0x72db032c0dFB6E7502e16A73fabdab31712dc706 9999 0 \
  --from 0x72db032c0dFB6E7502e16A73fabdab31712dc706 --rpc-url $RPC
```

### The permanent-freeze bug, and its fix, on the live contract

`Estate.registerClaim` used `claims[claimId].creditor != address(0)` as its
existence check. A claim registered with a zero creditor therefore never set
the sentinel, so the same id passed the duplicate check again and was pushed
into `claimIds` twice. `_classTotal` then counted it twice, two allocation
slots settled against one `Claim`, `paidAmount` overshot `allowedAmount`, and
every later `allowedAmount - paidAmount` reverted with an arithmetic panic —
inside `totalOutstanding()`, which both `executePlan` **and** `sweepSurplus`
call. That is every path out of the contract closed, permanently, with no admin
escape.

The fix is a dedicated `registered` flag as the sentinel plus an outright
rejection of the zero creditor. `test_registerClaim_zeroCreditorCannotFreezeTheEstate`
reproduces the whole chain — the duplicate push, the overshoot, the panic — and
fails against the old code. `scripts/e2e-local.sh` asserts the same guard by
selector. And it is refused on Sepolia:

```bash
# reverts 0xef5fa8b7 = ZeroCreditor()
cast call 0x775223E7a0bAE836511934435ec7B2Ea838Eb832 \
  "registerClaim(bytes32,address,uint256,uint8)" \
  $(cast keccak "ghost") 0x0000000000000000000000000000000000000000 500000 2 \
  --from 0xd09e929E440c6743164D63CC806A1c7A39DfED8C \
  --rpc-url https://ethereum-sepolia-rpc.publicnode.com

# reverts 0xc33e5e92 = ClaimAlreadyRegistered() - the id is already taken, and
# now the `registered` flag is what says so
cast call 0x775223E7a0bAE836511934435ec7B2Ea838Eb832 \
  "registerClaim(bytes32,address,uint256,uint8)" \
  0x8727f387cf2a7a26c7b47a48dc2fdb45a64d423da4e52fb0b495c30679211df1 \
  0x8e8D8415cf0e527e06a04E0A0FD5D3B4ae6083a9 1 0 \
  --from 0xd09e929E440c6743164D63CC806A1c7A39DfED8C \
  --rpc-url https://ethereum-sepolia-rpc.publicnode.com
```

**Why a third address for those two calls.** `registerClaim` checks `executed`
before it checks anything about its arguments, so on the estate that actually
ran the waterfall (`0x83f4…fC7F`) both of the calls above now return
`0x0dc10197` = `AlreadyExecuted()` and prove nothing about the fix. Rather than
print a command that reverts for the wrong reason, there is a second Estate at
[`0x775223E7a0bAE836511934435ec7B2Ea838Eb832`](https://sepolia.etherscan.io/address/0x775223E7a0bAE836511934435ec7B2Ea838Eb832)
— same build, same trustee, one registered claim, no funds, never executed —
kept open precisely so these guards stay callable. It was checked live against
`0x83f4…fC7F` too, before the distribution, and returned `0xef5fa8b7` there.

### Agent 2's addresses

| | |
|---|---|
| agent id | `0x3bb9846eddba2c5c78b94bbc2be970db97c11731d2588aa86d375e281183cc67` |
| owner | [`0x99dDbaE5142bb0C2FE5B46A571adb04437d2D085`](https://sepolia.etherscan.io/address/0x99dDbaE5142bb0C2FE5B46A571adb04437d2D085) |
| heartbeat signer | [`0xB3E86A269BFf4cd615DaB7a8109B0275dF1D2F17`](https://sepolia.etherscan.io/address/0xB3E86A269BFf4cd615DaB7a8109B0275dF1D2F17) |
| trustee | [`0xd09e929E440c6743164D63CC806A1c7A39DfED8C`](https://sepolia.etherscan.io/address/0xd09e929E440c6743164D63CC806A1c7A39DfED8C) |
| recovery authority | [`0xcB5161bdE9671aE5EC613ab05AC631E1Bc7f1901`](https://sepolia.etherscan.io/address/0xcB5161bdE9671aE5EC613ab05AC631E1Bc7f1901) |
| treasury | `0x81f6c368ede3ab917DC5616736F8C9cbFc540cc8` |
| `Estate` (settled the waterfall) | [`0x83f447FAb4E1267Ca5fd6Ebe151a93b462EFfC7F`](https://sepolia.etherscan.io/address/0x83f447FAb4E1267Ca5fd6Ebe151a93b462EFfC7F) |
| `Estate` (guard demonstrator, unexecuted) | [`0x775223E7a0bAE836511934435ec7B2Ea838Eb832`](https://sepolia.etherscan.io/address/0x775223E7a0bAE836511934435ec7B2Ea838Eb832) |

---

## Three more things you can check in 60 seconds

1. **The contract, on Sepolia** —
   [`0x2946B46c2EB5Ec532093877223Ef043b13729e39`](https://sepolia.etherscan.io/address/0x2946B46c2EB5Ec532093877223Ef043b13729e39)
   ([deployed](https://sepolia.etherscan.io/tx/0xe0975d0b2bf4590cf72d3eb84f057c2da49a0d60162916c930402439ca49129e)
   in block 11669841). Read `getPaymentDestination` with agent id
   `0x6574c8cc5e4ca438a061eb83708582b10658d3a1a7334a8d94b6f6a1960dcb37`:

   ```bash
   # returns 0x7ea7…7330 (treasury) while Active, 0xDE32…2337 (estate) if not
   cast call 0x2946B46c2EB5Ec532093877223Ef043b13729e39 \
     "getPaymentDestination(bytes32)(address)" \
     0x6574c8cc5e4ca438a061eb83708582b10658d3a1a7334a8d94b6f6a1960dcb37 \
     --rpc-url https://ethereum-sepolia-rpc.publicnode.com
   ```

   It returns the treasury `0x7ea7…7330` while the agent is Active and the
   estate payout address `0xDE32…2337` once it isn't. It was left Active — but
   A heartbeat runner keeps it Active on a 45-second cadence against a
   180-second deadline (`heartbeatInterval` 120 + `gracePeriod` 60). If that
   runner is not up when you read this, the window lapses and
   `enterAdministration` becomes callable by anyone — so you may well read the
   estate address instead. That is the mechanism working, not the README being
   wrong: pair this with `getStatus(bytes32)` and the two always agree. Agent 2's lifecycle above is the
   version that cannot drift, because every state it passed through is a
   recorded transaction.

2. **The plan lock, enforced on live chain** — the plan was
   [amended](https://sepolia.etherscan.io/tx/0xa6e85bec3c4334659cb2b84aab274b48e9e75026a4947e3cee5ee2020eb6953c)
   with `updatePlan`, then
   [locked](https://sepolia.etherscan.io/tx/0xff0d42572a2565280a8a8500840c7d3f80f81085d4e02cbf735c7cde83f414c0).
   The same `updatePlan` call, from the plan's own owner, now reverts:

   ```bash
   # reverts with 0x96cb9f37 = PlanIsLocked()
   cast call 0x2946B46c2EB5Ec532093877223Ef043b13729e39 \
     "updatePlan(bytes32,address,address,address,address,address,uint64,uint64)" \
     0x6574c8cc5e4ca438a061eb83708582b10658d3a1a7334a8d94b6f6a1960dcb37 \
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

4. **ENS decides where the money goes** — the gateway never reads the payout
   address from `ExecutorRegistry`. It asks ENS, and pays what ENS says:

   ```bash
   RPC=https://ethereum-sepolia-rpc.publicnode.com

   # the name's resolver, from the ENSv2 registry (argument is the label string)
   cast call 0x67b728a792e789a8978b30cf1b3b641f19354b43 \
     "getResolver(string)(address)" "executor-hackathon-demo" --rpc-url $RPC
   # -> 0x52fccD0BaFeFfc0cb85aB50F90a3CFb7fB487E43

   # the addr record it serves - this is the address the 402 challenge quotes
   cast call 0x52fccD0BaFeFfc0cb85aB50F90a3CFb7fB487E43 \
     "addr(bytes32,uint256)(bytes)" \
     0xebf5950ce1cd24d4bc0f0cabcc987510f64e6d4ec76005b69b500203c6a5e63d 60 \
     --rpc-url $RPC
   ```

   `ExecutorResolver` stores no address — `addr()` reads
   `getPaymentDestination()` at the block it is called in — so ENS and the
   registry cannot disagree, and there is no stale record that could silently
   misroute an agent's revenue. The gateway cross-checks anyway and refuses to
   sell on mismatch. `docs/PRIZES.md` has the full walkthrough, including
   resolution through ENS's own `UniversalResolverV2`.

5. **The ENS succession lock, verifiable without a wallet** — the operator of
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
| `Estate` | `contracts/src/Estate.sol` | Creditor claims, a trustee-approved plan hash, and a priority-class distribution waterfall with pull-payment fallback | Sepolia [`0x83f4…fC7F`](https://sepolia.etherscan.io/address/0x83f447FAb4E1267Ca5fd6Ebe151a93b462EFfC7F) (agent 2 — **has run**, twice), and the earlier [`0xD67a…286f`](https://sepolia.etherscan.io/address/0xD67a10D5466d311C2f995744937c7b9e1734286f) (demo agent — never used). Both bound to Circle USDC |
| x402 gateway | `packages/agent-debtor/src/gateway.ts` | A real x402 resource server on Hedera testnet selling a genuine LLM query, whose `payTo` is resolved through ENS on every request | Runs locally against Hedera testnet |
| `ExecutorResolver` | `contracts/src/ExecutorResolver.sol` | The ENS resolver in the money path. Derives `addr()` from `ExecutorRegistry` at call time, so the record cannot go stale | Sepolia [`0x52fcc…7E43`](https://sepolia.etherscan.io/address/0x52fccD0BaFeFfc0cb85aB50F90a3CFb7fB487E43) |
| Dashboard | `apps/dashboard` | Next.js app doing live chain reads, plus two write routes that call `enterAdministration` / `restoreActive` | Runs locally |
| ENSv2 name | `executor-hackathon-demo.eth` | The payment destination the gateway resolves before every quote, with the resolver-admin role irreversibly revoked | Sepolia |

### What is deployed, and what each deployment proves

Both contracts are on Sepolia, and the deployed registry is the same build as
`contracts/src/ExecutorRegistry.sol` — `updatePlan` and `resolve` included.
`Estate` is deployed twice: `0x83f4…fC7F` is the current source, including the
`ZeroCreditor` fix, and is the one that ran the waterfall above.
`0xD67a…286f` predates the fix, holds nothing, and is left in place only so the
older links in these docs keep resolving.

| Thing | Address | Deploy tx |
|---|---|---|
| `ExecutorRegistry` | [`0x2946B46c2EB5Ec532093877223Ef043b13729e39`](https://sepolia.etherscan.io/address/0x2946B46c2EB5Ec532093877223Ef043b13729e39) (block 11669841) | [`0xe0975d0b…9ca49129e`](https://sepolia.etherscan.io/tx/0xe0975d0b2bf4590cf72d3eb84f057c2da49a0d60162916c930402439ca49129e) |
| `Estate` (agent 2, current code, **settled a real waterfall**) | [`0x83f447FAb4E1267Ca5fd6Ebe151a93b462EFfC7F`](https://sepolia.etherscan.io/address/0x83f447FAb4E1267Ca5fd6Ebe151a93b462EFfC7F) | [`0x7e82cd00…ee6c62feb2`](https://sepolia.etherscan.io/tx/0x7e82cd004ef3cc5eae8c5699d06f04f2f5d6f7fa33f286e1445104ee6c62feb2) |
| `Estate` (demo agent, pre-`ZeroCreditor`-fix build, never used) | [`0xD67a10D5466d311C2f995744937c7b9e1734286f`](https://sepolia.etherscan.io/address/0xD67a10D5466d311C2f995744937c7b9e1734286f) | [`0xf234c5ff…d77cb049362`](https://sepolia.etherscan.io/tx/0xf234c5ff5a0f31b56ebdb43ae813f7f3920ec5fcf5d504d2ccdb1d77cb049362) |

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
  0x6574c8cc5e4ca438a061eb83708582b10658d3a1a7334a8d94b6f6a1960dcb37 \
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

This trips people up on first read, so: the **demo agent's** plan holds
`estate = 0xDE3207F493fE4600DeEc424e0875ec943d712337`, which is **not** an
`Estate` contract at all. It is not a mistake. There are two settlement rails
for the same failed agent, and they carry different money. (Agent 2 is the
other configuration: its plan's `estate` field *is* its `Estate` contract
`0x83f4…fC7F`, which is why `enterAdministration` there flips the payment
destination straight onto the waterfall.)

- **x402 revenue settles on Hedera.** `0xDE32…2337` is an EVM address with no
  code on Sepolia; it is the Hedera-mapped payout account `0.0.10423647`. When
  the registry flips, the gateway resolves `getPaymentDestination()` through the
  mirror node and the *next HBAR payment* lands there. That is the rail the
  Hedera transaction IDs in `docs/PRIZES.md` are on.
- **Creditor claims settle on Sepolia in USDC.** `Estate` is the contract that
  takes registered claims, a trustee-approved plan hash and a priority-class
  waterfall. Its constructor binds it to Circle's real Sepolia USDC
  `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238` (`symbol()` is `"USDC"`,
  `decimals()` is `6`), and its `registry()`, `trustee()` and `agentId()`
  getters read back the registry above, that estate's trustee, and its agent
  id. Agent 2's estate `0x83f4…fC7F` did exactly this, for 1 USDC, in the
  transactions at the top of this file.

```bash
cast call 0x83f447FAb4E1267Ca5fd6Ebe151a93b462EFfC7F "usdc()(address)" \
  --rpc-url https://ethereum-sepolia-rpc.publicnode.com     # 0x1c7D…7238
cast call 0x83f447FAb4E1267Ca5fd6Ebe151a93b462EFfC7F "registry()(address)" \
  --rpc-url https://ethereum-sepolia-rpc.publicnode.com     # 0x2946…9e39
cast call 0x83f447FAb4E1267Ca5fd6Ebe151a93b462EFfC7F "totalOutstanding()(uint256)" \
  --rpc-url https://ethereum-sepolia-rpc.publicnode.com     # 400000 - the real shortfall
```

Nothing automatically moves value from the Hedera rail to the Sepolia one. A
trustee would have to bridge it. That gap is real and is not implemented.

### What is and is not proven on-chain

- **The lifecycle has been run on `0x2946…9e39`.** Twice, on two agents: the
  full `Active -> Administration -> Active -> Administration -> Liquidation ->
  Resolved` walk on agent 2, and the recoverable `Active -> Administration ->
  Active` flip on the demo agent. Before this the registry had emitted only
  `AgentRegistered`, `PlanUpdated` and `PlanLocked` — zero `StatusChanged`,
  zero `Heartbeat`. It now has both, and `cast logs` on the address will show
  you how many.
- **The waterfall has run on Sepolia, with real Circle USDC.** Two rounds, four
  creditors, a 0.9 USDC shortfall in round one. See the tables at the top. What
  it did *not* do is exercise the pull-payment escrow path on chain — no real
  USDC address involved here is blacklisted, and blacklisting one is not
  something we can arrange. That branch is covered by unit tests and by
  `scripts/e2e-local.sh` against a mock that models USDC's blocklist.
- **`Estate` at `0xD67a…286f` — the *first* Estate, bound to the original demo
  agent — still holds no funds and no claims.** It was superseded by
  `0x83f4…fC7F`, which carries the `registerClaim` fix and is the one that
  settled. Nothing was ever executed at `0xD67a…286f`, and this README does not
  claim otherwise.
- **Nothing bridges the two rails.** x402 revenue lands on Hedera; creditor
  claims settle in USDC on Sepolia. A trustee would have to move value between
  them by hand. The 1 USDC that funded agent 2's estate came from the operator
  directly, not from x402 revenue.

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

- `contracts/` — Foundry. `ExecutorRegistry.sol`, `Estate.sol` and
  `ExecutorResolver.sol` are all deployed on Sepolia (addresses above).
  `test/Estate.t.sol` (40), `test/ExecutorRegistry.t.sol` (37),
  `test/ExecutorResolver.t.sol` (14), `test/LivingWill.t.sol` (9, ENSv2 role
  semantics) and `test/Receiver.t.sol` (4, for the superseded contract) cover
  them — **122 in total**, all passing.
- `packages/agent-debtor/src/gateway.ts` — the x402 resource server.
  `pay-for-research.ts` — the matching paying client.
- `apps/dashboard` — the Next.js dashboard. Current state comes from contract
  reads; history and liveness statistics come from the subgraph.
- `subgraph/` — the Graph subgraph indexing `ExecutorRegistry` and, through a
  dynamic data source template, every `Estate` an agent has pointed at. Live at
  `https://api.studio.thegraph.com/query/1760047/executor/v0.1.1`.
- `scripts/route-payment.sh` — pays an agent by reading
  `getPaymentDestination` at payment time. Takes an agent id and **no
  destination**, which is what makes rows 6 and 9 above meaningful.
- `scripts/heartbeat.sh` — the liveness runner.
- `scripts/record-demo/` — how the demo video was produced, including the
  script that pulls every displayed value off-chain.
- `scripts/e2e-local.sh` — the same lifecycle from an empty anvil chain, with
  assertions on every step and negative assertions checked against the 4-byte
  custom-error selector.
- `demo/script.md` — the shot list, describing only things that exist.

**There is no stub graveyard any more.** `packages/optional`, `packages/sweep`,
`packages/bazantic`, `packages/cre-workflow`,
`packages/agent-trustee`, `packages/agent-client`, `packages/shared`,
`demo/run-e2e.ts`, `demo/seed.ts` and four dead files under
`packages/agent-debtor/src/` were `git rm`'d rather than left as decoration —
`console.log`s and `throw new Error("not implemented")` in directories a reader
has to open before learning they do nothing. Git history keeps them.

Two things in `contracts/src/` are still there and still do not run, because
`ExecutorRegistry.sol`'s header comment refers to them:
`contracts/src/Receiver.sol` was never deployed and is superseded, and
`contracts/src/adapters/EnsAdapter.sol` describes an ENSv2 registry interface
that does not exist. Both say so in their own headers.

An earlier version of this README described a two-chain system with an
`Estate` contract on Arc and a Chainlink CRE TEE performing confidential
solvency checks. The Arc deployment and the CRE TEE were never built and the
claims have been removed rather than softened. The `Estate` contract itself now
exists, is tested, and is deployed — on Sepolia, not on Arc.

## Running it

```bash
pnpm install
cd contracts && forge install

forge test                                    # 122 tests
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

- **The estate has settled two insolvencies, for about 1.2 USDC in total.**
  Those are real distributions with real money on a public chain, and they are
  also small ones.
  It exercised strict priority, pro-rata splitting, truncation-remainder
  recovery, repeat rounds and post-`resolve` execution. It did not exercise the
  pull-payment escrow branch (nobody here can get an address blacklisted by
  Circle), the 200-claim ceiling, or any adversarial trustee. Those live in the
  test suite.
- **The estate trusts the token it was constructed with — but less than it
  used to.** `_tryTransfer` no longer takes a token's `true` at face value; it
  requires this contract's balance to have actually fallen, and treats a token
  that reports success while moving nothing exactly like a blacklist, escrowing
  the amount for a later pull instead of marking the claim settled. That closes
  a hole that was never exploitable against Circle USDC and would have been
  against a hostile token, and it costs two extra `balanceOf` reads per payout
  (the 200-claim distribution went from 9.4M to 12.2M gas). What it still does
  not do is defend against a token that lies about `balanceOf` as well.
- **The waterfall settles one ERC-20.** Non-USDC estate assets are not sold
  first, and nothing values them. There is no code for that, and the stub
  directory that used to stand in for it has been deleted rather than left
  looking like a plan.
- **A claim ceiling.** `Estate.MAX_CLAIMS` is 200, because `executePlan` walks
  the claim array several times per priority class and an unbounded array is a
  gas-limit brick waiting to happen. Larger estates need to be split across
  several `Estate` contracts.
- **Payments are native HBAR**, not USDC.
- **None of the recent contract fixes are on chain.** Adversarial review found
  several real bugs; all are fixed in source and pinned by tests, and the
  deployed bytecode predates every one of them. Concretely, on the live
  Sepolia deployments:

  | fix | in source | deployed |
  |---|---|---|
  | `sweepSurplus` gated on status, approved plan and a non-empty claim set | yes | **no** |
  | `approvePlan` validates the hash instead of storing any 32 bytes | yes | **no** |
  | `returnToTreasury()` — recovers estate funds after `restoreActive` | yes | **absent entirely** |
  | `registerAgent`/`updatePlan` reject zero addresses | yes | **no** |

  You can check the last one in one call: `registerAgent` with an all-zero
  trustee, estate and recovery authority still succeeds against the deployed
  registry. And `cast call <estate> "returnToTreasury()"` reverts on both live
  estates, because the function does not exist there.

  **What is actually at risk:** nothing, on the `sweepSurplus` path — both live
  estates (`0xD52b37AD…7C5F`, `0x83f447FA…fC7F`) hold 0 USDC with non-zero
  `totalOutstanding`, so `ClaimsOutstanding` blocks it on each. The stranded-funds
  problem `returnToTreasury` solves *is* live and unmitigated on chain: an agent
  that lapsed, took revenue, and then recovered would have no way to get that
  revenue back out of a deployed estate. No agent is currently in that state.

  These are not redeployed because doing so would invalidate every transaction
  link in this README, and the agent-3 lifecycle those links prove is the
  strongest artifact here. That is a deliberate trade, not an oversight, and
  this table is the price of making it.
- **The live demo agent's `estate` field is an EOA, not the `Estate` contract.** Agent `0x6574c8cc…cb37`, the one
  `executor-hackathon-demo.eth` resolves to, names `0xDE3207F4…2337` as its
  estate. That address has no code. This is not an oversight: the x402 gateway
  maps a payment destination to a Hedera account through the mirror node, and
  `/api/v1/accounts/0xD52b37AD…7C5F` — the Sepolia `Estate` *contract* — returns
  no account at all. Pointing this agent's `estate` field at the contract would
  break settlement the moment it flipped. So the registry's `estate` is the
  Hedera-mapped payout account for the revenue rail, and the `Estate` contract
  is the claims venue on Sepolia; `docs/ARCHITECTURE.md` covers the split.

  **This is a design limitation, not a law of nature, and it is worth being
  precise about which.** The registry stores *one* address that has to be both a
  Sepolia contract and a Hedera account, and no address is both. Two fields — an
  `estatePayout` for the rail and an `estateContract` for the claims — would
  dissolve it entirely. Agent 2 shows the other side of the same coin: it points
  `estate` straight at its `Estate` contract, so its flip and its waterfall land
  on the same address, because it never had to satisfy the Hedera rail. What is
  actually unfixable is the *retrofit*: this agent's plan is locked, and the
  registry is deployed.

  What follows honestly from that: **flipping the live demo agent proves the
  payment destination changes, and not that a waterfall runs.** The agent that
  proves the waterfall is agent 3 at the top of this README, whose `estate` *is*
  a real `Estate` contract at `0xD52b37AD…7C5F` — because agent 3 was driven
  entirely on Sepolia and never had to satisfy the Hedera rail. The subgraph
  exposes the distinction directly as `Agent.estateIsContract`.

  The live agent does now have real separation of powers — owner, heartbeat
  signer, trustee and recovery authority are four distinct keys. An earlier
  demo agent held all four on one address; the name was moved off it.

  Two more things a reader should not have to discover for themselves. The
  retired agent and the current one **share a treasury and an estate EOA**, so
  if both were flipped their revenue would commingle in one Hedera account with
  no on-chain attribution. And nothing automatically moves value from the Hedera
  rail into an `Estate` contract — a trustee would have to bridge it, and that
  bridge is not implemented. The ENS-mediated flip and the priority waterfall
  are two mechanisms this repo proves separately and does not join.
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

`docs/PRIZES.md` — **ENS**, **Hedera** and **The Graph**. Nothing else is filed.

x402 is central to how this works but is not a standalone track at this event,
so that work is claimed under Hedera rather than as a fourth filing. Eight other
partner tracks were scoped and withdrawn rather than filed on stubs; `FEEDBACK.md`
records which and why.
