// How often does something land?
//
// Total time to finish the tree says nothing about whether a run feels like
// progress. Ten hours spent on thirty huge unlocks is a different game from
// ten hours spent on five hundred small ones, and a player will call the
// first one broken. This reads a BOT_TRACE and reports the gap between
// unlocks across the run, plus what there was to spend money on at the time.
//
//   node tools/cadence.mjs /tmp/trace.json
import { readFileSync } from 'node:fs';

const rows = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const bands = 12;
const span = rows[rows.length - 1].rnd - rows[0].rnd;
if (span <= 0) { console.log('no research finished in this trace'); process.exit(0); }

console.log('    days    money        nodes  days/node  affordable  to next  upgrades left  free tiles');
let prev = rows[0];
for (let b = 1; b <= bands; b++) {
  const want = rows[0].rnd + Math.round((span * b) / bands);
  const at = rows.find((r) => r.rnd >= want && r.day > prev.day);
  if (!at) continue;
  const dn = at.rnd - prev.rnd;
  const m = at.money;
  console.log(
    String(at.day).padStart(8),
    (m >= 1e12 ? (m / 1e12).toFixed(1) + 'T' : m >= 1e9 ? (m / 1e9).toFixed(1) + 'B'
      : m >= 1e6 ? (m / 1e6).toFixed(1) + 'M' : Math.round(m) + '').padStart(9),
    (at.rnd + '/545').padStart(12),
    (dn > 0 ? ((at.day - prev.day) / dn).toFixed(1) : '-').padStart(10),
    String(at.affordableNodes ?? '-').padStart(11),
    ((at.daysToNextNode ?? '-') + 'd').padStart(8),
    String(at.openUpgrades ?? '-').padStart(14),
    String(at.freeTiles ?? '-').padStart(11),
  );
  prev = at;
}

let worst = null;
for (let i = 1; i < rows.length; i++) {
  const dn = rows[i].rnd - rows[i - 1].rnd;
  if (dn <= 0) continue;
  const per = (rows[i].day - rows[i - 1].day) / dn;
  if (!worst || per > worst.per) worst = { per, at: rows[i] };
}
if (worst) {
  console.log(`\nslowest stretch: ${worst.per.toFixed(0)} days per node around day ${worst.at.day}`
    + ` (node ${worst.at.rnd}, $${(worst.at.money / 1e9).toFixed(1)}B,`
    + ` ${worst.at.openUpgrades} upgrades unbought)`);
}
const stalled = rows.filter((r) => (r.daysToNextNode ?? 0) > 30 && r.affordableNodes === 0);
if (stalled.length) {
  console.log(`${stalled.length} of ${rows.length} samples were more than 30 days from the next node`
    + ` with none affordable — first at day ${stalled[0].day}, $${(stalled[0].money / 1e9).toFixed(2)}B`);
} else {
  console.log('no sample was more than 30 days from the next node with none affordable');
}
