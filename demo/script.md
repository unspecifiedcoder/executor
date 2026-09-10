# Demo script

Every shot below is a real transaction on Sepolia or a real command you can run.
There is no `just kill`, no `declareAdministration()`, no CRE DON report and no
ENS card flip in this system — an earlier version of this file described all
four, and none of them were ever built.

Addresses used throughout:

| | |
|---|---|
| `ExecutorRegistry` | `0x2946B46c2EB5Ec532093877223Ef043b13729e39` |
| Agent 2 id | `0x3bb9846eddba2c5c78b94bbc2be970db97c11731d2588aa86d375e281183cc67` |
| Agent 2 `Estate` | `0x83f447FAb4E1267Ca5fd6Ebe151a93b462EFfC7F` |
| Circle USDC (Sepolia) | `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238` |
| RPC | `https://ethereum-sepolia-rpc.publicnode.com` |

## Shot list

**1. The registry decides where money goes (10s).**
Read `getPaymentDestination` for the live demo agent. It returns the treasury,
because that agent is Active.

```bash
cast call 0x2946B46c2EB5Ec532093877223Ef043b13729e39 \
  "getPaymentDestination(bytes32)(address)" \
  0x6b7f61f16d01348d0b80bac1e63e0abb99eb377294a49d1f22181e912daf5255 \
  --rpc-url https://ethereum-sepolia-rpc.publicnode.com
```

**2. The x402 endpoint reads that on every request (20s).**
`pnpm --filter @executor/agent-debtor gateway` on :3200, then
`HEDERA_PRIVATE_KEY=... pnpm --filter @executor/agent-debtor pay`. The gateway's
`payTo` is a `DynamicPayTo` callback: it re-reads the call in shot 1 per request
and resolves the result to a Hedera account through the mirror node. Same URL,
same price, different destination account.

**3. The flip, already on chain (20s).**
Agent 2's whole lifecycle was driven publicly. Open the registry's event log and
walk the `StatusChanged` entries: Active → Administration → Active →
Administration → Liquidation → Resolved. The heartbeat that started it came from
the agent's heartbeat signer, the restore from its recovery authority, the
liquidation from its trustee — four different addresses, none of them the
operator that pushed the permissionless calls.

```bash
cast logs --address 0x2946B46c2EB5Ec532093877223Ef043b13729e39 \
  "StatusChanged(bytes32,uint8)" \
  0x3bb9846eddba2c5c78b94bbc2be970db97c11731d2588aa86d375e281183cc67 \
  --from-block 11672200 --rpc-url https://ethereum-sepolia-rpc.publicnode.com
```

**4. The waterfall, with real USDC (30s).** The money shot.
0.5 USDC against 1.4 USDC of claims — an insolvent estate, which is the case
worth showing. Secured was paid in full, both Administrative claims split what
was left pro-rata, Unsecured got nothing. A second round after late revenue
arrived finished the Administrative class and started paying Unsecured.

```bash
# 200000 / 400000 / 300000 / 100000 - i.e. 0.20, 0.40, 0.30, 0.10 USDC
for c in 0x3AFf06C662A51F1B701C1499ac50F8F56d6087cb \
         0x8e8D8415cf0e527e06a04E0A0FD5D3B4ae6083a9 \
         0x72F0E1d0327CE912C3baE2D1f555e50CeB9fA455 \
         0xBe8fE696404eBA73fEe09e7d8F6c9eCD3BC7514c; do
  cast call 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238 \
    "balanceOf(address)(uint256)" $c \
    --rpc-url https://ethereum-sepolia-rpc.publicnode.com
done
```

The exact transaction hashes for every step, and what each one proves, are in
the root `README.md` under "The full lifecycle, on Sepolia".

**5. The dashboard (10s).** `pnpm -C apps/dashboard dev`. Live chain reads, and
two write routes that call `enterAdministration` / `restoreActive` for the demo
agent.

**6. The exploit that is not there (10s).** A claim payable to the zero address
used to be registrable twice, which double-counted it, overshot `paidAmount`,
and made `executePlan` and `sweepSurplus` revert with an arithmetic panic
forever. The deployed Estate refuses it:

```bash
# reverts with 0xef5fa8b7 = ZeroCreditor()
# (0x7752… is a second, deliberately unexecuted Estate - on the one that ran
#  the waterfall, registerClaim hits the `executed` guard first and would
#  revert for the wrong reason.)
cast call 0x775223E7a0bAE836511934435ec7B2Ea838Eb832 \
  "registerClaim(bytes32,address,uint256,uint8)" \
  $(cast keccak "anything") 0x0000000000000000000000000000000000000000 500000 2 \
  --from 0xd09e929E440c6743164D63CC806A1c7A39DfED8C \
  --rpc-url https://ethereum-sepolia-rpc.publicnode.com
```

## If you would rather watch it happen than read a log

`./scripts/e2e-local.sh` against a local anvil runs the same lifecycle from an
empty chain in about twenty seconds, with assertions on every step.
