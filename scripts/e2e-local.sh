#!/usr/bin/env bash
# Full protocol lifecycle against a local anvil chain, end to end, with no
# mocking above the ERC-20: deploy -> register -> lock -> miss heartbeats ->
# administration -> liquidation -> creditor claims -> waterfall distribution ->
# resolved -> late funds -> a blocked creditor pulling their share.
#
# This replaces the previous demo/run-e2e.ts, which was a list of TODO comments
# that threw when executed. Every assertion below reads real state back out of
# real contracts on a real (local) chain.
#
# Two properties this script is careful about, because getting either wrong
# turns a strong negative assertion into a test that passes for free:
#
#   * Negative assertions use `cast call` and check the 4-byte custom-error
#     selector that came back. `if cast send ... ; then fail` would also "pass"
#     when the transaction failed for a typo, a bad argument or gas.
#   * Every role is a different anvil key. Owner, heartbeat signer, trustee and
#     recovery authority being the same address means separation of powers is
#     never actually exercised.
#
#   anvil &                 # in another terminal
#   ./scripts/e2e-local.sh
set -euo pipefail

RPC="${RPC:-http://localhost:8545}"

# anvil's default accounts. Public, well-known, local-only. One key per role -
# see the note above.
DEPLOYER_KEY="${DEPLOYER_KEY:-0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80}"
SIGNER_KEY="0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba"
TRUSTEE_KEY="0x92db14e403b83dfe3df233f83dfa3a0d7096f21ca9b0d6d6b8d88b2b4ec1564e"
RECOVERY_KEY="0x4bbbf85ce3377467afe5d46f804f221813b2bb87f24d81f60f1fcdbf7cbf4356"
UNSECURED_KEY="0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a"

DEPLOYER="$(cast wallet address --private-key "$DEPLOYER_KEY")"
SIGNER="$(cast wallet address --private-key "$SIGNER_KEY")"
TRUSTEE="$(cast wallet address --private-key "$TRUSTEE_KEY")"
RECOVERY="$(cast wallet address --private-key "$RECOVERY_KEY")"

TREASURY="$(cast wallet address --private-key 0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d)"
SECURED_CREDITOR="$(cast wallet address --private-key 0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a)"
ADMIN_CREDITOR="$(cast wallet address --private-key 0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6)"
UNSECURED_CREDITOR="$(cast wallet address --private-key "$UNSECURED_KEY")"
UNSECURED_CREDITOR_2="$(cast wallet address --private-key 0xdbda1821b80551c9d65939329250298aa3472ba22feea921c0cf5d620ea67b97)"

# Custom-error selectors, so a negative assertion proves *which* guard fired.
ERR_PLAN_IS_LOCKED="0x96cb9f37"           # PlanIsLocked()
ERR_NOT_IN_LIQUIDATION="0xed8e4fc4"       # AgentNotInLiquidation(uint8)
ERR_WRONG_STATUS="0x359011cc"             # WrongStatus(uint8)
ERR_NOT_TRUSTEE="0x5aa309bb"              # NotTrustee()
ERR_ZERO_CREDITOR="0xef5fa8b7"            # ZeroCreditor()

CONTRACTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../contracts" && pwd)"
cd "$CONTRACTS_DIR"

bold() { printf '\n\033[1m%s\033[0m\n' "$1"; }
ok()   { printf '  \033[32m✓\033[0m %s\n' "$1"; }
fail() { printf '  \033[31m✗ %s\033[0m\n' "$1"; exit 1; }

expect_eq() {
  if [ "$1" != "$2" ]; then fail "$3 (expected '$2', got '$1')"; fi
  ok "$3"
}

