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
  await page.evaluate(() => { window.__rr.state.settings.speed = 5; });
  const seen = [];
  const step = () => page.evaluate(() => ({
    n: window.__rr.state.tutorial.step,
    aimed: [...document.querySelectorAll('.tut-target')].map((x) => x.dataset.build || x.dataset.fill
      || x.dataset.sign || x.dataset.grid || x.dataset.research || x.dataset.hire
      || x.dataset.tab || x.id || x.tagName),
  }));

  // Walk it the way a player does: act on whatever the guide is ringing, and
  // let each step decide for itself when it is satisfied.
  const spots = [[2, 2], [3, 2], [3, 3]];
  let placed = 0;
  for (let guard = 0; guard < 30; guard++) {
    const st = await step();
    if (st.n >= 10) break;
    if (seen.length === st.n) seen.push(st);
    const target = await page.$('.tut-target');
    if (!target) { await page.waitForTimeout(600); continue; }
    const id = await page.evaluate((n) => n.id, target);
    const tag = await page.evaluate((n) => n.tagName, target);
    if (id === 'canvaswrap') {
      const spot = spots[Math.min(placed++, spots.length - 1)];
      await clickTile(page, spot[0], spot[1]);
    } else if (tag === 'INPUT') {
      // The R&D slider: nudge it, then let the points accrue.
      await page.evaluate((n) => { n.value = '40'; n.dispatchEvent(new Event('input')); }, target);
      await page.waitForTimeout(700);
    } else {
      await target.click().catch(() => {});
    }
    await page.waitForTimeout(800);
  }
  const done = await page.evaluate(() => window.__rr.state.tutorial.step);
  const heat = await page.evaluate(() => window.__rr.d.maxTemp);
  const covered = await page.evaluate(async () => {
    const s = window.__rr.state;
    return {
      grid: s.gridPower > 6.001,
      research: s.research.done.length > 0,
      tech: (s.staff.tech || 0) > 0,
      town: s.tutorial.sawTown === true,
      deal: s.contracts.active.length > 0,
    };
  });

  if (done === 10) pass('guide completes in ten steps');
  else fail('guide completes in ten steps', 'stopped at step ' + done);
  if (seen.length === 10 && seen.every((x, i) => x.n === i && x.aimed.length > 0)) {
    pass('every step rings a control');
  } else {
    fail('every step rings a control', JSON.stringify(seen.map((x) => x.n + ':' + x.aimed)));
  }
  // The whole point of the longer guide: nobody should finish it without
  // having bought power, researched something, hired somebody and seen the town.
  if (covered.grid && covered.research && covered.tech && covered.town && covered.deal) {
    pass('the guide covers power, research, staff, deals and the town');
  } else {
    fail('the guide covers power, research, staff, deals and the town', JSON.stringify(covered));
  }
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

// ------------------------------ objectives nudge, they do not fund the whole run
{
  const page = await newPage();
  await page.click('text=Start in the cupboard');
  const r = await page.evaluate(async () => {
    const sim = await import('/src/sim.js');
    const S = await import('/src/state.js');
    const P = await import('/src/data/progression.js');
    const s = S.newGame();
    const d = sim.derive(s);
    let cum = 0;
    const first13 = P.OBJECTIVES.slice(0, 13)
      .map((o, i) => { const c = sim.objectiveReward(o, d, i); cum += c; return Math.round(c); });
    // Rewards must never exceed what the table allows, either.
    const overCeiling = P.OBJECTIVES.some((o, i) =>
      sim.objectiveReward(o, d, i) > (o.reward?.money || 0) + 0.01);
    return { start: s.money, cumFirst13: Math.round(cum), first13, overCeiling };
  });
  // The first thirteen objectives arrive in the opening minutes. Paying their
  // table value handed the player $815,000 there, which drowned out every
  // contract in the game; a fresh site should still be counting thousands.
  const ok = r.start === 10_000 && r.cumFirst13 < 60_000 && !r.overCeiling;
  if (ok) pass('objectives nudge rather than fund the run', '$' + r.cumFirst13 + ' by objective 13');
  else fail('objectives nudge rather than fund the run', JSON.stringify(r));
  await page.close();
}

