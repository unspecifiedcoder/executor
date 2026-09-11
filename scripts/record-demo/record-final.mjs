import { chromium } from 'playwright-core';

/**
 * The submission cut. Recorded from the dashboard itself — every frame is a
 * page a judge can open.
 *
 * Beats, and why each is there:
 *   0:00  overview at rest, hopper = treasury   (the page opens paused now)
 *   0:12  step 03, eighteen heartbeats          (it was genuinely alive)
 *   0:32  step 04, payment lands in TREASURY    (without this the flip has
 *                                                nothing to be different from)
 *   0:56  step 06, window lapses, treasury sealed
 *   1:20  step 07, THE DEFLECTION — longest hold in the cut
 *   1:52  step 08, liquidation + flatline
 *   2:12  step 09, executePlan pours into Secured
 *   2:36  step 10, resolved
 *   2:52  /vitals — the live agent, still beating
 *
 * The close is deliberate: a judge has just watched one machine die, and the
 * last frame is a different one alive on the same registry.
 */
const DASH = 'http://localhost:3100';
const sleep = ms => new Promise(r => setTimeout(r, ms));

const MARK = {
  rest:    12,
  beats:   32,
  payTre:  56,
  lapse:   80,
  flip:   112,   // 32s on the peak
  liq:    132,
  pour:   156,
  resolved:172,
  vitals: 186,   // trimmed from 200 to make room for the close
  register:214,  // and you can make your own
};

const browser = await chromium.launch({
  executablePath: '/opt/google/chrome/chrome',
  args: ['--no-sandbox','--disable-dev-shm-usage','--force-device-scale-factor=1','--hide-scrollbars','--disable-gpu'],
});
const ctx = await browser.newContext({
  viewport: { width: 1920, height: 1080 },
  recordVideo: { dir: 'out-final', size: { width: 1920, height: 1080 } },
});
const page = await ctx.newPage();
page.on('pageerror', e => console.log('\n!! PAGEERROR:', String(e).slice(0, 300)));

const t0 = Date.now();
const at = s => `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
const hold = async s => { while (Date.now()-t0 < s*1000) await sleep(40); };
const mark = (s,l) => console.log(`  ${at(s)}  ${l}`);
const next = n => page.evaluate(k => {
  const b = [...document.querySelectorAll('.controls button')];
  for (let i=0;i<k;i++) b[2]?.click();
}, n);

try {
  mark(0, 'overview at rest — hopper = treasury');
  await page.goto(DASH, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await sleep(3500);
  await hold(MARK.rest);

  await next(2); mark(MARK.rest, 'step 03 — eighteen heartbeats'); await hold(MARK.beats);
  await next(1); mark(MARK.beats, 'step 04 — payment lands in TREASURY'); await hold(MARK.payTre);
  await next(2); mark(MARK.payTre, 'step 06 — window lapses, treasury SEALED'); await hold(MARK.lapse);
  await next(1); mark(MARK.lapse, 'step 07 — THE DEFLECTION  ** peak **'); await hold(MARK.flip);
  await next(1); mark(MARK.flip, 'step 08 — liquidation + flatline'); await hold(MARK.liq);
  await next(1); mark(MARK.liq, 'step 09 — executePlan pours'); await hold(MARK.pour);
  await next(1); mark(MARK.pour, 'step 10 — resolved'); await hold(MARK.resolved);

  mark(MARK.resolved, '/vitals — the live agent, still beating');
  await page.goto(DASH + '/vitals', { waitUntil: 'domcontentloaded', timeout: 120000 });
  await hold(MARK.vitals);

  // The async round is where most prizes are decided, and most of those judges
  // only watch the video. Ending on "look what we built" wastes the fact that
  // anyone can drive this; ending on the form makes it an invitation.
  mark(MARK.vitals, '/register — and you can make your own');
  await page.goto(DASH + '/register', { waitUntil: 'domcontentloaded', timeout: 120000 });
  await sleep(2200);
  await page.evaluate(() => window.scrollTo({ top: 0 }));
  await hold(MARK.register);
  mark(MARK.register, 'end');
} finally {
  await page.close().catch(()=>{});
  await ctx.close().catch(()=>{});
  await browser.close().catch(()=>{});
}
console.log('written to out-final/');
