// One axis at a time, with the survival interval attached.
//
// Balance changes interact: a tighter opening and a pay cut are each fine and
// together are a death spiral. This runs the trial harness across a grid of
// RR_* knobs so the pair is judged together, and prints one row per cell.
//
//   node tools/sweep.mjs 'START_MONEY=3600,5000 CONTRACT_PAY=0.62,0.8' [runs] [styles]
import { spawn } from 'node:child_process';

const spec = process.argv[2] || '';
const RUNS = process.argv[3] || '6';
const STYLES = process.argv[4] || 'balanced';
const axes = spec.split(/\s+/).filter(Boolean).map((part) => {
  const [name, list] = part.split('=');
  return { name, values: list.split(',') };
});

function grid(axes) {
  if (!axes.length) return [{}];
  const [head, ...rest] = axes;
  const tail = grid(rest);
  return head.values.flatMap((v) => tail.map((t) => ({ [head.name]: v, ...t })));
}

const cells = grid(axes);
console.log(`${cells.length} cells x ${RUNS} runs x ${STYLES.split(',').length} styles`);

for (const cell of cells) {
  const env = { ...process.env };
  for (const [k, v] of Object.entries(cell)) env['RR_' + k] = v;
  const label = Object.entries(cell).map(([k, v]) => `${k}=${v}`).join(' ') || 'defaults';
  const out = await new Promise((resolve) => {
    const child = spawn(process.execPath, ['tools/trials.mjs', RUNS, STYLES], { env, cwd: process.cwd() });
    let buf = '';
    child.stdout.on('data', (b) => { buf += b; });
    child.stderr.on('data', () => {});
    child.on('close', () => resolve(buf));
  });
  const overall = out.split('\n').find((l) => l.includes('survive (95%'));
  const rows = out.split('\n').filter((l) => /^\w+\s+\d+\/\d+/.test(l.trim()));
  console.log(`\n${label}`);
  for (const r of rows) console.log('   ' + r.trim());
  if (overall) console.log('   ' + overall.trim());
}