// --------------------------------------- overdrawn: no buying, and a way out
{
  const page = await newPage();
  await page.click('text=Start in the cupboard');
  const r = await page.evaluate(async () => {
    const app = window.__rr;
    const A = await import('/src/actions.js');
    const sim = await import('/src/sim.js');
    const R = await import('/src/data/research.js');
    const s = app.state;
    s.tutorial.skipped = true;
    s.objectives.done = new Array(40).fill('x');   // no reward cascade in here
    app.d = sim.derive(s);
    const out = { startLimit: Math.round(app.d.creditLimit) };

    // A loan you choose to take is capped by the credit line, not by the ask.
    sim.borrow(s, app.d, 1e12, { log() {} });
    out.cappedAtLimit = Math.abs(s.bank.debt - app.d.creditLimit) < 1;
    app.d = sim.derive(s);
    out.interestIsACost = app.d.interestCost > 0;

    // Build a site that only ever loses money.
    s.facility = 5; s.money = 4e6; s.gridPower = 20000; s.bank.debt = 0;
    for (const r2 of R.RESEARCH.slice(0, 40)) s.research.done.push(r2.id);
    app.d = sim.derive(s);
    for (let y = 0; y < 4; y++) for (let x = 0; x < 10; x++) {
      A.place(s, app.d, x, y, y === 3 ? 'crac' : 'rack3', null);
      app.d = sim.derive(s);
    }
    A.fillAll(s, app.d, 'gpu', null);
    s.staff.tech = 8; s.staff.eng = 4;
    s.money = 1000;
    app.d = sim.derive(s);

    // Sink it, declining every offer, and record where each one arrived.
    const offers = [];
    const hooks = { log() {}, onRescue: (o) => offers.push(Math.round(o.short)) };
    let blocked = null, sellWorked = null;
    for (let i = 0; i < 30000 && offers.length < 3; i++) {
      if (s.rescue) sim.declineRescue(s);
      sim.tick(s, 0.2, app.d, hooks);
      app.d = sim.derive(s);
      if (blocked === null && s.money < 0) {
        // Below zero nothing at all can be bought, but selling stays open.
        blocked = A.place(s, app.d, 0, 4, 'rack3', null);
        out.gridBlocked = !!A.buyGrid(s, 10, { log() {} });
        out.hireBlocked = !!A.hire(s, app.d, 'tech', { log() {} });
        out.installBlocked = !!A.install(s, app.d, s.tiles['0,0'], 'gpu', 1, { log() {} });
        sellWorked = A.sell(s, app.d, 9, 0, { log() {} }) === null;
      }
    }
    out.buyBlocked = /overdrawn/i.test(blocked || '');
    out.sellStillWorks = sellWorked === true;
    // The three offers land where the player was told they would.
    out.offers = offers;
    out.offersOnTarget = offers.length === 3
      && offers[0] >= 100_000 && offers[0] < 105_000
      && offers[1] >= 500_000 && offers[1] < 520_000
      && offers[2] >= 1_000_000 && offers[2] < 1_040_000;

    // Taking the terms clears the hole, leaves a float to trade out of, and
    // costs a multiple of it.
    s.rescue = { level: 0, short: -s.money, day: s.day, net: app.d.netIncome };
    const owedBefore = s.bank.debt;
    const hole = -s.money;
    sim.takeRescue(s, app.d, { log() {} });
    app.d = sim.derive(s);
    out.aboveWaterAfter = s.money > 0;
    out.costsAMultiple = (s.bank.debt - owedBefore) > hole * 2;
    out.termsRunning = s.events.active.some((e) => e.label === 'Rescue terms');
    out.canBuyAgain = A.place(s, app.d, 1, 4, 'rack', null) === null;
    return out;
  });
  const ok = r.startLimit === 9000 && r.cappedAtLimit && r.interestIsACost
    && r.buyBlocked && r.gridBlocked && r.hireBlocked && r.installBlocked && r.sellStillWorks
    && r.offersOnTarget && r.aboveWaterAfter && r.costsAMultiple && r.termsRunning && r.canBuyAgain;
  if (ok) pass('overdrawn stops all buying, and the bank offers a way out', r.offers.join(' / '));
  else fail('overdrawn stops all buying, and the bank offers a way out', JSON.stringify(r));
  await page.close();
}

