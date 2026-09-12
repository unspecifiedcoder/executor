import { chromium } from 'playwright-core';

/**
 * v3 of the submission cut, timed to docs/VOICEOVER_SCRIPT_V3.md.
 *
 * Structural change from v2: the video no longer consists only of this app
 * rendering its own claims. Three segments are pages we do not control - a
 * terminal transcript of a real paid request, HashScan, and Etherscan - because
 * "watch our animation" and "here is the receipt on someone else's website" are
 * different kinds of evidence, and only the second survives a sceptic.
 *
 * The narration leads each cut by 2-4s (see the script), so the marks below are
 * where the *picture* changes, not where a sentence begins.
 */
const DASH = 'http://localhost:3100';
const GRAPHQ = 'file:///tmp/claude-0/-mnt-c-Users-Pramod-GitHub-ai-research/c467eb2f-5e81-4c44-8abd-feab16531f5c/scratchpad/graph/index.html';
const TERM = 'file:///tmp/claude-0/-mnt-c-Users-Pramod-GitHub-ai-research/c467eb2f-5e81-4c44-8abd-feab16531f5c/scratchpad/term/index.html';

/** Registered on Sepolia for this recording: four distinct authorities, 60s
 *  interval, treasury and estate both mapped to real Hedera accounts. */
const VIDEO_AGENT = '0x22c4fc7e5e8db456657c12913446369e6634e186b65e01f4db19c4481cf782e3';

/** The registerAgent that actually created the agent above. */
const TX_REGISTER = '0x943890e3c06744eee08e77437b358bf8350bfc4cadda942b8101830cbf152813';
const TX_TREASURY = '0x731319100c29e25cf27270085ef91caaba946f9907cd14dfa67e33ef8ea243c5';
const HS_TX = '0.0.7162784@1789202466.813297956';

const sleep = ms => new Promise(r => setTimeout(r, ms));

/**
 * Typed on camera. Four distinct authorities, because "4 of 4 distinct" is a
 * claim the page itself verifies and displays.
 *
 * The form is filled but NOT submitted from the browser. Relaying a signature
 * through a server route would mean shipping an endpoint that signs whatever
 * it is handed - a real key-abuse surface for a few seconds of footage. The
 * registration this video claims is a transaction that genuinely happened,
 * and the next shot is its receipt on Etherscan.
 */
const REG = {
  label:    'courier-seven.eth',
  signer:   '0xC63adec9161CabA36935138b262267489D2d62D0',
  trustee:  '0x108efe0989d08d3BCF49ca1A3A35548543CbA310',
  recovery: '0x86A85D90e605B6661808f7Cbe37565dCa49f323E',
  treasury: '0x7ea7f6e97E24F1ad03Db0bd544A0AeF4A1f07330',
  estate:   '0xDE3207F493fE4600DeEc424e0875ec943d712337',
  interval: '60',
  grace:    '30',
};

/**
 * Every value is an absolute second from the start, and the last one is the
 * hard constraint: The Graph requires a demo of two to four minutes, so 240
 * is a cap and not a target. A first pass ran to 5:00 and would have been
 * ineligible for that track.
 */
const MARK = {
  hook:      16,   // hero: the bankruptcy analogy
  regform:   52,   // /register - the plan typed live, field by field
  regtx:     68,   // Etherscan: the registerAgent that actually happened
  alive:     82,   // the rail - alive means treasury
  terminal: 112,   // a real x402 paid request, typing for its whole slot
  stops:    124,   // heartbeat stops
  sealed:   138,   // treasury sealed
  deflect:  156,   // THE DEFLECTION ** peak **
  ether:    172,   // Etherscan: the USDC transfer
  hash:     190,   // HashScan: the HBAR settlement
  graph:    206,   // the subgraph answering its own query
  waterfall:220,   // creditors, in order
  vitals:   232,   // the live agent, beating
  end:      238,
};

const browser = await chromium.launch({
  executablePath: '/opt/google/chrome/chrome',
  args: ['--no-sandbox','--disable-dev-shm-usage','--force-device-scale-factor=1','--hide-scrollbars','--disable-gpu'],
});
const ctx = await browser.newContext({
  viewport: { width: 1920, height: 1080 },
  recordVideo: { dir: 'out-v4', size: { width: 1920, height: 1080 } },
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36',
});
const page = await ctx.newPage();
page.on('pageerror', e => console.log('\n!! PAGEERROR:', String(e).slice(0, 240)));

