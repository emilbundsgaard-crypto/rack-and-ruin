// Play it in a real browser, the way the report asked for.
//
// The bot in Node exercises the simulation; it never renders a panel, never
// reads a badge and never notices that a number has gone off the end of its
// cell. This walks the guide, then plays at 10x with a plain policy — buy
// what is unlocked and affordable, keep the plant ahead of the racks, sign
// what fits, spend points as they land — and reports what a player would be
// looking at: money, what each tab says is available, and how long since
// anything last unlocked.
//
//   node tools/playthrough.mjs [minutes] [shot-dir]
const { chromium } = await import(process.env.RR_PLAYWRIGHT || 'playwright');
const URL = process.env.RR_URL || 'http://127.0.0.1:8099/index.html';
const MINUTES = Number(process.argv[2] || 6);
const SHOTS = process.argv[3] || '';

const browser = await chromium.launch(process.env.RR_CHROMIUM ? { executablePath: process.env.RR_CHROMIUM } : {});
const page = await browser.newPage({ viewport: { width: 1500, height: 940 } });
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await page.goto(URL, { waitUntil: 'networkidle' });
await page.click('text=Start in the cupboard');
await page.waitForTimeout(400);
await page.evaluate(() => { window.__rr.state.tutorial.skipped = true; window.__rr.state.settings.speed = 10; });

// One turn of a plain player: keep the plant ahead, fill the racks, sign what
// fits, spend the points. Done through the same functions the buttons call.
const turn = () => page.evaluate(async () => {
  const sim = await import('/src/sim.js');
  const A = await import('/src/actions.js');
  const B = await import('/src/data/buildings.js');
  const R = await import('/src/data/research.js');
  const P = await import('/src/data/progression.js');
  const H = await import('/src/data/hardware.js');
  const S = await import('/src/state.js');
  const app = window.__rr;
  const s = app.state;
  const quiet = { log() {}, onDecision() {}, onRescue() {} };
  let d = () => (app.d = sim.derive(s));
  let dd = d();

  // Points first: they are what unlocks everything else.
  for (let i = 0; i < 40; i++) {
    const open = R.RESEARCH.filter((n) => !s.research.done.includes(n.id)
      && R.available(n, s) && s.rp >= n.cost).sort((a, b) => a.cost - b.cost);
    if (!open.length) break;
    A.buyResearch(s, open[0].id, quiet);
  }
  dd = d();

  // Machines first, then whatever the meters say is now in the way. The other
  // way round spends the whole float on plant with nothing in the racks to
  // pay for it, which is a mistake a real player makes exactly once.
  const f = S.facilityOf(s);
  const freeTile = () => {
    for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) if (!S.tileAt(s, x, y)) return { x, y };
    return null;
  };
  const unlocked = (pred) => B.BUILDINGS.filter((b) => (!b.req || s.research.done.includes(b.req)) && pred(b));
  const afford = (list, score, share) => list.filter((b) => b.cost <= s.money * share)
    .sort((a, b) => score(b) - score(a))[0];
  const put = (b) => {
    if (!b) return false;
    const t = freeTile();
    if (!t) return false;
    if (A.place(s, dd, t.x, t.y, b.id, quiet)) return false;
    dd = d();
    return true;
  };

  // Somewhere to put them, and something to plug them into.
  if (dd.freeSlots < 4) put(afford(unlocked((b) => b.cat === 'compute' && b.slots), (b) => b.slots, 0.3));
  if (!dd.counts.anyPdu || dd.racks.some((r) => r.powerGot < r.power * 0.99)) {
    put(afford(unlocked((b) => b.powerCap), (b) => b.powerCap, 0.25));
  }
  if (dd.coolCap < dd.heatLoad * 1.2) put(afford(unlocked((b) => b.coolCap), (b) => b.coolCap, 0.25));

  const hw = H.HARDWARE.filter((h) => (!h.req || s.research.done.includes(h.req)))
    .sort((a, b) => b.compute - a.compute)[0];
  if (hw) { A.fillAll(s, dd, hw.id, quiet); dd = d(); }

  // Then the rest of the plant, only where a meter says it is short.
  if (dd.supplyKW - dd.actualDraw < dd.actualDraw * 0.2) {
    const room = Math.max(0, S.facilityOf(s).gridCap - s.gridPower);
    const kw = Math.min(A.maxGrid(s), room);
    if (kw > 0) { A.buyGrid(s, kw, quiet); dd = d(); }
    else put(afford(unlocked((b) => b.supplyKW), (b) => b.supplyKW, 0.3));
  }
  if (dd.coolCap < dd.heatLoad * 1.2) put(afford(unlocked((b) => b.coolCap), (b) => b.coolCap, 0.25));
  if (dd.waterSupply < dd.waterDemand * 1.2) put(afford(unlocked((b) => b.supplyWater), (b) => b.supplyWater, 0.25));
  if (dd.netCap < dd.netNeed * 1.2) put(afford(unlocked((b) => b.net), (b) => b.net, 0.25));

  // Upgrades, cheapest first, out of spare cash.
  for (const u of P.UPGRADES.filter((x) => !s.upgrades.includes(x.id)).sort((a, b) => a.cost - b.cost)) {
    if (u.cost > s.money * 0.25) break;
    A.buyUpgrade(s, dd, u.id, quiet);
    dd = d();
  }

  // Deals that fit, with headroom left.
  let free = dd.computeSellable * 0.85 - dd.contractDemand;
  for (const o of [...s.contracts.offers].sort((a, b) => b.pay - a.pay)) {
    if (o.demand > free) continue;
    sim.signContract(s, dd, o, quiet);
    free -= o.demand;
    dd = d();
  }

  // A bigger site when it is affordable.
  if (!A.upgradeFacility(s, quiet)) dd = d();
  for (const axis of ['w', 'h']) {
    if (A.canExpand(s, axis) && s.money > A.expandCost(s, dd) * 6) { A.expand(s, dd, axis, quiet); dd = d(); }
  }
  if (s.staff.tech < 3 + s.facility) A.hire(s, dd, 'tech', quiet);
  if (s.staff.eng < 2 + s.facility) A.hire(s, dd, 'eng', quiet);
  s.researchAlloc = 0.4;
  app.d = d();
  app.refreshLive();
});

