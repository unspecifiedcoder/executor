#!/usr/bin/env bash
# The liveness runner. This is the process that makes the dead-man's switch a
# switch rather than a diagram: while it runs, the agent is alive; when it
# stops, `enterAdministration` becomes callable by anyone and the agent's
# revenue is redirected to its estate.
#
# `ExecutorRegistry.heartbeat()` is the only call here. It is signed by the
# agent's heartbeat key - which is a *different* key from the owner, the
# trustee and the recovery authority, on purpose: an agent that can sign its
# own liveness with the key that also controls its plan is not demonstrating
# separation of powers.
#
# Deliberate properties:
#
#   * The interval defaults to a fraction of the on-chain `heartbeatInterval`
#     rather than matching it. Beating exactly at the deadline means one slow
#     block puts a healthy agent into Administration. The registry's clock is
#     the deadline; this is the schedule, and the two are not the same number.
#   * A failed beat does not kill the loop. A dropped RPC connection is not
#     the agent dying, and treating it as such would hand any transient
#     network fault the power to liquidate a solvent agent. The loop retries
#     on the next tick and the on-chain deadline is what ultimately decides.
#   * Every beat prints its transaction hash. The point of the exercise is an
#     auditable trail of `Heartbeat` events, not a process that claims to have
#     sent them.
#
# Usage:
#   AGENT_ID=0x… HEARTBEAT_SIGNER_KEY=0x… ./scripts/heartbeat.sh [count]
#
#   BEAT_SECONDS   seconds between beats            (default 90)
#   count          number of beats, 0 = run forever (default 0)
set -uo pipefail

RPC="${RPC:-https://ethereum-sepolia-rpc.publicnode.com}"
REGISTRY="${EXECUTOR_REGISTRY_ADDRESS:-0x2946B46c2EB5Ec532093877223Ef043b13729e39}"
BEAT_SECONDS="${BEAT_SECONDS:-90}"
COUNT="${1:-0}"

: "${AGENT_ID:?AGENT_ID must be set (bytes32 agent id)}"
: "${HEARTBEAT_SIGNER_KEY:?HEARTBEAT_SIGNER_KEY must be set}"

SIGNER="$(cast wallet address --private-key "$HEARTBEAT_SIGNER_KEY")"

echo "heartbeat runner"
echo "  registry : $REGISTRY"
echo "  agent    : $AGENT_ID"
echo "  signer   : $SIGNER"
echo "  every    : ${BEAT_SECONDS}s"
echo "  beats    : $([ "$COUNT" = 0 ] && echo "unbounded" || echo "$COUNT")"
echo

beat=0
ok=0
failed=0

while [ "$COUNT" = 0 ] || [ "$beat" -lt "$COUNT" ]; do
  beat=$((beat + 1))

  out="$(cast send "$REGISTRY" 'heartbeat(bytes32)' "$AGENT_ID" \
          --private-key "$HEARTBEAT_SIGNER_KEY" --rpc-url "$RPC" --json 2>&1)"

  hash="$(printf '%s' "$out" | sed -n 's/.*"transactionHash":"\(0x[0-9a-f]*\)".*/\1/p')"
  status="$(printf '%s' "$out" | sed -n 's/.*"status":"\(0x[0-9]*\)".*/\1/p')"

  if [ "$status" = "0x1" ]; then
    ok=$((ok + 1))
    echo "$(date -u +%H:%M:%SZ)  beat $beat  ok    $hash"
  else
    # Not fatal. See the note at the top: a transient RPC failure is not a
    # dead agent, and the on-chain deadline is the thing that decides.
    failed=$((failed + 1))
    echo "$(date -u +%H:%M:%SZ)  beat $beat  FAIL  $(printf '%s' "$out" | head -c 200)"
  fi

  if [ "$COUNT" != 0 ] && [ "$beat" -ge "$COUNT" ]; then break; fi
  sleep "$BEAT_SECONDS"
done

echo
echo "$ok beat(s) landed, $failed failed."
echo "The agent is now unattended. Once heartbeatInterval + gracePeriod elapse,"
echo "enterAdministration() is callable by anyone and payments redirect."
