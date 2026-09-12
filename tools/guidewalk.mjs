// Does the guide finish, and how reliably?
//
// The check suite walks it once. The sim is stochastic in a dozen places and
// the opening float only just covers what the guide asks for, so once is a
// coin toss dressed up as an assertion — the walk can stall at the technician
// for want of a hundred dollars on one seed and sail past it on the next.
// This walks it N times and reports the distribution.
//
//   node tools/guidewalk.mjs [runs]
const { chromium } = await import(process.env.RR_PLAYWRIGHT || 'playwright');
const URL = process.env.RR_URL || 'http://127.0.0.1:8099/index.html';
const RUNS = Number(process.argv[2] || 6);
const browser = await chromium.launch(process.env.RR_CHROMIUM ? { executablePath: process.env.RR_CHROMIUM } : {});
const rows = [];

for (let run = 0; run < RUNS; run++) {
  const page = await browser.newPage({ viewport: { width: 1500, height: 940 } });
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.click('text=Start in the cupboard');
  await page.waitForTimeout(400);
  await page.evaluate(() => { window.__rr.state.settings.speed = 10; });
  const spots = [[2, 2], [3, 2], [3, 3]];
  let placed = 0, stalls = 0;
  for (let guard = 0; guard < 220; guard++) {
    const n = await page.evaluate(() => window.__rr.state.tutorial.step);
    if (n >= 10) break;
    const target = await page.$('.tut-target');
    if (!target) { await page.waitForTimeout(500); continue; }
    const id = await page.evaluate((x) => x.id, target);
    const tag = await page.evaluate((x) => x.tagName, target);
    if (await page.evaluate((x) => x.disabled === true, target)) {
      stalls++;
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
      const c = await page.evaluate(([x, y]) => window.__rr.view.tileCentre(x, y), spots[Math.min(placed++, 2)]);
      await page.mouse.click(c.x, c.y);
    } else if (tag === 'INPUT') {
      await page.evaluate((x) => { x.value = '40'; x.dispatchEvent(new Event('input')); }, target);
      await page.waitForTimeout(700);
    } else {
      await target.click().catch(() => {});
    }
    await page.waitForTimeout(700);
  }
  const end = await page.evaluate(() => ({
    step: window.__rr.state.tutorial.step,
    day: +window.__rr.state.day.toFixed(1),
    money: Math.round(window.__rr.state.money),
  }));
  rows.push({ ...end, stalls, errs: errs.length });
  console.log(`run ${run}  step ${end.step}/10  day ${end.day}  $${end.money}  waited ${stalls}x`
    + (errs.length ? `  ERRORS ${errs.length}` : ''));
  await page.close();
}
await browser.close();
const done = rows.filter((r) => r.step >= 10).length;
console.log(`\n${done}/${RUNS} finished the guide; stopped at `
  + [...new Set(rows.filter((r) => r.step < 10).map((r) => r.step))].join(', ') || 'nowhere');