const snap = () => page.evaluate(() => {
  const app = window.__rr, s = app.state, d = app.d;
  return {
    day: Math.round(s.day), money: s.money, tier: s.facility,
    compute: d.computeTotal, rnd: s.research.done.length, rep: Math.round(s.reputation),
    badges: Object.fromEntries([...document.querySelectorAll('#tabs .tab')]
      .map((t) => [t.dataset.tab, parseInt(t.querySelector('.badge')?.textContent || '0', 10)])),
    netIncome: d.netIncome,
  };
});

const money = (n) => (Math.abs(n) >= 1e12 ? (n / 1e12).toFixed(1) + 'T'
  : Math.abs(n) >= 1e9 ? (n / 1e9).toFixed(1) + 'B'
  : Math.abs(n) >= 1e6 ? (n / 1e6).toFixed(1) + 'M'
  : Math.abs(n) >= 1e3 ? (n / 1e3).toFixed(1) + 'K' : Math.round(n) + '');

console.log('  real   day    money   tier    compute   rnd     rep   since unlock   build racks deals upg');
const t0 = Date.now();
let lastRnd = 0, lastRndDay = 0;
const until = t0 + MINUTES * 60_000;
let step = 0;
while (Date.now() < until) {
  await turn();
  await page.waitForTimeout(2000);
  const s = await snap();
  if (s.rnd > lastRnd) { lastRnd = s.rnd; lastRndDay = s.day; }
  const b = s.badges;
  console.log(
    (Math.round((Date.now() - t0) / 1000) + 's').padStart(6),
    String(s.day).padStart(6),
    money(s.money).padStart(8),
    String(s.tier).padStart(5),
    money(s.compute).padStart(10),
    (s.rnd + '/545').padStart(8),
    String(s.rep).padStart(7),
    ((s.day - lastRndDay) + 'd').padStart(14),
    String(b.build || 0).padStart(6), String(b.racks || 0).padStart(5),
    String(b.deals || 0).padStart(5), String(b.upgrade || 0).padStart(4),
  );
  if (SHOTS && ++step % 20 === 0) {
    await page.screenshot({ path: `${SHOTS}/play-${String(step).padStart(3, '0')}.png` });
  }
}
console.log(errs.length ? `\nPAGE ERRORS: ${errs.slice(0, 5).join(' | ')}` : '\nno page errors');
await browser.close();
