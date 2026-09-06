// End-to-end check in a real browser. Needs Playwright and a static server:
//
//   python3 -m http.server 8099 &
//   node tools/browser-check.mjs
//
// Exits non-zero on any page error or failed expectation.

// Playwright is not a dependency of the game; point RR_PLAYWRIGHT at a global
// install if `import 'playwright'` cannot find it, and RR_CHROMIUM at a browser
// binary if the bundled download is not where Playwright expects it.
const { chromium } = await import(process.env.RR_PLAYWRIGHT || 'playwright');

const URL = process.env.RR_URL || 'http://127.0.0.1:8099/index.html';
const LAUNCH = process.env.RR_CHROMIUM ? { executablePath: process.env.RR_CHROMIUM } : {};
const results = [];
const fail = (name, detail) => results.push({ name, ok: false, detail });
const pass = (name, detail) => results.push({ name, ok: true, detail });

const browser = await chromium.launch(LAUNCH);
const errors = [];

async function newPage(width = 1500, height = 940) {
  const page = await browser.newPage({ viewport: { width, height } });
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(URL, { waitUntil: 'networkidle' });
  return page;
}

const tileAt = (page, gx, gy) => page.evaluate(
  ([gx, gy]) => window.__rr.view.tileCentre(gx, gy), [gx, gy]);

async function clickTile(page, gx, gy) {
  const p = await tileAt(page, gx, gy);
  await page.mouse.click(p.x, p.y);
  await page.waitForTimeout(300);
}

// ---------------------------------------------------------- the guided start
{
  const page = await newPage();
  await page.click('text=Start in the cupboard');
  await page.waitForTimeout(500);
  const seen = [];
  const step = () => page.evaluate(() => ({
    n: window.__rr.state.tutorial.step,
    aimed: [...document.querySelectorAll('.tut-target')].map((x) => x.dataset.build || x.dataset.fill || x.dataset.sign || x.id),
  }));

  seen.push(await step());
  await page.click('[data-build="pdu"]');
  await clickTile(page, 2, 2);
  seen.push(await step());
  await page.click('[data-build="rack"]');
  await clickTile(page, 3, 2);
  seen.push(await step());
  await page.click('[data-build="fan"]');
  await clickTile(page, 3, 3);
  seen.push(await step());
  await page.click('[data-fill="desktop"]');
  await page.waitForTimeout(900);
  seen.push(await step());
  const signable = await page.locator('[data-sign]').count();
  if (signable) await page.locator('[data-sign]').first().click();
  await page.waitForTimeout(900);
  const done = await page.evaluate(() => window.__rr.state.tutorial.step);
  const heat = await page.evaluate(() => window.__rr.d.maxTemp);

  if (done === 5) pass('guide completes in five steps');
  else fail('guide completes in five steps', 'stopped at step ' + done);
  if (seen.every((s, i) => s.n === i && s.aimed.length > 0)) pass('every step rings a control');
  else fail('every step rings a control', JSON.stringify(seen));
  if (heat < 40) pass('guide never cooks the first rack', heat.toFixed(1) + ' °C');
  else fail('guide never cooks the first rack', heat.toFixed(1) + ' °C');
  await page.close();
}

// ------------------------------------------------------------- every surface
{
  const page = await newPage();
  await page.click('text=Start in the cupboard');
  await page.evaluate(() => { window.__rr.state.tutorial.skipped = true; });
  await page.waitForTimeout(300);
  const tabs = await page.$$('#tabs .tab');
  for (const t of tabs) { await t.click(); await page.waitForTimeout(180); }
  for (const label of ['Power', 'Cooling', 'Heat', 'Network', 'No overlay']) {
    await page.click(`#floortools >> text=${label}`);
    await page.waitForTimeout(120);
  }
  await page.click('text=Guide');
  await page.waitForTimeout(300);
  const guideOpen = await page.locator('.sheet h2').count();
  if (guideOpen) pass('every tab, overlay and the guide open cleanly');
  else fail('every tab, overlay and the guide open cleanly', 'guide did not open');
  await page.close();
}

