// What the guide costs, step by step, at the current starting money.
const { chromium } = await import('playwright');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
p.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await p.goto('http://127.0.0.1:8099/index.html', { waitUntil: 'networkidle' });
await p.click('text=Start in the cupboard');
await p.waitForTimeout(400);
await p.evaluate(() => { window.__rr.state.settings.speed = 10; });
const spots = [[2,2],[3,2],[3,3],[4,2],[4,3]];
let placed = 0;
for (let i = 0; i < 150; i++) {
  const st = await p.evaluate(() => ({
    n: window.__rr.state.tutorial.step, money: Math.round(window.__rr.state.money),
    compute: +window.__rr.d.computeTotal.toFixed(1), units: window.__rr.d.unitsTotal,
    rev: +window.__rr.d.revenue.toFixed(2), day: +window.__rr.state.day.toFixed(1), net: +window.__rr.d.netIncome.toFixed(2), active: window.__rr.state.contracts.active.length, offers: window.__rr.state.contracts.offers.length,
  }));
  if (st.n >= 10) { console.log('finished', JSON.stringify(st)); break; }
  const target = await p.$('.tut-target');
  if (!target) { await p.waitForTimeout(500); continue; }
  const id = await p.evaluate((n) => n.id, target);
  const tag = await p.evaluate((n) => n.tagName, target);
  const what = await p.evaluate((n) => n.dataset.build || n.dataset.fill || n.dataset.sign
    || n.dataset.grid || n.dataset.research || n.dataset.hire || n.dataset.tab || n.id, target);
  const dis = await p.evaluate((n) => n.disabled === true, target);
  console.log(`step ${st.n}  $${st.money}  day ${st.day}  rev ${st.rev}  net ${st.net}  active ${st.active}  offers ${st.offers}  -> ${what}${dis ? ' [DISABLED]' : ''}`);
  if (id === 'canvaswrap') {
    const c = await p.evaluate(([x,y]) => window.__rr.view.tileCentre(x,y), spots[Math.min(placed++, 4)]);
    await p.mouse.click(c.x, c.y);
  } else if (tag === 'INPUT') {
    await p.evaluate((n) => { n.value = '40'; n.dispatchEvent(new Event('input')); }, target);
    await p.waitForTimeout(800);
  } else if (dis) {
    await p.waitForTimeout(900);
  } else {
    await target.click().catch(() => {});
  }
  await p.waitForTimeout(700);
}
await b.close();