# expect_revert <selector> <description> <...cast call args>
#
# Asserts the call reverts AND that it reverted with the named custom error.
# A `cast send` that merely failed - wrong arity, bad enum, out of gas - would
# satisfy a bare "did it fail?" check while proving nothing about the guard.
expect_revert() {
  local selector="$1" desc="$2" out
  shift 2
  if out="$(cast call --rpc-url "$RPC" "$@" 2>&1)"; then
    fail "$desc - the call SUCCEEDED"
  fi
  if ! printf '%s' "$out" | grep -qi -- "${selector#0x}"; then
    fail "$desc - it reverted, but not with $selector. Got: $(printf '%s' "$out" | tr '\n' ' ')"
  fi
  ok "$desc [$selector]"
}

if ! cast block-number --rpc-url "$RPC" >/dev/null 2>&1; then
  fail "no chain at $RPC - start anvil first"
fi

# Compile before anything parses forge's output. `forge create` prints compiler
# progress on stdout when the cache is cold, which lands in front of its `--json`
# payload and makes the `jq` below fail with a parse error rather than anything
# resembling a diagnosis. Warm caches hid this: it only ever bit on a fresh
# clone, which is exactly the case this script exists to serve.
forge build >/dev/null 2>&1 || fail "forge build failed - run it directly to see why"

AGENT_ID="$(cast keccak "executor-local-e2e")"
INTERVAL=60
GRACE=30

send()          { cast send --rpc-url "$RPC" --private-key "$DEPLOYER_KEY" --json "$@" >/dev/null; }
send_as()       { local k="$1"; shift; cast send --rpc-url "$RPC" --private-key "$k" --json "$@" >/dev/null; }
call()          { cast call --rpc-url "$RPC" "$@"; }

bold "0. Roles (one anvil key each - separation of powers is real or it is not tested)"
printf '  owner/deployer     %s\n  heartbeat signer   %s\n  trustee            %s\n  recovery authority %s\n' \
  "$DEPLOYER" "$SIGNER" "$TRUSTEE" "$RECOVERY"
for pair in "$SIGNER:$DEPLOYER" "$TRUSTEE:$DEPLOYER" "$RECOVERY:$DEPLOYER" "$TRUSTEE:$RECOVERY" "$TRUSTEE:$SIGNER"; do
  if [ "${pair%%:*}" = "${pair##*:}" ]; then fail "two roles share an address - the separation is not being tested"; fi
done
ok "four distinct addresses"

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
DEST="$(call "$REGISTRY" "getPaymentDestination(bytes32)(address)" "$AGENT_ID")"
ok "updatePlan pointed the estate at the real Estate contract"

send "$REGISTRY" "lockPlan(bytes32)" "$AGENT_ID"
ok "lockPlan"

# The lock has to actually bite, or it is decoration.
expect_revert "$ERR_PLAN_IS_LOCKED" "updatePlan reverts after lockPlan - the lock is load-bearing" \
  --from "$DEPLOYER" "$REGISTRY" \
  "updatePlan(bytes32,address,address,address,address,address,uint64,uint64)" \
  "$AGENT_ID" "$SIGNER" "$TRUSTEE" "$RECOVERY" "$SECURED_CREDITOR" "$ESTATE" "$INTERVAL" "$GRACE"

bold "3. While Active, payment routes to the treasury"
expect_eq "$(call "$REGISTRY" "getStatus(bytes32)(uint8)" "$AGENT_ID")" "0" "status = Active"
DEST="$(call "$REGISTRY" "getPaymentDestination(bytes32)(address)" "$AGENT_ID")"
expect_eq "${DEST,,}" "${TREASURY,,}" "getPaymentDestination -> treasury"

bold "4. Heartbeat stops; the window lapses"
send_as "$SIGNER_KEY" "$REGISTRY" "heartbeat(bytes32)" "$AGENT_ID"
ok "the heartbeat signer (not the owner) can heartbeat"
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
send_as "$TRUSTEE_KEY" "$ESTATE" "registerClaim(bytes32,address,uint256,uint8)" "$(cast keccak 'claim-secured')"   "$SECURED_CREDITOR"   300 0
send_as "$TRUSTEE_KEY" "$ESTATE" "registerClaim(bytes32,address,uint256,uint8)" "$(cast keccak 'claim-admin')"     "$ADMIN_CREDITOR"     200 1
send_as "$TRUSTEE_KEY" "$ESTATE" "registerClaim(bytes32,address,uint256,uint8)" "$(cast keccak 'claim-unsecured')"   "$UNSECURED_CREDITOR"   500 2
send_as "$TRUSTEE_KEY" "$ESTATE" "registerClaim(bytes32,address,uint256,uint8)" "$(cast keccak 'claim-unsecured-2')" "$UNSECURED_CREDITOR_2" 250 2
ok "4 claims registered by the trustee (300 secured / 200 administrative / 500 + 250 unsecured)"

