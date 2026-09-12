// Can a site trade its way out of a deep overdraft without the bank?
//
// The game promises it in as many words — "sell everything you cannot run and
// trade your way back above zero" — so it has to be true, and it stops being
// true quietly whenever revenue moves and the overdraft charge does not. This
// is the check-suite scenario with the knobs exposed, so the rate can be
// chosen from a measurement instead of a feeling.
//
//   RR_OVERDRAFT_RATE=0.02 node tools/rescueless.mjs [runs]
import { newGame } from '../src/state.js';
import { derive, tick, signContract, OVERDRAFT_RATE, CONTRACT_PAY } from '../src/sim.js';
import * as A from '../src/actions.js';
import { RESEARCH } from '../src/data/research.js';

const RUNS = Number(process.argv[2] || 8);
const quiet = { log() {}, onRescue() {}, onDecision() {} };
let ok = 0;
const times = [];
for (let run = 0; run < RUNS; run++) {
  const s = newGame();
  s.tutorial.skipped = true;
  s.objectives.done = new Array(40).fill('x');
  s.money = 20_000; s.gridPower = 60;
  for (const n of RESEARCH.slice(0, 8)) s.research.done.push(n.id);
  let d = derive(s);
  A.place(s, d, 2, 2, 'pdu', null); d = derive(s);
  for (let x = 0; x < 5; x++) { A.place(s, d, x, 1, 'rack', null); d = derive(s); }
  A.place(s, d, 3, 3, 'fan', null); d = derive(s);
  A.fillAll(s, d, 'desktop', null); d = derive(s);
  s.staff.tech = 3;
  d = derive(s);
  for (let i = 0; i < 200_000 && s.money > -30_000; i++) { tick(s, 0.2, d, quiet); d = derive(s); }
  A.fire(s, 'tech', quiet); A.fire(s, 'tech', quiet); A.fire(s, 'tech', quiet);
  d = derive(s);
  // Sell what you cannot run, not everything you have: a site with no
  // machines earns nothing, so "sell until the net turns positive" walks
  // straight past the answer and ends with an empty floor and an overdraft
  // that still compounds. The cap is the point.
  const CAP = Number(process.env.RR_SELL_CAP || 3);
  let sold = 0;
  for (const k of Object.keys(s.tiles).filter((x) => s.tiles[x].units)) {
    if (sold >= CAP || d.netIncome > 0) break;
    const [x, y] = k.split(',').map(Number);
    if (!A.sell(s, d, x, y, quiet)) { sold++; d = derive(s); }
  }
  const net0 = d.netIncome;
  let recovered = false, days = null;
  for (let i = 0; i < 200_000; i++) {
    tick(s, 0.2, d, quiet); d = derive(s);
    for (const o of [...s.contracts.offers]) signContract(s, d, o, quiet);
    if (s.money > 0) { recovered = true; days = +(i * 0.2 / 60).toFixed(1); break; }
  }
  if (recovered) { ok++; times.push(days); }
  console.log(`  run ${run}  sold ${sold}  net after selling ${net0.toFixed(2)}/s  `
    + (recovered ? `back above zero in ${days} days` : `still at $${Math.round(s.money)} after 666 days`));
}
times.sort((a, b) => a - b);
console.log(`OVERDRAFT_RATE=${OVERDRAFT_RATE} CONTRACT_PAY=${CONTRACT_PAY}: `
  + `${ok}/${RUNS} traded back` + (times.length ? `, median ${times[times.length >> 1]} days` : ''));
