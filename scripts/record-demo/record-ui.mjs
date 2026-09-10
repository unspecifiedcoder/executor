import { chromium } from 'playwright-core';

/**
 * Records the demo from the actual dashboard.
 *
 * The previous recorder drove a purpose-built console page, so the video and
 * the live site were two different products and the persuasive one was the one
 * nobody could visit. This drives the real UI: every frame below is a page a
 * judge can open.
 *
 * The replay is stepped manually rather than left to autoplay. Its own holds
 * total ~34s, which is the right pace for reading on a screen and the wrong
 * pace for a narrated video - and segment boundaries have to be exact, because
 * the voiceover script is written against them.
 */
const DASH = 'http://localhost:3100';
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Absolute end-of-segment marks, in seconds. Narration is written to these.
const MARKS = {
  hero:        22,   // 0:00  the problem
  replayIntro: 40,   // 0:22  the primitive, rack at rest
  s2:          50,   // lock plan
  s3:          62,   // heartbeats
  s4:          78,   // payment -> treasury
  s5:          90,   // heartbeat stops
  s6:         106,   // enterAdministration, by a stranger
  s7:         126,   // same command -> estate   <- the peak, longest hold
  s8:         138,   // enterLiquidation
  s9:         156,   // executePlan + waterfall
  s10:        166,   // resolve
  graph:      186,   // liveness history, indexed
  end:        206,   // close on the hero
};

const browser = await chromium.launch({
  executablePath: '/opt/google/chrome/chrome',
  args: ['--no-sandbox','--disable-dev-shm-usage','--force-device-scale-factor=1',
         '--hide-scrollbars','--disable-gpu'],
});
const ctx = await browser.newContext({
  viewport: { width: 1920, height: 1080 },
  recordVideo: { dir: 'out-ui', size: { width: 1920, height: 1080 } },
  deviceScaleFactor: 1,
});
const page = await ctx.newPage();
page.on('pageerror', e => console.log('\n!! PAGEERROR:', String(e.stack || e).slice(0, 1200)));
page.on('console', m => { if (m.type() === 'error') console.log('!! CONSOLE:', m.text().slice(0, 400)); });
setInterval(async () => {
  try {
    const m = await page.evaluate(() => performance.memory ? Math.round(performance.memory.usedJSHeapSize/1048576) : -1);
    if (m > 0) process.stdout.write(` [heap ${m}MB]`);
  } catch {}
}, 20000);

const t0 = Date.now();
const at = s => `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
const holdUntil = async s => { while (Date.now()-t0 < s*1000) await sleep(40); };
const mark = (s,l) => console.log(`  ${at(s)}  ${l}`);

const nextStep = async () => {
  await page.evaluate(() => {
    const btns = document.querySelectorAll('.replay-controls .replay-btn');
    const next = btns[btns.length - 1];
    if (next && !next.disabled) next.click();
  });
};

const scrollTo = async (selector, block = 'center') => {
  await page.evaluate(([sel, blk]) => {
    const el = document.querySelector(sel);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: blk });
  }, [selector, block]);
};

try {
  // ── the problem: the live agent, alive right now ───────────────────────────
  mark(0, 'hero — live agent');
  await page.goto(DASH, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await sleep(2500);
  await page.evaluate(ms => new Promise(res => {
    const target = Math.min(330, Math.max(0, document.body.scrollHeight - innerHeight));
    const start = performance.now();
    (function f(){
      const p = Math.min(1, (performance.now()-start)/ms);
      scrollTo(0, target*p);
      p < 1 ? requestAnimationFrame(f) : res();
    })();
  }), (MARKS.hero - 5) * 1000);
  await holdUntil(MARKS.hero);

  // ── the primitive, at rest ─────────────────────────────────────────────────
  mark(MARKS.hero, 'replay — rack at rest (step 1)');
  await scrollTo('.replay', 'start');
  await holdUntil(MARKS.replayIntro);

  // ── step the lifecycle, on the marks ───────────────────────────────────────
  const steps = [
    ['s2',  'lock plan'],
    ['s3',  'heartbeats'],
    ['s4',  'payment -> TREASURY'],
    ['s5',  'heartbeat stops'],
    ['s6',  'enterAdministration (stranger)'],
    ['s7',  'same command -> ESTATE   ** peak **'],
    ['s8',  'enterLiquidation'],
    ['s9',  'executePlan + waterfall'],
    ['s10', 'resolve'],
  ];
  for (const [key, label] of steps) {
    await nextStep();
    mark(Math.round((Date.now()-t0)/1000), label);
    await holdUntil(MARKS[key]);
  }

  // ── what the index gives you ───────────────────────────────────────────────
  mark(MARKS.s10, 'liveness history — indexed by The Graph');
  await scrollTo('.vitals-strip', 'center');
  await holdUntil(MARKS.graph);

  // ── close where we started ─────────────────────────────────────────────────
  mark(MARKS.graph, 'close — back to the hero');
  await page.evaluate(() => scrollTo({ top: 0, behavior: 'smooth' }));
  await holdUntil(MARKS.end);
  mark(MARKS.end, 'end');
} finally {
  await page.close().catch(()=>{});
  await ctx.close().catch(()=>{});
  await browser.close().catch(()=>{});
}
console.log('video written to out-ui/');
