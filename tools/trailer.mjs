// Records a ~10 second trailer by driving the real game in a real browser.
// Everything on screen is the game's own renderer and the game's own UI; what
// a trailer adds is pace — an hour of a run in ten seconds.
//
//   node tools/trailer.mjs <url> <outdir>
//
// The setup is done behind a black cover so it can be trimmed off precisely
// afterwards: ffmpeg's blackdetect finds the exact frame the cover lifts.
const { chromium } = await import(process.env.RR_PLAYWRIGHT || 'playwright');
const URL = process.argv[2] || 'http://127.0.0.1:8099/index.html';
const OUT = process.argv[3] || '.';

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  recordVideo: { dir: OUT, size: { width: 1280, height: 720 } },
  deviceScaleFactor: 1,
});

// Black from the first recorded frame, before anything has even loaded.
await ctx.addInitScript(() => {
  const paint = () => {
    if (document.getElementById('__cover')) return;
    const c = document.createElement('div');
    c.id = '__cover';
    c.style.cssText = 'position:fixed;inset:0;background:#000;z-index:99999';
    (document.body || document.documentElement).append(c);
  };
  if (document.body) paint();
  else document.addEventListener('DOMContentLoaded', paint);
});

const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));

await page.goto(URL, { waitUntil: 'networkidle' });
await page.evaluate(() => document.querySelector('#boot button')?.click());
await page.waitForTimeout(900);

await page.evaluate(async () => {
  const R = await import('/src/data/research.js');
  window.__rrResearchIds = R.RESEARCH.map((r) => r.id);
  const s = window.__rr.state;
  s.tutorial.skipped = true;
  s.tutorial.step = 99;
  document.getElementById('tutorial')?.setAttribute('hidden', '');
  s.money = 1e14;
  s.reputation = 500;
  // Unlock the tech tree so the halls can be filled with something better than
  // salvaged desktops. Without this the racks stay empty and the top bar reads
  // COMPUTE 0 over a full hall.
  s.research.done = window.__rrResearchIds || s.research.done;
  s.settings.speed = 1;
  window.__rr.view.centred = false;            // let the camera fit the room
});
await page.waitForTimeout(600);

