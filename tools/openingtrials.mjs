// Does the guide leave you solvent?
//
// A player who does exactly what the game tells them should not finish the
// tutorial losing money. One run cannot answer that — the sim is stochastic in
// a dozen places — so this walks the guide N times and reports the spread.
//
//   node tools/openingtrials.mjs [runs]
import { chromium } from 'playwright';

const RUNS = Number(process.argv[2] || 6);
const b = await chromium.launch();
const rows = [];

for (let run = 0; run < RUNS; run++) {
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('http://127.0.0.1:8099/index.html', { waitUntil: 'networkidle' });
  await p.click('text=Start in the cupboard');
  await p.waitForTimeout(400);

  const spots = [[2, 2], [3, 2], [3, 3], [4, 2], [4, 3]];
  let placed = 0;
  for (let i = 0; i < 40; i++) {
    const step = await p.evaluate(() => window.__rr.state.tutorial.step);
    if (step >= 10) break;
    const target = await p.$('.tut-target');
    if (!target) { await p.waitForTimeout(400); continue; }
    const id = await p.evaluate((n) => n.id, target);
    const tag = await p.evaluate((n) => n.tagName, target);
    if (id === 'canvaswrap') {
      const spot = spots[Math.min(placed++, spots.length - 1)];
      const c = await p.evaluate(([x, y]) => window.__rr.view.tileCentre(x, y), spot);
      await p.mouse.click(c.x, c.y);
    } else if (tag === 'INPUT') {
      await p.evaluate((n) => { n.value = '40'; n.dispatchEvent(new Event('input')); }, target);
      await p.waitForTimeout(500);
    } else {
      await target.click().catch(() => {});
    }
    await p.waitForTimeout(600);
  }

  const read = () => p.evaluate(() => {
    const d = window.__rr.d, s = window.__rr.state;
    return {
      day: +s.day.toFixed(1), money: Math.round(s.money), net: +d.netIncome.toFixed(2),
      rev: +d.revenue.toFixed(2), power: +d.powerCost.toFixed(2), wages: +d.upkeepCost.toFixed(2),
      fines: +d.penalties.toFixed(2), compute: +d.computeTotal.toFixed(1),
      deals: s.contracts.active.length, staff: s.staff.tech || 0,
    };
  });
  // Close the end-of-guide card the way a player would, then let it run.
  await p.evaluate(() => {
    const m = document.getElementById('modal');
    if (m && !m.hidden) m.querySelector('.btnrow .btn')?.click();
  });
  const atEnd = await read();
  await p.evaluate(() => { window.__rr.state.settings.speed = 10; });
  const until = Date.now() + 25000;
  while (Date.now() < until) await p.waitForTimeout(500);
  await p.evaluate(() => { window.__rr.state.settings.speed = 1; });
  await p.waitForTimeout(300);
  const later = await read();
  rows.push({ run, atEnd, later, errs: errs.length });
  console.log(`run ${run}  end: day ${atEnd.day} $${atEnd.money} net ${atEnd.net} `
    + `(rev ${atEnd.rev} pwr ${atEnd.power} wages ${atEnd.wages} fines ${atEnd.fines}) `
    + `deals ${atEnd.deals}  |  later: day ${later.day} $${later.money} net ${later.net}`);
  await p.close();
}

const neg = rows.filter((r) => r.later.net < 0).length;
const broke = rows.filter((r) => r.later.money < r.atEnd.money).length;
console.log(`\n${neg}/${RUNS} still losing money after the guide; `
  + `${broke}/${RUNS} had less cash than when it ended`);
await b.close();
