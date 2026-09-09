// Ashbrook, the town next door.
//
// The town is the bill for what the site takes. Damage is a ratchet driven by
// the footprint you currently run — the megawatts, the litres, the acres — so
// it only ever goes one way. Wrecking it completely is the other victory
// condition, and on the way Ashbrook does push back: see the town events in
// data/events.js, which only appear once you have taken enough to be noticed.

import { clamp, sum } from './util.js';

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
/**
 * The four things the site takes from Ashbrook, each on its own scale, with
 * the weight it carries. Exported so the town panel can show what is actually
 * driving the dial — and therefore what to build more of.
 */
export function townStrands(state, d) {
  const tiles = Object.keys(state.tiles).length;
  // Each strand is capped a little above its target, so a site that is huge on
  // power can cover a small shortfall on water. Finishing the town should be
  // hard, not a knife edge.
  const cap = (v) => clamp(v, 0, 1.3);
  return [
    { id: 'power', label: 'Power', weight: 0.34, unit: 'kW', now: d.actualDraw,
      full: 2.4e6, at: cap(Math.log10(1 + d.actualDraw) / Math.log10(1 + 2.4e6)) },
    { id: 'water', label: 'Water', weight: 0.26, unit: 'L/s', now: d.waterDemand,
      full: 22_000, at: cap(Math.log10(1 + d.waterDemand) / Math.log10(1 + 22_000)) },
    { id: 'heat', label: 'Heat', weight: 0.18, unit: 'kW', now: d.heatLoad,
      full: 1.8e6, at: cap(Math.log10(1 + d.heatLoad) / Math.log10(1 + 1.8e6)) },
    { id: 'land', label: 'Land', weight: 0.22, unit: 'tiles', now: tiles,
      full: 540, at: cap(tiles / 540) },
  ];
}

export function townTarget(state, d) {
  const strands = townStrands(state, d);
  return clamp(sum(strands, (x) => x.at * x.weight), 0, 1);
}

