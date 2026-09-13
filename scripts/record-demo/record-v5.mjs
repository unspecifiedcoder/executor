import { chromium } from 'playwright-core';
import { createPublicClient, createWalletClient, http, keccak256, stringToHex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import fs from 'node:fs';

/**
 * v5 — the registration is connected, signed and broadcast for real, on camera.
 *
 * Earlier cuts filled the form and cut away. Automating the click looked like
 * it needed an endpoint in the app that signs whatever it is handed, which
 * would be a live key-abuse surface on a deployed site for a few seconds of
 * footage. It does not need that.
 *
 * The key stays in THIS process. The page gets two bound functions: one that
 * proxies reads to a public RPC, one that signs. `window.ethereum` here is a
 * genuine EIP-1193 provider rather than a stub, because the register page uses
 * viem's custom() transport and therefore routes every RPC call through it.
 * Nothing is added to the app and nothing is deployed; the key never enters
 * page memory or the repo.
 *
 * RUN LOCALLY ONLY. This script holds a signing key and points a browser at it.
 */
const RPC = 'https://ethereum-sepolia-rpc.publicnode.com';
const DASH = process.env.DASH_URL ?? 'http://localhost:3100';
const REGISTRY = '0x2946B46c2EB5Ec532093877223Ef043b13729e39';
/**
 * These two pages live in the repo, not a temp directory. An earlier take died
 * mid-recording because they had been written to the session scratchpad, which
 * is wiped between sessions - the video depends on them, so they are versioned.
 */
const PAGES = new URL('./pages/', import.meta.url).href;
const TERM = `${PAGES}term/index.html`;
const GRAPHQ = `${PAGES}graph/index.html`;

const TX_TREASURY = '0x731319100c29e25cf27270085ef91caaba946f9907cd14dfa67e33ef8ea243c5';
/** Refreshed before each take. A link that is a day old invites "is this
 *  thing still running?" - which is the one doubt a live paywall should
 *  not leave. `scripts/demo-day.sh` option 3 makes a new one. */
const HS_TX = '0.0.7162784@1789281994.609981819';

/** A fresh label per take, so a re-run is never blocked by AgentAlreadyRegistered. */
const LABEL = `courier-${Math.random().toString(36).slice(2, 7)}.eth`;
const REG = {
  label: LABEL,
  signer:   '0xC63adec9161CabA36935138b262267489D2d62D0',
  trustee:  '0x108efe0989d08d3BCF49ca1A3A35548543CbA310',
  recovery: '0x86A85D90e605B6661808f7Cbe37565dCa49f323E',
  treasury: '0x7ea7f6e97E24F1ad03Db0bd544A0AeF4A1f07330',
  estate:   '0xDE3207F493fE4600DeEc424e0875ec943d712337',
  interval: '30',
  grace:    '15',
};
/** Exactly how the page derives it: keccak256(stringToHex(label)). */
const AGENT_ID = keccak256(stringToHex(LABEL));

const DEST_ABI = [{ name:'getPaymentDestination', type:'function', stateMutability:'view',
  inputs:[{type:'bytes32'}], outputs:[{type:'address'}] }];
const FLIP_ABI = [{ name:'enterAdministration', type:'function', stateMutability:'nonpayable',
  inputs:[{type:'bytes32'}], outputs:[] }];
const BEAT_ABI = [{ name:'heartbeat', type:'function', stateMutability:'nonpayable',
  inputs:[{type:'bytes32'}], outputs:[] }];
const PLAN_ABI = [{ name:'plans', type:'function', stateMutability:'view', inputs:[{type:'bytes32'}],
  outputs:[{type:'address'},{type:'address'},{type:'address'},{type:'address'},{type:'address'},
           {type:'address'},{type:'uint64'},{type:'uint64'},{type:'uint64'},{type:'uint8'},{type:'bool'}] }];

let pk = fs.readFileSync(new URL('../../.env', import.meta.url), 'utf8')
  .match(/^PRIVATE_KEY=(.+)$/m)[1].trim().replace(/^["']|["']$/g, '');
if (!pk.startsWith('0x')) pk = '0x' + pk;
const account = privateKeyToAccount(pk);

/**
 * The heartbeat signer is a different key from the owner - the contract
 * rejects a heartbeat from anyone else, which is the point of the four roles.
 * Without this the agent in the video never beats at all, and narrating "the
 * heartbeat stops" over an agent that never started would be a lie.
 */
let bk = fs.readFileSync(new URL('../../.env.local', import.meta.url), 'utf8')
  .match(/^AGENT3_SIGNER_KEY=(.+)$/m)[1].trim().replace(/^["']|["']$/g, '');
if (!bk.startsWith('0x')) bk = '0x' + bk;
const signer = privateKeyToAccount(bk);
const pub = createPublicClient({ chain: sepolia, transport: http(RPC) });
const wallet = createWalletClient({ account, chain: sepolia, transport: http(RPC) });
const beater = createWalletClient({ account: signer, chain: sepolia, transport: http(RPC) });

const sleep = ms => new Promise(r => setTimeout(r, ms));

const MARK = {
  // On-chain waits (mining, three heartbeats, the eligibility poll) are
  // variable, and everything after them slides when they run long - one take
  // ran 253s and left Etherscan on screen through two later segments. The
  // tail therefore carries deliberate slack rather than tight gaps.
  hook:      14,
  connect:   24,
  filled:    50,
  signed:    64,
  agentpage: 94,
  alive:    106,
  terminal: 130,
  flip:     148,
  flipped:  172,
  ether:    190,
  hash:     208,
  waterfall:228,   // 20s - the creditor bars, scrolled into view
  graph:    240,
  end:      246,
};

const browser = await chromium.launch({
  executablePath: '/opt/google/chrome/chrome',
  args: ['--no-sandbox','--disable-dev-shm-usage','--force-device-scale-factor=1','--hide-scrollbars','--disable-gpu'],
});
const ctx = await browser.newContext({
  viewport: { width: 1920, height: 1080 },
  recordVideo: { dir: 'out-v5', size: { width: 1920, height: 1080 } },
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36',
});
const page = await ctx.newPage();
page.on('pageerror', e => console.log('\n!! PAGEERROR:', String(e).slice(0, 240)));

// --- the wallet, living in this process, not in the page --------------------
await page.exposeFunction('__walletRpc', async (method, params) => {
  const r = await fetch(RPC, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc:'2.0', id:1, method, params: params ?? [] }),
  });
  const j = await r.json();
  if (j.error) throw new Error(j.error.message);
  return j.result;
});
let registerHash = null;
await page.exposeFunction('__walletSend', async (tx) => {
  const hash = await wallet.sendTransaction({
    to: tx.to, data: tx.data, value: tx.value ? BigInt(tx.value) : undefined,
  });
  console.log('    signed & broadcast:', hash);
  registerHash = hash;
  return hash;
});
await page.addInitScript((addr) => {
  window.ethereum = {
    isMetaMask: true,
    selectedAddress: addr,
    chainId: '0xaa36a7',
    async request({ method, params }) {
      if (method === 'eth_requestAccounts' || method === 'eth_accounts') return [addr];
      if (method === 'eth_chainId') return '0xaa36a7';
      if (method === 'wallet_switchEthereumChain' || method === 'wallet_addEthereumChain') return null;
      if (method === 'eth_sendTransaction') return window.__walletSend(params[0]);
      return window.__walletRpc(method, params);
    },
    on() {}, removeListener() {},
  };
}, account.address);

// Warm the overview BEFORE the clock starts. /api/rail fetches three external
// services on a cold render, and a take opened on fourteen seconds of blank
// page because the hero had not painted yet when t0 began.
console.log('  warming the overview…');
await page.goto(DASH, { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForSelector('.stackproof .sp', { timeout: 90000 }).catch(() =>
  console.log('    !! proof strip never appeared — the hero may be bare'));
await page.waitForSelector('.vault', { timeout: 30000 }).catch(()=>{});
await sleep(2500);
console.log('  warm, starting the clock');

const t0 = Date.now();
const at = s => `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
const hold = async s => { while (Date.now()-t0 < s*1000) await sleep(40); };
const mark = (s,l) => console.log(`  ${at(s)}  ${l}`);
const next = n => page.evaluate(k => {
  const b = [...document.querySelectorAll('.controls button')];
  for (let i=0;i<k;i++) b[2]?.click();
}, n);
/**
 * Both explorers put a cookie modal over exactly the rows this video exists to
 * show, and HashScan raises its one a beat AFTER the page settles - a single
 * early click misses it, and a take shipped with the modal covering the Hbar
 * transfers. So: try repeatedly, and confirm it is actually gone.
 */
const dismiss = async () => {
  for (let attempt = 0; attempt < 6; attempt++) {
    for (const sel of ['button:has-text("ACCEPT")', 'button:has-text("Accept")',
                       'button:has-text("Got it")', 'button:has-text("I agree")']) {
      const b = page.locator(sel).first();
      if (await b.count().catch(() => 0)) await b.click({ timeout: 2000 }).catch(() => {});
    }
    await sleep(900);
    const stillThere = await page
      .locator('text=/Accept Cookies|uses cookies/i').first()
      .isVisible({ timeout: 700 }).catch(() => false);
    if (!stillThere) return;
  }
  console.log('    !! a cookie modal is still on screen');
};
const destination = () => pub.readContract({
  address: REGISTRY, abi: DEST_ABI, functionName:'getPaymentDestination', args:[AGENT_ID] });

console.log(`  label   ${LABEL}\n  agentId ${AGENT_ID}\n  owner   ${account.address}`);

try {
  mark(0, 'hero — a company fails and there is a process; an agent fails and there is nothing');
  await hold(MARK.hook);   // already on screen and painted, from the warm-up

  mark(MARK.hook, '/register — connecting the wallet');
  await page.goto(`${DASH}/register`, { waitUntil:'domcontentloaded', timeout:120000 });
  await sleep(1600);
  // Connect, then PROVE the form appeared. A take failed silently when the
  // click did not land: every field lookup missed, registration never
  // happened, and the heartbeats and flip reverted one after another - four
  // minutes of footage wasted because nothing checked this one thing.
  let connected = false;
  for (let attempt = 1; attempt <= 3 && !connected; attempt++) {
    const connect = page.locator('button:has-text("CONNECT WALLET")');
    if (await connect.count()) {
      await connect.click().catch(() => {});
    }
    connected = await page
      .locator('label', { hasText: 'Agent label' })
      .first()
      .waitFor({ state: 'visible', timeout: 8000 })
      .then(() => true)
      .catch(() => false);
    if (!connected) console.log(`    connect attempt ${attempt} did not reveal the form`);
  }
  if (!connected) throw new Error('register form never appeared — aborting rather than recording a broken take');
  console.log('    wallet connected, form is up');
  await hold(MARK.connect);

  mark(MARK.connect, 'typing the plan — four distinct authorities');
  const typeField = async (label, value) => {
    const input = page.locator('label', { hasText: label }).locator('input');
    if (!(await input.count())) { console.log('    !! field not found:', label); return; }
    await input.scrollIntoViewIfNeeded({ timeout: 5000 }).catch(() => {});
    await input.fill('');
    await input.type(value, { delay: 26 });
    await sleep(160);
  };
  await typeField('Agent label', REG.label);
  await typeField('Heartbeat signer', REG.signer);
  await typeField('Trustee', REG.trustee);
  await typeField('Recovery authority', REG.recovery);
  await typeField('Treasury', REG.treasury);
  await typeField('Estate', REG.estate);
  await page.evaluate(() => window.scrollBy({ top: 220 }));
  await sleep(500);
  await typeField('Heartbeat interval', REG.interval);
  await typeField('Grace period', REG.grace);
  await hold(MARK.filled);

  mark(MARK.filled, 'REGISTER AGENT — signing and broadcasting');
  const submit = page.locator('button:has-text("REGISTER AGENT")').first();
  if (!(await submit.count())) throw new Error('REGISTER AGENT button not found — aborting');
  await submit.click().catch(e => console.log('    click:', e.message));
  await hold(MARK.signed);

  // Wait for the registration to be MINED before navigating. Going early
  // means the registry reverts AgentNotFound and Next renders a white 404 -
  // which is exactly what an earlier take captured, in the middle of the
  // segment claiming the agent now exists.
  // Poll the condition the PAGE needs, not the hash. `registerHash` is set
  // inside an async bridge callback and can still be null here, which silently
  // disabled this guard in an earlier take - and this guard is the only thing
  // standing between the take and a white 404 in the middle of the video.
  mark(MARK.signed, 'waiting for the registration to be mined');
  let mined = false;
  for (let i = 0; i < 30; i++) {
    try { await destination(); mined = true; break; } catch { await sleep(2000); }
  }
  console.log(mined ? '    registration mined' : '    !! never mined — the agent page will 404');

  mark(MARK.signed + 4, 'the agent that now exists');
  await page.goto(`${DASH}/agent/${AGENT_ID}`, { waitUntil:'domcontentloaded', timeout:120000 });
  await sleep(1600);
  console.log('    destination now:', await destination().catch(e => e.message));

  // Beat it, so that when it stops there is something that stopped.
  for (let i = 1; i <= 3; i++) {
    try {
      const h = await beater.writeContract({
        address: REGISTRY, abi: BEAT_ABI, functionName:'heartbeat', args:[AGENT_ID] });
      console.log(`    heartbeat ${i}:`, h);
      await pub.waitForTransactionReceipt({ hash: h });
    } catch (e) { console.log(`    !! heartbeat ${i}:`, e.shortMessage || e.message); }
  }
  console.log('    heartbeats stop here — nothing beats it again');
  await hold(MARK.agentpage);

  mark(MARK.agentpage, 'the rail — alive means treasury');
  await page.goto(DASH, { waitUntil:'domcontentloaded', timeout:120000 });
  await page.waitForSelector('.stackproof .sp', { timeout:60000 }).catch(()=>{});
  await sleep(1200);
  await next(3);
  await hold(MARK.alive);

  mark(MARK.alive, 'terminal — a real x402 paid request on Hedera');
  await page.goto(TERM, { waitUntil:'domcontentloaded', timeout:60000 });
  await hold(MARK.terminal);

  mark(MARK.terminal, 'the agent, past its deadline');
  await page.goto(`${DASH}/agent/${AGENT_ID}`, { waitUntil:'domcontentloaded', timeout:120000 });
  await sleep(1400);
  console.log('    destination before flip:', await destination().catch(e => e.message));
  await hold(MARK.flip);

  // enterAdministration is permissionless: the contract checks the deadline,
  // not the caller. This account holds none of the agent's four roles.
  // Each heartbeat pushed the deadline out, which is what heartbeats are for -
  // so the eligible moment has to be READ, not assumed. A fixed wait races
  // variable mining time and reverts TooEarly, which an earlier take did.
  try {
    for (let i = 0; i < 40; i++) {
      const pl = await pub.readContract({
        address: REGISTRY, abi: PLAN_ABI, functionName:'plans', args:[AGENT_ID] });
      const eligibleAt = Number(pl[8]) + Number(pl[6]) + Number(pl[7]);
      // Compare against the CHAIN's clock, not this machine's. block.timestamp
      // lags wall-clock by a few seconds, so local time reports "eligible"
      // before the next block agrees - and enterAdministration reverts
      // TooEarly. The margin is the fix; the skew is not ours to control.
      const head = await pub.getBlock();
      const chainNow = Number(head.timestamp);
      if (chainNow >= eligibleAt + 3) { console.log('    eligible on chain'); break; }
      if (i === 0) console.log(`    waiting ${eligibleAt - chainNow + 3}s for the chain to pass the deadline`);
      await sleep(3000);
    }
    const h = await wallet.writeContract({
      address: REGISTRY, abi: FLIP_ABI, functionName:'enterAdministration', args:[AGENT_ID] });
    console.log('    enterAdministration:', h);
    await pub.waitForTransactionReceipt({ hash: h });
    console.log('    destination after  :', await destination());
  } catch (e) {
    console.log('    !! flip failed:', e.shortMessage || e.message);
  }

  // The agent page is ISR with revalidate=15, so a plain reload serves the
  // STALE render and only regenerates in the background - the payoff frame
  // showed the pre-flip state in an earlier take. A fresh query string is a
  // new cache key, so this renders the post-flip chain read immediately.
  mark(MARK.flip, 'reload — the destination has changed');
  await page.goto(`${DASH}/agent/${AGENT_ID}?after=flip`, { waitUntil:'domcontentloaded', timeout:120000 })
    .catch(e => console.log('    reload:', e.message.slice(0,80)));
  await sleep(2400);
  console.log('    page shows:', await page.locator('text=administration').first().count()
    .then(n => n ? 'administration ✓' : 'still active ✗').catch(()=>'?'));
  await hold(MARK.flipped);

  mark(MARK.flipped, 'Etherscan — the USDC transfer');
  await page.goto(`https://sepolia.etherscan.io/tx/${TX_TREASURY}`, { waitUntil:'domcontentloaded', timeout:90000 });
  await sleep(2600); await dismiss(); await sleep(600);
  await hold(MARK.ether);

  mark(MARK.ether, 'HashScan — the HBAR settlement');
  await page.goto(`https://hashscan.io/testnet/transaction/${HS_TX}`, { waitUntil:'domcontentloaded', timeout:90000 });
  await sleep(3000); await dismiss(); await sleep(600);
  await hold(MARK.hash);

  // The hook promises "administration, liquidation, creditors paid in order".
  // Without this segment the video sets that up and never pays it off, and
  // priority ordering is the point that separates this from a forwarding
  // address. Agent 3's settled estate is the only one that has actually run.
  mark(MARK.hash, 'creditors, in priority order — the analogy paid off');
  await page.goto(DASH, { waitUntil:'domcontentloaded', timeout:120000 });
  await sleep(1400);
  await next(8); // step 09 — executePlan pours
  // The waterfall lives below the fold. Without this the segment narrating
  // "secured is paid, the rest get nothing" showed the page header instead,
  // and the creditor bars - the payoff the hook promises - never appeared.
  await page.locator('.fall').scrollIntoViewIfNeeded({ timeout: 8000 }).catch(() =>
    page.evaluate(() => window.scrollBy({ top: 900 })).catch(()=>{}));
  await sleep(700);
  await hold(MARK.waterfall);

  mark(MARK.waterfall, 'the subgraph — approval and execution joined by planHash');
  await page.goto(GRAPHQ, { waitUntil:'domcontentloaded', timeout:60000 });
  await hold(MARK.graph);

  mark(MARK.graph, 'close — register your own');
  await page.goto(`${DASH}/register`, { waitUntil:'domcontentloaded', timeout:120000 });
  await sleep(1000);
  await page.evaluate(() => window.scrollTo({ top: 0 }));
  await hold(MARK.end);
  mark(MARK.end, 'end');
} finally {
  await page.close().catch(()=>{});
  await ctx.close().catch(()=>{});
  await browser.close().catch(()=>{});
}
console.log(`written to out-v5/   agent ${AGENT_ID}  label ${LABEL}`);
