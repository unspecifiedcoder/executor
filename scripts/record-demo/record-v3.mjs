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
const TERM = 'file:///tmp/claude-0/-mnt-c-Users-Pramod-GitHub-ai-research/c467eb2f-5e81-4c44-8abd-feab16531f5c/scratchpad/term/index.html';

/** Registered on Sepolia for this recording: four distinct authorities, 60s
 *  interval, treasury and estate both mapped to real Hedera accounts. */
const VIDEO_AGENT = '0x22c4fc7e5e8db456657c12913446369e6634e186b65e01f4db19c4481cf782e3';

const TX_TREASURY = '0x731319100c29e25cf27270085ef91caaba946f9907cd14dfa67e33ef8ea243c5';
const HS_TX = '0.0.7162784@1789202466.813297956';

const sleep = ms => new Promise(r => setTimeout(r, ms));

/**
 * Every value is an absolute second from the start, and the last one is the
 * hard constraint: The Graph requires a demo of two to four minutes, so 240
 * is a cap and not a target. A first pass ran to 5:00 and would have been
 * ineligible for that track.
 */
const MARK = {
  hook:      18,   // hero: the bankruptcy analogy, already on screen
  agent:     30,   // the agent registered minutes ago
  alive:     42,   // back to the rail - alive means treasury
  terminal:  50,   // a real paywall
  paid:      72,   // the paid request runs
  stops:     84,   // heartbeat stops
  sealed:    98,   // treasury sealed
  deflect:  120,   // THE DEFLECTION - peak, longest dwell
  receipts: 140,   // both receipts on one frame
  ether:    158,   // Etherscan: the USDC transfer
  hash:     178,   // HashScan: the HBAR settlement
  waterfall:196,   // creditors, in order
  vitals:   214,   // the live agent, still beating
  register: 228,   // register your own
  end:      238,
};

const browser = await chromium.launch({
  executablePath: '/opt/google/chrome/chrome',
  args: ['--no-sandbox','--disable-dev-shm-usage','--force-device-scale-factor=1','--hide-scrollbars','--disable-gpu'],
});
const ctx = await browser.newContext({
  viewport: { width: 1920, height: 1080 },
  recordVideo: { dir: 'out-v3', size: { width: 1920, height: 1080 } },
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
  await page.goto(DASH, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForSelector('.stackproof .sp', { timeout: 60000 }).catch(()=>{});
  await sleep(1200);
  await hold(MARK.hook);

  mark(MARK.hook, 'the agent we registered for this recording');
  await page.goto(`${DASH}/agent/${VIDEO_AGENT}`, { waitUntil:'domcontentloaded', timeout:120000 });
  await hold(MARK.agent);

  mark(MARK.agent, 'back to the rail — alive means treasury');
  await page.goto(DASH, { waitUntil:'domcontentloaded', timeout:120000 });
  await page.waitForSelector('.stackproof .sp', { timeout:60000 }).catch(()=>{});
  await hold(MARK.alive);
  await next(3); // step 04 — the payment lands in the treasury
  await hold(MARK.terminal);

  mark(MARK.terminal, 'terminal — a real x402 paywall on Hedera');
  await page.goto(TERM, { waitUntil:'domcontentloaded', timeout:60000 });
  await hold(MARK.paid);
  mark(MARK.paid, '  (settlement printing — narration is silent here)');
  await hold(MARK.stops);

  mark(MARK.stops, 'back to the replay — the heartbeat stops');
  await page.goto(DASH, { waitUntil:'domcontentloaded', timeout:120000 });
  await sleep(1500);
  await next(5); // step 06 — window lapses, treasury sealed
  await hold(MARK.sealed);
  mark(MARK.sealed, 'TREASURY SEALED');
  await hold(MARK.deflect);

  await next(1); // step 07 — THE DEFLECTION, both receipts on the frame
  mark(MARK.deflect, 'THE DEFLECTION  ** peak **');
  await hold(MARK.receipts);
  mark(MARK.receipts, 'both receipts, same payer, two destinations');
  await hold(MARK.ether);

  mark(MARK.ether, 'Etherscan — the treasury transfer, on a site we do not own');
  await page.goto(`https://sepolia.etherscan.io/tx/${TX_TREASURY}`, { waitUntil:'domcontentloaded', timeout:90000 });
  await sleep(3500); await dismiss();
  await hold(MARK.hash);

  mark(MARK.hash, 'HashScan — the HBAR settlement');
  await page.goto(`https://hashscan.io/testnet/transaction/${HS_TX}`, { waitUntil:'domcontentloaded', timeout:90000 });
  await sleep(6000); await dismiss();
  await hold(MARK.waterfall);

  mark(MARK.waterfall, 'creditors, in priority order');
  await page.goto(DASH, { waitUntil:'domcontentloaded', timeout:120000 });
  await sleep(1500);
  await next(8); // step 09 — executePlan pours
  await hold(MARK.vitals);

  mark(MARK.vitals, '/vitals — the live agent, still beating');
  await page.goto(`${DASH}/vitals`, { waitUntil:'domcontentloaded', timeout:120000 });
  await page.waitForSelector('.b-word', { timeout:60000 }).catch(()=>{});
  await hold(MARK.register);

  mark(MARK.register, '/register — your keys, your gas');
  await page.goto(`${DASH}/register`, { waitUntil:'domcontentloaded', timeout:120000 });
  await sleep(1800);
  await page.evaluate(() => window.scrollTo({ top: 0 }));
  await hold(MARK.end);
  mark(MARK.end, 'end');
} finally {
  await page.close().catch(()=>{});
  await ctx.close().catch(()=>{});
  await browser.close().catch(()=>{});
}
console.log('written to out-v3/');
