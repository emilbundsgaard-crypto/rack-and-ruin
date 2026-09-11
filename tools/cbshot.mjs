// A frame with the site in trouble, for checking that state survives a
// colour-vision filter rather than being carried by hue alone.
import { chromium } from 'playwright';
const [out, tag] = process.argv.slice(2);
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1400, height: 880 }, deviceScaleFactor: 2 });
await p.goto('http://127.0.0.1:8099/index.html', { waitUntil: 'networkidle' });
await p.click('text=Start in the cupboard');
await p.evaluate(async () => {
  const A = await import('/src/actions.js'); const sim = await import('/src/sim.js');
  const R = await import('/src/data/research.js'); const St = await import('/src/state.js');
  const app = window.__rr, s = app.state;
  s.tutorial.skipped = true; s.money = 1e14; s.reputation = 500;
  s.research.done = R.RESEARCH.map(r => r.id);
  while (s.facility < 3 && !A.upgradeFacility(s, app.hooks)) {}
  s.money = 1e14; app.d = sim.derive(s);
  const f = St.roomOf(s);
  for (let x = 0; x < f.w; x++) for (let y = 0; y < f.h; y++)
    A.place(s, app.d, x, y, (x + y) % 9 === 0 ? 'pdu3' : 'rack3', app.hooks);
  app.d = sim.derive(s);
  for (let i = 0; i < 6; i++) {
    A.buyGrid(s, A.maxGrid(s), app.hooks); app.d = sim.derive(s);
    A.fillAll(s, app.d, 'blade', app.hooks); app.d = sim.derive(s);
  }
  // Deliberately starved: cooling and network over capacity, power short.
  s.money = 2.4e8; s.day = 3.88; s.settings.speed = 1; app.view.centred = false;
});
await p.waitForTimeout(1800);
await p.evaluate(() => { window.__rr.state.day = 3.88; window.__rr.state.settings.speed = 0; });
// Any event card that opened while the clock ran hides the canvas behind a
// blur and stops the draw loop, so the frame would show a stale board.
await p.evaluate(() => {
  const m = document.getElementById('modal');
  if (m && !m.hidden) { m.hidden = true; m.replaceChildren(); }
  window.__rr.view.draw(window.__rr.state, window.__rr.d, 0);
});
await p.waitForTimeout(500);
console.log('meter states:', await p.evaluate(() => {
  const rows = [...document.querySelectorAll('.meters .meter')];
  if (!rows.length) return 'NO METERS IN DOM';
  return rows.map((n) => {
    const state = n.className.replace('meter', '').trim() || 'ok';
    const mk = n.querySelector('.mk'), mv = n.querySelector('.mv');
    return (mk ? mk.textContent : '?') + '=' + state + '(' + (mv ? mv.textContent : '?') + ')';
  }).join(' ');
}));
await p.screenshot({ path: `${out}/cb-${tag}.png` });
await b.close();
