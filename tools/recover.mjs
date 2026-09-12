// Can a player who follows the advice climb back out?
//
// Survival trials measure a bot that never gets into trouble; this measures
// the trouble case, which is where a pay cut actually bites. It is the cooked
// site from the check suite: five racks the room cannot cool, sell most of the
// machines as the game tells you to, and see whether the balance climbs from
// what is left. Run across a range of one knob to find where it stops working.
//
//   RR_CONTRACT_PAY=0.8 node tools/recover.mjs [runs]
import { newGame } from '../src/state.js';
import { derive, tick } from '../src/sim.js';
import * as A from '../src/actions.js';
import { CONTRACT_PAY } from '../src/sim.js';

const RUNS = Number(process.argv[2] || 12);
let ok = 0;
const ends = [];
for (let run = 0; run < RUNS; run++) {
  const s = newGame();
  s.tutorial.skipped = true;
  s.money = 400_000;
  let d = derive(s);
  A.place(s, d, 2, 2, 'pdu', null); d = derive(s);
  for (let x = 0; x < 5; x++) { A.place(s, d, x, 1, 'rack', null); d = derive(s); }
  A.place(s, d, 3, 3, 'fan', null); d = derive(s);
  A.buyGrid(s, A.maxGrid(s), null); d = derive(s);
  A.fillAll(s, d, 'desktop', null); d = derive(s);
  s.money = 1_500;
  s.settings.autoSign = true;
  s.settings.autoSignUptime = 0.80;
  d = derive(s);
  for (const r of d.racks) {
    for (const g of [...(r.tile.units || [])]) {
      const take = Math.ceil(g.n * 0.6);
      if (take > 0) A.uninstall(s, d, r.tile, g.t, take, null);
    }
  }
  d = derive(s);
  const start = s.money;
  let low = s.money;
  const quiet = { log: () => {}, onDecision: () => {} };
  for (let t = 0; t < 120 * 60; t += 0.25) {
    d = derive(s);
    tick(s, 0.25, d, quiet);
    low = Math.min(low, s.money);
  }
  const good = low >= 0 && s.money > start;
  if (good) ok++;
  ends.push({ start: Math.round(start), low: Math.round(low), end: Math.round(s.money), good });
}
ends.sort((a, b) => a.end - b.end);
console.log(`CONTRACT_PAY=${CONTRACT_PAY}  ${ok}/${RUNS} climbed back without going under`);
console.log('  ends:', ends.map((e) => e.end).join(' '));
console.log('  worst dip:', ends[0].low, ' best end:', ends[ends.length - 1].end);
