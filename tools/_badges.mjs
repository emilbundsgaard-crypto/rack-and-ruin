const { chromium } = await import('playwright');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1500, height: 940 } });
const errs = [];
p.on('pageerror', (e) => errs.push(e.message));
p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await p.goto('http://127.0.0.1:8099/index.html', { waitUntil: 'networkidle' });
await p.click('text=Start in the cupboard');
await p.waitForTimeout(500);
console.log('fresh:', await p.evaluate(() => [...document.querySelectorAll('#tabs .tab')]
  .map((t) => t.dataset.tab + ':' + (t.querySelector('.badge')?.textContent || '-')).join(' ')));
await p.evaluate(async () => {
  const sim = await import('/src/sim.js');
  const R = await import('/src/data/research.js');
  const app = window.__rr;
  app.state.tutorial.skipped = true;
  app.state.money = 5e9;
  app.state.rp = 1e6;
  for (const n of R.RESEARCH.slice(0, 120)) app.state.research.done.push(n.id);
  app.d = sim.derive(app.state);
  app.refreshLive();
});
await p.waitForTimeout(800);
console.log('rich :', await p.evaluate(() => [...document.querySelectorAll('#tabs .tab')]
  .map((t) => t.dataset.tab + ':' + (t.querySelector('.badge')?.textContent || '-')).join(' ')));
await p.click('#tabs [data-tab="upgrade"]');
await p.waitForTimeout(600);
console.log('next unlock row:', await p.evaluate(() => {
  const ks = [...document.querySelectorAll('#tabbody .kv .k')];
  const i = ks.findIndex((k) => k.textContent === 'Next unlock');
  return i < 0 ? '(missing)' : ks[i].nextElementSibling.textContent;
}));
console.log('errors:', errs.length ? errs.slice(0, 3) : 'none');
await b.close();