// ------------------------------------- an overdrawn site can always be saved
{
  const page = await newPage();
  await page.click('text=Start in the cupboard');
  const r = await page.evaluate(async () => {
    const app = window.__rr;
    const sim = await import('/src/sim.js');
    const A = await import('/src/actions.js');
    const R = await import('/src/data/research.js');
    const s = app.state;
    s.tutorial.skipped = true;
    s.objectives.done = new Array(40).fill('x');
    s.money = 20_000; s.gridPower = 60;
    for (const r2 of R.RESEARCH.slice(0, 8)) s.research.done.push(r2.id);
    let d = sim.derive(s);
    A.place(s, d, 2, 2, 'pdu', null); d = sim.derive(s);
    for (let x = 0; x < 5; x++) { A.place(s, d, x, 1, 'rack', null); d = sim.derive(s); }
    A.place(s, d, 3, 3, 'fan', null); d = sim.derive(s);
    A.fillAll(s, d, 'desktop', null); d = sim.derive(s);
    s.staff.tech = 3;                      // over-hired, which is how it starts
    d = sim.derive(s);

    // Sink it well under.
    for (let i = 0; i < 6000 && s.money > -50_000; i++) {
      sim.tick(s, 0.2, d, { log() {}, onRescue() {} });
      d = sim.derive(s);
    }
    const low = Math.round(s.money);

    // Now do exactly what the game tells you to: let staff go, sell what you
    // cannot run. This has to be enough — a player who follows the advice and
    // still sinks for ever has been handed an unwinnable save.
    A.fire(s, 'tech', { log() {} }); A.fire(s, 'tech', { log() {} }); A.fire(s, 'tech', { log() {} });
    d = sim.derive(s);
    let sold = 0;
    for (const k of Object.keys(s.tiles)) {
      if (sold >= 3) break;
      if (!s.tiles[k].units) continue;
      const [x, y] = k.split(',').map(Number);
      if (!A.sell(s, d, x, y, { log() {} })) { sold++; d = sim.derive(s); }
    }
    let recovered = false, days = null;
    for (let i = 0; i < 90_000; i++) {
      sim.tick(s, 0.2, d, { log() {}, onRescue() {} });
      d = sim.derive(s);
      for (const o of [...s.contracts.offers]) sim.signContract(s, d, o, { log() {} });
      if (s.money > 0) { recovered = true; days = +(i * 0.2 / 60).toFixed(1); break; }
    }
    return { low, recovered, days, sold };
  });
  if (r.recovered && r.low <= -30_000) {
    pass('an overdrawn site can always be traded back', 'from $' + r.low + ' in ' + r.days + ' days');
  } else {
    fail('an overdrawn site can always be traded back', JSON.stringify(r));
  }
  await page.close();
}

