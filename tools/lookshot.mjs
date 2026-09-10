// A repeatable picture of the floor, so a change to how it looks can be
// compared against the last one instead of admired in isolation.
import { chromium } from 'playwright';
const [out, tag, dayArg] = process.argv.slice(2);
const DAY = dayArg ? Number(dayArg) : 3.78;
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1240, height: 820 }, deviceScaleFactor: 2 });
const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.goto('http://127.0.0.1:8099/index.html', { waitUntil: 'networkidle' });
await p.click('text=Start in the cupboard');
await p.evaluate(async (day) => {
  window.__day = day;
  const A = await import('/src/actions.js');
  const sim = await import('/src/sim.js');
  const R = await import('/src/data/research.js');
  const app = window.__rr, s = app.state;
  s.tutorial.skipped = true; s.money = 1e14; s.reputation = 500;
  s.research.done = R.RESEARCH.map(r => r.id);
  while (s.facility < 3 && !A.upgradeFacility(s, app.hooks)) {}
  s.money = 1e14;
  app.d = sim.derive(s);
  const St = await import('/src/state.js');
  const f = St.roomOf(s);
  for (let x = 0; x < f.w; x++) for (let y = 0; y < f.h; y++) {
    const id = (x + y) % 7 === 0 ? 'pdu3' : (x + y) % 5 === 0 ? 'crac'
             : (x + y) % 11 === 0 ? 'noc' : 'rack3';
    A.place(s, app.d, x, y, id, app.hooks);
  }
  app.d = sim.derive(s);
  for (let i = 0; i < 6; i++) {
    A.buyGrid(s, A.maxGrid(s), app.hooks); app.d = sim.derive(s);
    A.fillAll(s, app.d, 'blade', app.hooks); app.d = sim.derive(s);
  }
  s.money = 2.4e8;
  s.day = window.__day;
  s.settings.speed = 0;
  app.view.centred = false;
}, DAY);
await p.waitForTimeout(1200);
await p.evaluate((d) => { window.__rr.state.day = d; }, DAY);
await p.waitForTimeout(600);
await p.locator('#canvaswrap').screenshot({ path: `${out}/look-${tag}.png` });
const fps = await p.evaluate(() => new Promise((res) => {
  let f = 0; const t0 = performance.now();
  const loop = () => { f++; performance.now() - t0 < 2000 ? requestAnimationFrame(loop) : res(f / ((performance.now() - t0) / 1000)); };
  requestAnimationFrame(loop);
}));
console.log(`${tag}: ${fps.toFixed(0)} fps`);
await b.close();
if (errs.length) { console.log('ERRORS', errs); process.exit(1); }
