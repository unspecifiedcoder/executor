# Architecture

## The two-stage flow

```
                    heartbeat lapses               DON-signed report
  Alive  ───────────────────────────►  UnderAdministration  ───────────────►  Liquidated
    │           (Receiver, Sepolia,              │                    (Receiver, Sepolia)
    │            liveness only)                  │
    │                                             ▼
    │                                   cre-workflow verifies claims
    │                                   + checks solvency inside a TEE
    ▼
agent-debtor sells services on
Hedera (x402/Blocky402) and Arc
(Circle Agent Marketplace)
```

## Chain map

| Chain          | Contract   | Responsibility                                    |
|----------------|-----------|-----------------------------------------------------|
| Sepolia        | `Receiver` | Liveness, stage transitions, ENS role custody       |
| Sepolia        | ENSv2      | Identity: subname, addr/text roles, operator lockout |
| Arc testnet    | `Estate`   | Holds funds, claims registry, waterfall execution   |
| Hedera testnet | (off-chain)| x402-gated paid service (via Blocky402)             |

## Who writes what

- `Receiver.ping()` — signed by the agent's own key (`agent-debtor`).
- `Receiver.declareAdministration()` — permissionless, gated only by the
  missed-heartbeat check.
- `Receiver.declareLiquidation()` — requires the CRE DON's signed report.
- `Estate.registerClaim()` / `approvePlan()` — the trustee only
  (`agent-trustee`), sourced from `cre-workflow`'s verified output.
- `Estate.executePlan()` — anyone can call, but requires a valid trustee
  signature over the approved `planHash`.

## Why the split between Receiver and Estate

Keeping liveness/succession (Sepolia) separate from funds (Arc) means a
bug in the payout waterfall can't accidentally corrupt the liveness state
machine, and vice versa - `Receiver` never holds a token balance, `Estate`
never has an opinion about heartbeats.
