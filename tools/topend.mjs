// What the cost side looks like at the top of the ladder.
//
// Waiting for a full run to reach tier 12 takes hours; this builds the site
// the run would have built and reads the ledger straight off derive(). It is
// not a substitute for a played run — nothing here proves the site is
// reachable — but it answers "where does the money go at the top" in seconds,
// and that is the question the tail of a run kept posing.
//
//   node tools/topend.mjs [facilityTier]
import { newGame, facilityOf, tileAt, DAY_SECONDS } from '../src/state.js';
import { derive, sellPrice, powerTariff } from '../src/sim.js';
import * as A from '../src/actions.js';
import { RESEARCH } from '../src/data/research.js';
import { BUILDINGS } from '../src/data/buildings.js';
import { HARDWARE } from '../src/data/hardware.js';

const tier = Number(process.argv[2] || 12);
const s = newGame();
s.tutorial.skipped = true;
s.facility = tier;
s.money = 1e30;
s.reputation = 20000;
for (const n of RESEARCH) s.research.done.push(n.id);
let d = derive(s);

// The best of each thing the research tree allows, laid out in bands.
const best = (pred, score) => BUILDINGS.filter(pred).sort((a, b) => score(b) - score(a))[0];
const rack = best((b) => b.cat === 'compute' && b.slots, (b) => b.slots);
const pdu = best((b) => b.powerCap, (b) => b.powerCap);
const cool = best((b) => b.coolCap, (b) => b.coolCap);
const gen = best((b) => b.supplyKW, (b) => b.supplyKW);
const water = best((b) => b.supplyWater, (b) => b.supplyWater);
const net = best((b) => b.net, (b) => b.net);
const hw = HARDWARE.slice().sort((a, b) => b.compute - a.compute)[0];
console.log('rack', rack.id, '| pdu', pdu.id, '| cool', cool.id, '| gen', gen.id,
  '| water', water.id, '| net', net.id, '| hw', hw.id);

const f = facilityOf(s);
const tiles = [];
for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) if (!tileAt(s, x, y)) tiles.push({ x, y });
// A realistic mix rather than a floor of racks: the plant has to carry it.
const plan = [];
for (let i = 0; i < tiles.length; i++) {
  const m = i % 10;
  plan.push(m < 5 ? rack.id : m < 6 ? pdu.id : m < 8 ? cool.id : m === 8 ? gen.id : (i % 20 === 9 ? water.id : net.id));
}
let placed = 0;
const errs = new Map();
for (let i = 0; i < tiles.length; i++) {
  const t = tiles[i];
  const err = A.place(s, d, t.x, t.y, plan[i], null);
  if (err) errs.set(err, (errs.get(err) || 0) + 1); else placed++;
  if (i % 40 === 0) d = derive(s);
}
if (errs.size) console.log('placement refused:', [...errs].map(([k, n]) => `${n}x ${k}`).join(' | '));
d = derive(s);
A.buyGrid(s, A.maxGrid(s), null);
d = derive(s);
A.fillAll(s, d, hw.id, null);
d = derive(s);
s.staff.tech = 40; s.staff.eng = 40; s.staff.sales = 20; s.staff.ops = 20;
s.money = 0;
d = derive(s);

const row = (k, v) => console.log('  ' + k.padEnd(22) + String(v).padStart(16));
console.log(`\nfacility ${tier}: ${placed} tiles built, ${d.unitsTotal} machines`);
row('compute', d.computeTotal.toExponential(3));
row('draw kW', d.actualDraw.toExponential(3));
row('compute per kW', (d.computeTotal / Math.max(1e-9, d.actualDraw)).toExponential(3));
row('own supply kW', d.ownSupply.toExponential(3));
row('grid used kW', d.gridUsed.toExponential(3));
row('tariff', powerTariff(d.gridUsed).toFixed(1) + 'x');
row('sell price', (100 * d.sellPrice / d.listPrice).toFixed(1) + '% of list');
console.log('\ncost side, per second:');
row('electricity', d.powerCost.toExponential(3));
row('fuel', d.fuelCost.toExponential(3));
row('generation upkeep', d.plantUpkeep.toExponential(3));
row('water', d.waterBill.toExponential(3));
row('wages', d.salaryCost.toExponential(3));
row('site upkeep', d.machineUpkeep.toExponential(3));
row('total costs', d.costs.toExponential(3));
console.log('\nif it were selling everything it makes:');
const rev = d.computeSellable * d.sellPrice;
row('revenue at spot', rev.toExponential(3));
row('revenue / costs', (rev / Math.max(1e-9, d.costs)).toExponential(2));
row('costs / revenue', (100 * d.costs / Math.max(1e-9, rev)).toFixed(3) + '%');
