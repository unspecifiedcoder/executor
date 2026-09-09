#!/usr/bin/env bash
# Full protocol lifecycle against a local anvil chain, end to end, with no
# mocking above the ERC-20: deploy -> register -> lock -> miss heartbeats ->
# administration -> liquidation -> creditor claims -> waterfall distribution ->
# resolved.
#
# This replaces the previous demo/run-e2e.ts, which was a list of TODO comments
# that threw when executed. Every assertion below reads real state back out of
# real contracts on a real (local) chain.
#
#   anvil &                 # in another terminal
#   ./scripts/e2e-local.sh
set -euo pipefail

RPC="${RPC:-http://localhost:8545}"
# anvil's first default account. Public, well-known, local-only.
DEPLOYER_KEY="${DEPLOYER_KEY:-0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80}"
DEPLOYER="$(cast wallet address --private-key "$DEPLOYER_KEY")"

CONTRACTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../contracts" && pwd)"
cd "$CONTRACTS_DIR"

bold() { printf '\n\033[1m%s\033[0m\n' "$1"; }
ok()   { printf '  \033[32m✓\033[0m %s\n' "$1"; }
fail() { printf '  \033[31m✗ %s\033[0m\n' "$1"; exit 1; }

expect_eq() {
  if [ "$1" != "$2" ]; then fail "$3 (expected '$2', got '$1')"; fi
  ok "$3"
}

if ! cast block-number --rpc-url "$RPC" >/dev/null 2>&1; then
  fail "no chain at $RPC - start anvil first"
fi

AGENT_ID="$(cast keccak "executor-local-e2e")"
INTERVAL=60
GRACE=30

TREASURY="$(cast wallet address --private-key 0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d)"
TRUSTEE="$DEPLOYER"          # the deployer acts as trustee for this run
RECOVERY="$DEPLOYER"
SIGNER="$DEPLOYER"
SECURED_CREDITOR="$(cast wallet address --private-key 0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a)"
ADMIN_CREDITOR="$(cast wallet address --private-key 0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6)"
UNSECURED_CREDITOR="$(cast wallet address --private-key 0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a)"

send() { cast send --rpc-url "$RPC" --private-key "$DEPLOYER_KEY" --json "$@" >/dev/null; }
call() { cast call --rpc-url "$RPC" "$@"; }

bold "1. Deploy"
REGISTRY="$(forge create src/ExecutorRegistry.sol:ExecutorRegistry \
  --rpc-url "$RPC" --private-key "$DEPLOYER_KEY" --broadcast --json | jq -r .deployedTo)"
ok "ExecutorRegistry $REGISTRY"

USDC="$(forge create test/mocks/MockUSDC.sol:MockUSDC \
  --rpc-url "$RPC" --private-key "$DEPLOYER_KEY" --broadcast --json | jq -r .deployedTo)"
ok "MockUSDC       $USDC"

bold "2. Register the agent, then lock the plan"
# Estate address isn't known yet, so register with a placeholder and amend it
# below - which is exactly what updatePlan exists for.
send "$REGISTRY" "registerAgent(bytes32,address,address,address,address,address,uint64,uint64)" \
  "$AGENT_ID" "$SIGNER" "$TRUSTEE" "$RECOVERY" "$TREASURY" "$TREASURY" "$INTERVAL" "$GRACE"
ok "registerAgent"

ESTATE="$(forge create src/Estate.sol:Estate \
  --rpc-url "$RPC" --private-key "$DEPLOYER_KEY" --broadcast --json \
  --constructor-args "$USDC" "$TRUSTEE" "$REGISTRY" "$AGENT_ID" | jq -r .deployedTo)"
ok "Estate         $ESTATE"

send "$REGISTRY" "updatePlan(bytes32,address,address,address,address,address,uint64,uint64)" \
  "$AGENT_ID" "$SIGNER" "$TRUSTEE" "$RECOVERY" "$TREASURY" "$ESTATE" "$INTERVAL" "$GRACE"
ok "updatePlan pointed the estate at the real Estate contract"

send "$REGISTRY" "lockPlan(bytes32)" "$AGENT_ID"
ok "lockPlan"

# The lock has to actually bite, or it is decoration.
if cast send --rpc-url "$RPC" --private-key "$DEPLOYER_KEY" "$REGISTRY" \
  "updatePlan(bytes32,address,address,address,address,address,uint64,uint64)" \
  "$AGENT_ID" "$SIGNER" "$TRUSTEE" "$RECOVERY" "$SECURED_CREDITOR" "$ESTATE" "$INTERVAL" "$GRACE" \
  >/dev/null 2>&1; then
  fail "updatePlan SUCCEEDED after lockPlan - the lock enforces nothing"
fi
ok "updatePlan reverts after lockPlan (PlanIsLocked) - the lock is load-bearing"