// ------------------------------------------------------ dragging a whole row
{
  const page = await newPage();
  await page.click('text=Start in the cupboard');
  await page.evaluate(() => {
    window.__rr.state.money = 500000;
    window.__rr.state.tutorial.skipped = true;
  });
  await page.waitForTimeout(300);
  await page.click('#tabs .tab >> nth=0');
  await page.waitForTimeout(250);
  await page.click('#tabbody .btn:has-text("Compute")');
  await page.waitForTimeout(250);
  await page.click('[data-build="rack"]');
  const a = await tileAt(page, 1, 1);
  const b = await tileAt(page, 5, 1);
  // Rows run diagonally on an isometric floor, so the sweep follows the line
  // between the two tile centres rather than a straight screen row.
  const sweep = async () => {
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    for (let i = 0; i <= 16; i++) {
      await page.mouse.move(a.x + (b.x - a.x) * i / 16, a.y + (b.y - a.y) * i / 16);
      await page.waitForTimeout(25);
    }
    await page.mouse.up();
    await page.waitForTimeout(400);
  };
  await sweep();
  const built = await page.evaluate(() => window.__rr.d.racks.length);
  await page.click('#floortools >> text=Demolish');
  await sweep();
  const left = await page.evaluate(() => window.__rr.d.racks.length);
  if (built >= 4 && left === 0) pass('drag places and demolishes a row', built + ' placed, ' + left + ' left');
  else fail('drag places and demolishes a row', built + ' placed, ' + left + ' left');
  await page.close();
}

// ------------------------------------------- a full site, drawn and persisted
{
  const page = await newPage();
  await page.click('text=Start in the cupboard');
  await page.evaluate(async () => {
    const app = window.__rr;
    const A = await import('/src/actions.js');
    const sim = await import('/src/sim.js');
    const R = await import('/src/data/research.js');
    const s = app.state;
    s.tutorial.skipped = true;
    s.facility = 9; s.money = 1e30; s.gridPower = 6e6;
    for (const r of R.RESEARCH) s.research.done.push(r.id);
    app.d = sim.derive(s);
    let n = 0;
    for (let y = 0; y < 20; y++) for (let x = 0; x < 33; x++) {
      const id = (x % 5 === 4)
        ? (y % 4 === 0 ? 'pdu5' : y % 4 === 1 ? 'cryo' : y % 4 === 2 ? 'switch4' : 'fusion')
        : 'rack5';
      A.place(s, app.d, x, y, id, null);
      if (++n % 60 === 0) app.d = sim.derive(s);
    }
    app.d = sim.derive(s);
    A.fillAll(s, app.d, 'zetta', null);
    app.d = sim.derive(s);
    app.view.centred = false;
  });
  await page.waitForTimeout(1500);
  const fps = await page.evaluate(() => new Promise((res) => {
    let f = 0; const t0 = performance.now();
    const loop = () => { f++; performance.now() - t0 < 3000 ? requestAnimationFrame(loop) : res(f / ((performance.now() - t0) / 1000)); };
    requestAnimationFrame(loop);
  }));
  const rt = await page.evaluate(async () => {
    const S = await import('/src/state.js');
    S.save(window.__rr.state);
    const back = S.load();
    return { tiles: Object.keys(back.tiles || {}).length, facility: back.facility };
  });
  if (fps > 30) pass('endgame floor stays interactive', fps.toFixed(0) + ' fps');
  else fail('endgame floor stays interactive', fps.toFixed(0) + ' fps');
  if (rt.tiles === 660 && rt.facility === 9) pass('save round trip', rt.tiles + ' tiles');
  else fail('save round trip', JSON.stringify(rt));
  await page.close();
}