// ------------------------------------------- the economy holds under any state
{
  const page = await newPage();
  await page.click('text=Start in the cupboard');
  const r = await page.evaluate(async () => {
    const sim = await import('/src/sim.js');
    const A = await import('/src/actions.js');
    const S = await import('/src/state.js');
    const B = await import('/src/data/buildings.js');
    const H = await import('/src/data/hardware.js');
    const R = await import('/src/data/research.js');
    const ids = B.BUILDINGS.map((x) => x.id);
    const hw = H.HARDWARE.map((x) => x.id);
    const bad = [];
    let ticks = 0;
    // Scattered sites at every tier, some solvent and some not, some carrying a
    // loan, run at four different step sizes including the long ones the
    // offline catch-up uses.
    for (let run = 0; run < 24 && !bad.length; run++) {
      const s = S.newGame();
      s.tutorial.skipped = true;
      s.facility = run % 10;
      s.money = [0, 1, 500, 1e5, 1e12][run % 5];
      s.gridPower = [6, 200, 5000, 1e6][run % 4];
      s.staff.tech = run % 7; s.staff.eng = run % 4;
      for (const r2 of R.RESEARCH.slice(0, (run * 11) % R.RESEARCH.length)) s.research.done.push(r2.id);
      let d = sim.derive(s);
      for (let k = 0; k < 20; k++) {
        A.place(s, d, (k * 7 + run) % 12, (k * 3 + run) % 8, ids[(k + run) % ids.length], null);
        d = sim.derive(s);
      }
      A.fillAll(s, d, hw[run % hw.length], null);
      d = sim.derive(s);
      if (run % 3 === 0) sim.borrow(s, d, 1e9, { log() {} });
      for (let i = 0; i < 150; i++) {
        sim.tick(s, [0.2, 1, 6, 20][i % 4], d);
        d = sim.derive(s);
        ticks++;
        // Cash may go below zero — that is the fail state — but never off the
        // rails, and the overdraft must stay answerable rather than runaway.
        if (!isFinite(s.money)) { bad.push(`run${run} cash ${s.money}`); break; }
        if (s.money < 0 && !d.overdrawn) { bad.push(`run${run} negative but not flagged`); break; }
        if (!isFinite(s.bank.debt) || s.bank.debt < 0) { bad.push(`run${run} debt ${s.bank.debt}`); break; }
        // Interest must never compound past the credit line, or an idle site
        // comes back to a number no amount of selling could clear.
        if (s.bank.debt > d.creditLimit + 1) {
          bad.push(`run${run} debt ${Math.round(s.bank.debt)} over line ${Math.round(d.creditLimit)}`);
          break;
        }
        if (!isFinite(d.netIncome)) { bad.push(`run${run} net not finite`); break; }
        if (!(s.reputation >= 0) || !isFinite(s.reputation)) { bad.push(`run${run} rep ${s.reputation}`); break; }
      }
    }
    return { bad: bad.slice(0, 3), ticks };
  });
  if (!r.bad.length) pass('cash and debt stay sane in every state', r.ticks + ' ticks');
  else fail('cash and debt stay sane in every state', r.bad.join(' | '));
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

// ------------------------------------------ the top bar never overlaps itself
{
  // The bar never wraps, so anything that does not fit prints on top of its
  // neighbour. Widths depend on the viewer's fonts, so this sweeps a range of
  // window sizes with the text deliberately stretched — which is what a
  // different system font does — and asks that the blocks stay disjoint.
  const bad = [];
  for (const stretch of [0, 1.4, 2.6]) {
    for (const w of [1920, 1600, 1440, 1380, 1340, 1200, 1050, 900, 700]) {
      const page = await newPage(w, 900);
      await page.addStyleTag({ content:
        `#topbar, #topbar * { letter-spacing: ${stretch}px !important; }` });
      await page.click('text=Start in the cupboard');
      await page.evaluate(() => {
        const s = window.__rr.state;
        s.tutorial.skipped = true; s.money = 1.234e21; s.rp = 987654; s.reputation = 4321;
      });
      await page.waitForTimeout(320);
      const r = await page.evaluate(() => {
        const boxes = [...document.querySelectorAll('.vital,.meters,.minis,.topright')]
          .filter((e) => e.offsetParent !== null)
          .map((e) => ({ cls: e.className, r: e.getBoundingClientRect() }));
        let hit = null;
        for (let i = 0; i < boxes.length - 1; i++) {
          if (boxes[i + 1].r.left < boxes[i].r.right - 1) hit = boxes[i].cls + ' / ' + boxes[i + 1].cls;
        }
        const tb = document.getElementById('topbar');
        const scrolls = getComputedStyle(tb).overflowX === 'auto';
        return { hit, clipped: tb.scrollWidth > tb.clientWidth + 2 && !scrolls };
      });
      if (r.hit || r.clipped) bad.push(`${w}px/ls${stretch}: ` + (r.hit || 'clipped'));
      await page.close();
    }
  }
  if (!bad.length) pass('the top bar never overlaps itself', '27 widths × font widths');
  else fail('the top bar never overlaps itself', bad.slice(0, 3).join(' | '));
}

// --------------------------------------------------- a phone gets a real layout
{
  for (const [name, w, h] of [['portrait', 390, 844], ['small', 375, 667]]) {
    // First: the guide card must not swallow the floor. At desktop widths it is
    // 62% wide, which on a phone is a narrow column that turns four lines of
    // text into twelve and leaves nothing to look at.
    {
      const page = await newPage(w, h);
      await page.click('text=Start in the cupboard');
      await page.waitForTimeout(600);
      const g = await page.evaluate(() => {
        const t = document.getElementById('tutorial');
        const c = document.getElementById('canvaswrap');
        if (!t || t.hidden) return null;
        return {
          card: Math.round(t.getBoundingClientRect().height),
          floor: Math.round(c.getBoundingClientRect().height),
        };
      });
      const share = g ? g.card / g.floor : 1;
      if (g && share <= 0.55) {
        pass(`the guide leaves room for the floor (${name})`, Math.round(share * 100) + '% of it');
      } else {
        fail(`the guide leaves room for the floor (${name})`, JSON.stringify(g));
      }
      await page.close();
    }

    const page = await newPage(w, h);
    await page.click('text=Start in the cupboard');
    await page.evaluate(() => { window.__rr.state.tutorial.skipped = true; });
    await page.waitForTimeout(400);
    const m = await page.evaluate(() => {
      const box = (id) => {
        const e = document.getElementById(id);
        if (!e || e.offsetParent === null) return 0;
        return Math.round(e.getBoundingClientRect().height);
      };
      const tb = document.getElementById('topbar');
      const btns = [...document.querySelectorAll('.topbtn')];
      const last = btns[btns.length - 1];
      if (getComputedStyle(tb).overflowX === 'auto') tb.scrollLeft = tb.scrollWidth;
      const lr = last ? last.getBoundingClientRect() : null;
      return {
        overflowX: document.documentElement.scrollWidth > window.innerWidth + 1,
        canvas: box('canvaswrap'),
        // The two desktop bands that have nowhere to go on a phone.
        inspector: box('inspector'),
        log: box('logbar'),
        menuReachable: !!lr && lr.right <= window.innerWidth + 2 && lr.width > 0,
        speed: !!document.querySelector('.sp'),
      };
    });
    // The floor is the game: it has to be the biggest thing on the screen.
    const ok = !m.overflowX && m.canvas >= h * 0.3 && m.inspector === 0 && m.log === 0
      && m.menuReachable && m.speed;
    if (ok) pass(`a phone gets a real layout (${name})`, m.canvas + 'px of floor');
    else fail(`a phone gets a real layout (${name})`, JSON.stringify(m));
    await page.close();
  }
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
