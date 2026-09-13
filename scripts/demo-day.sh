#!/usr/bin/env bash
# Recording helper. Run it, press a number, read the output on camera.
#
# Nothing here is a mock: every option that says it sends a transaction sends a
# real one on Sepolia or Hedera testnet. Options are ordered the way the video
# is, so you can work down the list.
#
#   cd /mnt/c/Users/Pramod/GitHub/executor && ./scripts/demo-day.sh
#
set -uo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.." || exit 1

RPC="https://ethereum-sepolia-rpc.publicnode.com"
REGISTRY="0x2946B46c2EB5Ec532093877223Ef043b13729e39"
SUBGRAPH="https://api.studio.thegraph.com/query/1760047/executor/v0.1.2"
GATEWAY="https://executor-gateway.vercel.app"
DEMO_AGENT="0x6574c8cc5e4ca438a061eb83708582b10658d3a1a7334a8d94b6f6a1960dcb37"

B=$'\e[1m'; G=$'\e[32m'; Y=$'\e[33m'; R=$'\e[31m'; D=$'\e[2m'; N=$'\e[0m'

# Keys are loaded here, once, before you start recording — never export them in
# a window that is being captured.
set -a; [ -f .env ] && . ./.env; [ -f .env.local ] && . ./.env.local; set +a

hr(){ printf "${D}%s${N}\n" "────────────────────────────────────────────────────────────"; }

