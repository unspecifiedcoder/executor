#!/usr/bin/env bash
# Pays an agent by *asking the protocol where to pay*, and nowhere else.
#
# This script exists because of a specific, fair criticism: a treasury address
# and an estate address both receiving USDC proves nothing on its own, because
# a human with both addresses can hand-deliver to either. What has to be shown
# is that the destination of a payment was *read out of the registry at payment
# time* and the payer had no other source for it.
#
# So the destination here is never an argument. It is the return value of
# `ExecutorRegistry.getPaymentDestination(agentId)`, read one block before the
# transfer, and the transfer is sent to exactly that. Run the same command
# before and after `enterAdministration()` and the money lands in two different
# contracts with no change to the command.
#
# When ENS_LABEL is set, resolution goes the long way round - ENSv2 registry ->
# the name's resolver -> addr(node, 60) - and the result is cross-checked
# against the registry, exactly as `packages/agent-debtor/src/gateway.ts` does
# it. A mismatch aborts the payment rather than picking a winner: a stale or
# hijacked name must stop the money, not redirect it.
#
# Usage:
#   AGENT_ID=0x… PAYER_KEY=0x… ./scripts/route-payment.sh <amount-in-token-units>
#   ENS_LABEL=executor-agent-3 AGENT_ID=… PAYER_KEY=… ./scripts/route-payment.sh 400000
set -euo pipefail

RPC="${RPC:-https://ethereum-sepolia-rpc.publicnode.com}"
REGISTRY="${EXECUTOR_REGISTRY_ADDRESS:-0x2946B46c2EB5Ec532093877223Ef043b13729e39}"
# Circle's own USDC on Sepolia, not a mock we minted for ourselves.
TOKEN="${PAYMENT_TOKEN:-0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238}"
ENS_ETH_REGISTRY="${ENS_ETH_REGISTRY:-0x67b728a792e789a8978b30cf1b3b641f19354b43}"
ENS_LABEL="${ENS_LABEL:-}"

: "${AGENT_ID:?AGENT_ID must be set}"
: "${PAYER_KEY:?PAYER_KEY must be set}"
AMOUNT="${1:?usage: route-payment.sh <amount in token units>}"

PAYER="$(cast wallet address --private-key "$PAYER_KEY")"

status="$(cast call "$REGISTRY" 'getStatus(bytes32)(uint8)' "$AGENT_ID" --rpc-url "$RPC")"
case "$status" in
  0) status_name="Active" ;;
  1) status_name="Administration" ;;
  2) status_name="Liquidation" ;;
  3) status_name="Resolved" ;;
  *) status_name="unknown($status)" ;;
esac

registry_dest="$(cast call "$REGISTRY" 'getPaymentDestination(bytes32)(address)' "$AGENT_ID" --rpc-url "$RPC")"

if [ -n "$ENS_LABEL" ]; then
  node="$(cast namehash "${ENS_LABEL}.eth")"
  resolver="$(cast call "$ENS_ETH_REGISTRY" 'getResolver(string)(address)' "$ENS_LABEL" --rpc-url "$RPC")"
  if [ "$resolver" = "0x0000000000000000000000000000000000000000" ]; then
    echo "abort: ${ENS_LABEL}.eth has no resolver set. Refusing to pay." >&2
    exit 1
  fi
  raw="$(cast call "$resolver" 'addr(bytes32,uint256)(bytes)' "$node" 60 --rpc-url "$RPC")"
  # 20 bytes = "0x" + 40 hex chars. Empty is a conforming "no record", and a
  # payer that treats "no record" as an address is the bug this guards.
  if [ "${#raw}" -ne 42 ]; then
    echo "abort: resolver $resolver returned no ETH addr record for ${ENS_LABEL}.eth ($raw)." >&2
    exit 1
  fi
  if [ "$(echo "$raw" | tr 'A-Z' 'a-z')" != "$(echo "$registry_dest" | tr 'A-Z' 'a-z')" ]; then
    echo "abort: ENS/registry mismatch. ENS says $raw, registry says $registry_dest." >&2
    exit 1
  fi
  echo "resolved via ENS: ${ENS_LABEL}.eth -> resolver $resolver -> addr(60) $raw (registry-confirmed)"
  dest="$raw"
else
  echo "resolved via registry: getPaymentDestination($AGENT_ID) -> $registry_dest"
  dest="$registry_dest"
fi

before="$(cast call "$TOKEN" 'balanceOf(address)(uint256)' "$dest" --rpc-url "$RPC" | awk '{print $1}')"

echo "agent status : $status_name"
echo "payer        : $PAYER"
echo "destination  : $dest  (balance before: $before)"
echo "amount       : $AMOUNT"

hash="$(cast send "$TOKEN" 'transfer(address,uint256)' "$dest" "$AMOUNT" \
        --private-key "$PAYER_KEY" --rpc-url "$RPC" --json \
        | sed -n 's/.*"transactionHash":"\(0x[0-9a-f]*\)".*/\1/p')"

after="$(cast call "$TOKEN" 'balanceOf(address)(uint256)' "$dest" --rpc-url "$RPC" | awk '{print $1}')"

echo "tx           : $hash"
echo "destination balance: $before -> $after"
