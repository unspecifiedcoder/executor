import { chromium } from 'playwright-core';

/**
 * v2 of the submission cut. Same approach as record-final.mjs — drives the
 * real dashboard in headless Chrome, records at 1920x1080, steps the on-page
 * lifecycle replay on fixed marks — but with a tighter shot list.
 *
 * record-final.mjs held some states frozen for up to 32s. Nothing here holds
 * longer than ~20s of *dwell* after the step's own transition animation, so
 * the cut breathes without ever going dead on screen.
 *
 * Beats, and why each is there:
 *   0:00  overview at rest, hopper = treasury
 *   0:10  step 03, eighteen heartbeats
 *   0:26  step 04, payment lands in TREASURY (dwell on its tx hash)
 *   0:42  step 06, window lapses, treasury sealed
 *   0:56  step 07, THE DEFLECTION — longest hold in the cut (see note below)
 *   1:20  step 08, liquidation + flatline
 *   1:34  step 09, executePlan pours into Secured
 *   1:52  step 10, resolved
 *   2:10  /vitals — the live agent, still beating
 *   2:22  /register — filled live on camera, not just parked on
 *
 * step 07 note: another worker is concurrently adding a second transaction
 * hash to the deflection step, so by record time it renders two receipts
 * side by side instead of one. That's more for a viewer to read, and it's
 * the thematic peak of the whole cut, so it gets the single longest hold —
 * flip(56) -> liq(80) is ~2s of animation plus ~14-20s of dwell, longer than
 * every other segment's dwell time.
 */
const DASH = 'http://localhost:3100';
const sleep = ms => new Promise(r => setTimeout(r, ms));

const MARK = {
  rest:     10,   // overview at rest
  beats:    26,   // step 03 - 18 heartbeats
  payTre:   42,   // step 04 - payment -> TREASURY  (dwell on its tx hash)
  lapse:    56,   // step 06 - window lapses, treasury SEALED
  flip:     80,   // step 07 - THE DEFLECTION  ** peak, longest hold **
  liq:      94,   // step 08 - liquidation
  pour:    112,   // step 09 - executePlan waterfall
  resolved:130,   // step 10 - resolved
  vitals:  142,   // navigate to /vitals, live agent beating
  register:158,   // navigate to /register
  end:     190,   // end of recording
};

/**
 * Demo values typed into the /register form on camera. Deliberately NOT the
 * DEMO_KEYS baked into the page (that's the one-click "Use four distinct
 * keys" autofill) — typing distinct values shows a viewer this is a real,
 * editable form and not a canned state.
 *
 * These are cosmetically valid Sepolia-shaped addresses (pass the page's
 * isAddress() regex) chosen for this recording only. No wallet is ever
 * connected with a real key and no transaction is sent — see Task 3 note
 * in the register segment below.
 */
const REGISTER_DEMO = {
  label: 'midnight-courier.eth',
  heartbeatSigner:   '0x23c477fceb91a154181ea6b4d56ae15d31a03cd0',
  trustee:           '0xc017d471a601c79b5bbce8c3ef503c885d50ccb7',
  recoveryAuthority: '0xe8c0d010b924b39fef1b66d94be4dae30662ad61',
  treasury:          '0x949c5eba449b5168e8a7af9ab1ff1528831d57d9',
  estate:            '0xbedd0f7e44b3eaf96c22c8cbd7383ef10fc447a8',
  heartbeatInterval: '7200',
  gracePeriod: '3600',
};

