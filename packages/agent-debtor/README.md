# agent-debtor

The x402 side of the demo.

## What runs

- **`src/gateway.ts`** — the real thing. An Express + `@x402/express` resource
  server on Hedera testnet (facilitator: Blocky402), selling `GET /research`
  for 0.01 HBAR. `payTo` is a `DynamicPayTo` callback, so every request
  re-reads `ExecutorRegistry.getPaymentDestination()` on Sepolia and then
  resolves that EVM address to a Hedera account ID via the mirror node REST
  API. Treasury while the agent is Active, estate once it isn't.

  ```bash
  pnpm gateway     # :3200
  ```

- **`src/pay-for-research.ts`** — the paying client. Takes the 402, signs a
  payment, retries with `X-PAYMENT`. Run it once before and once after the
  status flip: same command, same endpoint, different destination account.

  ```bash
  HEDERA_PRIVATE_KEY=... pnpm pay
  ```

**What to show a judge:** run `pnpm pay` against a live gateway, then look the
payment up on the mirror node and confirm which account received it.

## What does not run

- `src/server-hedera.ts` — a stub. `startServer` logs `would listen on…` and
  returns. Superseded by `gateway.ts`.
- `src/server-arc.ts` — a stub. There is no Arc integration.
- `src/heartbeat.ts` — targets `Receiver.ping()`, a contract that was never
  deployed. The deployed contract's method is `ExecutorRegistry.heartbeat(agentId)`.
  Not wired up.
- `src/kill.ts` — demo helper for the above.
