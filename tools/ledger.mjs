// Where the cost side goes, over a whole run.
//
// Revenue outruns costs by five figures in the late game and no single number
// says why. This reads a BOT_TRACE and prints, per facility tier, what each
// cost line is as a share of revenue and how the ratios that drive it — the
// compute the site makes per kW it draws, and the revenue it earns per kW —
// move as the site grows. Those two are the whole story: every cost in this
// game is per kW, per tile or per head, and revenue is near enough linear in
// compute, so compute per kW is the gap.
//
//   node tools/ledger.mjs /tmp/trace.json
import { readFileSync } from 'node:fs';

const rows = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const byTier = new Map();
for (const r of rows) {
  if (!byTier.has(r.tier)) byTier.set(r.tier, []);
  byTier.get(r.tier).push(r);
}
const mean = (xs, f) => xs.reduce((a, b) => a + f(b), 0) / Math.max(1, xs.length);
const pct = (x) => (100 * x).toFixed(2).padStart(7);

console.log('tier  days      compute       kW   c/kW    $/kW   rev/cost '
  + '| power%   fuel%  water%  upkeep%   int%  other%');
for (const [tier, xs] of [...byTier].sort((a, b) => a[0] - b[0])) {
  const rev = mean(xs, (r) => r.revenue);
  const cost = mean(xs, (r) => r.costs);
  const kW = mean(xs, (r) => r.actualDraw);
  const compute = mean(xs, (r) => r.computeTotal);
  const share = (f) => (rev > 0 ? mean(xs, f) / rev : 0);
  const named = mean(xs, (r) => r.powerCost + r.fuelCost + r.waterBill + r.upkeepCost + r.interestCost);
  console.log(
    String(tier).padStart(4),
    String(xs.length).padStart(5),
    compute.toExponential(2).padStart(11),
    kW.toExponential(1).padStart(8),
    (compute / Math.max(kW, 1e-9)).toExponential(1).padStart(8),
    (rev / Math.max(kW, 1e-9)).toExponential(1).padStart(8),
    (cost > 0 ? rev / cost : 0).toExponential(1).padStart(9),
    '|', pct(share((r) => r.powerCost)), pct(share((r) => r.fuelCost)),
    pct(share((r) => r.waterBill)), pct(share((r) => r.upkeepCost)),
    pct(share((r) => r.interestCost)), pct((cost - named) / Math.max(rev, 1e-9)),
  );
}

// And the research curve the same way: what the allocation actually bought.
console.log('\ntier   compute on R&D   rp from compute   rp flat   compute share');
for (const [tier, xs] of [...byTier].sort((a, b) => a[0] - b[0])) {
  const c = mean(xs, (r) => r.rpCompute), f = mean(xs, (r) => r.rpFlat);
  console.log(
    String(tier).padStart(4),
    mean(xs, (r) => r.computeResearch).toExponential(2).padStart(16),
    c.toExponential(2).padStart(17),
    f.toExponential(2).padStart(10),
    ((100 * c / Math.max(1e-12, c + f)).toFixed(0) + '%').padStart(14),
  );
}