/** Ashbrook started at 940 people. It does not go back up. */
export function population(damage) {
  return Math.max(0, Math.round(940 * (1 - damage) ** 1.4));
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

// -------------------------------------------------- the town on the horizon

/**
 * Ashbrook, seen from the site, behind everything you build.
 *
 * The panel version above is a storybook elevation in daylight. This is the
 * same town at distance, in the game's own dark palette, drawn across the top
 * of the floor view so the place you are wrecking is on screen the whole time
 * instead of behind a tab. It is scenery and nothing else: it reads no input
 * and changes no state.
 *
 * The silhouette only changes when the damage or the light does, so it is
 * cached and blitted; the smoke is the only thing redrawn every frame.
 */
const skyCache = { key: '', canvas: null, w: 0, h: 0 };

const OVERHANG = 90;   // drawn wider than the view, so parallax has somewhere to go

function paintSkyline(g, w, h, dmg, sun) {
  const dead = dmg;
  const night = 1 - sun;
  const base = Math.round(h * 0.78);    // horizon, with ground below it to fade out on

  // Air, brightest at the horizon and fading upward — sky glow over a town,
  // which is the only way a dark silhouette reads against a dark game. The
  // first attempt ran the gradient the other way and put dark roofs on a dark
  // background, where they were invisible.
  //
  // Blue-grey at night, dusty by day, and browner the worse it gets.
  const air = g.createLinearGradient(0, 0, 0, h);
  const gr = lerp(lerp(56, 104, sun), lerp(104, 150, sun), dead);
  const gg = lerp(lerp(62, 108, sun), lerp(84, 116, sun), dead);
  const gb = lerp(lerp(84, 124, sun), lerp(66, 78, sun), dead);
  air.addColorStop(0, 'rgba(14,12,10,0)');
  air.addColorStop(0.55, `rgba(${(gr * 0.42) | 0},${(gg * 0.42) | 0},${(gb * 0.46) | 0},0.55)`);
  air.addColorStop(1, `rgba(${gr | 0},${gg | 0},${gb | 0},0.92)`);
  g.fillStyle = air;
  g.fillRect(0, 0, w, base);

  // Sun or moon, low and hazy.
  const discY = h * 0.26;
  const discX = w * 0.72;
  g.globalAlpha = (sun > 0.25 ? 0.30 : 0.22) * (1 - dead * 0.5);
  g.fillStyle = sun > 0.25
    ? rgb(255, lerp(226, 168, dead), lerp(178, 104, dead))
    : rgb(196, 202, 214);
  g.beginPath();
  g.arc(discX, discY, sun > 0.25 ? 13 : 9, 0, 6.283);
  g.fill();
  g.globalAlpha = 1;

  // The ridge behind the town.
  g.fillStyle = `rgba(${lerp(28, 46, dead) | 0},${lerp(34, 40, dead) | 0},${lerp(40, 32, dead) | 0},0.7)`;
  g.beginPath();
  g.moveTo(0, base);
  g.lineTo(0, base - 24);
  g.quadraticCurveTo(w * 0.26, base - 46, w * 0.52, base - 20);
  g.quadraticCurveTo(w * 0.78, base - 40, w, base - 16);
  g.lineTo(w, base);
  g.closePath();
  g.fill();

  // The town itself: a run of roofs left to right, each with its own hour.
  // Roofs go, then the walls, in the same order the panel tells it.
  const roofs = Math.max(10, Math.round(w / 46));
  const span = w * 0.66;
  const x0 = w * 0.05;
  const dark = `rgba(${lerp(13, 24, dead) | 0},${lerp(14, 20, dead) | 0},${lerp(18, 16, dead) | 0},0.96)`;
  for (let i = 0; i < roofs; i++) {
    const r = rand(i * 3 + 1);
    const x = x0 + (i / roofs) * span + r * 6;
    const bw = 16 + rand(i + 11) * 20;
    // A few tall ones among the terraces — a mill, a chapel, a block of flats —
    // otherwise the roofline is a fence.
    const tall = rand(i + 47) > 0.82;
    const bh = (tall ? 30 : 9) + rand(i + 5) * (tall ? 18 : 15);
    const doom = 0.20 + (i / roofs) * 0.70;
    if (dmg > doom) {
      // Left standing: a broken stub, so the skyline goes gap-toothed rather
      // than simply emptying.
      if (rand(i + 31) > 0.45) {
        g.fillStyle = dark;
        g.fillRect(x, base - bh * 0.32, bw * 0.7, bh * 0.32);
      }
      continue;
    }
    g.fillStyle = dark;
    g.fillRect(x, base - bh, bw, bh);
    if (dmg < doom - 0.10) {                       // still roofed
      g.beginPath();
      g.moveTo(x - 2, base - bh);
      g.lineTo(x + bw / 2, base - bh - 7 - rand(i + 2) * 4);
      g.lineTo(x + bw + 2, base - bh);
      g.closePath();
      g.fill();
    }
    // A lit window means somebody is still in there. They go out early, and
    // they only show at dusk.
    const lived = dmg < doom - 0.18;
    if (lived && night > 0.35 && rand(i + 17) > 0.35) {
      g.fillStyle = `rgba(247,206,124,${0.5 * Math.min(1, (night - 0.35) / 0.4)})`;
      g.fillRect(x + 4 + rand(i + 23) * (bw - 12), base - bh + 4 + rand(i + 29) * 5, 3, 3);
    }
  }

  // The church, still there when nothing else is.
  if (dmg < 0.97) {
    const cx = x0 + span + 22;
    g.fillStyle = dark;
    g.fillRect(cx, base - 20, 13, 20);
    g.beginPath();
    g.moveTo(cx + 1, base - 20);
    g.lineTo(cx + 6.5, base - 42);
    g.lineTo(cx + 12, base - 20);
    g.closePath();
    g.fill();
  }

  // Ground below the horizon, fading down into the floor's own background.
  // Without it the band ends on a ruled line straight across the screen.
  const soil = g.createLinearGradient(0, base, 0, h);
  soil.addColorStop(0, `rgba(${lerp(26, 40, dead) | 0},${lerp(24, 32, dead) | 0},${lerp(22, 22, dead) | 0},0.85)`);
  soil.addColorStop(1, 'rgba(14,12,10,0)');
  g.fillStyle = soil;
  g.fillRect(0, base, w, h - base);

  // Your own site, creeping in from the right and out-topping everything.
  const site = clamp(dmg * 1.2, 0, 1);
  const sw = w * 0.26 * site;
  if (sw > 8) {
    g.fillStyle = `rgba(20,24,30,0.95)`;
    g.fillRect(w - sw - 2, base - 16 - 26 * site, sw, 16 + 26 * site);
    // Hazard lights on the tall corner.
    if (night > 0.3) {
      g.fillStyle = `rgba(229,97,79,${0.55 * night})`;
      g.fillRect(w - sw - 1, base - 18 - 26 * site, 3, 3);
    }
  }
}

/**
 * Blit the cached skyline, then the smoke, which is the only moving part.
 * `pan` slides it a fraction of the camera so it sits at a distance.
 */
export function drawSkyline(ctx, w, h, dmg, t, sun, pan) {
  if (w <= 0 || h <= 0) return;
  const band = Math.round(Math.min(150, Math.max(78, h * 0.27)));
  const cw = Math.round(w) + OVERHANG * 2;
  // Coarse buckets: the picture only needs to change when it would visibly
  // differ, not on every thousandth of a damage point.
  const key = `${cw}|${band}|${Math.round(dmg * 40)}|${Math.round(sun * 12)}`;
  if (skyCache.key !== key) {
    const c = skyCache.canvas || (skyCache.canvas = document.createElement('canvas'));
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = Math.ceil(cw * dpr);
    c.height = Math.ceil(band * dpr);
    const g = c.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, cw, band);
    paintSkyline(g, cw, band, dmg, sun);
    skyCache.key = key;
    skyCache.w = cw;
    skyCache.h = band;
  }

  const shift = Math.max(-OVERHANG, Math.min(OVERHANG, (pan || 0) * 0.06));
  ctx.save();
  ctx.drawImage(skyCache.canvas, -OVERHANG + shift, 0, skyCache.w, skyCache.h);

  // Plumes from the site: the one thing that moves, and the one thing that
  // gets worse without ever getting better.
  const site = clamp(dmg * 1.2, 0, 1);
  if (site > 0.08) {
    const baseY = band * 0.78;                  // the horizon, same as the paint
    // One soft dome of exhaust rather than drawn plumes. A hundred pixels of
    // sky is not enough for smoke to have a shape: columns read as stripes and
    // fanned columns read as a starburst, both of which were tried. A haze
    // that breathes says the same thing and stays out of the way.
    const cx = w - w * 0.13 * site - 6 + shift;
    const breath = 1 + Math.sin(t * 0.21) * 0.07;
    const r = baseY * (0.55 + 0.35 * site) * breath;
    const haze = ctx.createRadialGradient(cx, baseY, 0, cx, baseY, r);
    haze.addColorStop(0, `rgba(178,166,146,${0.11 * site})`);
    haze.addColorStop(0.5, `rgba(168,158,140,${0.05 * site})`);
    haze.addColorStop(1, 'rgba(160,150,134,0)');
    ctx.fillStyle = haze;
    ctx.beginPath();
    // A half-dome: the sky above the horizon only.
    ctx.ellipse(cx, baseY, r, r * 0.92, 0, Math.PI, 0);
    ctx.fill();
  }
  ctx.restore();
}
