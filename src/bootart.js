import { lightSprite } from './render.js';
/**
 * The backdrop behind the title card: a slow isometric drift over a floor of
 * racks, lit only by their own status strips. Purely decorative — it holds no
 * game state, and stops the moment the site itself takes over the screen.
 */

const TW = 68;
const TH = 34;
const COLS = 30;
const ROWS = 30;

/** A stable pseudo-random in [0,1) from a pair of coordinates. */
function noise(x, y) {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

/** The floor plan: which tiles carry a machine, and how tall it stands. */
function plan() {
  const out = [];
  for (let gy = 0; gy < ROWS; gy++) {
    for (let gx = 0; gx < COLS; gx++) {
      const n = noise(gx, gy);
      // Leave aisles, so the eye reads rows of racks rather than a solid slab.
      if (gx % 4 === 3 || n < 0.28) continue;
      out.push({
        gx, gy,
        h: 26 + Math.round(noise(gx + 9, gy) * 20),
        lit: noise(gx, gy + 5),
        rate: 0.6 + noise(gx + 3, gy + 3) * 2.4,
      });
    }
  }
  return out;
}

export class BootArt {
  constructor(canvas) {
    this.c = canvas;
    this.ctx = canvas.getContext('2d');
    this.tiles = plan();
    this.t = 0;
    this.raf = 0;
    this.last = 0;
    this.dead = false;
    this.onResize = () => this.resize();
    window.addEventListener('resize', this.onResize);
    this.resize();
  }

  resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.w = w; this.h = h;
    this.c.width = Math.max(1, Math.round(w * dpr));
    this.c.height = Math.max(1, Math.round(h * dpr));
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  start() {
    if (this.raf || this.dead) return;
    this.last = performance.now();
    const loop = (now) => {
      if (this.dead) return;
      const dt = Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      this.t += dt;
      this.draw();
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop() {
    this.dead = true;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    window.removeEventListener('resize', this.onResize);
  }

  draw() {
    const { ctx, w, h } = this;
    ctx.clearRect(0, 0, w, h);

    // The camera sways rather than scrolls, so the field never runs out of
    // floor and the seam at the edge of the plan is never reached.
    const ox = w / 2 + Math.sin(this.t * 0.055) * 120;
    const oy = h * 0.56 + Math.cos(this.t * 0.041) * 26;

    const at = (gx, gy) => ({
      x: ox + (gx - gy) * (TW / 2),
      y: oy + (gx + gy) * (TH / 2) - (COLS + ROWS) * (TH / 4),
    });

    // Back to front, so nearer racks occlude the ones behind them.
    const order = this.tiles.slice().sort((a, b) => (a.gx + a.gy) - (b.gx + b.gy));

    for (const t of order) {
      const p = at(t.gx, t.gy);
      if (p.x < -TW || p.x > w + TW || p.y < -TH * 4 || p.y > h + TH * 3) continue;
      // Depth fade: rows further back sink into the dark.
      const depth = (t.gx + t.gy) / (COLS + ROWS - 2);
      const a = 0.26 + depth * 0.62;
      this.rack(p.x, p.y, t, a);
    }

    // A low haze over the floor, and a vignette to seat the title card.
    const haze = ctx.createLinearGradient(0, h * 0.42, 0, h);
    haze.addColorStop(0, 'rgba(14,12,10,0.72)');
    haze.addColorStop(0.42, 'rgba(14,12,10,0.16)');
    haze.addColorStop(1, 'rgba(10,9,8,0.80)');
    ctx.fillStyle = haze;
    ctx.fillRect(0, 0, w, h);

    const vig = ctx.createRadialGradient(w / 2, h * 0.44, 40, w / 2, h * 0.44, Math.max(w, h) * 0.72);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(0,0,0,0.66)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, w, h);
  }

  /** One extruded rack prism with a column of blinking status strips. */
  rack(x, y, t, a) {
    const ctx = this.ctx;
    const hw = TW / 2;
    const hh = TH / 2;
    const H = t.h;

    ctx.globalAlpha = a;

    // Left face.
    ctx.fillStyle = '#141519';
    ctx.beginPath();
    ctx.moveTo(x - hw, y);
    ctx.lineTo(x, y + hh);
    ctx.lineTo(x, y + hh - H);
    ctx.lineTo(x - hw, y - H);
    ctx.closePath();
    ctx.fill();

    // Right face, a shade lighter so the form reads.
    ctx.fillStyle = '#1c1e24';
    ctx.beginPath();
    ctx.moveTo(x + hw, y);
    ctx.lineTo(x, y + hh);
    ctx.lineTo(x, y + hh - H);
    ctx.lineTo(x + hw, y - H);
    ctx.closePath();
    ctx.fill();

    // Lid.
    ctx.fillStyle = '#26292f';
    ctx.beginPath();
    ctx.moveTo(x, y - H - hh);
    ctx.lineTo(x + hw, y - H);
    ctx.lineTo(x, y - H + hh);
    ctx.lineTo(x - hw, y - H);
    ctx.closePath();
    ctx.fill();

    // The same lamp the floor uses, so the title screen is lit by the same
    // light as the game behind it.
    if (a > 0.06) {
      const rgb = t.lit > 0.86 ? '111,200,216' : '242,168,60';
      const gr = (hw + hh) * 0.9;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = a * (0.10 + 0.10 * Math.max(0, Math.sin(this.t * t.rate + t.lit * 6)));
      ctx.drawImage(lightSprite(rgb), x + hw / 2 - gr, y - gr * 0.6, gr * 2, gr * 1.2);
      ctx.restore();
    }

    // Status strips down the right face: four bays, each on its own beat.
    for (let i = 0; i < 4; i++) {
      const f = (i + 0.6) / 4.6;
      const sy = y + hh - H * (1 - f) - hh * f;
      const beat = Math.sin(this.t * t.rate + i * 1.7 + t.lit * 6);
      const on = 0.28 + Math.max(0, beat) * 0.72;
      ctx.globalAlpha = a * on * 0.9;
      ctx.fillStyle = t.lit > 0.86 ? '#6fc8d8' : '#f2a83c';
      ctx.beginPath();
      ctx.moveTo(x + 5, sy + 2.5);
      ctx.lineTo(x + hw - 6, sy - (hw - 11) * (hh / hw) + 2.5);
      ctx.lineTo(x + hw - 6, sy - (hw - 11) * (hh / hw) + 5);
      ctx.lineTo(x + 5, sy + 5);
      ctx.closePath();
      ctx.fill();
    }

    ctx.globalAlpha = 1;
  }
}
