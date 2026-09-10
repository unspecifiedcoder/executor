# agent-debtor

The x402 side of the demo.

## What runs

- **`src/gateway.ts`** — the real thing. An Express + `@x402/express` resource
  server on Hedera testnet (facilitator: Blocky402), selling `GET /research`
  for 0.01 HBAR.

  **What is sold.** `?q=` is the prompt. The handler calls Groq
  (`qwen/qwen3.8-27b`, ~0.5s) and returns the generated answer along with the
  model id, token count and measured latency. There is deliberately no
  canned-response fallback: a missing `GROQ_API_KEY` is a 503, an upstream
  failure is a 502/504. Serving a stored string and calling it generated would
  make the paywall theatre. A request with no `?q=` gets a **free** 400 —
  validation runs before the payment middleware, so a malformed request is
  never charged.

  Requires `GROQ_API_KEY` in the environment. Server-side only; it is never
  sent to a client.

  **Where the money goes.** `payTo` is a `DynamicPayTo` callback that resolves
  it *through ENS* on every request:

  ```
  ENSv2 registry.getResolver("executor-hackathon-demo")
    -> resolver.addr(namehash("executor-hackathon-demo.eth"), 60)
    -> cross-check against ExecutorRegistry.getPaymentDestination()
    -> mirror-node lookup to a Hedera account id
  ```

  No step is skippable and none has a fallback. If the name has no resolver, if
  the resolver has no addr record, or if ENS and the registry disagree, the
  gateway refuses to quote a price rather than paying somewhere plausible.
  Treasury while the agent is Active, estate once it isn't — because
  `ExecutorResolver` derives the record from registry state rather than storing
  it.

  ```bash
  GROQ_API_KEY=... pnpm gateway     # :3200
  ```

- **`GET /payto`** — unpaid introspection. Returns the whole ENS resolution
  chain (registry, node, resolver, addr, cross-check result, Hedera account) so
  the payment path can be inspected without spending HBAR.

- **`src/pay-for-research.ts`** — the paying client. Takes the 402, signs a
  payment, retries with `X-PAYMENT`. Run it once before and once after the
  status flip: same command, same endpoint, different destination account. Set
  `RESEARCH_QUERY` to change the prompt being bought.

  ```bash
  HEDERA_PRIVATE_KEY=... pnpm pay
  RESEARCH_QUERY="Explain Hedera aBFT in one sentence." pnpm pay
  ```

**What to show a judge:** `curl localhost:3200/payto` to see the ENS chain, then
run `pnpm pay` against a live gateway, then look the payment up on the mirror
node and confirm which account received it — and that the answer in the body is
about the question you asked.

## What does not run

Nothing in this package. The stubs that used to sit here - `server-hedera.ts`,
`server-arc.ts`, `heartbeat.ts` and `kill.ts` - have been deleted rather than
left as decoration; `git log` has them. `heartbeat.ts` in particular targeted
`Receiver.ping()`, a contract that was never deployed. The live heartbeat is
`ExecutorRegistry.heartbeat(bytes32)`, and it has been called on Sepolia - see
the agent-2 lifecycle table in the root README.
