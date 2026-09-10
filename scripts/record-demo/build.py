import json, os, html
D="data"
def rd(n): return open(os.path.join(D,n+".txt")).read().strip()

RPC="--rpc-url $SEPOLIA_RPC"
REG="0x2946B46c…29e39"
A1="0x6b7f61f1…5255"
A3="0x96abf3c7…c36d4"

def blk(cmd, out, note=None):
    return {"cmd":cmd,"out":out,"note":note}

hb = rd("hb_table")

scenes = [
 # id, title, seconds, blocks
 {"id":"primitive","title":"The primitive","dur":23,"blocks":[
   blk("cast call $REGISTRY \"getPaymentDestination(bytes32)(address)\" \\\n     "+A1+" "+RPC,
       rd("dest_alive")+"     <- the treasury",
       "live Sepolia · this agent is alive right now"),
   blk("cast call $REGISTRY \"getStatus(bytes32)(uint8)\" "+A1+" "+RPC,
       rd("status_alive")+"     <- Active"),
 ]},
 {"id":"alive","title":"It was genuinely alive","dur":23,"blocks":[
   blk("cast logs --address $REGISTRY \"Heartbeat(bytes32,uint64)\" "+A3+" "+RPC, hb,
       "a signer proving liveness every 96 seconds, for 27 minutes"),
 ]},
 {"id":"paid","title":"A real payment, while alive","dur":22,"blocks":[
   blk("./scripts/route-payment.sh "+A3+"   # destination is never an argument",
       "reading getPaymentDestination…  -> 0x29eA9aE5…5557\n"
       "sending 200000 USDC to exactly that address\n\n"
       "tx 0x73131910…a243c5   block 11672895   status 1 (success)\n"
       "  Transfer  200000 USDC   0xbFe5551e…16EA -> 0x29eA9aE5…5557  (treasury)",
       "real Circle USDC on Sepolia"),
 ]},
 {"id":"dies","title":"The agent dies","dur":22,"blocks":[
   blk("# heartbeat stopped at block 11672892. the window lapses.\ncast send $REGISTRY \"enterAdministration(bytes32)\" "+A3+"   # too soon",
       "Error: execution reverted: TooEarly() [0x085de625]",
       "the contract refuses until the real deadline passes"),
   blk("cast send $REGISTRY \"enterAdministration(bytes32)\" "+A3+"   # after the window",
       "tx 0x345811aa…6ae2ea8e   block 11672930   status 1 (success)\n"
       "  from 0x72db032c…c706  <- not the owner, signer, trustee or recovery key",
       "enterAdministration is permissionless. the contract checks the deadline, not the caller."),
 ]},
 {"id":"flip","title":"The same command, different money","dur":22,"blocks":[
   blk("cast call $REGISTRY \"getPaymentDestination(bytes32)(address)\" "+A3+" "+RPC,
       rd("dest_a3")+"     <- the estate contract, not the treasury"),
   blk("./scripts/route-payment.sh "+A3+"   # byte-for-byte the same command",
       "tx 0x17b0f956…9d8816d37ad   block 11672932   status 1 (success)\n\n"
       "  pay #1   block 11672895   0xbFe5551e…16EA -> 0x29eA9aE5…5557  (treasury)\n"
       "  pay #2   block 11672932   0xbFe5551e…16EA -> 0xD52b37AD…7C5F  (estate)\n"
       "           same payer        same 200000 USDC      same script",
       "nothing about the payer changed. the agent's on-chain state did."),
 ]},
 {"id":"paid_out","title":"Creditors actually get paid","dur":26,"blocks":[
   blk("cast send $REGISTRY \"enterLiquidation(bytes32)\" "+A3+"   # trustee only",
       "tx 0x8a5121bb…90a39242   block 11672934   from 0x108efe09…A310 (trustee)\n"
       "status 2 (Liquidation)  <- only this unlocks payouts",
       "administration is recoverable. paying creditors while the agent might come back would be the worst bug this protocol could have."),
   blk("cast send $ESTATE \"executePlan()\"   # permissionless",
       "tx 0xb693dbab…82d0882e9a8bafc8   block 11672939   gas 173673\n\n"
       "  200000 available  vs  850000 owed\n"
       "  secured          0x77b31B4a…C35a   paid  200000   in full\n"
       "  administrative   0xb081dc53…042f   paid       0\n"
       "  unsecured        0x356895DE…810b   paid       0\n"
       "  estate balance   0xD52b37AD…7C5F           0   drained",
       "strict priority. insolvent on purpose - that is the normal case."),
 ]},
]

TOTAL_MID = sum(s["dur"] for s in scenes)
print("mid total", TOTAL_MID)
open("scenes.json","w").write(json.dumps(scenes,indent=1))