const t0 = Date.now();
const at = s => `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
const hold = async s => { while (Date.now()-t0 < s*1000) await sleep(40); };
const mark = (s,l) => console.log(`  ${at(s)}  ${l}`);
const next = n => page.evaluate(k => {
  const b = [...document.querySelectorAll('.controls button')];
  for (let i=0;i<k;i++) b[2]?.click();
}, n);
/** Cookie walls sit over the evidence on both explorers. */
const dismiss = async () => {
  for (const sel of ['button:has-text("Got it")','button:has-text("ACCEPT")','button:has-text("Accept")']) {
    const b = page.locator(sel).first();
    if (await b.count().catch(()=>0)) { await b.click().catch(()=>{}); await sleep(400); }
  }
};

try {
  mark(0, 'hero — a company fails and there is a process; an agent fails and there is nothing');
  await page.goto(DASH, { waitUntil:'domcontentloaded', timeout:120000 });
  await page.waitForSelector('.stackproof .sp', { timeout:60000 }).catch(()=>{});
  await sleep(1200);
  await hold(MARK.hook);

  mark(MARK.hook, '/register — a plan typed, field by field');
  await page.goto(`${DASH}/register`, { waitUntil:'domcontentloaded', timeout:120000 });
  await sleep(1400);
  await page.evaluate(() => {
    // Read-only stub: it answers the account queries the connect gate makes and
    // implements no signing method at all, so no transaction is possible from
    // this page. The registration shown later is a real, separate transaction.
    window.ethereum = {
      isMetaMask: true,
      async request({ method }) {
        if (method === 'eth_requestAccounts' || method === 'eth_accounts')
          return ['0x72db032c0dFB6E7502e16A73fabdab31712dc706'];
        if (method === 'eth_chainId') return '0xaa36a7';
        if (method === 'wallet_switchEthereumChain') return null;
        throw new Error(`record-v4: read-only wallet, refusing "${method}"`);
      },
      on(){}, removeListener(){},
    };
  });
  const connect = page.locator('button:has-text("CONNECT WALLET")');
  if (await connect.count()) { await connect.click(); await sleep(700); }

  const typeField = async (label, value) => {
    const input = page.locator('label', { hasText: label }).locator('input');
    if (!(await input.count())) return;
    await input.scrollIntoViewIfNeeded();
    await input.fill('');
    await input.type(value, { delay: 34 });
    await sleep(150);
  };
  await typeField('Agent label', REG.label);
  await typeField('Heartbeat signer', REG.signer);
  await typeField('Trustee', REG.trustee);
  await typeField('Recovery authority', REG.recovery);
  await typeField('Treasury', REG.treasury);
  await typeField('Estate', REG.estate);
  await page.evaluate(() => window.scrollBy({ top: 220, behavior:'smooth' }));
  await sleep(400);
  await typeField('Heartbeat interval', REG.interval);
  await typeField('Grace period', REG.grace);
  await hold(MARK.regform);

  mark(MARK.regform, 'Etherscan — the registerAgent that actually happened');
  await page.goto(`https://sepolia.etherscan.io/tx/${TX_REGISTER}`, { waitUntil:'domcontentloaded', timeout:90000 });
  await sleep(3000); await dismiss();
  await hold(MARK.regtx);

  mark(MARK.regtx, 'the rail — alive means treasury');
  await page.goto(DASH, { waitUntil:'domcontentloaded', timeout:120000 });
  await page.waitForSelector('.stackproof .sp', { timeout:60000 }).catch(()=>{});
  await sleep(1200);
  await next(3);
  await hold(MARK.alive);

  mark(MARK.alive, 'terminal — a real x402 paid request on Hedera');
  await page.goto(TERM, { waitUntil:'domcontentloaded', timeout:60000 });
  await hold(MARK.terminal);

  mark(MARK.terminal, 'replay — the heartbeat stops');
  await page.goto(DASH, { waitUntil:'domcontentloaded', timeout:120000 });
  await sleep(1400);
  await next(5);
  await hold(MARK.stops);
  mark(MARK.stops, 'TREASURY SEALED');
  await hold(MARK.sealed);

  await next(1);
  mark(MARK.sealed, 'THE DEFLECTION  ** peak **');
  await hold(MARK.deflect);

  mark(MARK.deflect, 'Etherscan — the USDC transfer');
  await page.goto(`https://sepolia.etherscan.io/tx/${TX_TREASURY}`, { waitUntil:'domcontentloaded', timeout:90000 });
  await sleep(3200); await dismiss();
  await hold(MARK.ether);

  mark(MARK.ether, 'HashScan — the HBAR settlement');
  await page.goto(`https://hashscan.io/testnet/transaction/${HS_TX}`, { waitUntil:'domcontentloaded', timeout:90000 });
  await sleep(5200); await dismiss();
  await hold(MARK.hash);

  mark(MARK.hash, 'the subgraph — approval and execution joined by planHash');
  await page.goto(GRAPHQ, { waitUntil:'domcontentloaded', timeout:60000 });
  await hold(MARK.graph);

  mark(MARK.graph, 'creditors, in priority order');
  await page.goto(DASH, { waitUntil:'domcontentloaded', timeout:120000 });
  await sleep(1400);
  await next(8);
  await hold(MARK.waterfall);

  mark(MARK.waterfall, '/vitals — the live agent, still beating');
  await page.goto(`${DASH}/vitals`, { waitUntil:'domcontentloaded', timeout:120000 });
  await page.waitForSelector('.b-word', { timeout:60000 }).catch(()=>{});
  await hold(MARK.vitals);

  mark(MARK.vitals, 'close');
  await page.goto(`${DASH}/register`, { waitUntil:'domcontentloaded', timeout:120000 });
  await sleep(1200);
  await page.evaluate(() => window.scrollTo({ top: 0 }));
  await hold(MARK.end);
  mark(MARK.end, 'end');
} finally {
  await page.close().catch(()=>{});
  await ctx.close().catch(()=>{});
  await browser.close().catch(()=>{});
}
console.log('written to out-v4/');
