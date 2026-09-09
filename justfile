set dotenv-load := true

# Recipes for the parts of this repo that actually run. The earlier justfile
# also had `deploy-arc`, `register-agent`, `e2e`, `demo` and `simulate`; the
# scripts behind them were never finished, so they have been removed rather
# than left to fail.

install:
    pnpm install
    cd contracts && forge install

# 41 tests: ExecutorRegistry (25) + ENSv2 role semantics (9) + legacy undeployed
# contracts (7).
test:
    cd contracts && forge test -vvv

typecheck:
    pnpm -C apps/dashboard exec tsc --noEmit

build:
    pnpm -C apps/dashboard build

# The dashboard. Reads Sepolia over a public RPC; no keys needed to browse it.
dev:
    pnpm -C apps/dashboard dev

# The x402 resource server on :3200.
gateway:
    pnpm --filter @executor/agent-debtor gateway

# One real paid request against the gateway. Needs HEDERA_PRIVATE_KEY.
pay:
    pnpm --filter @executor/agent-debtor pay

fmt:
    cd contracts && forge fmt