bold "3. While Active, payment routes to the treasury"
expect_eq "$(call "$REGISTRY" "getStatus(bytes32)(uint8)" "$AGENT_ID")" "0" "status = Active"
DEST="$(call "$REGISTRY" "getPaymentDestination(bytes32)(address)" "$AGENT_ID")"
expect_eq "${DEST,,}" "${TREASURY,,}" "getPaymentDestination -> treasury"

bold "4. Heartbeat stops; the window lapses"
cast rpc --rpc-url "$RPC" evm_increaseTime $((INTERVAL + GRACE + 1)) >/dev/null
cast rpc --rpc-url "$RPC" evm_mine >/dev/null
send "$REGISTRY" "enterAdministration(bytes32)" "$AGENT_ID"
expect_eq "$(call "$REGISTRY" "getStatus(bytes32)(uint8)" "$AGENT_ID")" "1" "status = Administration"
DEST="$(call "$REGISTRY" "getPaymentDestination(bytes32)(address)" "$AGENT_ID")"
expect_eq "${DEST,,}" "${ESTATE,,}" "getPaymentDestination -> estate (the flip)"

bold "5. Revenue accrues to the estate"
send "$USDC" "mint(address,uint256)" "$ESTATE" 400
expect_eq "$(call "$USDC" "balanceOf(address)(uint256)" "$ESTATE")" "400" "estate holds 400 mUSDC"

bold "6. Creditors cannot be paid while recovery is still possible"
send "$ESTATE" "registerClaim(bytes32,address,uint256,uint8)" "$(cast keccak 'claim-secured')"   "$SECURED_CREDITOR"   300 0
send "$ESTATE" "registerClaim(bytes32,address,uint256,uint8)" "$(cast keccak 'claim-admin')"     "$ADMIN_CREDITOR"     200 1
send "$ESTATE" "registerClaim(bytes32,address,uint256,uint8)" "$(cast keccak 'claim-unsecured')" "$UNSECURED_CREDITOR" 500 2
ok "3 claims registered (300 secured / 200 administrative / 500 unsecured)"

PLAN_HASH="$(call "$ESTATE" "currentPlanHash()(bytes32)")"
send "$ESTATE" "approvePlan(bytes32)" "$PLAN_HASH"
ok "trustee approved plan $PLAN_HASH"

if cast send --rpc-url "$RPC" --private-key "$DEPLOYER_KEY" \
  "$ESTATE" "executePlan(bytes32)" "$PLAN_HASH" >/dev/null 2>&1; then
  fail "executePlan SUCCEEDED during Administration - creditors were paid while the agent could still recover"
fi
ok "executePlan reverts during Administration (AgentNotInLiquidation)"

bold "7. Trustee declares liquidation - terminal, one-way"
send "$REGISTRY" "enterLiquidation(bytes32)" "$AGENT_ID"
expect_eq "$(call "$REGISTRY" "getStatus(bytes32)(uint8)" "$AGENT_ID")" "2" "status = Liquidation"

if cast send --rpc-url "$RPC" --private-key "$DEPLOYER_KEY" \
  "$REGISTRY" "restoreActive(bytes32)" "$AGENT_ID" >/dev/null 2>&1; then
  fail "restoreActive SUCCEEDED from Liquidation - liquidation is not terminal"
fi
ok "restoreActive reverts from Liquidation - this is what makes it terminal, not cosmetic"

bold "8. The waterfall runs"
send "$ESTATE" "executePlan(bytes32)" "$PLAN_HASH"
# 400 available against 300 secured + 200 admin + 500 unsecured:
# secured paid in full, administrative takes the remaining 100, unsecured gets nothing.
expect_eq "$(call "$USDC" "balanceOf(address)(uint256)" "$SECURED_CREDITOR")"   "300" "secured creditor paid 300 (in full, first)"
expect_eq "$(call "$USDC" "balanceOf(address)(uint256)" "$ADMIN_CREDITOR")"     "100" "administrative creditor paid 100 (partial - what was left)"
expect_eq "$(call "$USDC" "balanceOf(address)(uint256)" "$UNSECURED_CREDITOR")" "0"   "unsecured creditor paid 0 (estate exhausted)"
expect_eq "$(call "$USDC" "balanceOf(address)(uint256)" "$ESTATE")"             "0"   "estate fully drained"

bold "9. Wind up"
send "$REGISTRY" "resolve(bytes32)" "$AGENT_ID"
expect_eq "$(call "$REGISTRY" "getStatus(bytes32)(uint8)" "$AGENT_ID")" "3" "status = Resolved"

bold "PASS - full lifecycle Active -> Administration -> Liquidation -> Resolved"
printf '  registry %s\n  estate   %s\n  agentId  %s\n\n' "$REGISTRY" "$ESTATE" "$AGENT_ID"
