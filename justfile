set dotenv-load := true

# Recipes for the parts of this repo that actually run. The earlier justfile
# also had `deploy-arc`, `register-agent`, `demo` and `simulate`; the scripts
# behind them were never finished, so they have been removed rather than left
# to fail. `e2e` is back, because scripts/e2e-local.sh now exists and passes.

install:
    pnpm install
    cd contracts && forge install

# The whole lifecycle against a local anvil: register -> lock -> miss the
# heartbeat -> administration -> liquidation -> claims -> waterfall -> resolved
# -> late funds -> a blocked creditor pulling. Needs `anvil` on :8545.
e2e:
    ./scripts/e2e-local.sh

# 90 tests: ExecutorRegistry (37) + Estate (40) + ENSv2 role semantics (9) +
# the superseded, never-deployed Receiver (4).
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