// ------------------------------------ the canvas keeps up with its own layout
{
  const page = await newPage();
  await page.click('text=Start in the cupboard');
  await page.evaluate(() => { window.__rr.state.tutorial.skipped = true; });
  await page.waitForTimeout(600);
  const measure = () => page.evaluate(() => {
    const v = window.__rr.view;
    const c = document.getElementById('view');
    const r = c.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    return {
      drift: Math.abs(v.w - r.width) + Math.abs(v.h - r.height),
      buffer: Math.abs(c.width - Math.round(r.width * dpr)) + Math.abs(c.height - Math.round(r.height * dpr)),
    };
  });
  const before = await measure();
  // Fill the floor enough to make the to-do list, and so the layout, change.
  await page.evaluate(async () => {
    const app = window.__rr;
    const A = await import('/src/actions.js');
    const sim = await import('/src/sim.js');
    const s = app.state;
    s.money = 1e7; s.rp = 400;
    A.buyResearch(s, 'rnd_rails', { log() {} });
    app.d = sim.derive(s);
    for (let x = 0; x < 5; x++) { A.place(s, app.d, x, 1, 'rack', null); app.d = sim.derive(s); }
    A.fillAll(s, app.d, 'desktop', null);
    app.d = sim.derive(s);
  });
  await page.waitForTimeout(800);
  const after = await measure();
  if (before.drift < 1 && before.buffer < 2 && after.drift < 1 && after.buffer < 2) {
    pass('canvas buffer tracks its CSS box');
  } else {
    fail('canvas buffer tracks its CSS box', JSON.stringify({ before, after }));
  }

  // And the pointer lands where the cursor is, in every rotation.
  await page.evaluate(() => { window.__rr.view.tool = 'rack'; });
  const off = [];
  for (let r = 0; r < 4; r++) {
    for (const [gx, gy] of [[1, 1], [3, 2], [0, 3]]) {
      const p = await tileAt(page, gx, gy);
      await page.mouse.move(p.x, p.y);
      await page.waitForTimeout(40);
      const h = await page.evaluate(() => window.__rr.view.hover);
      if (!h || h.x !== gx || h.y !== gy) off.push(`rot${r} ${gx},${gy}->${h && h.x},${h && h.y}`);
    }
    await page.evaluate(() => window.__rr.view.turn(1));
    await page.waitForTimeout(250);
  }
  if (!off.length) pass('cursor picks the tile under it, in all four rotations');
  else fail('cursor picks the tile under it, in all four rotations', off.join(' '));
  await page.close();
}

// ------------------------------------------------------------ speed control
{
  const page = await newPage();
  await page.click('text=Start in the cupboard');
  await page.evaluate(() => { window.__rr.state.tutorial.skipped = true; });
  await page.waitForTimeout(400);
  const dayAfter = async (label, ms) => {
    await page.click(`.sp:has-text("${label}")`);
    const a = await page.evaluate(() => window.__rr.state.day);
    await page.waitForTimeout(ms);
    const b = await page.evaluate(() => window.__rr.state.day);
    return b - a;
  };
  const one = await dayAfter('1×', 1500);
  const ten = await dayAfter('10×', 1500);
  const ratio = one > 0 ? ten / one : 0;
  if (ratio > 6 && ratio < 14) pass('speed control multiplies the clock', ratio.toFixed(1) + '× measured');
  else fail('speed control multiplies the clock', `1x=${one.toFixed(3)} 10x=${ten.toFixed(3)}`);
  await page.click(`.sp:has-text("Pause")`).catch(() => {});
  await page.waitForTimeout(300);
  const stopped = await page.evaluate(async () => {
    const a = window.__rr.state.day;
    await new Promise((r) => setTimeout(r, 500));
    return Math.abs(window.__rr.state.day - a) < 1e-6;
  });
  if (stopped) pass('pause stops the clock');
  else fail('pause stops the clock');
  await page.close();
}

// ------------------------------------------------------------- narrow screen
for (const [w, h] of [[1024, 720], [520, 900]]) {
  const page = await newPage(w, h);
  await page.click('text=Start in the cupboard');
  await page.evaluate(() => { window.__rr.state.tutorial.skipped = true; });
  await page.waitForTimeout(500);
  const m = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
    canvas: Math.round(document.getElementById('canvaswrap').getBoundingClientRect().height),
  }));
  if (!m.overflow && m.canvas >= 200) pass(`layout holds at ${w}×${h}`, m.canvas + 'px of floor');
  else fail(`layout holds at ${w}×${h}`, JSON.stringify(m));
  await page.close();
}

await browser.close();

if (errors.length) fail('no page errors', errors.slice(0, 4).join(' | '));
else pass('no page errors');

let bad = 0;
for (const r of results) {
  if (!r.ok) bad++;
  console.log((r.ok ? '  ok  ' : ' FAIL ') + r.name + (r.detail ? '  — ' + r.detail : ''));
}
console.log(bad ? `\n${bad} of ${results.length} checks failed` : `\nall ${results.length} checks passed`);
process.exit(bad ? 1 : 0);