expect_revert "$ERR_NOT_TRUSTEE" "registerClaim reverts for the owner - claims are trustee-curated" \
  --from "$DEPLOYER" "$ESTATE" "registerClaim(bytes32,address,uint256,uint8)" \
  "$(cast keccak 'claim-forged')" "$DEPLOYER" 9999 0

# A claim payable to nobody used to be registrable, and - because the existence
# sentinel was `creditor != address(0)` - registrable TWICE, which pushed one id
# into claimIds twice, double-counted it in _classTotal, overshot paidAmount and
# made every later `allowedAmount - paidAmount` panic. That is executePlan and
# sweepSurplus both bricked forever, with no admin escape. Asserted here as well
# as in the unit tests because it is the one bug in this contract that has no
# recovery path once triggered.
expect_revert "$ERR_ZERO_CREDITOR" "registerClaim rejects a zero creditor - the permanent-freeze path" \
  --from "$TRUSTEE" "$ESTATE" "registerClaim(bytes32,address,uint256,uint8)" \
  "$(cast keccak 'claim-ghost')" "0x0000000000000000000000000000000000000000" 500 2
expect_eq "$(call "$ESTATE" "claimCount()(uint256)")" "4" \
  "claimCount is still 4 - the ghost claim never entered claimIds"

PLAN_HASH="$(call "$ESTATE" "currentPlanHash()(bytes32)")"
send_as "$TRUSTEE_KEY" "$ESTATE" "approvePlan(bytes32)" "$PLAN_HASH"
ok "trustee approved plan $PLAN_HASH"

expect_revert "$ERR_NOT_IN_LIQUIDATION" \
  "executePlan reverts during Administration - creditors are not paid while the agent can still recover" \
  "$ESTATE" "executePlan(bytes32)" "$PLAN_HASH"

bold "7. Trustee declares liquidation - terminal, one-way"
send_as "$TRUSTEE_KEY" "$REGISTRY" "enterLiquidation(bytes32)" "$AGENT_ID"
expect_eq "$(call "$REGISTRY" "getStatus(bytes32)(uint8)" "$AGENT_ID")" "2" "status = Liquidation"

# Called AS the recovery authority, so the only thing that can stop it is the
# status guard - not a permission error standing in for one.
expect_revert "$ERR_WRONG_STATUS" \
  "restoreActive reverts from Liquidation even for the recovery authority - this is what makes it terminal" \
  --from "$RECOVERY" "$REGISTRY" "restoreActive(bytes32)" "$AGENT_ID"

bold "8. The waterfall runs"
send "$ESTATE" "executePlan(bytes32)" "$PLAN_HASH"
# 400 available against 300 secured + 200 admin + 500 unsecured:
# secured paid in full, administrative takes the remaining 100, unsecured gets nothing.
expect_eq "$(call "$USDC" "balanceOf(address)(uint256)" "$SECURED_CREDITOR")"   "300" "secured creditor paid 300 (in full, first)"
expect_eq "$(call "$USDC" "balanceOf(address)(uint256)" "$ADMIN_CREDITOR")"     "100" "administrative creditor paid 100 (partial - what was left)"
expect_eq "$(call "$USDC" "balanceOf(address)(uint256)" "$UNSECURED_CREDITOR")" "0"   "unsecured creditor paid 0 (estate exhausted)"
expect_eq "$(call "$USDC" "balanceOf(address)(uint256)" "$ESTATE")"             "0"   "estate fully drained"

