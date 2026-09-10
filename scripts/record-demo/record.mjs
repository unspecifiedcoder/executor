import { chromium } from 'playwright-core';
import { fileURLToPath } from 'url';
import path from 'path';

const DASH = 'http://localhost:3100';
const CONSOLE_URL = 'file://' + path.resolve('console.built.html');
const sleep = ms => new Promise(r => setTimeout(r, ms));

const OPEN_S = 22;    // 0:00 - 0:22  the problem
const MID_S  = 158;   // 0:22 - 3:00  the loop, and the index
const CLOSE_S= 20;   // 3:00 - 3:20  the close

const browser = await chromium.launch({
  executablePath: '/opt/google/chrome/chrome',
  args: ['--no-sandbox','--disable-dev-shm-usage','--force-device-scale-factor=1',
         '--hide-scrollbars','--disable-gpu']
});
const ctx = await browser.newContext({
  viewport: { width: 1920, height: 1080 },
  recordVideo: { dir: 'out', size: { width: 1920, height: 1080 } },
  deviceScaleFactor: 1,
});
const page = await ctx.newPage();

const t0 = Date.now();
try {
const at = s => `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
const mark = (s,l) => console.log(`  ${at(s)}  ${l}`);
const holdUntil = async s => { while (Date.now()-t0 < s*1000) await sleep(50); };

// ---- 0:00 the problem: the live dashboard ----
mark(0,'dashboard (hero)');
await page.goto(DASH, { waitUntil: 'domcontentloaded', timeout: 90000 });
await sleep(1500);
// a slow drift down the page so the frame is never static
await page.evaluate(ms => new Promise(res => {
  const end = performance.now()+ms, max = document.body.scrollHeight - innerHeight;
  const t0 = performance.now();
  (function f(){
    const p = Math.min(1,(performance.now()-t0)/ms);
    scrollTo(0, max*Math.min(1,p*1.15)*0.55);
    performance.now()<end ? requestAnimationFrame(f) : res();
  })();
}), (OPEN_S-4)*1000);
await holdUntil(OPEN_S);

// ---- 0:22 the loop, on one agent ----
mark(OPEN_S,'console (the loop)');
await page.goto(CONSOLE_URL, { waitUntil: 'domcontentloaded' });
await sleep(600);
await page.evaluate(() => window.__start());
await holdUntil(OPEN_S + MID_S);

// ---- 2:40 close, back where we started ----
mark(OPEN_S+MID_S,'dashboard (close)');
await page.goto(DASH, { waitUntil: 'domcontentloaded', timeout: 90000 });
await holdUntil(OPEN_S + MID_S + CLOSE_S);
mark(OPEN_S+MID_S+CLOSE_S,'end');

} finally {
  await page.close().catch(()=>{});
  await ctx.close().catch(()=>{});
  await browser.close().catch(()=>{});
}
console.log('video written to out/');
