// The first ten minutes, at the pace a person plays them: follow the guide,
// then leave the site alone and photograph what it looks like while the
// player is deciding what to do next. Friction is what you can see in these.
//
//   node tools/openingshot.mjs <outdir>
import { chromium } from 'playwright';

const out = process.argv[2] || '.';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const errs = [];
p.on('pageerror', (e) => errs.push(e.message));
await p.goto('http://127.0.0.1:8099/index.html', { waitUntil: 'networkidle' });
await p.click('text=Start in the cupboard');
await p.waitForTimeout(600);

const read = () => p.evaluate(() => {
  const d = window.__rr.d, s = window.__rr.state;
  const modal = document.getElementById('modal');
  return {
    day: +s.day.toFixed(2),
    money: Math.round(s.money),
    net: +d.netIncome.toFixed(2),
    compute: +d.computeTotal.toFixed(1),
    temp: +d.maxTemp.toFixed(0),
    step: s.tutorial.step,
    bottleneck: d.bottleneck,
    problems: (d.problems || []).map((x) => x.title || x.text || String(x)).slice(0, 3),
    ringing: [...document.querySelectorAll('.tut-target')].map((n) => n.id || n.textContent.trim().slice(0, 24)),
    modal: modal && !modal.hidden ? (modal.querySelector('h2')?.textContent || 'open') : null,
    log: [...document.querySelectorAll('#log .line')].slice(-3).map((n) => n.textContent.trim().slice(0, 90)),
  };
});

const spots = [[2, 2], [3, 2], [3, 3], [4, 2], [4, 3]];
let placed = 0;
const shot = async (name) => {
  const st = await read();
  console.log(name.padEnd(9), JSON.stringify(st));
  await p.screenshot({ path: `${out}/open-${name}.png` });
};

await shot('00-start');

// Follow the guide the way a player does: click whatever it is ringing.
for (let i = 0; i < 40; i++) {
  const st = await read();
  if (st.step >= 10) break;
  const target = await p.$('.tut-target');
  if (!target) { await p.waitForTimeout(500); continue; }
  const id = await p.evaluate((n) => n.id, target);
  const tag = await p.evaluate((n) => n.tagName, target);
  if (id === 'canvaswrap') {
    const spot = spots[Math.min(placed++, spots.length - 1)];
    const c = await p.evaluate(([x, y]) => window.__rr.view.tileCentre(x, y), spot);
    await p.mouse.click(c.x, c.y);
  } else if (tag === 'INPUT') {
    await p.evaluate((n) => { n.value = '40'; n.dispatchEvent(new Event('input')); }, target);
    await p.waitForTimeout(600);
  } else {
    await target.click().catch(() => {});
  }
  await p.waitForTimeout(700);
  if (i === 4) await shot('01-guide');
}
await shot('02-guided');

// Now the part nobody scripts: the player stops being told what to do.
await p.evaluate(() => { window.__rr.state.settings.speed = 1; });
for (const [mins, name] of [[2, '03-two'], [3, '04-five'], [5, '05-ten']]) {
  const until = Date.now() + mins * 60000 / 12;    // watched at 12× wall speed
  await p.evaluate((x) => { window.__rr.state.settings.speed = x; }, 10);
  while (Date.now() < until) await p.waitForTimeout(500);
  await p.evaluate(() => { window.__rr.state.settings.speed = 1; });
  await p.waitForTimeout(400);
  await shot(name);
}
if (errs.length) console.log('PAGE ERRORS', errs.slice(0, 3));
await b.close();