# The partially-paid administrative claim is still owed 100. An estate that
# reports 750 here is understating what it owes by exactly that 100 - which is
# what happens if a partial payment is recorded as "paid".
expect_eq "$(call "$ESTATE" "totalOutstanding()(uint256)")" "850" \
  "totalOutstanding = 850: 100 still owed on the partly-paid admin claim + 750 unsecured"

bold "9. Wind up BEFORE the estate is finished - the ordering that used to brick it"
send_as "$TRUSTEE_KEY" "$REGISTRY" "resolve(bytes32)" "$AGENT_ID"
expect_eq "$(call "$REGISTRY" "getStatus(bytes32)(uint8)" "$AGENT_ID")" "3" "status = Resolved"
DEST="$(call "$REGISTRY" "getPaymentDestination(bytes32)(address)" "$AGENT_ID")"
expect_eq "${DEST,,}" "${ESTATE,,}" "payment destination stays the estate once Resolved"

bold "10. Late revenue, numbers that do not divide, and a blocked creditor"
# 102 against 100 still owed to Administrative and 500 + 250 to Unsecured.
# Administrative clears in full, leaving 2 against 750 of Unsecured claims:
# 500*2/750 = 1 and 250*2/750 = 0, so raw pro-rata hands out 1 of the 2 and
# truncates the other away. Deliberately chosen so the truncation path runs
# on-chain rather than only in a unit test.
send "$USDC" "mint(address,uint256)" "$ESTATE" 102
# USDC can blacklist an address. One refused payout must not brick the rest.
send "$USDC" "setBlocked(address,bool)" "$UNSECURED_CREDITOR" true
ok "unsecured creditor blacklisted by the token"

send "$ESTATE" "executePlan(bytes32)" "$PLAN_HASH"
ok "a second distribution round ran after Resolved - resolving first does not brick the estate"

expect_eq "$(call "$USDC" "balanceOf(address)(uint256)" "$ADMIN_CREDITOR")" "200" \
  "administrative creditor topped up to 200 (paid in full across two rounds, never twice)"
expect_eq "$(call "$USDC" "balanceOf(address)(uint256)" "$SECURED_CREDITOR")" "300" \
  "secured creditor still 300 - a settled claim is not paid again"
expect_eq "$(call "$USDC" "balanceOf(address)(uint256)" "$UNSECURED_CREDITOR")" "0" \
  "the blacklisted creditor could not be pushed"
expect_eq "$(call "$ESTATE" "withdrawable(address)(uint256)" "$UNSECURED_CREDITOR")" "2" \
  "their 2 (1 pro-rata + 1 recovered from truncation) was booked to withdrawable, not reverted"
expect_eq "$(call "$USDC" "balanceOf(address)(uint256)" "$ESTATE")" "2" \
  "the estate holds exactly the escrowed 2 - nothing truncated into limbo"
expect_eq "$(call "$ESTATE" "distributable()(uint256)")" "0" \
  "escrowed funds are not counted as distributable"
expect_eq "$(call "$ESTATE" "totalOutstanding()(uint256)")" "748" \
  "shortfall is 748 - the real number, not 0"

bold "11. The blacklist lifts; the creditor pulls"
send "$USDC" "setBlocked(address,bool)" "$UNSECURED_CREDITOR" false
send_as "$UNSECURED_KEY" "$ESTATE" "claimPayout()"
expect_eq "$(call "$USDC" "balanceOf(address)(uint256)" "$UNSECURED_CREDITOR")" "2" \
  "creditor pulled their escrowed payout"
expect_eq "$(call "$USDC" "balanceOf(address)(uint256)" "$ESTATE")" "0" "estate holds nothing"

bold "PASS - Active -> Administration -> Liquidation -> Resolved, two distribution rounds, nothing stranded"
printf '  registry %s\n  estate   %s\n  agentId  %s\n\n' "$REGISTRY" "$ESTATE" "$AGENT_ID"
