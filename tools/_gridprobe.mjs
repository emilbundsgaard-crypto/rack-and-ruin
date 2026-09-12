const { chromium } = await import('playwright');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
p.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await p.goto('http://127.0.0.1:8099/index.html', { waitUntil: 'networkidle' });
await p.click('text=Start in the cupboard');
await p.waitForTimeout(400);
console.log(await p.evaluate(async () => {
  const A = await import('/src/actions.js');
  const s = window.__rr.state;
  const out = { gridPower: s.gridPower, cap: A.gridCap(s), money: s.money };
  s.money = 1e6;
  s.tutorial.skipped = true;
  window.__rr.refreshLive();
  return out;
}));
await p.waitForTimeout(300);
await p.click('#tabs [data-tab="ops"]').catch(() => {});
await p.waitForTimeout(600);
console.log(await p.evaluate(() => [...document.querySelectorAll('[data-grid]')].map((n) => ({
  label: n.textContent, kw: n.dataset.grid, disabled: n.disabled }))));
await b.close();