const browser = await chromium.launch({
  executablePath: '/opt/google/chrome/chrome',
  args: ['--no-sandbox','--disable-dev-shm-usage','--force-device-scale-factor=1','--hide-scrollbars','--disable-gpu'],
});
const ctx = await browser.newContext({
  viewport: { width: 1920, height: 1080 },
  recordVideo: { dir: 'out-v2', size: { width: 1920, height: 1080 } },
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
  await next(1); mark(MARK.lapse, 'step 07 — THE DEFLECTION  ** peak, longest hold **'); await hold(MARK.flip);
  await next(1); mark(MARK.flip, 'step 08 — liquidation + flatline'); await hold(MARK.liq);
  await next(1); mark(MARK.liq, 'step 09 — executePlan pours'); await hold(MARK.pour);
  await next(1); mark(MARK.pour, 'step 10 — resolved'); await hold(MARK.resolved);

  mark(MARK.resolved, '/vitals — the live agent, still beating');
  await page.goto(DASH + '/vitals', { waitUntil: 'domcontentloaded', timeout: 120000 });
  await hold(MARK.vitals);

  // The async round is where most prizes are decided, and most of those judges
  // only watch the video. Ending on "look what we built" wastes the fact that
  // anyone can drive this; ending on the form makes it an invitation. Unlike
  // record-final.mjs, this cut doesn't just park on the page — it fills the
  // form live so a viewer actually sees registration happen.
  mark(MARK.vitals, '/register — filling the form live');
  await page.goto(DASH + '/register', { waitUntil: 'domcontentloaded', timeout: 120000 });
  await sleep(2200);
  await page.evaluate(() => window.scrollTo({ top: 0 }));

  // --- Fill the /register form on camera --------------------------------
  // IMPORTANT: this segment never connects a real wallet, never clicks
  // REGISTER AGENT or LOCK PLAN, and never sends a transaction. It only
  // types into the form fields to demonstrate what registration looks
  // like. A minimal fake window.ethereum is injected purely so the page's
  // own connect() flow (which requires window.ethereum to exist) advances
  // past the "CONNECT WALLET" gate and reveals the input fields — it
  // answers eth_requestAccounts / eth_chainId only, and implements no
  // write/send method, so no signature and no transaction are possible.
  await page.evaluate(() => {
    window.ethereum = {
      isMetaMask: true,
      async request({ method }) {
        if (method === 'eth_requestAccounts') return ['0xDEC0DE0000000000000000000000000000CAFE'];
        if (method === 'eth_chainId') return '0xaa36a7';
        if (method === 'wallet_switchEthereumChain') return null;
        throw new Error(`record-v2 fake wallet: refusing to handle "${method}"`);
      },
      on() {},
      removeListener() {},
    };
  });

  const connectBtn = page.locator('button:has-text("CONNECT WALLET")');
  if (await connectBtn.count()) {
    await connectBtn.click();
    await sleep(600);
  }

  // Type each field with a human-ish delay so the typing itself reads on
  // camera. Clear the wallet-connect prefill first (fill('') then type).
  const typeField = async (labelText, value) => {
    const input = page.locator('label', { hasText: labelText }).locator('input');
    if (!(await input.count())) return;
    await input.scrollIntoViewIfNeeded();
    await input.fill('');
    await input.type(value, { delay: 40 });
    await sleep(250);
  };

  await typeField('Agent label', REGISTER_DEMO.label);
  await typeField('Heartbeat signer', REGISTER_DEMO.heartbeatSigner);
  await typeField('Trustee', REGISTER_DEMO.trustee);
  await typeField('Recovery authority', REGISTER_DEMO.recoveryAuthority);
  await typeField('Treasury', REGISTER_DEMO.treasury);
  await typeField('Estate', REGISTER_DEMO.estate);

  // Scroll down so the interval/grace row and the (non-clicked) submit
  // button are in frame for the remaining hold.
  await page.evaluate(() => window.scrollBy({ top: 240, behavior: 'smooth' }));
  await sleep(400);
  await typeField('Heartbeat interval', REGISTER_DEMO.heartbeatInterval);
  await typeField('Grace period', REGISTER_DEMO.gracePeriod);

  // Deliberately stop here: no click on [ REGISTER AGENT ], no tx.
  //
  // Hold to MARK.end, not MARK.register: the typing itself eats most of the
  // 142->158 window (six 42-char addresses at 40ms/char), so ending at
  // MARK.register would cut the moment the last field finished and leave no
  // frame of the completed form. The closing narration plays over that dwell.
  mark(MARK.register, 'form filled — dwell on the completed plan');
  await hold(MARK.end);
  mark(MARK.end, 'end');
} finally {
  await page.close().catch(()=>{});
  await ctx.close().catch(()=>{});
  await browser.close().catch(()=>{});
}
console.log('written to out-v2/');
