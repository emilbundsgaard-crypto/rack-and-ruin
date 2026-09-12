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
  await page.evaluate(() => { window.__rr.state.settings.speed = 10; });
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
  // Patient, not fast. The opening float only just covers what the guide asks
  // for, so a step can legitimately be waiting on a day of contract income —
  // the first kilowatt of utility power has to be earned. What this still
  // catches is a guide that cannot be finished at all, which is what a ring on
  // a button no amount of waiting will enable looks like.
  for (let guard = 0; guard < 220; guard++) {
    const st = await step();
    if (st.n >= 10) break;
    if (seen.length === st.n) seen.push(st);
    const target = await page.$('.tut-target');
    if (!target) { await page.waitForTimeout(600); continue; }
    const id = await page.evaluate((n) => n.id, target);
    const tag = await page.evaluate((n) => n.tagName, target);
    if (await page.evaluate((n) => n.disabled === true, target)) {
      // A minimally competent player: if there is no deal running, sign one.
      // Machines draw power whether or not anything is paying for them, so a
      // walk that only ever clicks the ring is poorer than any real player and
      // would report the guide broken for its own reason.
      await page.evaluate(async () => {
        const sim = await import('/src/sim.js');
        const app = window.__rr;
        if (app.state.contracts.active.length) return;
        const o = app.state.contracts.offers.find((x) => x.demand <= app.d.computeSellable);
        if (o) sim.signContract(app.state, app.d, o, { log() {} });
      });
      await page.waitForTimeout(900);
      continue;
    }
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
  // Every step the walk actually lands on has to be ringing something. It is
  // deliberately not "all ten were sampled": the ring moves the instant a step
  // completes, so a click aimed at one step can land on the next and finish it
  // between samples — which is a race in the walk, not a hole in the guide.
  // Requiring all ten to be observed made this fail while the guide itself was
  // reaching step 10 perfectly well.
  const mute = seen.filter((x) => x.aimed.length === 0);
  if (seen.length >= 6 && !mute.length) {
    pass('every step rings a control', seen.length + ' of 10 steps sampled, all ringing');
  } else {
    fail('every step rings a control',
      mute.length ? 'step ' + mute[0].n + ' rings nothing'
        : 'only ' + seen.length + ' steps sampled: ' + JSON.stringify(seen.map((x) => x.n + ':' + x.aimed)));
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
  await page.click('#tabbody .btn:has-text("Racks")');
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
    const P = await import('/src/data/progression.js');
    const S = await import('/src/state.js');
    const s = S.newGame();
    return {
      start: s.money,
      startMoney: S.START_MONEY,
      payCash: P.OBJECTIVES.filter((o) => o.reward && o.reward.money).length,
      payPoints: P.OBJECTIVES.filter((o) => o.reward && o.reward.rp).length,
      total: P.OBJECTIVES.length,
      achCash: P.ACHIEVEMENTS.filter((a) => a.reward && a.reward.money).length,
    };
  });
  // Not one of them may hand out money. Paying a lump sum for doing the thing
  // the game just told you to do is paying the player to read the tutorial,
  // and it stops the balance in the corner being a reading of the site.
  // The starting float is a balance number and is read from state.js rather
  // than pinned here: what this check is for is that nothing hands you a lump
  // sum for doing what you were told, not what the opening float happens to
  // be this month.
  if (r.start === r.startMoney && r.payCash === 0 && r.achCash === 0 && r.payPoints === r.total) {
    pass('milestones pay points, never cash', r.total + ' objectives, all in RP');
  } else {
    fail('milestones pay points, never cash', JSON.stringify(r));
  }
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

    // Sink it to a fixed depth, not for a fixed time.
    //
    // The hole is the scenario, so it has to be the same hole every run: the
    // overdraft charges 3% a day on it, and a deeper hole is a harder problem
    // by an amount that has nothing to do with the change under test. Running
    // for a fixed number of ticks instead meant the depth moved with whatever
    // the economy happened to be doing that week — first stopping short of
    // the depth the assertion demanded, then, once the cap was raised,
    // bottoming out at the floor and failing for being 20,000 dollars deeper
    // than the run it was being compared with.
    for (let i = 0; i < 200_000 && s.money > -30_000; i++) {
      sim.tick(s, 0.2, d, { log() {}, onRescue() {} });
      d = sim.derive(s);
    }
    const low = Math.round(s.money);

    // Now do what the game tells you to: let staff go, sell what you cannot
    // run. There has to be a way back — a player who follows the advice and
    // still sinks for ever has been handed an unwinnable save.
    //
    // What "sell what you cannot run" comes to is not one number, and pinning
    // it to one was the flaw in this check rather than in the game. Measured
    // across the sell-downs: keeping four of the five racks is back above
    // zero in 26 days, keeping three takes 46, and keeping two never makes it
    // at all, because the overdraft compounds while operations are under
    // water and a site that small cannot get them back over. So the invariant
    // is that some sell-down works, not that a particular one does — and the
    // detail line says which, because "sell less than you think" is a real
    // and surprising answer.
    const snapshot = JSON.stringify(s);
    const tried = [];
    let recovered = false, days = null, sold = null;
    for (const cap of [1, 2, 3]) {
      const back = JSON.parse(snapshot);
      Object.keys(s).forEach((k) => delete s[k]);
      Object.assign(s, back);
      A.fire(s, 'tech', { log() {} }); A.fire(s, 'tech', { log() {} }); A.fire(s, 'tech', { log() {} });
      d = sim.derive(s);
      let n = 0;
      for (const k of Object.keys(s.tiles).filter((z) => s.tiles[z].units)) {
        if (n >= cap) break;
        const [x, y] = k.split(',').map(Number);
        if (!A.sell(s, d, x, y, { log() {} })) { n++; d = sim.derive(s); }
      }
      let got = null;
      for (let i = 0; i < 90_000; i++) {
        sim.tick(s, 0.2, d, { log() {}, onRescue() {} });
        d = sim.derive(s);
        for (const o of [...s.contracts.offers]) sim.signContract(s, d, o, { log() {} });
        if (s.money > 0) { got = +(i * 0.2 / 60).toFixed(1); break; }
      }
      tried.push({ cap: n, days: got });
      if (got !== null && !recovered) { recovered = true; days = got; sold = n; }
    }
    app.d = sim.derive(s);
    return { low, recovered, days, sold, tried };
  });
  if (r.recovered && r.low <= -29_000) {
    pass('an overdrawn site can always be traded back',
      'from $' + r.low + ' — '
      + r.tried.map((t) => `sell ${t.cap}: ` + (t.days === null ? 'never' : t.days + 'd')).join(', '));
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

// ------------------------- a wall of events never breaks the row above the floor
{
  const bad = [];
  for (const [w, h] of [[2000, 1000], [1600, 950], [1440, 900], [1280, 800], [1100, 760],
                        [900, 700], [390, 844]]) {
    const page = await newPage(w, h);
    await page.click('text=Start in the cupboard');
    // Six running events at once, which is what several bank rescues plus
    // weather looks like, and a cash figure with a lot of digits.
    await page.evaluate(async () => {
      const app = window.__rr;
      const sim = await import('/src/sim.js');
      const s = app.state;
      s.tutorial.skipped = true; s.money = 1.79e10; s.settings.speed = 0;
      ['Rescue terms', 'Rescue terms', 'Rescue terms', 'Investor revenue share',
       'Recalled boards in service', 'Drought restrictions'].forEach((label, i) => {
        s.events.active.push({ id: 'x' + i, label, tone: i < 3 ? 'bad' : 'neutral',
          until: s.day + 7 + i * 3, started: s.day, mods: {} });
      });
      app.d = sim.derive(s);
    });
    await page.waitForTimeout(600);
    const m = await page.evaluate(() => {
      const fh = document.getElementById('floorhead');
      const ft = document.getElementById('floortools');
      const rows = (sel) => new Set([...document.querySelectorAll(sel)]
        .map((n) => Math.round(n.getBoundingClientRect().top))).size;
      // On a phone the row scrolls sideways on purpose, so "reachable" is the
      // question, not "on screen at rest".
      if (getComputedStyle(fh).overflowX === 'auto') fh.scrollLeft = fh.scrollWidth;
      const r = ft.getBoundingClientRect();
      return {
        pageOverflowX: document.documentElement.scrollWidth > window.innerWidth + 1,
        headH: Math.round(fh.getBoundingClientRect().height),
        toolRows: rows('#floortools .tool'),
        evRows: rows('#events .ev'),
        toolsReachable: r.right <= window.innerWidth + 2,
      };
    });
    // The row has one line of buttons and one line of chips, always, and the
    // page itself never scrolls sideways.
    if (m.pageOverflowX || m.toolRows > 1 || m.evRows > 1 || !m.toolsReachable
        || m.headH < 30) {
      bad.push(`${w}px: ${JSON.stringify(m)}`);
    }
    await page.close();
  }
  if (!bad.length) pass('a wall of events never breaks the row above the floor', '7 widths');
  else fail('a wall of events never breaks the row above the floor', bad[0]);
}

// ------------------------------------- a phone can tap a thing and read it
{
  // The inspector was switched off entirely on phones, so tapping a rack
  // selected it and showed nothing — which is the only way to find out why
  // something is warning at you. Both orientations, because landscape had its
  // own rule doing the same thing.
  const bad = [];
  for (const [w, h, label] of [[390, 844, 'portrait'], [844, 390, 'landscape']]) {
    const page = await browser.newPage({ viewport: { width: w, height: h },
      isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(URL, { waitUntil: 'networkidle' });
    await page.click('text=Start in the cupboard');
    await page.evaluate(() => {
      const s = window.__rr.state;
      s.tutorial.skipped = true; s.money = 5e6; s.settings.speed = 0;
    });
    await page.waitForTimeout(400);
    await page.evaluate(async () => {
      const A = await import('/src/actions.js');
      const sim = await import('/src/sim.js');
      const app = window.__rr;
      A.place(app.state, app.d, 2, 2, 'rack', app.hooks);
      app.d = sim.derive(app.state);
      app.view.sel = null;
    });
    await page.waitForTimeout(300);
    const c = await page.evaluate(() => window.__rr.view.tileCentre(2, 2));
    await page.touchscreen.tap(c.x, c.y);
    await page.waitForTimeout(500);

    const open = await page.evaluate(() => {
      const ins = document.getElementById('inspector');
      const box = ins.getBoundingClientRect();
      const close = ins.querySelector('.inspclose');
      const area = (a, b) => Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top))
                           * Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
      const cb = close && close.getBoundingClientRect();
      const collides = cb ? [...ins.querySelectorAll('.kv .v, .kv .k')]
        .some((n) => area(n.getBoundingClientRect(), cb) > 0) : false;
      return {
        mode: ins.dataset.mode,
        shown: getComputedStyle(ins).display !== 'none' && box.height > 40,
        names: ins.innerText.includes('Open frame rack'),
        onScreen: box.top >= 0 && box.bottom <= innerHeight + 1,
        closeShown: close ? getComputedStyle(close).display !== 'none' : false,
        collides,
      };
    });
    if (!open.shown) bad.push(`${label}: tapping a rack showed nothing (mode ${open.mode})`);
    else if (!open.names) bad.push(`${label}: the panel opened without naming the rack`);
    else if (!open.onScreen) bad.push(`${label}: the panel is not fully on screen`);
    else if (!open.closeShown) bad.push(`${label}: no way to close it`);
    else if (open.collides) bad.push(`${label}: the close button sits on the readings`);
    else {
      // And it must close again.
      await page.locator('.inspclose').tap();
      await page.waitForTimeout(400);
      const mode = await page.evaluate(() => document.getElementById('inspector').dataset.mode);
      if (mode === 'tile') bad.push(`${label}: the close button did not close it`);
    }
    await page.close();
  }
  if (!bad.length) pass('a phone can tap a thing and read it', 'both orientations');
  else fail('a phone can tap a thing and read it', bad[0]);
}

// --------------------------------------- nothing invites the browser to zoom
{
  // iOS has ignored user-scalable=no since iOS 10, so the viewport tag is not
  // enough on its own: what stops a double tap zooming the interface is
  // declaring what each area accepts. The panels must still scroll.
  const page = await browser.newPage({ viewport: { width: 390, height: 844 },
    isMobile: true, hasTouch: true });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.click('text=Start in the cupboard');
  await page.waitForTimeout(500);
  const t = await page.evaluate(() => {
    const ta = (sel) => getComputedStyle(document.querySelector(sel)).touchAction;
    return { body: ta('body'), view: ta('#view'), panel: ta('#panel'),
             tabbody: ta('#tabbody'), head: ta('#floorhead') };
  });
  const zoomable = Object.entries(t).filter(([, v]) => v === 'auto' || v.includes('pinch-zoom'));
  const scrolls = t.panel.startsWith('pan-y') && t.tabbody.startsWith('pan-y');
  if (zoomable.length) fail('nothing invites the browser to zoom',
    `${zoomable[0][0]} is touch-action: ${zoomable[0][1]}`);
  else if (!scrolls) fail('nothing invites the browser to zoom',
    `the panel would stop scrolling (${t.panel} / ${t.tabbody})`);
  else pass('nothing invites the browser to zoom', 'floor none, panels pan-y');
  await page.close();
}

// ------------------------------------------- the register is the population
{
  // The population counter used to be 940 * (1 - damage) ** 1.4: a number that
  // looked plausible and answered to nothing. It is now the sum of the
  // households still standing, so this checks the two can never drift apart —
  // and that the register adds up to the town the game says exists.
  const page = await newPage(1400, 900);
  await page.click('text=Start in the cupboard');
  await page.waitForTimeout(400);
  const r = await page.evaluate(async () => {
    const A = await import('/src/data/ashbrook.js');
    const T = await import('/src/town.js');
    const rows = A.REGISTER;
    const ascending = rows.every((x, i) => i === 0 || x.at >= rows[i - 1].at);
    const drift = [];
    for (let d = 0; d <= 1.0001; d += 0.02) {
      const fromRegister = A.standing(d).reduce((t, x) => t + x.n, 0);
      if (T.population(d) !== fromRegister) drift.push(d.toFixed(2));
    }
    return {
      total: A.TOWN_POPULATION, intended: A.INTENDED_POPULATION, entries: rows.length, ascending, drift,
      startsFull: T.population(0), endsEmpty: T.population(1),
      everyLineWritten: rows.every((x) => typeof x.line === 'string' && x.line.length > 25),
    };
  });
  // Against the intended figure the data declares, not a number typed in here:
  // a size written in two places drifts, and the register module now refuses
  // to load at all if it does not add up.
  if (r.total !== r.intended) fail('the register is the population',
    `the register holds ${r.total}, the city is meant to hold ${r.intended}`);
  else if (!r.ascending) fail('the register is the population', 'the thresholds are out of order');
  else if (r.drift.length) fail('the register is the population', `counter and register disagree at damage ${r.drift[0]}`);
  else if (r.startsFull !== r.intended || r.endsEmpty !== 0) fail('the register is the population',
    `starts at ${r.startsFull}, ends at ${r.endsEmpty}`);
  else if (!r.everyLineWritten) fail('the register is the population', 'an entry has no line written for it');
  else pass('the register is the population',
    `${r.entries} addresses, ${r.total.toLocaleString('en-GB')} people, no drift`);
  await page.close();
}

// --------------------------------------------- a finished town gets an ending
{
  // Reaching nothing used to pass as a log line. It is the only ending the
  // game has, so it has to fire, fire once, and report figures from the run
  // rather than invented ones.
  const page = await newPage(1400, 900);
  await page.click('text=Start in the cupboard');
  await page.evaluate(() => { window.__rr.state.tutorial.skipped = true; });
  await page.waitForTimeout(400);
  const r = await page.evaluate(async () => {
    const town = await import('/src/town.js');
    const app = window.__rr, s = app.state;
    s.day = 412; s.lifetimeEarnings = 8.42e10;
    s.stats.powerDrawn = 1.24e9; s.stats.waterTaken = 4.91e9;
    for (let i = 0; i < 620; i++) s.tiles['x' + i] = { b: 'rack3' };
    const big = { actualDraw: 3.0e6, waterDemand: 26000, heatLoad: 2.2e6 };

    let fired = 0;
    const hooks = { ...app.hooks, onClosing: () => { fired++; app.hooks.onClosing(); } };
    town.tickTown(s, big, hooks);
    await new Promise((x) => setTimeout(x, 350));
    const sheet = document.querySelector('.sheet.closing');
    const text = sheet ? sheet.innerText : '';
    // A second tick must not put it up again.
    town.tickTown(s, big, hooks);
    return {
      reachable: town.townTarget(s, big) >= 1,
      fired, shown: !!sheet, day: s.town.closed,
      hasFigures: /1\.2 TWh/.test(text) && /4\.9 billion litres/.test(text) && /412 days/.test(text),
      namesTheLast: /Marie Baptiste/.test(text),
    };
  });
  if (!r.reachable) fail('a finished town gets an ending', 'damage 1.0 cannot be reached at all');
  else if (!r.shown) fail('a finished town gets an ending', 'nothing appeared');
  else if (r.fired !== 1) fail('a finished town gets an ending', `it fired ${r.fired} times`);
  else if (!r.hasFigures) fail('a finished town gets an ending', 'the figures are not from the run');
  else if (!r.namesTheLast) fail('a finished town gets an ending', 'it does not name the last to go');
  else pass('a finished town gets an ending', `once, on day ${r.day}, with the run's own figures`);
  await page.close();
}

// ------------------------------ a deal that is short says what is short of it
{
  // The panel showed the result and nothing else: a contract could sit at 62%
  // with no way to find out which of the four things that go into delivery was
  // costing what. Delivery is deliverRatio x baseUptime x broken x power, so
  // each reason is quantified against the same maths that produced the figure.
  const page = await newPage(1400, 900);
  await page.click('text=Start in the cupboard');
  await page.evaluate(async () => {
    const A = await import('/src/actions.js');
    const sim = await import('/src/sim.js');
    const R = await import('/src/data/research.js');
    const app = window.__rr, s = app.state;
    s.tutorial.skipped = true; s.money = 5e6; s.settings.speed = 0;
    s.research.done = R.RESEARCH.map((r) => r.id);
    app.d = sim.derive(s);
    A.place(s, app.d, 2, 2, 'rack2', app.hooks);
    A.place(s, app.d, 3, 2, 'pdu2', app.hooks);
    app.d = sim.derive(s);
    A.buyGrid(s, A.maxGrid(s), app.hooks); app.d = sim.derive(s);
    A.fillAll(s, app.d, 'pizza', app.hooks); app.d = sim.derive(s);
    // Every cause at once: units down, power short, more promised than made.
    const tile = s.tiles['2,2'];
    if (tile && tile.units) tile.units.forEach((u, i) => { if (i % 3 === 0) u.broken = true; });
    // Starve it properly rather than by a fixed fraction. With the whole tree
    // bought — 545 nodes now, including ten rungs of supply reinforcement — a
    // 55% cut was no longer a shortage at all, and the check went red while the
    // report was working perfectly. Tighten until the site is actually short.
    for (let i = 0; i < 40 && sim.derive(s).powerFactor > 0.75; i++) {
      s.gridPower = Math.max(0.5, s.gridPower * 0.6);
    }
    s.staff.tech = 1;
    s.contracts.active = [{
      cid: 'w1', tid: s.contracts.offers[0]?.tid || 'c_backup', name: 'Overnight batch',
      client: 'Someone', demand: 120, pay: 40, uptimeReq: 0.95, effUptime: 0.62,
      startDay: 1, endDay: 30, breached: true,
    }];
    app.d = sim.derive(s);
  });
  await page.waitForTimeout(500);
  await page.click('#tabs >> text=Deals');
  await page.waitForTimeout(600);

  const r = await page.evaluate(async () => {
    const sim = await import('/src/sim.js');
    const app = window.__rr;
    const btn = document.querySelector('.whybtn');
    const report = sim.deliveryReport(app.state, app.d);
    return {
      button: !!btn,
      tip: btn ? btn.dataset.tip : '',
      reasons: report.reasons.map((x) => ({ lost: x.lost, what: x.what, fix: x.fix })),
      ordered: report.reasons.every((x, i, a) => i === 0 || a[i - 1].lost >= x.lost),
      // What the setup actually achieved, so a failure says whether the report
      // is wrong or the scenario never happened.
      staged: { powerFactor: app.d.powerFactor, broken: app.d.brokenTotal,
        oversold: app.d.deliverRatio },
    };
  });
  const kinds = r.reasons.map((x) => x.what).join(' ');
  if (!r.button) fail('a deal that is short says what is short of it', 'no ? on a breaching deal');
  else if (r.reasons.length < 3) fail('a deal that is short says what is short of it',
    `only ${r.reasons.length} reason(s); staged ${JSON.stringify(r.staged)}`);
  else if (!r.ordered) fail('a deal that is short says what is short of it', 'not ranked by cost');
  else if (!/Oversold/.test(kinds)) fail('a deal that is short says what is short of it', 'it misses being oversold');
  else if (!/Power is meeting/.test(kinds)) fail('a deal that is short says what is short of it', 'it misses the power shortfall');
  else if (!/down\./.test(kinds)) fail('a deal that is short says what is short of it', 'it misses the broken servers');
  else if (r.reasons.some((x) => !x.fix || x.fix.length < 12))
    fail('a deal that is short says what is short of it', 'a reason has no fix attached');
  else if (!r.tip.includes('\n')) fail('a deal that is short says what is short of it',
    'the hover tip is a single line');
  else pass('a deal that is short says what is short of it',
    `${r.reasons.length} causes, worst first, each with what to do`);

  // And it has to be reachable without a hover, because tips are off on touch.
  const opened = await page.evaluate(async () => {
    document.querySelector('.whybtn').click();
    await new Promise((x) => setTimeout(x, 250));
    return !!document.querySelector('.sheet.why');
  });
  if (!opened) fail('a deal that is short says what is short of it',
    'tapping the ? opens nothing, so it is useless on a phone');
  await page.close();
}

// ---------------------------------------- auto-sign only takes what you allow
{
  // Auto-sign takes the best-paying offer that fits, and the best-paying
  // offers are the ones demanding 99.5% uptime, so a hands-off site ends up
  // committed to promises it cannot keep the first time the weather turns.
  const page = await newPage(1400, 900);
  await page.click('text=Start in the cupboard');
  await page.waitForTimeout(400);
  const r = await page.evaluate(async () => {
    const sim = await import('/src/sim.js');
    const app = window.__rr, s = app.state;
    s.tutorial.skipped = true;
    s.settings.autoSign = true;
    const board = [0.80, 0.90, 0.93, 0.97, 0.99, 0.995];
    const reset = () => {
      s.contracts.active = [];
      s.contracts.offers = board.map((u, i) => ({
        cid: 'o' + i, tid: 'c_backup', name: 'Deal ' + i, client: 'C' + i,
        demand: 0, pay: 10 + i, uptimeReq: u, days: 10, expires: s.day + 50,
      }));
    };
    const takenAt = (cap) => {
      reset();
      s.settings.autoSignUptime = cap;
      app.d = sim.derive(s);
      // Run the offer/auto-sign step the way the clock does.
      sim.tick(s, 0.2, app.d, app.hooks);
      return s.contracts.active.map((c) => c.uptimeReq);
    };
    return { any: takenAt(1), at93: takenAt(0.93), at85: takenAt(0.85) };
  });
  const worst = (a) => (a.length ? Math.max(...a) : 0);
  if (!r.any.length) fail('auto-sign only takes what you allow', 'it signed nothing with the cap wide open');
  else if (worst(r.at93) > 0.93 + 1e-6) fail('auto-sign only takes what you allow',
    `capped at 93% it still took a ${(worst(r.at93) * 100).toFixed(1)}% deal`);
  else if (worst(r.at85) > 0.85 + 1e-6) fail('auto-sign only takes what you allow',
    `capped at 85% it still took a ${(worst(r.at85) * 100).toFixed(1)}% deal`);
  else if (r.at85.length >= r.any.length) fail('auto-sign only takes what you allow',
    'the cap did not turn anything away');
  else pass('auto-sign only takes what you allow',
    `${r.any.length} deals uncapped, ${r.at93.length} at 93%, ${r.at85.length} at 85%`);
  await page.close();
}

// ------------------------------------------ weather arrives, it does not slap
{
  // Every event used to land at full strength in one tick. A 38% cut in
  // cooling arriving between frames can take a rack past 40°C and start
  // breaking hardware before the notification has been read.
  const page = await newPage(1400, 900);
  await page.click('text=Start in the cupboard');
  await page.waitForTimeout(400);
  const curve = await page.evaluate(async () => {
    const sim = await import('/src/sim.js');
    const s = window.__rr.state;
    s.tutorial.skipped = true;
    const start = s.day;
    s.events.active = [{ id: 'heatwave', started: start, until: start + 3.5 }];
    const at = (off) => { s.day = start + off; return sim.derive(s).mods.coolMult; };
    return { onset: at(0), early: at(0.15), mid: at(1.5), late: at(3.42), full: at(0.5) };
  });
  const target = 0.7;
  if (Math.abs(curve.mid - target) > 0.02) fail('weather arrives, it does not slap',
    `it never reaches full strength (${curve.mid.toFixed(2)} at the middle)`);
  else if (curve.onset < 0.99) fail('weather arrives, it does not slap',
    `it lands at ${curve.onset.toFixed(2)} on the first tick`);
  else if (curve.early <= curve.full + 0.01) fail('weather arrives, it does not slap',
    'there is no ramp — it is at full strength almost immediately');
  else if (curve.late < 0.85) fail('weather arrives, it does not slap',
    `it does not ease off at the end (${curve.late.toFixed(2)})`);
  else pass('weather arrives, it does not slap',
    `1.00 \u2192 ${curve.early.toFixed(2)} \u2192 ${curve.mid.toFixed(2)} \u2192 ${curve.late.toFixed(2)}`);
  await page.close();
}

// -------------------------------- a deal you cannot keep can always be dropped
{
  // The active list was only ever added to. A site that promised more than it
  // could deliver was fined every second for the rest of the term, and being
  // overdrawn stops you buying the capacity that would end the fines. The bot
  // found it: ten contracts ten minutes in, $87.50 a second of fines against
  // $14.91 of revenue, uptime 97% and nothing broken, and no move that helped.
  const page = await newPage(1400, 900);
  await page.click('text=Start in the cupboard');
  await page.evaluate(() => { window.__rr.state.tutorial.skipped = true; });
  await page.waitForTimeout(400);
  const r = await page.evaluate(async () => {
    const sim = await import('/src/sim.js');
    const app = window.__rr, s = app.state;
    // A contract being missed, on a site that is already under water.
    s.contracts.active = [{
      cid: 'x1', tid: s.contracts.offers[0]?.tid || 'c_backup', name: 'Test deal',
      client: 'Someone', demand: 100, pay: 50, uptimeReq: 0.99, effUptime: 0.4,
      startDay: 1, endDay: 40, breached: true,
    }];
    s.money = -250000;                       // overdrawn: buying is frozen
    s.reputation = 60;                       // there has to be something to lose
    app.d = sim.derive(s);
    const finesBefore = app.d.penalties;
    const rep = s.reputation;

    const err = sim.breakContract(s, 'x1', app.hooks);
    app.d = sim.derive(s);
    return {
      err, finesBefore, finesAfter: app.d.penalties,
      left: s.contracts.active.length,
      repCost: rep - s.reputation,
      moneyUnchanged: s.money === -250000,
    };
  });
  if (r.err) fail('a deal you cannot keep can always be dropped', r.err);
  else if (r.left !== 0) fail('a deal you cannot keep can always be dropped', 'the contract is still running');
  else if (r.finesAfter >= r.finesBefore && r.finesBefore > 0)
    fail('a deal you cannot keep can always be dropped', 'the fines did not stop');
  else if (!r.moneyUnchanged)
    fail('a deal you cannot keep can always be dropped', 'it charged money to an overdrawn site');
  else if (r.repCost <= 0)
    fail('a deal you cannot keep can always be dropped',
      'walking away cost nothing even with reputation to lose');
  else pass('a deal you cannot keep can always be dropped',
    `while overdrawn, for ${r.repCost} reputation and no cash`);
  await page.close();
}

// ------------------------------------- you are told before the money runs out
{
  // The game only warned once you were already overdrawn, which is after the
  // window where it is cheap to fix. A site can bleed for ten minutes with
  // everything green because the electricity costs more than the compute is
  // worth.
  const page = await newPage(1400, 900);
  await page.click('text=Start in the cupboard');
  await page.waitForTimeout(400);
  const r = await page.evaluate(async () => {
    const sim = await import('/src/sim.js');
    const app = window.__rr, s = app.state;
    s.tutorial.skipped = true;
    s.money = 5000;
    // A real site drawing real power with nothing sold: revenue zero, bills
    // ticking. Setting the grid connection alone proved nothing, because the
    // bill follows what is actually drawn.
    const A = await import('/src/actions.js');
    let d = sim.derive(s);
    A.place(s, d, 2, 2, 'rack', app.hooks);
    A.place(s, d, 3, 2, 'pdu', app.hooks);
    d = sim.derive(s);
    A.buyGrid(s, 20, app.hooks);
    d = sim.derive(s);
    A.fillAll(s, d, 'pizza', app.hooks);
    s.contracts.active = [];
    s.market.power = 1.3;
    s.money = 5000;
    d = sim.derive(s);
    const warn = d.problems.find((p) => /losing .* a second/.test(p.text));
    return {
      losing: d.revenue < d.costs,
      warned: !!warn,
      text: warn ? warn.text : d.problems.map((p) => p.text)[0] || '(no problems at all)',
    };
  });
  if (!r.losing) fail('you are told before the money runs out', 'the test site was not losing money');
  else if (!r.warned) fail('you are told before the money runs out',
    `no warning while still in credit; top problem was "${r.text.slice(0, 60)}"`);
  else if (!/runs out in/.test(r.text) || !/Most of it is/.test(r.text))
    fail('you are told before the money runs out', `the warning does not say when or why: "${r.text}"`);
  else pass('you are told before the money runs out', r.text.slice(0, 64) + '…');
  await page.close();
}

// ------------------------------- an overlay is visible on a floor worth reading
{
  // The overlays were painted on the bare floor and then buried under the very
  // machines they describe. On a floor with something on every tile — which is
  // every floor anyone opens an overlay on — turning one on changed nothing you
  // could see. This builds exactly that floor and compares the picture.
  const page = await newPage(1200, 800);
  await page.click('text=Start in the cupboard');
  await page.evaluate(async () => {
    const A = await import('/src/actions.js');
    const sim = await import('/src/sim.js');
    const R = await import('/src/data/research.js');
    const St = await import('/src/state.js');
    const app = window.__rr, s = app.state;
    s.tutorial.skipped = true; s.money = 1e14; s.reputation = 500;
    s.research.done = R.RESEARCH.map((r) => r.id);
    while (s.facility < 2 && !A.upgradeFacility(s, app.hooks)) {}
    s.money = 1e14; app.d = sim.derive(s);
    const f = St.roomOf(s);
    for (let x = 0; x < f.w; x++) for (let y = 0; y < f.h; y++) {
      A.place(s, app.d, x, y, (x + y) % 6 === 0 ? 'pdu3' : 'rack3', app.hooks);
    }
    app.d = sim.derive(s);
    for (let i = 0; i < 4; i++) {
      A.buyGrid(s, A.maxGrid(s), app.hooks); app.d = sim.derive(s);
      A.fillAll(s, app.d, 'blade', app.hooks); app.d = sim.derive(s);
    }
    s.settings.speed = 0; app.view.centred = false;
  });
  await page.waitForTimeout(1000);

  const strip = (overlay) => page.evaluate(async (o) => {
    window.__rr.setOverlay(o);
    await new Promise((r) => setTimeout(r, 500));
    const c = document.getElementById('view');
    const g = c.getContext('2d', { willReadFrequently: true });
    const px = g.getImageData(0, 0, c.width, c.height).data;
    // Mean colour over the whole floor view: an overlay that reaches the
    // machines moves it, one hidden under them does not.
    let r = 0, gr = 0, b = 0, n = 0;
    for (let i = 0; i < px.length; i += 64) { r += px[i]; gr += px[i + 1]; b += px[i + 2]; n++; }
    return [r / n, gr / n, b / n];
  }, overlay);

  const off = await strip('none');
  const bad = [];
  for (const o of ['power', 'cooling', 'heat', 'net']) {
    const on = await strip(o);
    const moved = Math.abs(on[0] - off[0]) + Math.abs(on[1] - off[1]) + Math.abs(on[2] - off[2]);
    if (moved < 3) bad.push(`${o} changed the picture by ${moved.toFixed(1)}`);
  }
  await strip('none');
  if (bad.length) fail('an overlay is visible on a floor worth reading', bad[0]);
  else pass('an overlay is visible on a floor worth reading', '4 overlays, full floor');
  await page.close();
}

// ------------------------------------------------ the lighting stays cheap
{
  // Frame rate is a bad signal here: this browser has no GPU, so fps swings by
  // a third between identical runs and reads the same whether a pass costs
  // 0.1ms or nothing at all. Chasing it led to rewriting the bloom twice for a
  // cost that turned out to be measurement noise. So this times the passes
  // themselves, which is the number that means something.
  const page = await newPage(1400, 900);
  await page.click('text=Start in the cupboard');
  await page.evaluate(async () => {
    const A = await import('/src/actions.js');
    const sim = await import('/src/sim.js');
    const R = await import('/src/data/research.js');
    const St = await import('/src/state.js');
    const app = window.__rr, s = app.state;
    s.tutorial.skipped = true; s.money = 1e14; s.reputation = 500;
    s.research.done = R.RESEARCH.map((r) => r.id);
    while (s.facility < 5 && !A.upgradeFacility(s, app.hooks)) {}
    s.money = 1e14; app.d = sim.derive(s);
    const f = St.roomOf(s);
    for (let x = 0; x < f.w; x++) for (let y = 0; y < f.h; y++) {
      A.place(s, app.d, x, y, (x + y) % 6 === 0 ? 'pdu3' : 'rack3', app.hooks);
    }
    app.d = sim.derive(s);
    for (let i = 0; i < 5; i++) {
      A.buyGrid(s, A.maxGrid(s), app.hooks); app.d = sim.derive(s);
      A.fillAll(s, app.d, 'blade', app.hooks); app.d = sim.derive(s);
    }
    s.day = 3.9; s.settings.speed = 0; app.view.centred = false;
  });
  await page.waitForTimeout(1200);
  const m = await page.evaluate(() => new Promise((res) => {
    const v = window.__rr.view;
    const oBurn = v.burn.bind(v), oVig = v.vignette.bind(v), oDraw = v.draw.bind(v);
    let burn = 0, vig = 0, all = 0, n = 0;
    v.burn = (c) => { const t = performance.now(); oBurn(c); burn += performance.now() - t; };
    v.vignette = (c) => { const t = performance.now(); oVig(c); vig += performance.now() - t; };
    v.draw = (a, b, c) => { const t = performance.now(); oDraw(a, b, c); all += performance.now() - t; n++; };
    setTimeout(() => res({ n, burn: burn / n, vig: vig / n, all: all / n, lamps: v.lights.length }), 2200);
  }));
  const light = m.burn + m.vig;
  if (!m.n) fail('the lighting stays cheap', 'the floor never drew');
  else if (!m.lamps) fail('the lighting stays cheap', 'nothing lit a full hall');
  else if (light > 2.5) fail('the lighting stays cheap',
    `${light.toFixed(2)}ms a frame on ${m.lamps} lamps`);
  else if (m.all > 12) fail('the lighting stays cheap',
    `the whole draw is ${m.all.toFixed(1)}ms a frame`);
  else pass('the lighting stays cheap',
    `${light.toFixed(2)}ms of ${m.all.toFixed(1)}ms, ${m.lamps} lamps`);
  await page.close();
}

// ------------------------------------ a dialogue does not cost the frame rate
{
  // backdrop-filter over the whole screen was taking a finished site from 36fps
  // to 12 — for the Menu, for an event decision, for the bank's offer, for
  // every dialogue in the game. It had nothing to do with the canvas redrawing;
  // the compositor re-filters the page regardless. This is here so no one puts
  // it back.
  const page = await newPage(1500, 940);
  await page.click('text=Start in the cupboard');
  await page.evaluate(async () => {
    const A = await import('/src/actions.js');
    const sim = await import('/src/sim.js');
    const R = await import('/src/data/research.js');
    const app = window.__rr, s = app.state;
    s.tutorial.skipped = true;
    s.facility = 9; s.money = 1e30; s.gridPower = 6e6;
    for (const r of R.RESEARCH) s.research.done.push(r.id);
    app.d = sim.derive(s);
    let n = 0;
    for (let y = 0; y < 18; y++) for (let x = 0; x < 30; x++) {
      A.place(s, app.d, x, y, x % 5 === 4 ? 'pdu5' : 'rack5', null);
      if (++n % 60 === 0) app.d = sim.derive(s);
    }
    app.d = sim.derive(s);
    app.view.centred = false;
  });
  await page.waitForTimeout(1400);
  const fps = () => page.evaluate(() => new Promise((res) => {
    let f = 0; const t0 = performance.now();
    const loop = () => { f++; performance.now() - t0 < 2000 ? requestAnimationFrame(loop) : res(f / ((performance.now() - t0) / 1000)); };
    requestAnimationFrame(loop);
  }));
  const open = await fps();
  await page.evaluate(() => window.__rr.openMenu());
  await page.waitForTimeout(400);
  const withDialogue = await fps();
  const blurred = await page.evaluate(() =>
    getComputedStyle(document.getElementById('modal')).backdropFilter);
  if (blurred && blurred !== 'none') fail('a dialogue does not cost the frame rate',
    `the modal is back to backdrop-filter: ${blurred}`);
  else if (withDialogue < open * 0.9) fail('a dialogue does not cost the frame rate',
    `${open.toFixed(0)}fps without, ${withDialogue.toFixed(0)}fps with`);
  else pass('a dialogue does not cost the frame rate',
    `${open.toFixed(0)}fps free, ${withDialogue.toFixed(0)}fps behind the Menu`);
  await page.close();
}

// --------------------------------------- the town is on screen, and it decays
{
  // The best writing in the game used to be behind a tab you might never open.
  // It is now drawn on the horizon behind the floor, so this checks two things
  // a screenshot cannot: that something is actually painted up there, and that
  // wrecking the place visibly changes it.
  //
  // The comparison is a downsampled strip of the band rather than a single
  // average. An average passed once while the detail it claimed to be watching
  // had not moved a pixel.
  const page = await newPage(1280, 800);
  await page.click('text=Start in the cupboard');
  await page.evaluate(() => { window.__rr.state.tutorial.skipped = true; });
  await page.waitForTimeout(500);

  const strip = (dmg) => page.evaluate(async (dmg) => {
    const app = window.__rr;
    app.state.town.damage = dmg;
    app.state.day = 3.3;
    app.state.settings.speed = 0;
    await new Promise((r) => setTimeout(r, 700));
    const c = document.getElementById('view');
    const g = c.getContext('2d', { willReadFrequently: true });
    const dpr = c.width / c.getBoundingClientRect().width;
    const h = Math.round(120 * dpr);
    const px = g.getImageData(0, 0, c.width, h).data;
    // 240 columns of mean luminance: enough to see a roofline come and go.
    const cols = 240, out = new Array(cols).fill(0);
    const cw = Math.floor(c.width / cols);
    let any = 0;
    for (let x = 0; x < cols; x++) {
      let sum = 0, n = 0;
      for (let ix = x * cw; ix < (x + 1) * cw; ix += 2) {
        for (let iy = 0; iy < h; iy += 2) {
          const i = (iy * c.width + ix) * 4;
          sum += (px[i] * 0.3 + px[i + 1] * 0.6 + px[i + 2] * 0.1) * (px[i + 3] / 255);
          n++;
        }
      }
      out[x] = n ? sum / n : 0;
      if (out[x] > 4) any++;
    }
    return { out, any };
  }, dmg);

  const clean = await strip(0);
  const ruined = await strip(0.95);
  let moved = 0;
  for (let i = 0; i < clean.out.length; i++) {
    if (Math.abs(clean.out[i] - ruined.out[i]) > 1.2) moved++;
  }
  const drawn = clean.any > 120;                 // the band is not simply empty
  if (!drawn) fail('the town is on screen, and it decays',
    `only ${clean.any}/240 columns have anything in them`);
  else if (moved < 60) fail('the town is on screen, and it decays',
    `wrecking it changed only ${moved}/240 columns`);
  else pass('the town is on screen, and it decays',
    `${moved}/240 columns of horizon changed`);
  await page.close();
}

// ------------------------------------- the tab row stays on a single line
{
  // "Running" used to wrap the row onto two lines between roughly 950 and
  // 1150px, which is an ordinary laptop window. The names are the only thing
  // that decides this, so it is worth holding them to it.
  const bad = [];
  for (const w of [1500, 1280, 1150, 1100, 1024, 950, 900, 700, 520, 390]) {
    const page = await newPage(w, 900);
    await page.click('text=Start in the cupboard');
    await page.waitForTimeout(500);
    const m = await page.evaluate(() => {
      const t = document.getElementById('tabs');
      const tabs = [...t.querySelectorAll('.tab')];
      const rows = new Set(tabs.map((n) => Math.round(n.getBoundingClientRect().top))).size;
      // On a phone the row is allowed to scroll; what matters is that every
      // tab can be reached, not that all of them are on screen at once.
      const scrolls = t.scrollWidth > t.clientWidth + 1;
      const canScroll = ['auto', 'scroll'].includes(getComputedStyle(t).overflowX);
      return { rows, reachable: !scrolls || canScroll, n: tabs.length };
    });
    if (m.rows > 1) bad.push(`${w}px: the tabs wrapped onto ${m.rows} lines`);
    else if (!m.reachable) bad.push(`${w}px: tabs overflow with no way to reach them`);
    await page.close();
  }
  if (!bad.length) pass('the tab row stays on a single line', '10 widths');
  else fail('the tab row stays on a single line', bad[0]);
}

// -------------------------------------------- the live counter fails politely
{
  // This suite runs against a static server, which is exactly the case the
  // counter has to survive: it asks for api/track.php, gets the script back as
  // plain text or a 404, and must remove itself rather than print a made-up
  // number or throw.
  const page = await newPage(1500, 940);
  await page.click('text=Start in the cupboard');
  await page.waitForTimeout(2400);
  const st = await page.evaluate(() => {
    const n = document.getElementById('livecount');
    return { built: !!n, showing: n ? (!n.hidden && getComputedStyle(n).display !== 'none') : false };
  });
  if (!st.built) fail('the live counter fails politely', 'the chip was never built');
  else if (st.showing) fail('the live counter fails politely', 'it showed a count with no server');
  else pass('the live counter fails politely', 'hidden, no server');
  await page.close();
}

// ------------------------------- a big live count does not break the top bar
{
  const bad = [];
  for (const [w, h] of [[1500, 940], [1280, 800], [1100, 760], [900, 700], [390, 844]]) {
    const page = await newPage(w, h);
    await page.click('text=Start in the cupboard');
    // The server is not here to say 4 digits, so say it by hand: this is the
    // layout question, not the network one.
    await page.evaluate(() => {
      const n = document.getElementById('livecount');
      n.innerHTML = '<i></i><b>1997</b><span>playing</span>';
      n.hidden = false;
      window.__rr.state.money = 1.79e10;
    });
    await page.waitForTimeout(500);
    const m = await page.evaluate(() => {
      const bar = document.getElementById('topbar');
      const chip = document.getElementById('livecount');
      const cash = document.querySelector('#v_cash .big');
      return {
        page: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        barSpill: bar.scrollWidth - bar.clientWidth,
        chipVisible: getComputedStyle(chip).display !== 'none' && chip.getBoundingClientRect().width > 8,
        overlap: chip.getBoundingClientRect().left < cash.getBoundingClientRect().right,
      };
    });
    if (m.page > 1) bad.push(`${w}px: the page scrolls sideways by ${m.page}px`);
    else if (m.barSpill > 1) bad.push(`${w}px: the bar overflows by ${m.barSpill}px`);
    else if (!m.chipVisible) bad.push(`${w}px: the counter vanished`);
    else if (m.overlap) bad.push(`${w}px: the counter sits on top of the cash figure`);
    await page.close();
  }
  if (!bad.length) pass('a big live count does not break the top bar', '5 widths, 4 digits');
  else fail('a big live count does not break the top bar', bad[0]);
}

// --------------------------------- the top bar readouts do not flicker in play
{
  const page = await newPage(1440, 950);
  await page.click('text=Start in the cupboard');
  await page.evaluate(async () => {
    const app = window.__rr;
    const sim = await import('/src/sim.js');
    const A = await import('/src/actions.js');
    const R = await import('/src/data/research.js');
    const s = app.state;
    s.tutorial.skipped = true; s.gridPower = 200; s.money = 41500;
    for (const r of R.RESEARCH.slice(0, 10)) s.research.done.push(r.id);
    let d = sim.derive(s);
    A.place(s, d, 2, 2, 'pdu', null); d = sim.derive(s);
    A.place(s, d, 3, 2, 'rack', null); d = sim.derive(s);
    A.place(s, d, 2, 3, 'fan', null); d = sim.derive(s);
    A.fillAll(s, d, 'desktop', null);
    app.d = sim.derive(s);
    s.settings.speed = 10;
  });
  // Let the first fit settle, then watch. One toggle at load is the bar
  // deciding what fits; a toggle after that is the flicker.
  await page.waitForTimeout(1200);
  await page.evaluate(() => {
    window.__toggles = 0;
    new MutationObserver(() => { window.__toggles++; })
      .observe(document.getElementById('topbar'), { attributes: true, attributeFilter: ['class'] });
  });
  await page.waitForTimeout(4000);
  const r = await page.evaluate(() => ({
    toggles: window.__toggles,
    minis: document.querySelector('.minis').offsetParent !== null,
    // And the money must never be cut off inside its fixed-width box.
    clipped: (() => {
      const big = document.querySelector('#v_cash .big');
      const probe = document.createElement('span');
      probe.style.cssText = 'position:absolute;visibility:hidden;white-space:nowrap;';
      probe.style.font = getComputedStyle(big).font;
      probe.textContent = '$1.23QaDc';
      document.body.append(probe);
      const need = probe.getBoundingClientRect().width;
      probe.remove();
      return need > big.clientWidth + 1;
    })(),
  }));
  // The readouts have fixed widths, so nothing about a rolling counter can
  // change whether they fit. Any toggle here is the fit being recomputed on a
  // number tick, which is what made them flash in and out.
  if (r.toggles === 0 && !r.clipped) {
    pass('the top bar readouts stay put while the numbers roll');
  } else {
    fail('the top bar readouts stay put while the numbers roll', JSON.stringify(r));
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

// ------------------------------- holding a machine is visible, and undoable
{
  const page = await newPage();
  await page.click('text=Start in the cupboard');
  await page.evaluate(() => { window.__rr.state.tutorial.skipped = true; window.__rr.state.money = 5e5; });
  await page.waitForTimeout(400);
  const drop = () => page.evaluate(() => {
    const b = document.querySelector('.dropbtn');
    return { hidden: b.hidden, label: b.textContent.trim(),
      tip: b.getAttribute('aria-label') || '' };
  });
  const idle = await drop();
  await page.click('[data-build="pdu"]');
  await page.waitForTimeout(400);
  const held = await drop();
  // Measure it while it is actually on screen: small, and inside the floor.
  const fit = await page.evaluate(() => {
    const b = document.querySelector('.dropbtn');
    const c = document.getElementById('canvaswrap').getBoundingClientRect();
    const r = b.getBoundingClientRect();
    return { w: Math.round(r.width), h: Math.round(r.height),
      inside: r.right <= c.right + 1 && r.bottom <= c.bottom + 1 && r.width > 0 };
  });
  await page.click('.dropbtn');
  await page.waitForTimeout(400);
  const after = await drop();
  const tool = await page.evaluate(() => window.__rr.view.tool);
  // Small enough to stay out of the way, big enough to hit with a thumb.
  if (idle.hidden && !held.hidden && /power strip/i.test(held.tip) && after.hidden && !tool
      && fit.h <= 40 && fit.w <= 40 && fit.h >= 26 && fit.inside) {
    pass('a held machine can always be put down', fit.w + '×' + fit.h);
  } else {
    fail('a held machine can always be put down', JSON.stringify({ idle, held, after, tool, fit }));
  }
  await page.close();
}

// ------------------------------------- a finger moves the floor, a mouse paints
{
  // With a machine held, dragging lays a row on a mouse and moves the camera on
  // a touch screen. Getting this backwards on a phone means every attempt to
  // look around builds something by accident.
  const page = await newPage(390, 844);
  await page.click('text=Start in the cupboard');
  await page.evaluate(() => { window.__rr.state.tutorial.skipped = true; window.__rr.state.money = 5e5; });
  await page.waitForTimeout(400);
  await page.click('[data-build="pdu"]');
  await page.waitForTimeout(300);
  const r = await page.evaluate(async () => {
    const v = window.__rr.view;
    const el = document.getElementById('view');
    const c = document.getElementById('canvaswrap').getBoundingClientRect();
    const sx = c.left + c.width / 2, sy = c.top + c.height / 2;
    const before = { ox: v.ox, n: Object.keys(window.__rr.state.tiles).length };
    const send = (type, x, y) => el.dispatchEvent(new PointerEvent(type, {
      pointerId: 1, pointerType: 'touch', clientX: x, clientY: y, bubbles: true, isPrimary: true }));
    send('pointerdown', sx, sy);
    for (let i = 1; i <= 12; i++) {
      send('pointermove', sx - i * 10, sy + i * 4);
      await new Promise((z) => setTimeout(z, 10));
    }
    send('pointerup', sx - 120, sy + 48);
    return { moved: v.ox !== before.ox, placed: Object.keys(window.__rr.state.tiles).length - before.n };
  });
  if (r.moved && r.placed === 0) pass('a finger drag moves the floor, it does not build');
  else fail('a finger drag moves the floor, it does not build', JSON.stringify(r));
  await page.close();
}

// -------------------------------------- what you can buy is at the top of a list
{
  const page = await newPage();
  await page.click('text=Start in the cupboard');
  await page.evaluate(() => { window.__rr.state.tutorial.skipped = true; window.__rr.state.money = 2370; });
  await page.waitForTimeout(400);
  const firstRows = async (n) => page.evaluate((k) =>
    [...document.querySelectorAll('#tabbody .row')].slice(0, k).map((r) => ({
      name: r.querySelector('b')?.textContent || '',
      locked: r.classList.contains('locked'),
    })), n);
  await page.click('#tabbody .btn:has-text("Cooling")');
  await page.waitForTimeout(300);
  const build = await firstRows(3);
  await page.click('#tabs >> text=Servers');
  await page.waitForTimeout(400);
  const machines = await firstRows(3);
  // A player with $2,370 should not open a tab to three screens of locked
  // billion-pound machines before the thing they can actually afford.
  const ok = build.length && !build[0].locked && machines.length && !machines[0].locked;
  if (ok) pass('what you can buy sorts to the top', build[0].name + ' / ' + machines[0].name);
  else fail('what you can buy sorts to the top', JSON.stringify({ build, machines }));
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

// ------------------------------------------- the hot room has a way out
// The early death spiral: a cupboard packed with servers, one fan, no money
// and 75 °C. Output collapsed as the hardware cooked, the electricity bill did
// not, and being overdrawn then stopped you buying the cooling that would have
// fixed it. Six of twenty-four bot runs used to end this way.
//
// What went wrong was never that the site was in trouble — it is supposed to
// be possible to ruin one. It was that nothing the player did helped. So this
// puts a site into exactly that state and checks the obvious remedy works:
// take out the machines you cannot cool, and the site pays its way again.
//
// It deliberately does not check that doing nothing recovers. Doing nothing
// should lose. An earlier version of this check tested precisely that and
// passed only because objectives were handing out cash — when that was taken
// out, as asked, the check went red while the game was behaving correctly.
{
  const page = await newPage();
  await page.click('text=Start in the cupboard');
  await page.evaluate(() => { window.__rr.state.tutorial.skipped = true; });
  await page.waitForTimeout(300);
  const out = await page.evaluate(async () => {
    const A = await import('/src/actions.js'); const sim = await import('/src/sim.js');
    const app = window.__rr, s = app.state;
    s.money = 400_000;
    let d = sim.derive(s);
    A.place(s, d, 2, 2, 'pdu', null); d = sim.derive(s);
    for (let x = 0; x < 5; x++) { A.place(s, d, x, 1, 'rack', null); d = sim.derive(s); }
    A.place(s, d, 3, 3, 'fan', null); d = sim.derive(s);
    A.buyGrid(s, A.maxGrid(s), null); d = sim.derive(s);
    A.fillAll(s, d, 'desktop', null); d = sim.derive(s);
    s.money = 1_500;
    s.settings.autoSign = true;
    s.settings.autoSignUptime = 0.80;
    d = sim.derive(s);
    const before = { temp: d.maxTemp, costs: d.costs };

    // The remedy a player has in front of them: sell what the room cannot cool.
    let sold = 0;
    for (const r of d.racks) {
      for (const g of [...(r.tile.units || [])]) {
        const take = Math.ceil(g.n * 0.6);
        if (take > 0) { A.uninstall(s, d, r.tile, g.t, take, null); sold += take; }
      }
    }
    d = sim.derive(s);
    const after = { costs: d.costs, money: s.money };

    const start = s.money;
    const quiet = { log: () => {}, onDecision: () => {} };
    // Five recoveries from the same starting state, not one.
    //
    // The recovery depends on which offers the board happens to post and
    // which events land. Measured over twelve fresh runs it succeeds eleven
    // times — call it nine in ten — so a single sample failed roughly one
    // suite run in ten with nothing wrong, and demanding four of five still
    // fails one run in fourteen. Three of five is the threshold that matches
    // what was measured: at a true rate of nine in ten it cries wolf less
    // than once in a hundred runs, and it still fails hard if recovery
    // actually breaks, which is what it is here to catch. A check that cries
    // wolf gets ignored, and this one guards against handing a player an
    // unwinnable save.
    const snapshot = JSON.stringify(s);
    const runs = [];
    for (let run = 0; run < 5; run++) {
      const t0 = JSON.parse(snapshot);
      Object.keys(s).forEach((k) => delete s[k]);
      Object.assign(s, t0);
      let low = s.money;
      for (let t = 0; t < 120 * 60; t += 0.25) {
        d = sim.derive(s);
        sim.tick(s, 0.25, d, quiet);
        low = Math.min(low, s.money);
      }
      runs.push({ low: Math.round(low), end: Math.round(s.money) });
    }
    app.d = sim.derive(s);
    const good = runs.filter((r) => r.low >= 0 && r.end > start).length;
    return { before, after, sold, start, runs, good };
  });
  // Hot enough to be the state that used to be fatal, the remedy has to cut
  // the bill, and from there the balance has to climb without going under.
  if (out.before.temp > 60 && out.after.costs < out.before.costs * 0.75
      && out.good >= 3) {
    pass('a cooked site has a remedy that works',
      `${Math.round(out.before.temp)} °C, sold ${out.sold} units, bill `
      + `${out.before.costs.toFixed(1)} to ${out.after.costs.toFixed(1)}/s, `
      + `${out.good}/5 climbed from $${Math.round(out.start)} to `
      + out.runs.map((r) => '$' + r.end).join(' / '));
  } else {
    fail('a cooked site has a remedy that works', JSON.stringify(out));
  }
  await page.close();
}

// ------------------------------------------------------------------ the float
// Going public is the one irreversible decision in the game that is not the
// end of the run: it hands over a large sum once and owes a dividend for ever,
// stepping up half a point of the float every listed year. Three things have
// to hold — it is refused before the company is worth listing, the dividend
// lands in the ledger rather than quietly draining the balance, and the whole
// thing survives a save and a reload, because a float that forgets itself is
// worse than no float at all.
{
  const page = await newPage();
  await page.click('text=Start in the cupboard');
  await page.evaluate(() => { window.__rr.state.tutorial.skipped = true; });
  await page.waitForTimeout(300);
  const r = await page.evaluate(async () => {
    const sim = await import('/src/sim.js');
    const S = await import('/src/state.js');
    const app = window.__rr, s = app.state;
    const out = {};
    out.blockedFresh = !!sim.ipoBlocker(s, sim.derive(s));
    // Old enough, known enough, and earning enough to be worth listing.
    s.day = 300; s.reputation = 700; s.money = 6e9;
    let d = sim.derive(s);
    out.cap = sim.marketCap(s, d);
    out.blockedReady = sim.ipoBlocker(s, d);
    out.err = sim.floatCompany(s, d, null);
    out.floated = s.ipo.floated;
    out.raised = s.ipo.raised;
    d = sim.derive(s);
    out.dividend = d.dividendCost;
    out.inCosts = d.costs >= d.dividendCost;
    // The rate must step up on the anniversary, not drift.
    out.rate0 = sim.dividendRate(0);
    out.rate3 = sim.dividendRate(3);
    // And it must come back off a save.
    S.save(s);
    const back = S.load();
    out.reloaded = !!(back && back.ipo && back.ipo.floated && back.ipo.raised > 0);
    return out;
  });
  const ok = r.blockedFresh && !r.blockedReady && !r.err && r.floated
    && r.raised > 0 && r.dividend > 0 && r.inCosts
    && r.rate3 > r.rate0 && r.reloaded;
  if (ok) {
    pass('the company can float, and then owes for ever',
      `listed at ${(r.cap / 1e9).toFixed(1)}B, raised ${(r.raised / 1e9).toFixed(2)}B, `
      + `${r.dividend.toFixed(0)}/s rising ${(r.rate0 * 100).toFixed(1)}% to `
      + `${(r.rate3 * 100).toFixed(1)}%`);
  } else {
    fail('the company can float, and then owes for ever', JSON.stringify(r));
  }
  await page.close();
}

// ------------------------------------------------ the data files are the shape
// This exists because a generated merge put forty-five building objects into
// the CATEGORIES array instead of BUILDINGS, and the build panel rendered every
// one of their names as a category button across the top of the most used
// screen in the game. Fifty-nine checks were green while it was broken, because
// not one of them looked at the shape of the data — they all looked at
// behaviour that happened to survive it.
{
  const page = await newPage();
  await page.click('text=Start in the cupboard');
  await page.waitForTimeout(300);
  const r = await page.evaluate(async () => {
    const B = await import('/src/data/buildings.js');
    const H = await import('/src/data/hardware.js');
    const P = await import('/src/data/progression.js');
    const C = await import('/src/data/contracts.js');
    const E = await import('/src/data/events.js');
    const R = await import('/src/data/research.js');
    const bad = [];
    // The category row is five buttons and has been for the life of the game.
    if (B.CATEGORIES.length !== 5) bad.push(`CATEGORIES has ${B.CATEGORIES.length} entries`);
    for (const c of B.CATEGORIES) {
      const keys = Object.keys(c).sort().join(',');
      if (keys !== 'id,name') bad.push(`category ${c.id} carries ${keys}`);
    }
    const cats = new Set(B.CATEGORIES.map((c) => c.id));
    for (const b of B.BUILDINGS) {
      if (!cats.has(b.cat)) bad.push(`building ${b.id} is in category ${b.cat}`);
      if (!b.name || !b.desc || typeof b.cost !== 'number' || !b.color || !b.glyph) {
        bad.push(`building ${b.id} is missing a field`);
      }
    }
    for (const h of H.HARDWARE) {
      if (!h.name || !h.desc || !(h.compute > 0) || !(h.power > 0) || typeof h.tier !== 'number') {
        bad.push(`hardware ${h.id} is missing a field`);
      }
    }
    for (const t of C.CONTRACT_TEMPLATES) {
      if (!t.name || !t.blurb || !t.clients || !t.clients.length || !(t.size > 0) || !(t.pay > 0)) {
        bad.push(`contract ${t.id} is missing a field`);
      }
    }
    for (const e of E.EVENTS) {
      if (!e.name || !e.text || (!e.mods && !e.choice)) bad.push(`event ${e.id} is missing a field`);
      if (typeof e.when !== 'function') bad.push(`event ${e.id} has no condition`);
    }
    for (const u of P.UPGRADES) {
      if (!u.name || !u.desc || !u.cat || !u.effects || !Object.keys(u.effects).length) {
        bad.push(`upgrade ${u.id} is missing a field`);
      }
    }
    for (const f of P.FACILITIES) {
      if (!f.name || !(f.w > 0) || !(f.h > 0) || typeof f.cost !== 'number') {
        bad.push(`facility ${f.id} is missing a field`);
      }
    }
    for (const pair of [['building', B.BUILDINGS], ['hardware', H.HARDWARE],
      ['research', R.RESEARCH], ['contract', C.CONTRACT_TEMPLATES], ['event', E.EVENTS],
      ['upgrade', P.UPGRADES]]) {
      const seen = new Set();
      for (const x of pair[1]) {
        if (seen.has(x.id)) bad.push(`duplicate ${pair[0]} id ${x.id}`);
        seen.add(x.id);
      }
    }
    return { bad: bad.slice(0, 8), total: bad.length,
      counts: { buildings: B.BUILDINGS.length, hardware: H.HARDWARE.length,
        research: R.RESEARCH.length, contracts: C.CONTRACT_TEMPLATES.length,
        events: E.EVENTS.length, upgrades: P.UPGRADES.length } };
  });
  if (!r.total) {
    pass('the data files are the shape they claim to be',
      Object.keys(r.counts).map((k) => k + ' ' + r.counts[k]).join(', '));
  } else {
    fail('the data files are the shape they claim to be',
      r.total + ' problems: ' + r.bad.join('; '));
  }
  await page.close();
}

// --------------------------------------- the biggest floor is still playable
// The largest site is 6,600 tiles, ten times what it used to be, and every tile
// is a depth-sorted draw. Before culling, the top tier cost 71.6 ms a frame.
// Culling is what makes it hold, and a regression here would not throw or look
// wrong — it would quietly make the last third of the game unplayable.
{
  const page = await newPage(1600, 950);
  await page.click('text=Start in the cupboard');
  await page.evaluate(() => { window.__rr.state.tutorial.skipped = true; });
  await page.waitForTimeout(300);
  const r = await page.evaluate(async () => {
    const A = await import('/src/actions.js'); const sim = await import('/src/sim.js');
    const R = await import('/src/data/research.js'); const St = await import('/src/state.js');
    const app = window.__rr, s = app.state;
    s.research.done = R.RESEARCH.map((x) => x.id);
    s.money = 1e30; s.reputation = 1e7;
    while (s.facility < 15 && !A.upgradeFacility(s, app.hooks)) { s.money = 1e30; }
    s.money = 1e30; app.d = sim.derive(s);
    const f = St.roomOf(s);
    for (let x = 0; x < f.w; x++) {
      for (let y = 0; y < f.h; y++) A.place(s, app.d, x, y, 'rack3', app.hooks);
    }
    app.d = sim.derive(s);
    app.view.centred = false;
    app.view.draw(s, app.d, 0);
    const whole = app.view.drawnLastFrame;
    app.view.zoom = 0.9;
    app.view.ox = app.view.w / 2; app.view.oy = app.view.h / 2;
    app.view.draw(s, app.d, 0);
    const close = app.view.drawnLastFrame;
    const t0 = performance.now();
    for (let i = 0; i < 15; i++) app.view.draw(s, app.d, 0.016);
    return { tier: s.facility, tiles: Object.keys(s.tiles).length, whole, close,
      ms: (performance.now() - t0) / 15 };
  });
  if (r.tiles >= 6_000 && r.close < r.tiles / 4 && r.whole > r.close) {
    pass('the biggest floor draws a screenful, not a siteful',
      `${r.tiles} tiles, ${r.close} drawn zoomed in, ${r.ms.toFixed(0)} ms`);
  } else {
    fail('the biggest floor draws a screenful, not a siteful', JSON.stringify(r));
  }
  await page.close();
}

// ------------------------------------------------- compute is a commodity
// Revenue used to be strictly linear in compute while every cost stayed tied
// to kW, tiles or heads — so across a full game revenue went from 5x costs to
// 29,000,000x and there was nothing left to manage. The price per unit now
// falls as the site floods the market. Two things have to hold: a small site
// pays the list price, and a large one does not.
{
  const page = await newPage();
  await page.click('text=Start in the cupboard');
  await page.evaluate(() => { window.__rr.state.tutorial.skipped = true; });
  await page.waitForTimeout(300);
  const curve = await page.evaluate(async () => {
    const sim = await import('/src/sim.js');
    const s = window.__rr.state;
    const at = (c) => sim.sellPrice(s, c) / s.market.compute;
    return {
      ref: sim.MARKET_REF, floor: sim.MARKET_FLOOR,
      small: at(sim.MARKET_REF * 0.5),
      atRef: at(sim.MARKET_REF),
      x1e3: at(sim.MARKET_REF * 1e3),
      x1e6: at(sim.MARKET_REF * 1e6),
      x1e9: at(sim.MARKET_REF * 1e9),
      huge: at(sim.MARKET_REF * 1e15),
    };
  });
  const monotone = curve.atRef > curve.x1e3 && curve.x1e3 > curve.x1e6
    && curve.x1e6 >= curve.x1e9;
  // The opening is fragile and is not where the problem was, so nothing at or
  // below the reference may be touched at all.
  const earlyUntouched = curve.small === 1 && curve.atRef === 1;
  // It has to bite: a thousandfold site cannot still be near list, and a
  // millionfold one has to be near the floor.
  //
  // The thresholds were halved with the elasticity, after a player watched the
  // rate reach 17% of list at 189,000 units and read it as a punishment for
  // building rather than a market clearing. What is under test is that the
  // decay is real and arrives, not how steep it is — the steepness is a
  // tuning number and this is the assertion that must not move every time it
  // does.
  const bites = curve.x1e3 < 0.45 && curve.x1e6 < 0.2;
  // And it must never fall through the floor, at any size at all. Decaying
  // towards nothing is what made the late game unwinnable: revenue went
  // sublinear in site size while upkeep stayed linear, the two crossed, and
  // a site at tier 8 sank for three hundred days with no move that helped.
  // The floor is what keeps revenue scaling like the costs it has to cover,
  // so it is the invariant worth pinning, not the depth of the decay.
  const holdsFloor = curve.x1e9 >= curve.floor && curve.huge >= curve.floor
    && curve.huge < curve.floor * 1.02;
  if (monotone && earlyUntouched && bites && holdsFloor) {
    pass('compute is worth less the more of it you sell, down to a floor',
      '1e3x:' + (curve.x1e3 * 100).toFixed(1) + '%  1e6x:' + (curve.x1e6 * 100).toFixed(1)
      + '%  floor ' + (curve.floor * 100).toFixed(0) + '% holds at 1e15x');
  } else {
    fail('compute is worth less the more of it you sell, down to a floor',
      JSON.stringify({ ...curve, monotone, earlyUntouched, bites, holdsFloor }));
  }
  await page.close();
}

// ----------------------------------------- the headline fits where it is shown
// The sub-line under COMPUTE is the game's central diagnostic and it is inside
// a fixed-width cell, so a sentence one word too long simply disappears: it
// read "no servers inst…" on a 1920px screen. Every short form has to fit, and
// every bottleneck the sim can produce has to have one.
{
  const page = await newPage();
  await page.click('text=Start in the cupboard');
  await page.evaluate(() => { window.__rr.state.tutorial.skipped = true; });
  await page.waitForTimeout(400);
  const fit = await page.evaluate(async () => {
    const ui = await import('/src/ui.js');
    const sub = [...document.querySelectorAll('#topbar .vital')][1].querySelector('.sub');
    const was = sub.textContent;
    const cut = [];
    for (const [full, short] of Object.entries(ui.SHORT_BOTTLENECK)) {
      sub.textContent = short;
      if (sub.scrollWidth > sub.clientWidth + 1) cut.push(short + ' (' + sub.scrollWidth + 'px)');
      void full;
    }
    sub.textContent = was;
    return { cut, have: sub.clientWidth, n: Object.keys(ui.SHORT_BOTTLENECK).length };
  });
  // And the sim must not be able to produce one the map has never heard of.
  const missing = await page.evaluate(async () => {
    const ui = await import('/src/ui.js');
    const res = await fetch('/src/sim.js').then((r) => r.text());
    const found = [...res.matchAll(/bottleneck = '([^']+)'/g)].map((m) => m[1]);
    return found.filter((x) => !(x in ui.SHORT_BOTTLENECK));
  });
  if (!fit.cut.length && !missing.length) {
    pass('the compute headline fits its cell', fit.n + ' phrasings in ' + fit.have + 'px');
  } else {
    fail('the compute headline fits its cell',
      JSON.stringify({ cut: fit.cut, noShortForm: missing }));
  }
  await page.close();
}

// --------------------------------------------- the first screen of the shop
// The build and hardware lists used to open on everything in the game, so a
// player with $10,000 met a $900B fusion reactor before anything they could
// buy. What is reachable comes first, a couple of next goals after it, and the
// rest waits behind a line.
{
  const page = await newPage();
  await page.click('text=Start in the cupboard');
  await page.waitForTimeout(400);
  const counts = [];
  for (const cat of ['Racks', 'Power', 'Cooling', 'Water', 'Support']) {
    await page.evaluate((c) => {
      [...document.querySelectorAll('#panel .btnrow .btn')].find((b) => b.textContent === c)?.click();
    }, cat);
    await page.waitForTimeout(250);
    counts.push(await page.evaluate((c) => ({
      cat: c,
      locked: document.querySelectorAll('#panel .row.locked').length,
      fold: !!document.querySelector('#panel .lockfold'),
    }), cat));
  }
  const wall = counts.filter((c) => c.locked > 2);
  if (!wall.length) {
    pass('the shop opens on what you can reach',
      counts.map((c) => c.cat + ':' + c.locked).join(' '));
  } else {
    fail('the shop opens on what you can reach', JSON.stringify(wall));
  }
  // And the line actually opens.
  const opened = await page.evaluate(async () => {
    const b = document.querySelector('#panel .lockfold');
    if (!b) return -1;
    const before = document.querySelectorAll('#panel .row.locked').length;
    b.click();
    await new Promise((r) => setTimeout(r, 250));
    return document.querySelectorAll('#panel .row.locked').length - before;
  });
  if (opened > 0) pass('the locked half opens when you ask for it', '+' + opened + ' rows');
  else fail('the locked half opens when you ask for it', String(opened));
  await page.close();
}

// ------------------------------------- the headline and the list agree
// These ran off two different thresholds, so a site between them had the top
// bar saying compute was going to waste while the to-do list said nothing was
// wrong. Whenever the headline says it, the list has to say it too.
{
  const page = await newPage();
  await page.click('text=Start in the cupboard');
  await page.evaluate(() => { window.__rr.state.tutorial.skipped = true; });
  await page.waitForTimeout(300);
  const agree = await page.evaluate(async () => {
    const A = await import('/src/actions.js'); const sim = await import('/src/sim.js');
    const app = window.__rr, s = app.state;
    s.money = 1e9;
    A.place(s, app.d, 2, 2, 'pdu', null); app.d = sim.derive(s);
    for (let x = 0; x < 4; x++) { A.place(s, app.d, x, 1, 'rack', null); app.d = sim.derive(s); }
    // Cool and fed, so the bottleneck chain gets past power and heat and
    // actually reaches the clause under test. A site that is too hot names the
    // heat instead, and rightly: the headline is the worst thing, not a list.
    for (const x of [0, 1, 2, 3]) { A.place(s, app.d, x, 2, 'fan', null); app.d = sim.derive(s); }
    A.buyGrid(s, A.maxGrid(s), null); app.d = sim.derive(s);
    A.fillAll(s, app.d, 'desktop', null); app.d = sim.derive(s);
    const out = [];
    // Sweep the whole band either side of both old thresholds.
    for (const frac of [0.6, 0.65, 0.7, 0.72, 0.75, 0.78, 0.8, 0.85, 0.9]) {
      s.contracts.active = [{
        cid: 'x', tid: 'static', name: 'Test', client: 'Test', pay: 1, days: 9,
        demand: app.d.computeSellable * frac, startDay: s.day, endDay: s.day + 9,
        breached: false, delivered: 1, effUptime: 1, uptime: 0.8,
      }];
      const d = sim.derive(s);
      const headline = d.bottleneck === 'compute going to waste';
      const listed = d.problems.some((p) => /nobody is paying for/.test(p.text));
      out.push({ frac, headline, listed, ok: headline === listed, saw: d.bottleneck,
        temp: +d.maxTemp.toFixed(0) });
    }
    return out;
  });
  const bad = agree.filter((x) => !x.ok);
  // A sweep in which the headline never fires proves nothing, so say so rather
  // than passing on an empty set.
  if (!agree.some((x) => x.headline)) {
    fail('the headline and the to-do list agree about idle compute',
      'the headline never said it: ' + JSON.stringify(agree.map((x) => x.saw)));
  } else if (!bad.length) {
    pass('the headline and the to-do list agree about idle compute',
      agree.filter((x) => x.headline).length + ' of ' + agree.length + ' say it');
  } else {
    fail('the headline and the to-do list agree about idle compute', JSON.stringify(bad));
  }
  await page.close();
}

// ------------------------------------------------- readable without colour
// Everything the game says in red or amber has to say it a second way, or a
// tenth of the men playing cannot read it. Colour is checked by shape here,
// not by eye: two problems must draw two different polygons, and a meter over
// capacity must carry a mark that survives a greyscale.
{
  const page = await newPage();
  await page.click('text=Start in the cupboard');
  await page.evaluate(() => { window.__rr.state.tutorial.skipped = true; });
  await page.waitForTimeout(400);

  // Count the vertices of every filled path a warning draws, by asking the
  // view to draw one rack in trouble at a time.
  const shapes = await page.evaluate(() => {
    const view = window.__rr.view;
    const zoom = view.zoom; view.zoom = 1;
    const ctx = view.ctx;
    const real = { beginPath: ctx.beginPath, moveTo: ctx.moveTo, lineTo: ctx.lineTo, fill: ctx.fill };
    let n = 0; const out = [];
    ctx.beginPath = function (...a) { n = 0; return real.beginPath.apply(this, a); };
    ctx.moveTo = function (...a) { n = 1; return real.moveTo.apply(this, a); };
    ctx.lineTo = function (...a) { n++; return real.lineTo.apply(this, a); };
    ctx.fill = function (...a) { if (n) out.push(n); n = 0; return real.fill.apply(this, a); };
    const rack = (extra) => Object.assign(
      { x: 1, y: 1, used: 4, cap: 8, pduFactor: 1, cover: 1, temp: 22 }, extra);
    const top = { x: 200, y: 200 };
    view.rackWarnings(ctx, rack({ pduFactor: 0.4 }), top);
    const starved = out.splice(0);
    view.rackWarnings(ctx, rack({ temp: 52 }), top);
    const cooking = out.splice(0);
    view.rackWarnings(ctx, rack({}), top);
    const fine = out.splice(0);
    Object.assign(ctx, real);
    view.zoom = zoom;
    return { starved, cooking, fine };
  });
  const sv = shapes.starved[0], cv = shapes.cooking[0];
  if (sv && cv && sv !== cv && !shapes.fine.length) {
    pass('a starved rack and a cooking one are different shapes',
      `${sv}-sided vs ${cv}-sided`);
  } else {
    fail('a starved rack and a cooking one are different shapes', JSON.stringify(shapes));
  }

  // A meter past capacity: striped fill and an exclamation before the number,
  // neither of which depends on being able to see the red.
  // A meter past capacity: striped fill and an exclamation before the number,
  // neither of which depends on being able to see the red. The power meter is
  // clamped at supply by construction and can never read over, so the state is
  // set on the element — what is under test is the styling contract, not which
  // utility happens to be short.
  const cue = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('.meters .meter')];
    if (rows.length < 2) return { rows: rows.length };
    const read = (n) => ({
      stripes: getComputedStyle(n.querySelector('.mbar > i')).backgroundImage !== 'none',
      before: getComputedStyle(n.querySelector('.mv'), '::before').content,
    });
    rows[0].className = 'meter bad';
    rows[1].className = 'meter';
    return { bad: read(rows[0]), ok: read(rows[1]) };
  });
  if (cue.bad && cue.bad.stripes && /!/.test(cue.bad.before)
      && !cue.ok.stripes && !/!/.test(cue.ok.before)) {
    pass('a meter over capacity is marked without colour',
      'stripes + ' + cue.bad.before.replace(/"/g, ''));
  } else {
    fail('a meter over capacity is marked without colour', JSON.stringify(cue));
  }
  await page.close();
}

// ------------------------------------------- a held clock never hides itself
//
// A decision event and the bank's rescue offer both stop time on purpose, and
// both live in the save. Written into a save and reloaded, they used to come
// back holding the clock with no modal on screen: the site rendered, the
// ledger showed income per second, and the day never moved. This walks that
// exact path — set it, save it, reload, continue — and then does it again with
// an id no longer in the game, which must not cost the player their save.
{
  const page = await newPage();
  await page.click('text=Start in the cupboard');
  await page.waitForTimeout(400);

  const plant = (id) => page.evaluate((id) => {
    const s = window.__rr.state;
    s.events.pending = { id, at: s.day };
    s.tutorial.skipped = true;
    window.__rr.save();
  }, id);
  // Long enough for the offline-progress threshold to be irrelevant either way.
  const resume = async () => {
    await page.goto(URL, { waitUntil: 'networkidle' });
    await page.click('text=Continue');
    await page.waitForTimeout(1600);
  };
  const probe = async () => {
    const before = await page.evaluate(() => {
      window.__rr.state.settings.speed = 5;
      return window.__rr.state.day;
    });
    await page.waitForTimeout(1200);
    const after = await page.evaluate(() => window.__rr.state.day);
    return { before, after, moved: after > before + 0.05 };
  };

  await plant('poach');
  await resume();
  const held = await page.evaluate(() => ({
    modal: !!document.getElementById('modal') && !document.getElementById('modal').hidden,
    title: document.querySelector('#modal h2')?.textContent || '',
    pending: window.__rr.state.events.pending?.id || null,
  }));
  if (held.modal && held.pending === 'poach') {
    pass('a decision saved mid-answer comes back on screen', held.title || 'modal open');
  } else {
    fail('a decision saved mid-answer comes back on screen', JSON.stringify(held));
  }

  // Answering it must release the clock.
  await page.evaluate(() => document.querySelector('#modal .btnrow .btn')?.click());
  await page.waitForTimeout(300);
  const freed = await probe();
  if (freed.moved) pass('answering it starts the clock again', `day ${freed.before} -> ${freed.after}`);
  else fail('answering it starts the clock again', JSON.stringify(freed));

  // An event id an update has removed: the watchdog clears it rather than
  // holding the clock for a modal that can never be built.
  await plant('an-event-that-no-longer-exists');
  await resume();
  const recovered = await probe();
  const cleared = await page.evaluate(() => window.__rr.state.events.pending);
  if (recovered.moved && !cleared) {
    pass('an event the game no longer has does not stop time',
      `day ${recovered.before} -> ${recovered.after}`);
  } else {
    fail('an event the game no longer has does not stop time',
      JSON.stringify({ recovered, cleared }));
  }
  await page.close();
}

// ------------------------------------------------- the ledger adds up to net
//
// Every line on the Ledger is a slice of the same two totals, and splitting
// one out is how the same dollar ends up printed twice: generation upkeep is
// part of the site's upkeep, so giving it its own row without taking it out
// of the row it came from would overstate costs on the one panel a player
// checks when they want to know where the money goes.
{
  const page = await newPage();
  await page.click('text=Start in the cupboard');
  const sums = await page.evaluate(async () => {
    const sim = await import('/src/sim.js');
    const A = await import('/src/actions.js');
    const B = await import('/src/data/buildings.js');
    const R = await import('/src/data/research.js');
    const app = window.__rr;
    const s = app.state;
    s.tutorial.skipped = true;
    // A site with its own generation, fuel, water and staff, so every line on
    // the ledger is a number rather than a zero.
    s.facility = 6; s.money = 1e12; s.gridPower = 40000;
    for (const n of R.RESEARCH) s.research.done.push(n.id);
    s.staff.tech = 3; s.staff.eng = 2;
    app.d = sim.derive(s);
    const want = ['rack', 'pdu', 'fan', 'genset', 'solar', 'tank', 'switch'];
    let x = 0, y = 0;
    for (const id of want) {
      const b = B.BUILDINGS_BY_ID[id] || B.BUILDINGS.find((z) => z.id.startsWith(id));
      if (!b) continue;
      A.place(s, app.d, x, y, b.id, { log() {} });
      x += 1; if (x > 8) { x = 0; y += 1; }
      app.d = sim.derive(s);
    }
    A.fillAll(s, app.d, 'desktop', { log() {} });
    s.bank.debt = 1e6;
    app.d = sim.derive(s);
    const d = app.d;
    const lines = d.powerCost + d.plantUpkeep + d.fuelCost + d.waterBill + d.salaryCost
      + d.machineUpkeep + d.penalties + d.interestCost + d.dividendCost;
    return {
      revenue: d.revenue, costs: d.costs, lines, net: d.netIncome,
      plantUpkeep: d.plantUpkeep, machineUpkeep: d.machineUpkeep,
      overdraft: d.overdraftCost,
    };
  });
  const slack = Math.max(1e-6, sums.costs * 1e-6);
  if (Math.abs(sums.lines - sums.costs) <= slack) {
    pass('the ledger adds up to what the site costs',
      'plant ' + sums.plantUpkeep.toFixed(2) + ' + site ' + sums.machineUpkeep.toFixed(2)
      + ' of ' + sums.costs.toFixed(2) + '/s');
  } else {
    fail('the ledger adds up to what the site costs', JSON.stringify(sums));
  }
  await page.close();
}

// --------------------------- an old save is told its machines draw more now
//
// Hardware draw is read from the data files, not from the save, so the
// efficiency rebalance changes what an existing site pulls the moment it
// loads. A site that browns out with no explanation looks like a bug in the
// game rather than a change to it, so the migration tops the connection up to
// the site's allowance and says what happened.
{
  const page = await newPage();
  await page.click('text=Start in the cupboard');
  const planted = await page.evaluate(async () => {
    const S = await import('/src/state.js');
    const A = await import('/src/actions.js');
    const sim = await import('/src/sim.js');
    const app = window.__rr;
    const s = app.state;
    s.tutorial.skipped = true;
    s.money = 5e5;
    let d = sim.derive(s);
    A.place(s, d, 2, 2, 'pdu', null); d = sim.derive(s);
    A.place(s, d, 2, 1, 'rack', null); d = sim.derive(s);
    s.gridPower = 8;
    // A save written by an older build, which is the whole trigger.
    s.build = '2000-01-01a';
    window.__rr.save();
    return { wrote: s.build, grid: s.gridPower, cap: A.gridCap(s) };
  });
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.click('text=Continue');
  await page.waitForTimeout(1200);
  const after = await page.evaluate(() => ({
    modal: !!document.getElementById('modal') && !document.getElementById('modal').hidden,
    title: document.querySelector('#modal h2')?.textContent || '',
    grid: window.__rr.state.gridPower,
    build: window.__rr.state.build,
    flag: window.__rr.state.powerRebalance,
  }));
  if (after.modal && /draw/i.test(after.title) && after.grid === planted.cap
      && after.build !== planted.wrote && !after.flag) {
    pass('an old save is told its machines draw more now',
      `connection ${planted.grid} -> ${after.grid} kW, and said so once`);
  } else {
    fail('an old save is told its machines draw more now',
      JSON.stringify({ planted, after }));
  }
  await page.close();
}

// ------------------------------ the tabs say where there is something to do
//
// "It should always feel like you can upgrade something." The counts that
// answer that were spread across four panels, so the tabs carry them now: a
// machine better than your best, a building that beats what is already on the
// floor for its category, a research node you can pay for, a deal that fits.
// What has to hold is that the badge appears when there is something and goes
// away when there is not — a count that is always lit is wallpaper.
{
  const page = await newPage();
  await page.click('text=Start in the cupboard');
  await page.waitForTimeout(400);
  const read = () => page.evaluate(() => Object.fromEntries(
    [...document.querySelectorAll('#tabs .tab')].map((t) => [t.dataset.tab,
      parseInt(t.querySelector('.badge')?.textContent || '0', 10)])));
  const fresh = await read();
  // Broke, with nothing researched: nothing anywhere should be lit.
  await page.evaluate(async () => {
    const sim = await import('/src/sim.js');
    const app = window.__rr;
    app.state.tutorial.skipped = true;
    app.state.money = 0;
    app.state.rp = 0;
    app.d = sim.derive(app.state);
    app.refreshLive();
  });
  await page.waitForTimeout(300);
  const broke = await read();
  // Rich, and with the best coolers the tree allows already on the floor: the
  // Build count has to fall, because a count of things that do not beat what
  // is already down there is wallpaper rather than a signal.
  const rich = await page.evaluate(async () => {
    const sim = await import('/src/sim.js');
    const A = await import('/src/actions.js');
    const B = await import('/src/data/buildings.js');
    const R = await import('/src/data/research.js');
    const app = window.__rr;
    const s = app.state;
    s.money = 1e9;
    s.rp = 1e7;
    for (const n of R.RESEARCH) s.research.done.push(n.id);
    app.d = sim.derive(s);
    const before = [...document.querySelectorAll('#tabs .tab')]
      .reduce((n, t) => n + parseInt(t.querySelector('.badge')?.textContent || '0', 10), 0);
    // The best of each category this money can buy, one of each.
    const cap = (b) => Math.max(b.slots || 0, b.powerCap || 0, b.supplyKW || 0, b.coolCap || 0,
      b.supplyWater || 0, b.net || 0, b.staff || 0, b.research || 0, b.repair || 0);
    let x = 0;
    for (const c of B.CATEGORIES) {
      const best = B.BUILDINGS.filter((b) => b.cat === c.id && b.cost <= s.money)
        .sort((a, b) => cap(b) - cap(a))[0];
      if (!best) continue;
      A.place(s, app.d, x++, 0, best.id, { log() {} });
      app.d = sim.derive(s);
    }
    app.refreshLive();
    return { before };
  });
  await page.waitForTimeout(300);
  const stocked = await read();

  const ok = fresh.build > 0 && fresh.upgrade > 0
    && broke.build === 0 && broke.racks === 0 && broke.upgrade === 0
    && stocked.build < fresh.build
    && !fresh.ops && !fresh.site && !fresh.town;
  if (ok) {
    pass('the tabs say where there is something to do',
      `fresh build ${fresh.build}, broke all clear, `
      + `build ${stocked.build} once the best of each is on the floor`);
  } else {
    fail('the tabs say where there is something to do',
      JSON.stringify({ fresh, broke, rich, stocked }));
  }
  await page.close();
}

// ------------------------- a bad stretch dents your name, it does not erase it
//
// The deadlock this guards against: a site at its facility's power cap cannot
// add compute, so any wobble drops it under what its contracts promised;
// breaching costs reputation; and the next facility — the only thing that
// raises the power cap — is gated on reputation. Measured, that left a run
// sitting at tier 4 from day 300 past day 470 with three and a half billion
// in the bank and reputation swinging between 127 and 284 against the 400 it
// needed. The floor under a track record is what breaks the loop, so it has
// to hold, and a completion still has to be able to push past the old peak.
{
  const page = await newPage();
  await page.click('text=Start in the cupboard');
  const r = await page.evaluate(async () => {
    const sim = await import('/src/sim.js');
    const app = window.__rr;
    const s = app.state;
    s.tutorial.skipped = true;
    s.reputation = 400;
    s.repPeak = 400;
    // One contract, wildly over-promised, so it breaches every tick.
    // Long enough that it never completes: what is under test is the floor
    // while breaching, and a contract that ends stops the bleeding early and
    // makes the assertion pass without ever reaching it.
    s.contracts.active = [{
      cid: 'x1', tid: s.contracts.offers[0]?.tid || 'c_backup', name: 'Over-promised',
      client: 'Test', demand: 1e9, net: 1, pay: 1, days: 9999,
      endDay: s.day + 9999, uptimeReq: 0.99, penalty: 1, delivered: 0, effUptime: 0,
    }];
    let d = sim.derive(s);
    const quiet = { log() {}, onDecision() {}, onRescue() {} };
    for (let i = 0; i < 20_000; i++) { sim.tick(s, 0.2, d, quiet); d = sim.derive(s); }
    const sank = s.reputation;
    return {
      floor: sim.REP_FLOOR, peak: 400, sank,
      // It has to come to rest on the floor: high enough that the gate stays
      // reachable, low enough that breaching still costs something real.
      held: sank >= 400 * sim.REP_FLOOR - 0.5,
      reached: sank <= 400 * sim.REP_FLOOR + 0.5,
    };
  });
  if (r.held && r.reached) {
    pass('a bad stretch dents your name, it does not erase it',
      `400 down to ${r.sank.toFixed(0)}, floor ${(r.floor * 100).toFixed(0)}% of peak`);
  } else {
    fail('a bad stretch dents your name, it does not erase it', JSON.stringify(r));
  }
  await page.close();
}

// -------------------- placing something does not cover the floor on a phone
//
// On a phone the inspector is a sheet over the floor rather than a band that
// is always there, and placing a building selected it — so laying out a row
// meant dismissing a panel between every two taps. Tapping a tile still opens
// it, because that is the only way to find out why something is warning at
// you; it is placing that must not.
{
  for (const [w, h, name] of [[1500, 940, 'desktop'], [390, 844, 'phone']]) {
    const page = await newPage(w, h);
    await page.click('text=Start in the cupboard');
    await page.evaluate(() => { window.__rr.state.tutorial.skipped = true; });
    await page.waitForTimeout(400);
    const mode = await page.evaluate(() => getComputedStyle(document.documentElement)
      .getPropertyValue('--inspector').trim());
    // Place a power strip by picking the tool and tapping the floor.
    await page.evaluate(() => { window.__rr.view.tool = 'pdu'; });
    await clickTile(page, 2, 2);
    await page.waitForTimeout(400);
    const afterPlace = await page.evaluate(() => ({
      sel: !!window.__rr.view.sel,
      shown: document.getElementById('inspector').dataset.mode === 'tile',
    }));
    // And a plain tap on the tile just placed, which must open it either way.
    // The selection is cleared first because a tap on the already-selected
    // tile is a deselect — correct behaviour, and not what is under test.
    await page.evaluate(() => { window.__rr.view.tool = null; window.__rr.view.sel = null; });
    await clickTile(page, 2, 2);
    await page.waitForTimeout(400);
    const afterTap = await page.evaluate(() => ({
      sel: !!window.__rr.view.sel,
      shown: document.getElementById('inspector').dataset.mode === 'tile',
    }));

    const wantSelected = mode !== 'sheet';
    if (afterPlace.sel === wantSelected && afterTap.sel === true && afterTap.shown === true) {
      pass(`placing does not open the inspector on a ${name}`,
        `--inspector: ${mode}, selected after placing: ${afterPlace.sel}, after tapping: true`);
    } else {
      fail(`placing does not open the inspector on a ${name}`,
        JSON.stringify({ mode, afterPlace, afterTap }));
    }
    await page.close();
  }
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
