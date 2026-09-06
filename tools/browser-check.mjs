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

// ------------------------------------------- big numbers, and a milestone card
{
  const page = await newPage();
  await page.click('text=Start in the cupboard');
  const bad = await page.evaluate(async () => {
    const { fmt } = await import('/src/util.js');
    const out = [];
    // Rounding must promote to the next suffix rather than print "1000K".
    for (let e = 0; e < 30; e++) {
      for (const m of [0.9994, 0.9995, 0.9999, 1, 1.5, 9.999]) {
        const v = m * Math.pow(10, e + 3);
        const t = fmt(v);
        if (/^\d{4}/.test(t) || /^1000/.test(t)) out.push(v.toExponential(3) + ' -> ' + t);
      }
    }
    if (fmt(400) !== '400') out.push('400 -> ' + fmt(400));
    if (fmt(0) !== '0') out.push('0 -> ' + fmt(0));
    return out;
  });
  if (!bad.length) pass('numbers never overflow their suffix');
  else fail('numbers never overflow their suffix', bad.slice(0, 3).join(', '));

  // Moving up a site shows a card, and the card clears itself.
  await page.evaluate(async () => {
    const app = window.__rr;
    const A = await import('/src/actions.js');
    const sim = await import('/src/sim.js');
    app.state.tutorial.skipped = true;
    app.state.money = 1e9; app.state.reputation = 40;
    app.d = sim.derive(app.state);
    A.upgradeFacility(app.state, app.hooks);
  });
  await page.waitForTimeout(400);
  const shown = await page.evaluate(() => {
    const b = document.getElementById('banner');
    return { hidden: b.hidden, has: /Back office/.test(b.textContent),
      clicks: getComputedStyle(b).pointerEvents };
  });
  await page.waitForTimeout(3400);
  const gone = await page.evaluate(() => document.getElementById('banner').hidden);
  if (!shown.hidden && shown.has && shown.clicks === 'none' && gone) {
    pass('a new site announces itself, then gets out of the way');
  } else {
    fail('a new site announces itself, then gets out of the way', JSON.stringify({ ...shown, gone }));
  }
  await page.close();
}

// --------------------------------------------- the objective chain cannot jam
{
  const page = await newPage();
  await page.click('text=Start in the cupboard');
  const r = await page.evaluate(async () => {
    const app = window.__rr;
    const sim = await import('/src/sim.js');
    const P = await import('/src/data/progression.js');
    const R = await import('/src/data/research.js');
    const s = app.state;
    s.tutorial.skipped = true;
    // Everything a late run has, except the one machine an early objective
    // names — the case that used to strand the rest of the list forever.
    s.facility = 9;
    s.money = 1e21;
    s.research.done = R.RESEARCH.map((x) => x.id);
    const before = s.objectives.done.length;
    for (let i = 0; i < 400; i++) {
      app.d = sim.derive(s);
      sim.checkObjectives(s, app.d, { log() {} });
    }
    const done = s.objectives.done;
    return {
      before,
      after: done.length,
      total: P.OBJECTIVES.length,
      // The chain must have moved past the machine-specific ones it skipped.
      pastFission: done.includes('o27'),
      pastQuantum: done.includes('o29'),
      tree: done.includes('o35'),
      // The last one is a real grind and must NOT be handed out.
      town: done.includes('o36'),
      smr: app.d.counts.smr || 0,
    };
  });
  if (r.after === r.total - 1 && r.pastFission && r.pastQuantum && r.tree && !r.town && r.smr === 0) {
    pass('the objective chain cannot dead-end', r.after + '/' + r.total + ' without an SMR');
  } else {
    fail('the objective chain cannot dead-end', JSON.stringify(r));
  }
  await page.close();
}

// ------------------------------------------- the screen never shifts under you
{
  const page = await newPage();
  await page.click('text=Start in the cupboard');
  await page.evaluate(async () => {
    const app = window.__rr;
    const A = await import('/src/actions.js');
    const sim = await import('/src/sim.js');
    const R = await import('/src/data/research.js');
    const s = app.state;
    s.tutorial.skipped = true; s.money = 5e8; s.rp = 5000; s.gridPower = 20000;
    for (const r of R.RESEARCH.slice(0, 20)) s.research.done.push(r.id);
    app.d = sim.derive(s);
    for (let x = 0; x < 6; x++) { A.place(s, app.d, x, 1, 'rack', null); app.d = sim.derive(s); }
    A.fillAll(s, app.d, 'server', null);
    app.d = sim.derive(s);
    s.settings.speed = 5;
  });
  // Watch every box that frames the floor across a few hundred frames. Numbers
  // growing a digit, the to-do list changing length and the objective text
  // rewrapping must not move any of them.
  const moved = await page.evaluate(() => new Promise((res) => {
    const ids = ['topbar', 'logbar', 'objective', 'main', 'floor', 'panel', 'canvaswrap', 'inspector'];
    const seen = {};
    for (const id of ids) seen[id] = new Set();
    let n = 0;
    const step = () => {
      for (const id of ids) {
        const e = document.getElementById(id);
        if (!e) continue;
        const r = e.getBoundingClientRect();
        seen[id].add(Math.round(r.height) + '@' + Math.round(r.top));
      }
      if (++n < 240) requestAnimationFrame(step);
      else res(ids.filter((id) => seen[id].size > 1)
        .map((id) => id + ' ' + [...seen[id]].join('/')));
    };
    requestAnimationFrame(step);
  }));
  if (!moved.length) pass('the layout never shifts while the numbers grow');
  else fail('the layout never shifts while the numbers grow', moved.slice(0, 3).join(' | '));
  await page.close();
}

