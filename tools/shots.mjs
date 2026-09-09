// Regenerates the screenshots in docs/. Needs a static server on the port
// below and a Playwright chromium:
//
//   python3 -m http.server 8099 &
//   RR_PLAYWRIGHT=... RR_CHROMIUM=... node tools/shots.mjs
//
// Every shot is driven through the real game, so they cannot drift from it.

import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const PW = process.env.RR_PLAYWRIGHT || 'playwright';
const { chromium } = await import(PW);

const URL = process.env.RR_URL || 'http://127.0.0.1:8099/index.html';
const OUT = join(dirname(dirname(fileURLToPath(import.meta.url))), 'docs');
const W = 1440;
const H = 900;

const browser = await chromium.launch({
  executablePath: process.env.RR_CHROMIUM || undefined,
});

async function shot(name, prepare) {
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  await page.goto(URL);
  await page.waitForTimeout(500);
  await prepare(page);
  await page.screenshot({ path: join(OUT, 'screenshot-' + name + '.png') });
  await page.close();
  console.log('  wrote docs/screenshot-' + name + '.png');
}

/** Skip the guide and hand the run enough money and research to look built. */
async function fastForward(page, opts) {
  await page.evaluate(async (o) => {
    const app = window.__rr;
    const A = await import('/src/actions.js');
    const sim = await import('/src/sim.js');
    const R = await import('/src/data/research.js');
    const s = app.state;
    s.tutorial.skipped = true;
    s.facility = o.facility;
    s.money = o.money;
    s.gridPower = o.grid;
    s.day = o.day;
    s.reputation = o.rep;
    for (const r of R.RESEARCH.slice(0, o.rnd)) s.research.done.push(r.id);
    app.d = sim.derive(s);
    // Every third column is support, cycling through the four kinds, which
    // is roughly what it takes to keep a floor of racks fed and cool.
    const SUPPORT = [o.pdu, o.cool, o.net, o.water];
    let n = 0;
    for (let y = 0; y < o.h; y++) for (let x = 0; x < o.w; x++) {
      const id = x % 3 === 2 ? SUPPORT[(Math.floor(x / 3) + y) % 4] : o.rack;
      A.place(s, app.d, x, y, id, null);
      if (++n % 60 === 0) app.d = sim.derive(s);
    }
    app.d = sim.derive(s);
    A.fillAll(s, app.d, o.gpu, null);
    app.d = sim.derive(s);
    app.view.centred = false;

    // Let it run so the plant settles and the board fills, then take what
    // there is spare compute for — an empty deal panel photographs badly.
    for (let i = 0; i < 900; i++) { sim.tick(s, 0.2, app.d); app.d = sim.derive(s); }
    for (const offer of [...s.contracts.offers]) {
      sim.signContract(s, app.d, offer, { log() {} });
      app.d = sim.derive(s);
    }
    window.__shotDiag = {
      problems: app.d.problems.map((p) => p.text),
      deals: s.contracts.active.length,
      offers: s.contracts.offers.length,
    };
  }, opts);
  await page.waitForTimeout(2000);
  const diag = await page.evaluate(() => window.__shotDiag);
  if (process.env.RR_SHOT_DIAG) console.log('    ', JSON.stringify(diag));
  return diag;
}

const SMALL = {
  facility: 2, money: 4e5, grid: 900, day: 12, rep: 9, rnd: 14, w: 9, h: 6,
  rack: 'rack2', pdu: 'pdu2', cool: 'crac', net: 'switch', water: 'well', gpu: 'server',
};
const BIG = {
  facility: 8, money: 1e21, grid: 4e8, day: 190, rep: 900, rnd: 999, w: 22, h: 15,
  rack: 'rack5', pdu: 'pdu5', cool: 'cryo', net: 'switch4', water: 'desal', gpu: 'zetta',
};

console.log('writing screenshots to docs/');

await shot('title', async (page) => {
  // The boot screen sways; give it a beat to settle somewhere flattering.
  await page.waitForTimeout(2600);
});

await shot('guided-start', async (page) => {
  await page.click('text=Start in the cupboard');
  await page.waitForTimeout(900);
});

await shot('floor', async (page) => {
  await page.click('text=Start in the cupboard');
  await fastForward(page, SMALL);
  await page.click('#tabs >> text=Build');
  await page.waitForTimeout(500);
});

await shot('endgame', async (page) => {
  await page.click('text=Start in the cupboard');
  await fastForward(page, BIG);
  await page.click('#tabs >> text=Servers');
  await page.waitForTimeout(700);
});

await shot('contracts', async (page) => {
  await page.click('text=Start in the cupboard');
  await fastForward(page, BIG);
  await page.click('#tabs >> text=Deals');
  await page.waitForTimeout(700);
});

await shot('town', async (page) => {
  await page.click('text=Start in the cupboard');
  await fastForward(page, BIG);
  await page.click('#tabs >> text=Town');
  await page.waitForTimeout(900);
});

await shot('prestige', async (page) => {
  await page.click('text=Start in the cupboard');
  await fastForward(page, BIG);
  await page.click('#tabs >> text=Site');
  await page.waitForTimeout(700);
});

await shot('events', async (page) => {
  await page.click('text=Start in the cupboard');
  await fastForward(page, SMALL);
  await page.evaluate(async () => {
    const app = window.__rr;
    const E = await import('/src/data/events.js');
    const ask = E.EVENTS.find((e) => e.choice && e.options && e.options.length);
    if (ask) {
      app.state.events.pending = { id: ask.id, day: app.state.day };
      app.hooks.onDecision(ask);
    }
  });
  await page.waitForTimeout(800);
});

await browser.close();
console.log('done');
