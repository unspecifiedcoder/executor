set dotenv-load := true

# install all workspace deps + forge deps
install:
    pnpm install
    cd contracts && forge install

# run the full local dev stack (contracts on anvil forks + agents + dashboard)
dev:
    pnpm dev

# unit tests: forge + vitest across the workspace
test:
    cd contracts && forge test -vvv
    pnpm test

# end-to-end demo: birth -> paid requests -> kill -> flip -> claims -> plan -> payout -> succession
e2e:
    pnpm --filter demo exec tsx run-e2e.ts

# scripted 10-second demo run for judging
demo:
    pnpm --filter demo exec tsx run-e2e.ts --scripted

# deploy Receiver + ENS setup to Sepolia
deploy-sepolia:
    cd contracts && forge script script/DeploySepolia.s.sol --rpc-url $SEPOLIA_RPC_URL --broadcast

# deploy Estate to Arc testnet
deploy-arc:
    cd contracts && forge script script/DeployArc.s.sol --rpc-url $ARC_TESTNET_RPC_URL --broadcast

# run the "living will" registration script against a deployed Receiver
register-agent:
    cd contracts && forge script script/RegisterAgent.s.sol --rpc-url $SEPOLIA_RPC_URL --broadcast

fmt:
    cd contracts && forge fmt
    pnpm -r lint --fix
