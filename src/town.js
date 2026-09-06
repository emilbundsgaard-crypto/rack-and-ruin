// Ashbrook, the town next door.
//
// Nothing here feeds back into the simulation: the town is the bill for what
// the site takes. Damage is a ratchet driven by the footprint you currently
// run — the megawatts, the litres, the acres — so it only ever goes one way.
// Wrecking it completely is the other victory condition.

import { clamp } from './util.js';

export const STAGES = [
  { at: 0.00, title: 'Ashbrook, population 940',
    line: 'A river, a cricket pitch, and a substation nobody had heard of.' },
  { at: 0.12, title: 'The hum',
    line: 'Transformers run day and night now. Nobody on Mill Lane sleeps well.' },
  { at: 0.25, title: 'Hosepipe ban',
    line: 'Gardens go brown by August. Your cooling towers are exempt.' },
  { at: 0.38, title: 'The pitch goes',
    line: 'The cricket pitch is a contractors’ car park. The club folds in spring.' },
  { at: 0.50, title: 'The river gives up',
    line: 'Down to a trickle below the weir. The fish went first, then the herons.' },
  { at: 0.62, title: 'Boarded up',
    line: 'Half the terraces are empty. The school closed at the end of June.' },
  { at: 0.75, title: 'Nothing to buy',
    line: 'The last shop shut. The bus route was cut the same week.' },
  { at: 0.88, title: 'Only the church',
    line: 'Still standing, and only because you rent it as overflow storage.' },
  { at: 1.00, title: 'There is no town',
    line: 'There is a site, and a road that used to lead somewhere.' },
];

/** Footprint, weighted, on a log scale so it climbs steadily across a run. */
export function townTarget(state, d) {
  const tiles = Object.keys(state.tiles).length;
  // Each strand is capped a little above its target, so a site that is huge on
  // power can cover a small shortfall on water. Finishing the town should be
  // hard, not a knife edge.
  const cap = (v) => clamp(v, 0, 1.3);
  const power = cap(Math.log10(1 + d.actualDraw) / Math.log10(1 + 2.4e6));
  const thirst = cap(Math.log10(1 + d.waterDemand) / Math.log10(1 + 22_000));
  const heat = cap(Math.log10(1 + d.heatLoad) / Math.log10(1 + 1.8e6));
  const land = cap(tiles / 540);
  return clamp(power * 0.34 + thirst * 0.26 + heat * 0.18 + land * 0.22, 0, 1);
}

export function tickTown(state, d, hooks) {
  if (!state.town) state.town = { damage: 0, seen: [], sinceDay: {} };
  const target = townTarget(state, d);
  if (target <= state.town.damage) return;
  state.town.damage = target;
  for (let i = STAGES.length - 1; i >= 0; i--) {
    const st = STAGES[i];
    if (target >= st.at && !state.town.seen.includes(i)) {
      state.town.seen.push(i);
      state.town.sinceDay[i] = Math.floor(state.day);
      if (i > 0) {
        hooks?.log('Ashbrook: ' + st.title + ' — ' + st.line, 'bad');
        // Losing another piece of the town is one of the few things in a run
        // that only ever happens once, so it gets the same card a new site does.
        hooks?.onMilestone?.('Ashbrook · ' + Math.round(st.at * 100) + '% gone', st.title, st.line);
      }
    }
  }
}

export function stageOf(damage) {
  let idx = 0;
  for (let i = 0; i < STAGES.length; i++) if (damage >= STAGES[i].at) idx = i;
  return idx;
}

// ------------------------------------------------------------------ drawing

const lerp = (a, b, t) => a + (b - a) * t;
const rgb = (r, g, b) => `rgb(${r | 0},${g | 0},${b | 0})`;

