import { newGame, DAY_SECONDS } from '../src/state.js';
import { derive, tick, signContract } from '../src/sim.js';
import * as A from '../src/actions.js';
import { fmt, money } from '../src/util.js';

const hooks = { log: () => {} };
const s = newGame();
let d = derive(s);

console.log('start money', money(s.money), 'grid', s.gridPower, 'kW');

// A cupboard build-out.
A.place(s, d, 1, 1, 'pdu', hooks);
A.place(s, d, 2, 1, 'rack', hooks);
A.place(s, d, 2, 2, 'fan', hooks);
A.place(s, d, 3, 1, 'switch', hooks);
d = derive(s);
A.install(s, d, s.tiles['2,1'], 'desktop', 8, hooks);
d = derive(s);

console.log('after build: money', money(s.money), 'compute', fmt(d.computeTotal),
  'draw', fmt(d.powerDraw), 'kW / supply', fmt(d.supplyKW),
  'temp', d.maxTemp.toFixed(1), 'net', fmt(d.netCap) + '/' + fmt(d.netNeed));

// tick once to fill the offer board, then sign everything we can
tick(s, 0.1, d, hooks); d = derive(s);
for (const o of [...s.contracts.offers]) {
  if (s.contracts.active.length < d.contractSlots) { signContract(s, d, o, hooks); d = derive(s); }
}
console.log('signed', s.contracts.active.length, 'contracts, demand',
  fmt(d.contractDemand), 'vs sellable', fmt(d.computeSellable));
console.log('revenue', money(d.revenue) + '/s  costs', money(d.costs) + '/s  net', money(d.netIncome) + '/s');
console.log('  power', money(d.powerCost), 'water', money(d.waterBill), 'upkeep', money(d.upkeepCost), 'penalty', money(d.penalties));
console.log('rp/s', d.rpPerSec.toFixed(3), ' uptime', (d.uptime*100).toFixed(1)+'%');

// Simulate 10 minutes of real time at 10 Hz.
let t0 = Date.now();
for (let i = 0; i < 6000; i++) { d = derive(s); tick(s, 0.1, d, hooks); }
console.log('after 10 min: money', money(s.money), 'rp', fmt(s.rp), 'day', s.day.toFixed(1),
  'rep', s.reputation.toFixed(1), 'objectives', s.objectives.done.length,
  '| sim cost', (Date.now()-t0)+'ms for 6000 ticks');
console.log('temp', d.maxTemp.toFixed(1), 'broken', d.brokenTotal, '/', d.unitsTotal);