// ------------------------------------------------------ debt is real, and paid
{
  const page = await newPage();
  await page.click('text=Start in the cupboard');
  const r = await page.evaluate(async () => {
    const app = window.__rr;
    const A = await import('/src/actions.js');
    const sim = await import('/src/sim.js');
    const s = app.state;
    s.tutorial.skipped = true;
    s.objectives.done = new Array(40).fill('x');   // no reward cascade in here
    app.d = sim.derive(s);

    const out = { startLimit: Math.round(app.d.creditLimit) };
    // A loan is capped by the credit line, not by what you ask for.
    sim.borrow(s, app.d, 1e12, { log() {} });
    out.borrowed = Math.round(s.bank.debt);
    out.cappedAtLimit = Math.abs(s.bank.debt - app.d.creditLimit) < 1;

    // Interest accrues, and shows up as a cost the ledger can see.
    app.d = sim.derive(s);
    out.interestIsACost = app.d.interestCost > 0;
    const before = s.bank.debt;
    for (let i = 0; i < 40; i++) { sim.tick(s, 0.2, app.d); app.d = sim.derive(s); }
    out.interestAccrues = s.bank.debt > before;

    // A site that cannot pay builds debt rather than having it forgiven.
    s.money = 50_000; s.bank.debt = 0; s.staff.tech = 4; s.gridPower = 400;
    app.d = sim.derive(s);
    out.built = A.place(s, app.d, 0, 0, 'pdu', null) === null
      && A.place(s, app.d, 1, 0, 'rack', null) === null;
    app.d = sim.derive(s);
    s.money = 100;                 // now take the cash away and let it bleed
    for (let i = 0; i < 600; i++) { sim.tick(s, 0.2, app.d); app.d = sim.derive(s); }
    out.cashNeverNegative = s.money >= 0;
    out.debtBuilt = s.bank.debt > 0;

    // Run it into the ground: past the limit, buying stops.
    for (let i = 0; i < 4000 && !app.d.insolvent; i++) { sim.tick(s, 0.2, app.d); app.d = sim.derive(s); }
    out.insolvent = !!app.d.insolvent;
    out.buyBlocked = /credit is stopped/i.test(A.place(s, app.d, 3, 0, 'rack', null) || '');
    out.sellStillWorks = A.sell(s, app.d, 1, 0, { log() {} }) === null;

    // Paying it off from cash clears it.
    s.money = s.bank.debt * 2;
    sim.repay(s, s.bank.debt, { log() {} });
    out.repaid = s.bank.debt === 0;
    return out;
  });
  const ok = r.startLimit === 9000 && r.cappedAtLimit && r.interestIsACost && r.interestAccrues
    && r.built
    && r.cashNeverNegative && r.debtBuilt && r.insolvent && r.buyBlocked && r.sellStillWorks
    && r.repaid;
  if (ok) pass('debt is real, and the bank stops lending', 'limit ' + r.startLimit);
  else fail('debt is real, and the bank stops lending', JSON.stringify(r));
  await page.close();
}

// --------------------------------------------- events only fire when they fit
{
  const page = await newPage();
  await page.click('text=Start in the cupboard');
  const r = await page.evaluate(async () => {
    const sim = await import('/src/sim.js');
    const E = await import('/src/data/events.js');
    const s = window.__rr.state;
    s.tutorial.skipped = true;
    s.facility = 9;                 // tier gate wide open
    s.staff = { tech: 0, eng: 0, sales: 0, ops: 0 };
    const d = sim.derive(s);        // an empty site: no machines, no staff
    const wouldFire = E.EVENTS.filter((e) => {
      if ((e.minTier || 0) > s.facility) return false;
      try { return !e.when || !!e.when(s, d); } catch (err) { return false; }
    }).map((e) => e.id);
    return { wouldFire, total: E.EVENTS.length, guarded: E.EVENTS.filter((e) => e.when).length };
  });
  // Nobody poaches staff you never hired, and nothing can break on an empty floor.
  if (!r.wouldFire.length && r.guarded === r.total) {
    pass('no event fires on a site it makes no sense for', r.guarded + ' guarded');
  } else {
    fail('no event fires on a site it makes no sense for', JSON.stringify(r));
  }
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