preflight() {
  hr; echo "${B}PREFLIGHT${N}"; hr
  printf "dashboard   "; curl -s -o /dev/null -w "%{http_code}\n" --max-time 20 https://executor-dashboard.vercel.app
  printf "gateway     "; curl -s -o /dev/null -w "%{http_code}\n" --max-time 20 "$GATEWAY/payto"
  printf "subgraph    "
  curl -s -X POST "$SUBGRAPH" -H 'content-type: application/json' \
    -d '{"query":"{_meta{block{number} hasIndexingErrors}}"}' |
    python3 -c "import sys,json;m=json.load(sys.stdin)['data']['_meta'];print('block',m['block']['number'],'errors',m['hasIndexingErrors'])"
  printf "demo agent  "
  curl -s -X POST "$SUBGRAPH" -H 'content-type: application/json' \
    -d "{\"query\":\"{agent(id:\\\"$DEMO_AGENT\\\"){status heartbeatCount lastHeartbeat}}\"}" |
    python3 -c "
import sys,json,time
a=json.load(sys.stdin)['data']['agent']; age=int(time.time())-int(a['lastHeartbeat'])
ok='OK' if age<300 else 'STALE — restart the heartbeat (option 9)'
print(f\"{a['status']} · {a['heartbeatCount']} beats · {age}s ago · {ok}\")"
  hr
  echo "${Y}Before you record:${N} dismiss the cookie banners on Etherscan and"
  echo "HashScan, and put your terminal font at ~16pt."
}

tabs() {
  hr; echo "${B}TABS TO OPEN${N}"; hr
  cat <<EOF
${B}Window A — the product${N}
  https://executor-dashboard.vercel.app
  https://executor-dashboard.vercel.app/register
  https://executor-dashboard.vercel.app/vitals

${B}Window B — evidence you do not own${N}
  Etherscan · the USDC payment that landed in the TREASURY
    https://sepolia.etherscan.io/tx/0x731319100c29e25cf27270085ef91caaba946f9907cd14dfa67e33ef8ea243c5
  Etherscan · the same payer, same amount, into the ESTATE
    https://sepolia.etherscan.io/tx/0x17b0f95681e3fea74423e06978d319ca1d57a20228480191f12c99d8816d37ad
  HashScan · (option 3 prints a fresh link — prefer that over an old one)
  Subgraph · https://thegraph.com/studio/subgraph/executor

${D}The two Etherscan transactions are from 10 Sep on purpose: they are agent 3's
completed lifecycle, and a finished insolvency is the only kind that has a
waterfall to show. The Hedera payment should be fresh — use option 3.${N}
EOF
}

pay() {
  hr; echo "${B}A REAL PAID REQUEST ON HEDERA${N}"; hr
  echo "${D}402 → sign → pay 0.01 HBAR → a model answers. Costs 0.01 testnet HBAR.${N}"
  GATEWAY_URL="$GATEWAY/research" \
  RESEARCH_QUERY="${1:-What does a subgraph index?}" \
  pnpm --filter @executor/agent-debtor pay 2>&1 | tee /tmp/executor-pay.log
  local id
  id=$(grep -oP "transaction: '\K[^']+" /tmp/executor-pay.log | head -1)
  if [ -n "$id" ]; then
    hr; echo "${G}Fresh HashScan link — open this on camera:${N}"
    echo "  https://hashscan.io/testnet/transaction/$id"
  fi
}

agent_id() {
  read -rp "agent label (exactly as typed into the form): " label
  echo "${G}agent id:${N} $(cast keccak "$label")"
  echo "${D}This is how the page derives it: keccak256 of the label.${N}"
}

destination() {
  local a="${1:-}"; [ -z "$a" ] && read -rp "agent id: " a
  echo -n "destination: "
  cast call "$REGISTRY" "getPaymentDestination(bytes32)(address)" "$a" --rpc-url "$RPC"
  echo "${D}0x7ea7f6e9…07330 = treasury   ·   0xDE3207F4…12337 = estate${N}"
}

flip() {
  local a="${1:-}"; [ -z "$a" ] && read -rp "agent id: " a
  hr; echo "${B}enterAdministration — permissionless${N}"
  echo "${D}The caller holds none of the agent's four roles. The contract checks"
  echo "the deadline, not the caller.${N}"
  destination "$a"
  cast send "$REGISTRY" "enterAdministration(bytes32)" "$a" \
    --rpc-url "$RPC" --private-key "$PRIVATE_KEY" 2>&1 | grep -E 'transactionHash|status|error' || true
  hr; destination "$a"
}

restore() {
  local a="${1:-}"; [ -z "$a" ] && read -rp "agent id: " a
  cast send "$REGISTRY" "restoreActive(bytes32)" "$a" \
    --rpc-url "$RPC" --private-key "$AGENT3_RECOVERY_KEY" 2>&1 | grep -E 'transactionHash|status|error' || true
  destination "$a"
}

subgraph_query() {
  hr; echo "${B}THE GRAPH — approval and execution, joined by planHash${N}"; hr
  curl -s -X POST "$SUBGRAPH" -H 'content-type: application/json' \
    -d '{"query":"{planApprovals(orderBy:blockNumber){planHash trustee blockNumber estate} planExecutions{planHash totalPaid shortfall}}"}' |
    python3 -m json.tool
}

heartbeat() {
  hr; echo "${B}RESTARTING THE HEARTBEAT RUNNER${N}"
  echo "${D}It dies with the shell that starts it. Leave this window open.${N}"; hr
  AGENT_ID="$DEMO_AGENT" HEARTBEAT_SIGNER_KEY="$AGENT3_SIGNER_KEY" BEAT_SECONDS=45 ./scripts/heartbeat.sh
}

menu() {
  clear
  echo "${B}EXECUTOR — recording helper${N}"
  echo "${D}Options that send transactions say so. All testnet.${N}"
  hr
  cat <<'EOF'
  1  Preflight — is everything live?
  2  Tabs to open, and what each one is for
  3  Make a real paid request on Hedera   [sends 0.01 HBAR, prints a fresh HashScan link]
  4  Work out an agent id from its label
  5  Read where an agent currently pays
  6  Flip an agent to administration      [sends a transaction]
  7  Restore an agent to active           [sends a transaction]
  8  Query the subgraph
  9  Restart the heartbeat runner         [blocks this window — use a spare one]
  q  quit
EOF
  hr
}

while true; do
  menu
  read -rp "> " c
  case "$c" in
    1) preflight ;;
    2) tabs ;;
    3) pay ;;
    4) agent_id ;;
    5) destination ;;
    6) flip ;;
    7) restore ;;
    8) subgraph_query ;;
    9) heartbeat ;;
    q|Q) exit 0 ;;
    *) echo "?" ;;
  esac
  echo; read -rp "${D}enter to return to the menu${N} "
done