const shown = await page.evaluate(async () => {
  const A = await import('/src/actions.js');
  const sim = await import('/src/sim.js');
  const St = await import('/src/state.js');
  const app = window.__rr;
  const s = app.state;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const redraw = () => { app.d = sim.derive(s); };
  const banner = document.getElementById('banner');
  const tut = document.getElementById('tutorial');

  // Milestone cards are good writing, but during the build they are clutter.
  // They come back for the town, which is what they are best at.
  banner.style.display = 'none';
  if (tut) tut.style.display = 'none';

  // ---- caption layer, over the floor rather than the log bar -------------
  const wrap = document.getElementById('canvaswrap');
  const cap = document.createElement('div');
  cap.style.cssText = [
    'position:absolute', 'left:0', 'right:0', 'top:0', 'z-index:9000',
    'padding:22px 30px 40px', 'pointer-events:none',
    'font:600 33px/1.25 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif',
    'color:#f6efe2', 'letter-spacing:-.3px',
    'text-shadow:0 2px 20px rgba(0,0,0,.98),0 1px 4px rgba(0,0,0,.95)',
    'background:linear-gradient(180deg,rgba(8,7,6,.72),transparent)',
    'opacity:0', 'transition:opacity .3s ease',
  ].join(';');
  wrap.append(cap);
  const say = (t) => { cap.textContent = t; cap.style.opacity = '1'; };
  const hush = () => { cap.style.opacity = '0'; };

  // Hold the clock at the twilight where the skyline reads best. Sweeping
  // five times of day and looking at them side by side, this one gives a crisp
  // silhouette against a lit sky; the later, prettier ones have lamps in the
  // windows but almost no contrast, and contrast is what survives two seconds
  // on a phone.
  const DAY = 3.64;
  (function hold() { s.day = DAY; requestAnimationFrame(hold); })();

  const cover = document.getElementById('__cover');

  // A cupboard with a couple of things in it reads better than a bare grid.
  A.place(s, app.d, 2, 2, 'rack', app.hooks);
  A.place(s, app.d, 3, 2, 'pdu', app.hooks);
  redraw();
  s.money = 9_400;                               // a believable opening balance
  await sleep(400);

  // ---- action ------------------------------------------------------------
  cover.remove();                                // <- the trim point
  await sleep(120);

  say('It starts in a broom cupboard.');
  await sleep(1250);
  hush();
  await sleep(200);

  // ---- beat 2: fill the cupboard -----------------------------------------
  // Enough to fill a cupboard and no more, so the cash readout falls as it is
  // spent instead of sitting on a number no run would ever show.
  s.money = 96_000;
  const room = St.roomOf(s);
  let i = 0;
  for (let x = 0; x < room.w; x++) for (let y = 0; y < room.h; y++, i++) {
    const id = i % 6 === 0 ? 'pdu2' : i % 5 === 0 ? 'crac' : 'rack2';
    A.place(s, app.d, x, y, id, app.hooks);
    if (i % 2 === 0) { redraw(); await sleep(46); }
  }
  redraw();
  A.buyGrid(s, A.maxGrid(s), app.hooks); redraw();
  A.fillAll(s, app.d, 'pizza', app.hooks); redraw();
  s.money = 38_600;
  await sleep(330);

  // ---- beat 3: it does not stay a cupboard -------------------------------
  say('Then it stops being a cupboard.');
  // Each hall is built in one synchronous burst. Nothing is awaited inside it,
  // so no frame can be drawn while the balance is temporarily set to a figure
  // that would give the game away — an earlier cut flashed $96.1T for two
  // frames between a $34.9K cupboard and a $41.8K one.
  const cash = [2_140_000, 68_400_000, 1_940_000_000];
  for (const [n, target] of [[0, 2], [1, 4], [2, 6]]) {
    s.money = 1e14;
    while (s.facility < target && !A.upgradeFacility(s, app.hooks)) {}
    const f = St.roomOf(s);
    redraw();
    for (let x = 0; x < f.w; x++) for (let y = 0; y < f.h; y++) {
      const id = (x + y) % 6 === 0 ? 'pdu3' : (x + y) % 5 === 0 ? 'crac' : 'rack3';
      A.place(s, app.d, x, y, id, app.hooks);
    }
    redraw();
    A.buyGrid(s, A.maxGrid(s), app.hooks); redraw();
    A.fillAll(s, app.d, 'gpu4', app.hooks); redraw();
    sim.tick(s, 0.2, app.d, app.hooks);
    s.money = cash[n];
    app.view.centred = false;
    redraw();
    await sleep(520);
  }
  hush();
  await sleep(200);

  // ---- beat 4: the bill --------------------------------------------------
  // The town's state follows the size of the site, so a real run arrives
  // here. The trailer walks it up in two seconds instead of an hour.
  say('The town next door pays for it.');
  const from = s.town.damage, to = 1.0, span = 1800;
  const t0 = performance.now();
  await new Promise((done) => {
    const step = () => {
      const k = Math.min(1, (performance.now() - t0) / span);
      s.town.damage = from + (to - from) * (k * k * (3 - 2 * k));
      if (k < 1) requestAnimationFrame(step); else done();
    };
    requestAnimationFrame(step);
  });

  // One card, at the end, saying where the town actually got to. An earlier
  // cut left the banner on through the whole ramp, where it sat on "25% gone"
  // for two seconds while the place fell to nothing behind it — the damage was
  // being set directly, so tickTown never ran and never issued a new one.
  const { STAGES, stageOf } = await import('/src/town.js');
  const st = STAGES[stageOf(s.town.damage)];
  banner.style.display = '';
  app.hooks.onMilestone?.('Ashbrook \u00b7 ' + Math.round(st.at * 100) + '% gone',
    st.title, st.line);
  await sleep(1250);
  hush();
  await sleep(120);

  // ---- beat 5: the card --------------------------------------------------
  const card = document.createElement('div');
  card.style.cssText = [
    'position:fixed', 'inset:0', 'z-index:9500', 'display:grid',
    'place-items:center', 'background:rgba(8,7,6,.86)',
    'opacity:0', 'transition:opacity .35s ease', 'pointer-events:none',
  ].join(';');
  card.innerHTML =
    '<div style="text-align:center">'
    + '<div style="font:700 76px/1 system-ui,-apple-system,sans-serif;letter-spacing:-2px;'
    + 'color:#f6efe2;text-shadow:0 4px 30px rgba(0,0,0,.9)">'
    + 'Clouter<span style="color:#f2a83c">X</span></div>'
    + '<div style="font:500 27px/1.5 system-ui,sans-serif;color:#cdc2b2;margin-top:14px;'
    + 'letter-spacing:.2px">clouterx.com</div></div>';
  document.body.append(card);
  requestAnimationFrame(() => { card.style.opacity = '1'; });
  await sleep(1000);

  return { compute: app.d.computeTotal, units: app.d.unitsTotal,
           damage: +s.town.damage.toFixed(2), facility: St.roomOf(s).name };
});

const path = await page.video().path();
await ctx.close();
await browser.close();
console.log('on screen at the end: ' + JSON.stringify(shown));
console.log(errors.length ? 'PAGE ERRORS: ' + errors.join(' | ') : 'no page errors');
console.log('raw: ' + path);