/** Deterministic scatter so the town looks the same every frame. */
function rand(i) {
  const x = Math.sin(i * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * A flat, storybook elevation of the place: sky, hill, river, trees, a row of
 * houses and a church, with your site creeping in from the right. Everything
 * degrades on the same 0..1 dial.
 */
export function drawTown(ctx, w, h, dmg, t) {
  const dead = dmg;
  ctx.clearRect(0, 0, w, h);

  // Sky: clear blue to a brown haze.
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, rgb(lerp(38, 76, dead), lerp(66, 58, dead), lerp(96, 44, dead)));
  sky.addColorStop(1, rgb(lerp(84, 122, dead), lerp(110, 92, dead), lerp(126, 66, dead)));
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  // Sun, dimming behind the haze.
  ctx.globalAlpha = 0.5 - dead * 0.35;
  ctx.fillStyle = rgb(255, lerp(240, 180, dead), lerp(200, 120, dead));
  ctx.beginPath();
  ctx.arc(w * 0.18, h * 0.22, 14, 0, 6.283);
  ctx.fill();
  ctx.globalAlpha = 1;

  const ground = h * 0.62;

  // Far hill.
  ctx.fillStyle = rgb(lerp(46, 74, dead), lerp(80, 66, dead), lerp(56, 46, dead));
  ctx.beginPath();
  ctx.moveTo(0, ground);
  ctx.quadraticCurveTo(w * 0.22, ground - 46, w * 0.48, ground - 8);
  ctx.quadraticCurveTo(w * 0.72, ground - 34, w, ground - 4);
  ctx.lineTo(w, ground); ctx.closePath(); ctx.fill();

  // Ground.
  ctx.fillStyle = rgb(lerp(52, 88, dead), lerp(86, 76, dead), lerp(58, 52, dead));
  ctx.fillRect(0, ground, w, h - ground);

  // The river: full and blue, then a brown thread, then a dry scar.
  const riverY = ground + (h - ground) * 0.52;
  const width = lerp(13, 1.5, clamp(dmg / 0.62, 0, 1));
  ctx.strokeStyle = dmg > 0.62
    ? rgb(96, 84, 62)
    : rgb(lerp(70, 120, dead), lerp(120, 104, dead), lerp(160, 84, dead));
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (let i = 0; i <= 30; i++) {
    const x = (i / 30) * w;
    const y = riverY + Math.sin(i / 3.2 + t * 0.4) * 4;
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  }
  ctx.stroke();

  // Trees along the bank; they thin out and go bare.
  for (let i = 0; i < 9; i++) {
    const x = 18 + i * (w - 40) / 9 + rand(i) * 10;
    const gone = dmg > 0.2 + rand(i + 40) * 0.62;
    const y = ground + 8 + rand(i + 7) * 6;
    ctx.strokeStyle = rgb(64, 50, 38);
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - 12); ctx.stroke();
    if (gone) {
      ctx.beginPath();
      ctx.moveTo(x, y - 12); ctx.lineTo(x - 4, y - 17);
      ctx.moveTo(x, y - 12); ctx.lineTo(x + 4, y - 16);
      ctx.stroke();
    } else {
      ctx.fillStyle = rgb(lerp(70, 104, dead), lerp(126, 96, dead), lerp(72, 54, dead));
      ctx.beginPath(); ctx.arc(x, y - 16, 7, 0, 6.283); ctx.fill();
    }
  }

  // The terrace: eight houses, failing left to right.
  const n = 8;
  const hw = 26, gap = 5;
  const startX = w * 0.08;
  for (let i = 0; i < n; i++) {
    const x = startX + i * (hw + gap);
    const base = ground - 4;
    const doom = 0.18 + (i / n) * 0.72;          // each house has its own hour
    const ruined = dmg > doom;
    const roofless = dmg > doom - 0.1;
    const bh = 24;
    if (ruined) {
      // Rubble.
      ctx.fillStyle = rgb(lerp(84, 52, dead), lerp(76, 46, dead), lerp(70, 42, dead));
      ctx.beginPath();
      ctx.moveTo(x - 2, base);
      ctx.lineTo(x + 6, base - 8 - rand(i) * 4);
      ctx.lineTo(x + 14, base - 3);
      ctx.lineTo(x + hw, base - 9 - rand(i + 3) * 5);
      ctx.lineTo(x + hw + 2, base);
      ctx.closePath(); ctx.fill();
      continue;
    }
    ctx.fillStyle = rgb(lerp(150, 96, dead), lerp(126, 84, dead), lerp(112, 76, dead));
    ctx.fillRect(x, base - bh, hw, bh);
    if (!roofless) {
      ctx.fillStyle = rgb(lerp(112, 78, dead), lerp(62, 52, dead), lerp(54, 46, dead));
      ctx.beginPath();
      ctx.moveTo(x - 3, base - bh);
      ctx.lineTo(x + hw / 2, base - bh - 11);
      ctx.lineTo(x + hw + 3, base - bh);
      ctx.closePath(); ctx.fill();
    }
    // Windows: lit while anyone is home.
    const lived = dmg < doom - 0.16;
    ctx.fillStyle = lived ? rgb(250, 220, 140) : rgb(38, 36, 34);
    ctx.fillRect(x + 5, base - bh + 6, 6, 6);
    ctx.fillRect(x + hw - 11, base - bh + 6, 6, 6);
    ctx.fillStyle = rgb(46, 40, 36);
    ctx.fillRect(x + hw / 2 - 4, base - 11, 8, 11);
  }

  // The church holds on longest.
  const cx = w * 0.08 + n * (hw + gap) + 16;
  if (dmg < 0.97) {
    const base = ground - 4;
    ctx.fillStyle = rgb(lerp(158, 104, dead), lerp(150, 96, dead), lerp(134, 86, dead));
    ctx.fillRect(cx, base - 30, 24, 30);
    ctx.beginPath();
    ctx.moveTo(cx + 3, base - 30); ctx.lineTo(cx + 12, base - 58); ctx.lineTo(cx + 21, base - 30);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = rgb(60, 54, 48); ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx + 12, base - 58); ctx.lineTo(cx + 12, base - 66);
    ctx.moveTo(cx + 8, base - 62); ctx.lineTo(cx + 16, base - 62);
    ctx.stroke();
  }

  // Your site, growing in from the right, with its plume.
  const site = clamp(dmg * 1.15, 0, 1);
  const sw = w * 0.30 * site;
  if (sw > 6) {
    const x0 = w - sw - 4;
    ctx.fillStyle = rgb(34, 44, 56);
    ctx.fillRect(x0, ground - 34 * site - 6, sw, 34 * site + 6);
    ctx.fillStyle = rgb(52, 66, 82);
    for (let i = 0; i < 5; i++) {
      const bx = x0 + 4 + i * (sw - 8) / 5;
      if (bx + 6 > w - 6) break;
      ctx.fillRect(bx, ground - 34 * site - 6, Math.max(3, (sw - 12) / 6), 34 * site + 6);
    }
    // Two stacks and a slow plume.
    for (const sx of [x0 + sw * 0.3, x0 + sw * 0.68]) {
      ctx.fillStyle = rgb(44, 56, 70);
      ctx.fillRect(sx, ground - 34 * site - 24, 5, 20);
      ctx.globalAlpha = 0.3 * site;
      ctx.fillStyle = rgb(210, 200, 190);
      for (let k = 0; k < 3; k++) {
        const py = ground - 34 * site - 28 - k * 9 - ((t * 8) % 9);
        ctx.beginPath();
        ctx.arc(sx + 2 + Math.sin(t * 0.6 + k) * 3, py, 4 + k * 1.6, 0, 6.283);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  }

  // A last vignette so it reads as a picture rather than a diagram.
  const vig = ctx.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, h * 0.85);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(0,0,0,.35)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, w, h);
}
