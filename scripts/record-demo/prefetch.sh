#!/usr/bin/env bash
# Runs every command the video displays, against live Sepolia, and captures the
# real output. Nothing shown on screen is authored by hand - this file is the
# only thing standing between the recording and the chain.
set -uo pipefail
export PATH="$PATH:$HOME/.foundry/bin"
cd /mnt/c/Users/Pramod/GitHub/executor
set -a; . ./.env.local 2>/dev/null; set +a

RPC=https://ethereum-sepolia-rpc.publicnode.com
REG=0x2946B46c2EB5Ec532093877223Ef043b13729e39
USDC=0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238
A1=0x6b7f61f16d01348d0b80bac1e63e0abb99eb377294a49d1f22181e912daf5255
A3=0x96abf3c7f8f72fdf248e91137fb471a442dccf3fcece378b2065616cb68c36d4
EST3=0xD52b37AD931F221A902fC7F43A9ed2D87Ce07C5F
TRE3=0x29eA9aE5baC451ee08094B265010511d2ADc5557
C1=0x77b31B4ab5381FcF75c9BF3e4E71Feb2Cb91C35a
C2=0xb081dc53df2D329b845Fb6DfAC3D6043DF81042f
C3=0x356895DE19620d046E29eaF6470Ef357Ef51810b

TX_PAY_TRE=0x731319100c29e25cf27270085ef91caaba946f9907cd14dfa67e33ef8ea243c5
TX_ADMIN=0x345811aa27275686899f84ec30c6b5c602cf6cc0d60e5be1edbb263e6ae2ea8e
TX_PAY_EST=0x17b0f95681e3fea74423e06978d319ca1d57a20228480191f12c99d8816d37ad
TX_LIQ=0x8a5121bb95318a52a292ebe4df962d5a04262634bdfc2ec7de69677e90a39242
TX_EXEC=0xb693dbab092d82cb70379969b7880bc3103874498bafe48682d0882e9a8bafc8
TX_RESOLVE=0xba2355020125ac12cfd06af36f0e6c3593281dcdfbfd81151a660149b2bceda9

OUT=/tmp/claude-0/-mnt-c-Users-Pramod-GitHub-ai-research/c467eb2f-5e81-4c44-8abd-feab16531f5c/scratchpad/rec/data
mkdir -p "$OUT"
run() { local id="$1"; shift; echo "  fetching $id" >&2; "$@" > "$OUT/$id.txt" 2>&1; }

# --- the primitive, live, on the agent that is alive right now ---
run dest_alive        cast call $REG "getPaymentDestination(bytes32)(address)" $A1 --rpc-url $RPC
run status_alive      cast call $REG "getStatus(bytes32)(uint8)" $A1 --rpc-url $RPC

# --- agent 3 heartbeat history: the agent genuinely lived ---
run hb_logs           cast logs --from-block 9350000 --address $REG \
                        "Heartbeat(bytes32,uint64)" $A3 --rpc-url $RPC

# --- payment while alive ---
run pay_tre_receipt   cast receipt $TX_PAY_TRE --rpc-url $RPC
run tre_bal           cast call $USDC "balanceOf(address)(uint256)" $TRE3 --rpc-url $RPC

# --- the death ---
run admin_receipt     cast receipt $TX_ADMIN --rpc-url $RPC
run status_a3         cast call $REG "getStatus(bytes32)(uint8)" $A3 --rpc-url $RPC
run dest_a3           cast call $REG "getPaymentDestination(bytes32)(address)" $A3 --rpc-url $RPC

# --- payment after the flip ---
run pay_est_receipt   cast receipt $TX_PAY_EST --rpc-url $RPC

# --- liquidation and the waterfall ---
run liq_receipt       cast receipt $TX_LIQ --rpc-url $RPC
run exec_receipt      cast receipt $TX_EXEC --rpc-url $RPC
run resolve_receipt   cast receipt $TX_RESOLVE --rpc-url $RPC
run est_code          cast codesize $EST3 --rpc-url $RPC
run est_bal           cast call $USDC "balanceOf(address)(uint256)" $EST3 --rpc-url $RPC
run c1_bal            cast call $USDC "balanceOf(address)(uint256)" $C1 --rpc-url $RPC
run c2_bal            cast call $USDC "balanceOf(address)(uint256)" $C2 --rpc-url $RPC
run c3_bal            cast call $USDC "balanceOf(address)(uint256)" $C3 --rpc-url $RPC
echo "done" >&2
