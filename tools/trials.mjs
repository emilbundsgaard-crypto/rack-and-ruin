// Many games, several play styles, one table.
//
// Everything anyone knew about this game's balance rested on a handful of runs
// of one crude policy, and sim.js draws on Math.random in eleven places — a
// single run gives tier 9 or tier 0 from identical code. That is not enough to
// tell a balance change from noise, and I have already once concluded a
// regression from it that did not exist.
//
// So: N runs per style, in parallel child processes, with a Wilson interval on
// the survival rate so the uncertainty is stated rather than implied.
//
//   node tools/trials.mjs [runs-per-style] [style,style,...]
import { spawn } from 'node:child_process';
import { cpus } from 'node:os';

const RUNS = Number(process.argv[2] || 8);
const STYLES = (process.argv[3] || 'balanced,cautious,aggressive').split(',');
const LANES = Math.max(2, Math.min(cpus().length, 6));

function once(style) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ['tools/bot.mjs'], {
      env: { ...process.env, BOT_STYLE: style, BOT_QUIET: '1' },
      cwd: process.cwd(),
    });
    let out = '';
    child.stdout.on('data', (b) => { out += b; });
    child.on('close', () => {
      const line = out.split('\n').find((l) => l.startsWith('RESULT '));
      if (!line) return resolve({ style, failed: true });
      try { resolve(JSON.parse(line.slice(7))); }
      catch { resolve({ style, failed: true }); }
    });
    child.on('error', () => resolve({ style, failed: true }));
  });
}

/** Wilson score interval: honest about small samples in a way ±sqrt(p q / n) is not. */
function wilson(hits, n) {
  if (!n) return [0, 0];
  const z = 1.96, p = hits / n;
  const d = 1 + z * z / n;
  const centre = p + z * z / (2 * n);
  const half = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n));
  return [Math.max(0, (centre - half) / d), Math.min(1, (centre + half) / d)];
}

const median = (xs) => {
  if (!xs.length) return 0;
  const a = [...xs].sort((x, y) => x - y);
  return a[Math.floor(a.length / 2)];
};

const jobs = [];
for (const style of STYLES) for (let i = 0; i < RUNS; i++) jobs.push(style);

const started = Date.now();
const results = [];
let next = 0, done = 0;

await Promise.all(Array.from({ length: LANES }, async () => {
  while (next < jobs.length) {
    const mine = jobs[next++];
    results.push(await once(mine));
    done++;
    process.stderr.write(`\r  ${done}/${jobs.length} runs`);
  }
}));
process.stderr.write('\r' + ' '.repeat(30) + '\r');

console.log(`${jobs.length} runs in ${((Date.now() - started) / 1000).toFixed(0)}s, `
  + `${LANES} at a time\n`);
console.log('style        survived        tier   town   died at   breaches');
console.log('─'.repeat(66));

for (const style of STYLES) {
  const rs = results.filter((r) => r.style === style && !r.failed);
  if (!rs.length) { console.log(`${style.padEnd(12)} no runs completed`); continue; }
  const alive = rs.filter((r) => r.survived);
  const [lo, hi] = wilson(alive.length, rs.length);
  const deaths = rs.filter((r) => !r.survived && r.underAt !== null).map((r) => r.underAt);
  console.log(
    style.padEnd(12)
    + `${alive.length}/${rs.length}`.padEnd(6)
    + `${(lo * 100).toFixed(0)}–${(hi * 100).toFixed(0)}%`.padEnd(10)
    + String(median(rs.map((r) => r.tier))).padEnd(7)
    + `${(median(rs.map((r) => r.town)) * 100).toFixed(0)}%`.padEnd(7)
    + (deaths.length ? `${median(deaths).toFixed(0)}m`.padEnd(10) : '—'.padEnd(10))
    + median(rs.map((r) => r.breaches)));
}

const all = results.filter((r) => !r.failed);
const alive = all.filter((r) => r.survived);
const [lo, hi] = wilson(alive.length, all.length);
console.log('─'.repeat(66));
console.log(`overall      ${alive.length}/${all.length}   ${(lo * 100).toFixed(0)}–${(hi * 100).toFixed(0)}% survive `
  + `(95% interval)`);
const broke = all.filter((r) => !r.survived);
if (broke.length) {
  console.log(`\nof the ${broke.length} that died: median peak tier `
    + `${median(broke.map((r) => r.peakTier))}, median death at `
    + `${median(broke.map((r) => r.underAt ?? 0)).toFixed(0)} minutes`);
}
