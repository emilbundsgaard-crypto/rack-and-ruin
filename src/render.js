// Isometric view of the floor.
//
// Tiles are diamonds; machines are extruded prisms standing on them, sorted
// back to front. Identity comes from silhouette, height and colour, with a
// decal painted flat on the top face — not from a caption on every box.
// Hovering names the thing; the floor stays quiet.

import { clamp } from './util.js';
import { BUILDINGS_BY_ID } from './data/buildings.js';
import { roomOf, tileAt } from './state.js';
import { daylight } from './sim.js';
import { drawSkyline } from './town.js';

export const TW = 68;            // tile width on screen
export const TH = 34;            // tile height on screen (2:1 isometric)
export const TILE = TW;          // kept for callers that just want a scale

const DETAIL = 0.5;              // below this zoom, decals are skipped
const BAYS = 0.78;               // and below this, racks lose their server bays
const LID = 0.34;                // and below this, machines are plain blocks
const HSCALE = 1.35;             // volumes read better a little taller than life
const STEAMY = new Set(['cooltower', 'coil', 'recycle', 'louvre']);

// ------------------------------------------------------------ colour tools

function hexToRgb(h) {
  const v = h.replace('#', '');
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
}

/** Wet plant: the things with a plume worth drawing. */
const STEAMS = new Set(['adiabatic', 'chiller', 'crac', 'cryo']);

const shadeCache = new Map();

/** Lighten (k > 1) or darken (k < 1) a hex colour, memoised. */
function shade(hex, k, mixTo) {
  const key = hex + k + (mixTo || '');
  const hit = shadeCache.get(key);
  if (hit) return hit;
  let [r, g, b] = hexToRgb(hex);
  if (mixTo) {
    const [mr, mg, mb] = hexToRgb(mixTo);
    const m = 0.55;
    r = r * (1 - m) + mr * m; g = g * (1 - m) + mg * m; b = b * (1 - m) + mb * m;
  }
  const out = 'rgb(' + [r, g, b].map((c) => Math.max(0, Math.min(255, Math.round(c * k)))).join(',') + ')';
  shadeCache.set(key, out);
  return out;
}

// ------------------------------------------------------------- top decals

/**
 * Decals are drawn in a -10..10 box on the top face, already skewed into the
 * isometric plane. Keep them chunky: thin strokes disappear once flattened.
 */
const DECALS = {
  plug(c) { c.lineWidth = 2.4; ring(c, 6); c.beginPath(); c.moveTo(-3, -3); c.lineTo(-3, 3); c.moveTo(3, -3); c.lineTo(3, 3); c.stroke(); },
  busbar(c) { c.lineWidth = 2.6; for (const y of [-4, 0, 4]) { c.beginPath(); c.moveTo(-8, y); c.lineTo(8, y); c.stroke(); } },
  transformer(c) { c.lineWidth = 2.2; ring(c, 4.5, -4); ring(c, 4.5, 4); },
  battery(c, t) { c.lineWidth = 2.2; c.strokeRect(-7, -4, 14, 8); const n = 1 + Math.floor((Math.sin(t * 1.6) * 0.5 + 0.5) * 3); for (let i = 0; i < n; i++) c.fillRect(-5.5 + i * 3.4, -2.4, 2.4, 4.8); },
  engine(c, t, k) { c.lineWidth = 2.2; c.strokeRect(-8, -4.5, 16, 9); const b = Math.sin(t * 8 + k) * 1.4; c.beginPath(); c.arc(-3, b, 2, 0, 7); c.moveTo(5, -b); c.arc(3, -b, 2, 0, 7); c.stroke(); },
  sun(c, t) { c.lineWidth = 2; ring(c, 3.5); for (let i = 0; i < 8; i++) { const a = i / 8 * 6.283 + t * 0.2; c.beginPath(); c.moveTo(Math.cos(a) * 5.5, Math.sin(a) * 5.5); c.lineTo(Math.cos(a) * 9, Math.sin(a) * 9); c.stroke(); } },
  turbine(c, t, k) { c.lineWidth = 2.2; c.save(); c.rotate(t * 2 + k); for (let i = 0; i < 3; i++) { c.rotate(2.094); c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -9); c.stroke(); } c.restore(); dot(c, 2); },
  flame(c, t, k) { c.lineWidth = 2.2; const w = 1 + Math.sin(t * 5 + k) * 0.14; c.beginPath(); c.moveTo(0, 8); c.bezierCurveTo(-7 * w, 3, -4 * w, -2, 0, -8); c.bezierCurveTo(4 * w, -2, 7 * w, 3, 0, 8); c.stroke(); },
  atom(c, t) { c.lineWidth = 1.8; for (let i = 0; i < 3; i++) { c.save(); c.rotate(i * 1.047 + t * 0.3); c.beginPath(); c.ellipse(0, 0, 9, 3.4, 0, 0, 6.283); c.stroke(); c.restore(); } dot(c, 2.2); },
  star(c, t) { c.lineWidth = 2; const p = 0.85 + Math.sin(t * 2.5) * 0.15; c.beginPath(); for (let i = 0; i < 10; i++) { const a = i / 10 * 6.283 - 1.571; const r = (i % 2 ? 3.6 : 9) * p; i ? c.lineTo(Math.cos(a) * r, Math.sin(a) * r) : c.moveTo(Math.cos(a) * r, Math.sin(a) * r); } c.closePath(); c.stroke(); },
  fan(c, t, k) { c.lineWidth = 2.6; c.save(); c.rotate(t * 3.5 + k); for (let i = 0; i < 3; i++) { c.rotate(2.094); c.beginPath(); c.arc(0, 0, 7, -0.4, 0.85); c.stroke(); } c.restore(); dot(c, 2); },
  coil(c, t, k) { c.lineWidth = 2.2; c.beginPath(); for (let i = 0; i <= 32; i++) { const x = -9 + i / 32 * 18; const y = Math.sin(i / 32 * 12.6 + t * 2 + k) * 4.5; i ? c.lineTo(x, y) : c.moveTo(x, y); } c.stroke(); },
  louvre(c, t, k) { c.lineWidth = 2.4; for (let i = 0; i < 4; i++) { const y = -6 + i * 4; const tl = Math.sin(t * 1.2 + k + i * 0.4) * 1.4; c.beginPath(); c.moveTo(-8, y - tl); c.lineTo(8, y + tl); c.stroke(); } },
  cooltower(c, t, k) { c.lineWidth = 2.2; ring(c, 7); c.globalAlpha = 0.5 + Math.sin(t * 2 + k) * 0.3; ring(c, 3.4); c.globalAlpha = 1; },
  snow(c, t) { c.lineWidth = 2; for (let i = 0; i < 3; i++) { c.save(); c.rotate(i * 1.047 + t * 0.15); c.beginPath(); c.moveTo(0, -9); c.lineTo(0, 9); c.moveTo(-2.4, -6); c.lineTo(0, -8.4); c.lineTo(2.4, -6); c.stroke(); c.restore(); } },
  tank(c, t, k) { c.lineWidth = 2.2; ring(c, 8); c.globalAlpha = 0.4; c.beginPath(); c.arc(0, 0, 5 + Math.sin(t * 1.5 + k) * 0.8, 0, 6.283); c.fill(); c.globalAlpha = 1; },
  cryo(c, t) { c.lineWidth = 2.2; c.strokeRect(-8, -8, 16, 16); DECALS.snow(c, t * 0.6, 0); },
  barrel(c) { c.lineWidth = 2.2; ring(c, 7.5); ring(c, 3.5); },
  tap(c, t, k) { c.lineWidth = 2.4; c.beginPath(); c.moveTo(-8, -4); c.lineTo(2, -4); c.lineTo(2, 2); c.stroke(); dot(c, 1.8, 2, 4 + ((t * 12 + (k || 0)) % 5)); },
  well(c, t, k) { c.lineWidth = 2.2; ring(c, 8); c.beginPath(); c.moveTo(-8, 0); c.lineTo(8, 0); c.stroke(); dot(c, 2, 0, Math.sin(t * 1.6 + k) * 3); },
  recycle(c, t) { c.lineWidth = 2.6; c.save(); c.rotate(t * 0.7); for (let i = 0; i < 3; i++) { c.rotate(2.094); c.beginPath(); c.arc(0, 0, 7, -0.5, 1); c.stroke(); } c.restore(); },
  wave(c, t, k) { c.lineWidth = 2.2; for (let r = 0; r < 3; r++) { c.beginPath(); for (let i = 0; i <= 16; i++) { const x = -8 + i; const y = -4.5 + r * 4.5 + Math.sin(i / 2.2 + t * 2.4 + k + r) * 1.5; i ? c.lineTo(x, y) : c.moveTo(x, y); } c.stroke(); } },
  switch(c, t, k) { c.lineWidth = 2.2; c.strokeRect(-9, -3.5, 18, 7); const on = Math.floor(t * 5 + k) % 4; for (let i = 0; i < 4; i++) { c.globalAlpha = i === on ? 1 : 0.3; c.fillRect(-7 + i * 3.7, -1.4, 2.4, 2.8); } c.globalAlpha = 1; },
  fibre(c, t, k) { c.lineWidth = 2.2; for (const y of [-4, 0, 4]) { c.beginPath(); c.moveTo(-9, y); c.lineTo(9, y); c.stroke(); } dot(c, 2, ((t * 20 + (k || 0) * 6) % 18) - 9, 0); },
  globe(c) { c.lineWidth = 2; ring(c, 8); c.beginPath(); c.ellipse(0, 0, 3.5, 8, 0, 0, 6.283); c.stroke(); c.beginPath(); c.moveTo(-8, 0); c.lineTo(8, 0); c.stroke(); },
  desk(c) { c.lineWidth = 2.4; c.beginPath(); c.moveTo(-9, 2); c.lineTo(9, 2); c.stroke(); ring(c, 2.6, 0, -4); },
  wrench(c) { c.lineWidth = 2.6; c.beginPath(); c.arc(-4, -4, 4.4, 0.6, 5.2); c.stroke(); c.beginPath(); c.moveTo(-1, -1); c.lineTo(7, 7); c.stroke(); },
  screen(c, t, k) { c.lineWidth = 2.2; c.strokeRect(-9, -6, 18, 12); c.lineWidth = 1.8; c.beginPath(); for (let i = 0; i <= 12; i++) { const x = -7 + i * 1.2; const y = Math.sin(i * 1.1 + t * 3.5 + k) * 2.6; i ? c.lineTo(x, y) : c.moveTo(x, y); } c.stroke(); },
  shield(c) { c.lineWidth = 2.4; c.beginPath(); c.moveTo(0, -9); c.lineTo(7, -5); c.lineTo(7, 2); c.quadraticCurveTo(7, 7, 0, 9); c.quadraticCurveTo(-7, 7, -7, 2); c.lineTo(-7, -5); c.closePath(); c.stroke(); },
  flask(c, t, k) { c.lineWidth = 2.4; c.beginPath(); c.moveTo(-3, -8); c.lineTo(-3, -2); c.lineTo(-7, 7); c.lineTo(7, 7); c.lineTo(3, -2); c.lineTo(3, -8); c.closePath(); c.stroke(); c.globalAlpha = 0.5; dot(c, 1.6, -1.5, 4 - (t * 6 + k * 2) % 8); c.globalAlpha = 1; },
  tag(c) { c.lineWidth = 2.4; c.beginPath(); c.moveTo(-8, -2); c.lineTo(-1, -9); c.lineTo(9, -9); c.lineTo(9, 1); c.lineTo(2, 8); c.closePath(); c.stroke(); },
  rack(c) { c.lineWidth = 2.2; c.strokeRect(-7, -8, 14, 16); },
};

function ring(c, r, x = 0, y = 0) { c.beginPath(); c.arc(x, y, r, 0, 6.283); c.stroke(); }
function dot(c, r, x = 0, y = 0) { c.beginPath(); c.arc(x, y, r, 0, 6.283); c.fill(); }

// ------------------------------------------------------------------- view

export class FloorView {
  constructor(canvas, callbacks) {
    this.c = canvas;
    this.ctx = canvas.getContext('2d');
    this.cb = callbacks || {};
    this.zoom = 1;
    this.lights = [];          // lamps to bloom, refilled every frame
    this.ox = 0;
    this.oy = 0;
    this.w = 0;
    this.h = 0;
    this.hover = null;
    this.sel = null;
    this.tool = null;
    this.overlay = 'none';
    this.rot = 0;            // 0-3, quarter turns of the room
    this.t = 0;
    this.dragging = false;
    this.panned = false;
    this.centred = false;
    this.hits = [];
    this.fx = [];
    this.sun = 1;
    this.night = 0;
    this._bind();
  }

  /**
   * Keep the backing store the same size as the CSS box. Anything that changes
   * the layout — the to-do list growing, a panel opening — resizes the canvas
   * element, and if the buffer does not follow the browser simply stretches the
   * last frame. Everything then sits a little away from the pointer, which is
   * exactly as maddening as it sounds.
   */
  resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const r = this.c.getBoundingClientRect();
    if (!r.width || !r.height) return;
    this.w = r.width;
    this.h = r.height;
    this.dpr = dpr;
    const bw = Math.max(1, Math.round(r.width * dpr));
    const bh = Math.max(1, Math.round(r.height * dpr));
    if (this.c.width !== bw || this.c.height !== bh) {
      this.c.width = bw;
      this.c.height = bh;
      this._groundKey = null;
    }
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /** Watch the element itself, not just the window. */
  observe() {
    if (this._ro || typeof ResizeObserver === 'undefined') return;
    this._ro = new ResizeObserver(() => this.resize());
    this._ro.observe(this.c);
  }

  /** World position of a rotated grid position, before pan and zoom. */
  isoR(rx, ry) {
    return { x: (rx - ry) * (TW / 2), y: (rx + ry) * (TH / 2) };
  }

  /** Room dimensions as seen from the current corner. */
  dims(f) {
    return this.rot % 2 ? { w: f.h, h: f.w } : { w: f.w, h: f.h };
  }

  /** Tile coordinates into the rotated grid the camera is looking at. */
  rotate(gx, gy, f) {
    switch (this.rot) {
      case 1: return { x: (f.h - 1) - gy, y: gx };
      case 2: return { x: (f.w - 1) - gx, y: (f.h - 1) - gy };
      case 3: return { x: gy, y: (f.w - 1) - gx };
      default: return { x: gx, y: gy };
    }
  }

  /** And back again, for turning a picked position into a real tile. */
  unrotate(rx, ry, f) {
    switch (this.rot) {
      case 1: return { x: ry, y: (f.h - 1) - rx };
      case 2: return { x: (f.w - 1) - rx, y: (f.h - 1) - ry };
      case 3: return { x: (f.w - 1) - ry, y: rx };
      default: return { x: rx, y: ry };
    }
  }

  /** World position of a tile's ground centre, in the current rotation. */
  iso(gx, gy, f) {
    const r = f ? this.rotate(gx, gy, f) : { x: gx, y: gy };
    return this.isoR(r.x, r.y);
  }

  /** Turn the room a quarter, keeping the middle of the view where it is. */
  turn(dir) {
    this.rot = (this.rot + (dir || 1) + 4) % 4;
    this._groundKey = null;
    this.centred = false;
  }

  centre(state) {
    const fac = roomOf(state);
    const f = this.dims(fac);
    const spanX = (f.w + f.h) * (TW / 2);
    const spanY = (f.w + f.h) * (TH / 2) + 90;
    this.zoom = clamp(Math.min((this.w - 40) / spanX, (this.h - 40) / spanY), 0.22, 1.6);
    const midX = ((f.w - 1) - (f.h - 1)) * (TW / 2) / 2;
    const midY = ((f.w - 1) + (f.h - 1)) * (TH / 2) / 2;
    this.ox = this.w / 2 - midX * this.zoom;
    this.oy = this.h / 2 - midY * this.zoom + 14 * this.zoom;
    this.centred = true;
  }

  /** Screen coordinates of a tile centre — used by the automated checks. */
  tileCentre(gx, gy, f) {
    const r = this.c.getBoundingClientRect();
    const p = this.iso(gx, gy, f || this._fac);
    return { x: r.left + this.ox + p.x * this.zoom, y: r.top + this.oy + p.y * this.zoom };
  }

  /**
   * Pointer picking walks the draw list backwards so the machine in front wins,
   * then falls back to the ground plane for empty tiles.
   */
  pick(px, py) {
    // Hit polygons are recorded in world space during the draw, so convert the
    // pointer once and walk the list backwards: whatever is in front wins.
    //
    // While a machine is held, skip that and read the floor instead. A tall
    // cabinet covers the tile behind it, and when you are placing something you
    // mean the ground under the cursor, not the box in front of it.
    const wx = (px - this.ox) / this.zoom;
    const wy = (py - this.oy) / this.zoom;
    const onGround = this.tool && this.tool !== 'sell';
    if (!onGround) {
      for (let i = this.hits.length - 1; i >= 0; i--) {
        const hit = this.hits[i];
        if (pointInPoly(wx, wy, hit.poly)) return { x: hit.gx, y: hit.gy };
      }
    }
    const a = wx / (TW / 2);
    const b = wy / (TH / 2);
    const rx = Math.round((a + b) / 2);
    const ry = Math.round((b - a) / 2);
    return this._fac ? this.unrotate(rx, ry, this._fac) : { x: rx, y: ry };
  }

  _bind() {
    const c = this.c;
    let last = null;
    const touches = new Map();
    let pinch = null;
    const pos = (e) => {
      const r = c.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const spread = () => {
      const [a, b] = [...touches.values()];
      return {
        d: Math.hypot(a.x - b.x, a.y - b.y),
        mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
      };
    };

    c.addEventListener('pointerdown', (e) => {
      c.setPointerCapture(e.pointerId);
      touches.set(e.pointerId, pos(e));
      if (touches.size === 2) {
        // Two fingers means pinch, not paint.
        const sp = spread();
        pinch = { d: sp.d, zoom: this.zoom };
        this.dragging = false;
        this.panned = true;
        return;
      }
      last = pos(e);
      this.dragging = true;
      this.panned = false;
      this.button = e.button;
      this.touch = e.pointerType === 'touch';
      // Remember where the drag began. A drag paints the tiles it moves over,
      // so without this the tile the pointer went down on is never touched and
      // dragging across a row always leaves its first tile behind.
      this.downTile = this.pick(last.x, last.y);
      this.paintedDown = false;
    });

    c.addEventListener('pointermove', (e) => {
      const p = pos(e);
      if (touches.has(e.pointerId)) touches.set(e.pointerId, p);
      if (pinch && touches.size === 2) {
        const sp = spread();
        if (sp.d > 4 && pinch.d > 4) {
          const nz = clamp(pinch.zoom * (sp.d / pinch.d), 0.18, 2.4);
          const f = nz / this.zoom;
          this.ox = sp.mid.x - (sp.mid.x - this.ox) * f;
          this.oy = sp.mid.y - (sp.mid.y - this.oy) * f;
          this.zoom = nz;
        }
        return;
      }
      this.hover = this.pick(p.x, p.y);
      if (this.dragging && last) {
        const dx = p.x - last.x, dy = p.y - last.y;
        // A finger needs more slack than a mouse before a tap counts as a drag.
        if (Math.abs(dx) + Math.abs(dy) > (this.touch ? 9 : 3)) this.panned = true;
        // With a machine held, dragging paints a row on a mouse. On a touch
        // screen dragging has to move the camera instead — it is the only way
        // to get around, and painting a row by accident while trying to scroll
        // the floor is the easiest mistake on a phone. There, you tap to place.
        const paintDrag = this.tool && !this.touch;
        if (this.button === 1 || this.button === 2 || !paintDrag) {
          this.ox += dx; this.oy += dy;
        } else if (this.panned) {
          if (!this.paintedDown && this.downTile) {
            this.paintedDown = true;
            this.cb.onPaint?.(this.downTile.x, this.downTile.y);
          }
          this.cb.onPaint?.(this.hover.x, this.hover.y);
        }
        last = p;
      }
      this.cb.onHover?.(this.hover);
    });

    const end = (e) => {
      touches.delete(e.pointerId);
      if (touches.size < 2) pinch = null;
      if (this.dragging && !this.panned) {
        const p = pos(e);
        const t = this.pick(p.x, p.y);
        this.cb.onClick?.(t.x, t.y, e.shiftKey);
      }
      this.dragging = false;
      last = null;
    };
    c.addEventListener('pointerup', end);
    c.addEventListener('pointercancel', (e) => {
      touches.delete(e.pointerId);
      if (touches.size < 2) pinch = null;
      this.dragging = false;
      last = null;
    });
    c.addEventListener('pointerleave', () => { this.hover = null; this.cb.onHover?.(null); });
    c.addEventListener('contextmenu', (e) => e.preventDefault());

    c.addEventListener('wheel', (e) => {
      e.preventDefault();
      const p = pos(e);
      const k = e.deltaY < 0 ? 1.12 : 1 / 1.12;
      const nz = clamp(this.zoom * k, 0.18, 2.4);
      const f = nz / this.zoom;
      this.ox = p.x - (p.x - this.ox) * f;
      this.oy = p.y - (p.y - this.oy) * f;
      this.zoom = nz;
    }, { passive: false });
  }

  // ---------------------------------------------------------------- drawing

  diamond(ctx, p, inset = 0) {
    const hw = TW / 2 - inset, hh = TH / 2 - inset * (TH / TW);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - hh);
    ctx.lineTo(p.x + hw, p.y);
    ctx.lineTo(p.x, p.y + hh);
    ctx.lineTo(p.x - hw, p.y);
    ctx.closePath();
  }

  draw(state, d, dt) {
    // One bad dt would poison the clock for the rest of the session: it feeds
    // the sine that breathes the haze, and NaN there throws out of the gradient
    // rather than drawing wrong, taking the whole frame with it.
    this.t += Number.isFinite(dt) ? dt : 0;
    const ctx = this.ctx;
    const f = roomOf(state);
    this._fac = f;
    // Daylight drives the atmosphere: how dark the room is, how hard the
    // machine lights read, and what colour the air is at dawn and dusk.
    this.sun = daylight(state.day);
    this.night = 1 - this.sun;
    // Every lamp the scene wants to bloom, gathered as it is drawn and burned
    // in afterwards in one pass.
    this.lights.length = 0;
    if (!this.centred && this.w) this.centre(state);
    ctx.clearRect(0, 0, this.w, this.h);

    // Ashbrook, on the horizon, before anything else and behind everything
    // else. Drawn in screen space: it is scenery at distance, so it does not
    // ride the camera's zoom, and only drifts a fraction of its pan.
    drawSkyline(ctx, this.w, this.h, state.town?.damage || 0, this.t, this.sun, this.ox);

    ctx.save();
    ctx.translate(this.ox, this.oy);
    ctx.scale(this.zoom, this.zoom);

    this.drawGround(ctx, state, d, f);
    if (this.overlay !== 'none') this.drawOverlay(ctx, state, d, f);

    const focus = this.tool && this.tool !== 'sell' ? this.hover : this.sel;
    if (focus) this.drawRange(ctx, state, focus, d);

    // Ground rings, but only for bare floor. A machine gets its own outline
    // after it is drawn, because that is where the cursor actually is: your
    // pointer is up on the body, not down at its feet.
    const selEmpty = this.sel && !tileAt(state, this.sel.x, this.sel.y);
    const hoverTile = this.hover && inRoom(f, this.hover) ? tileAt(state, this.hover.x, this.hover.y) : null;
    if (selEmpty) this.markTile(ctx, this.sel, '#fff6e6', true);
    if (this.hover && inRoom(f, this.hover) && !hoverTile) {
      this.markTile(ctx, this.hover, this.tool === 'sell' ? '#e5614f' : '#f2a83c');
    }

    // Everything on the floor, back to front.
    const order = [];
    for (const k in state.tiles) {
      const [gx, gy] = k.split(',').map(Number);
      const r = this.rotate(gx, gy, f);
      order.push({ gx, gy, depth: r.x + r.y, tie: r.x, tile: state.tiles[k] });
    }
    order.sort((a, b) => a.depth - b.depth || a.tie - b.tie);

    const rackAt = new Map();
    for (const r of d.racks) rackAt.set(r.x + ',' + r.y, r);

    this.hits.length = 0;
    const hv = this.hover;
    for (const item of order) {
      const b = BUILDINGS_BY_ID[item.tile.b];
      if (!b) continue;
      const rack = rackAt.get(item.gx + ',' + item.gy);
      const lifted = hv && hv.x === item.gx && hv.y === item.gy ? 5 : 0;
      this.drawSolid(ctx, item.gx, item.gy, b, rack, d, false, lifted);
    }

    // Air: steam off the wet plant, haze off whatever is cooking.
    //
    // Both of these were written and then never called — two atmospheric
    // effects sitting dead in the file. The haze earns its place twice over:
    // a rack in trouble is currently only red, and red is the one thing a
    // deuteranope cannot see. Rising air says "hot" without any colour at all.
    if (this.zoom > 0.34) {
      for (const item of order) {
        const b = BUILDINGS_BY_ID[item.tile.b];
        if (b && STEAMS.has(b.id)) this.steam(ctx, item.gx, item.gy, b);
      }
      for (const r of d.racks) {
        if (r.used > 0 && r.temp > 36) {
          this.shimmer(ctx, r.x, r.y, clamp((r.temp - 36) / 26, 0, 1));
        }
      }
    }

    if (this.overlay !== 'none') this.drawOverlayOver(ctx);

    // Outline whatever the cursor and the selection are actually on.
    if (this.sel && !selEmpty) this.outlineSolid(ctx, this.sel, '#fff6e6', 2, true);
    if (hoverTile) {
      const bad = this.tool === 'sell' || (this.tool && this.tool !== 'sell');
      this.outlineSolid(ctx, this.hover, this.tool === 'sell' ? '#ff8a80'
        : this.tool ? '#f2c14e' : '#ffe0a8', 2.4, false);
    }

    this.drawFx(ctx);

    // A ghost of what you are about to place.
    if (this.tool && this.tool !== 'sell' && this.hover && inRoom(f, this.hover)
        && !tileAt(state, this.hover.x, this.hover.y)) {
      const b = BUILDINGS_BY_ID[this.tool];
      if (b) {
        ctx.globalAlpha = 0.45;
        this.drawSolid(ctx, this.hover.x, this.hover.y, b, null, d, true);
        ctx.globalAlpha = 1;
      }
    }

    ctx.restore();

    this.burn(ctx);

    // One wash over the finished scene for the hour of the day. It is a single
    // fill, and it ties the room to the clock in the top bar.
    const hour = state.day % 1;
    const warm = Math.max(
      Math.max(0, 1 - Math.abs(hour - 0.78) * 9),
      Math.max(0, 1 - Math.abs(hour - 0.24) * 9),
    );
    if (this.night > 0.02 || warm > 0.02) {
      ctx.save();
      ctx.globalCompositeOperation = 'source-atop';
      if (this.night > 0.02) {
        ctx.fillStyle = `rgba(16,26,52,${this.night * 0.32})`;
        ctx.fillRect(0, 0, this.w, this.h);
      }
      if (warm > 0.02) {
        ctx.fillStyle = `rgba(232,124,44,${warm * 0.15})`;
        ctx.fillRect(0, 0, this.w, this.h);
      }
      ctx.restore();
    }

    this.vignette(ctx);
  }

  /**
   * Darken the corners.
   *
   * The room is one flat field of light from edge to edge without it, and the
   * eye has nowhere to land. The gradient is built once per size rather than
   * per frame — that is the whole trick to making this free.
   */
  vignette(ctx) {
    const key = this.w + 'x' + this.h;
    if (this._vigKey !== key) {
      const g = ctx.createRadialGradient(
        this.w * 0.5, this.h * 0.46, Math.min(this.w, this.h) * 0.30,
        this.w * 0.5, this.h * 0.5, Math.max(this.w, this.h) * 0.76);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(0.62, 'rgba(4,5,8,0.20)');
      g.addColorStop(1, 'rgba(3,4,7,0.62)');
      this._vig = g;
      this._vigKey = key;
    }
    ctx.save();
    ctx.fillStyle = this._vig;
    ctx.fillRect(0, 0, this.w, this.h);
    ctx.restore();
  }

  /**
   * Burn the lamps in.
   *
   * Hundreds of server LEDs in a dark room should light the room. They did not:
   * every lamp was a flat coloured strip and the floor between them stayed as
   * dark as the floor under them.
   *
   * The first version of this rendered the lamps to a quarter-size canvas and
   * scaled it back up, on the theory that the upscale is a free blur. It is,
   * but it was the wrong thing to optimise: the cost was never the lamps, it
   * was compositing a full-screen layer in 'lighter' every frame. Forty lamps
   * took a finished room from 30fps to 12, and dropping the smoothing quality
   * changed nothing, which is what gave it away.
   *
   * So there is no layer. The sprite is a soft radial gradient — it is already
   * the blur — and it goes straight onto the scene. Now the blending only
   * touches the area the lamps actually cover.
   */
  burn(ctx) {
    if (!this.lights.length || this.w < 8) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const L of this.lights) {
      // The lamps are collected in floor coordinates, so they go through the
      // same camera the scene did.
      const x = L.x * this.zoom + this.ox;
      const y = L.y * this.zoom + this.oy;
      const r = L.r * this.zoom;
      if (r < 1.5 || x + r < 0 || y + r < 0 || x - r > this.w || y - r > this.h) continue;
      ctx.globalAlpha = L.a;
      // A pool on the floor is squashed to the same angle the floor is.
      const ry = L.flat ? r * L.flat : r;
      ctx.drawImage(lightSprite(L.c), x - r, y - ry, r * 2, ry * 2);
    }
    ctx.restore();
  }

  /** Heat haze: a couple of wobbling threads rising off a cooking rack. */
  shimmer(ctx, gx, gy, strength) {
    const p = this.iso(gx, gy, this._fac);
    const top = p.y - 34;
    ctx.strokeStyle = `rgba(255,190,150,${0.10 + strength * 0.16})`;
    ctx.lineWidth = 1.4;
    for (let i = 0; i < 2; i++) {
      const off = (i - 0.5) * 13;
      const phase = this.t * 1.6 + gx * 1.7 + gy + i * 2.2;
      ctx.beginPath();
      for (let k = 0; k <= 8; k++) {
        const y = top - k * 4.5;
        const x = p.x + off + Math.sin(phase + k * 0.7) * (2 + k * 0.55);
        k ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.stroke();
    }
  }

  /** Steam off a tower, a chiller or a recycler. */
  steam(ctx, gx, gy, b) {
    const p = this.iso(gx, gy, this._fac);
    const top = p.y - b.h * HSCALE - 6;
    for (let i = 0; i < 3; i++) {
      const life = ((this.t * 0.5 + i * 0.34 + gx * 0.13 + gy * 0.07) % 1);
      const rise = life * 34;
      const rr = 4 + life * 9;
      ctx.fillStyle = `rgba(214,206,196,${(1 - life) * 0.20})`;
      ctx.beginPath();
      ctx.arc(p.x + Math.sin(this.t * 0.7 + i * 2) * (3 + life * 6), top - rise, rr, 0, 6.283);
      ctx.fill();
    }
  }

  // -------------------------------------------------------------------- fx

  /** A machine dropping into place, or the dust where one used to be. */
  pop(gx, gy, kind) {
    this.fx.push({ gx, gy, kind: kind || 'place', t: 0 });
    if (this.fx.length > 40) this.fx.shift();
  }

  drawFx(ctx) {
    if (!this.fx.length) return;
    const keep = [];
    for (const e of this.fx) {
      e.t += 1 / 60;
      const life = e.kind === 'place' ? 0.42 : 0.6;
      if (e.t > life) continue;
      keep.push(e);
      const k = e.t / life;
      const p = this.iso(e.gx, e.gy, this._fac);
      if (e.kind === 'place') {
        const r = 6 + k * (TW * 0.44);
        ctx.strokeStyle = `rgba(226,206,176,${(1 - k) * 0.5})`;
        ctx.lineWidth = 2 * (1 - k) + 0.4;
        ctx.beginPath();
        ctx.ellipse(p.x, p.y + 2, r, r * (TH / TW), 0, 0, 6.283);
        ctx.stroke();
      } else {
        for (let i = 0; i < 7; i++) {
          const a = (i / 7) * 6.283 + e.gx;
          const spread = k * (TW * 0.4);
          const rise = Math.sin(k * Math.PI) * 16;
          ctx.fillStyle = `rgba(158,142,120,${(1 - k) * 0.55})`;
          ctx.beginPath();
          ctx.arc(p.x + Math.cos(a) * spread, p.y - rise + Math.sin(a) * spread * (TH / TW),
            2.8 * (1 - k) + 0.6, 0, 6.283);
          ctx.fill();
        }
      }
    }
    this.fx = keep;
  }

  /** Bounds of the whole room in world space, including the plinth. */
  groundBounds(fac) {
    const f = this.dims(fac);
    return {
      minX: -(f.h - 0.5) * (TW / 2) - 4,
      maxX: (f.w - 0.5) * (TW / 2) + 4,
      minY: -TH / 2 - 4,
      maxY: (f.w + f.h - 1) * (TH / 2) + 20,
    };
  }

  /**
   * The floor never changes between frames, so it is rendered once per room
   * and zoom level and blitted. Six hundred diamonds a frame was most of the
   * budget at full site size.
   */
  drawGround(ctx, state, d, f) {
    const dpr = this.dpr || Math.min(2, window.devicePixelRatio || 1);
    const key = f.id + ':' + this.rot + ':' + this.zoom.toFixed(3) + ':' + dpr;
    if (this._groundKey !== key) {
      const b = this.groundBounds(f);
      const cw = Math.ceil((b.maxX - b.minX) * this.zoom * dpr);
      const ch = Math.ceil((b.maxY - b.minY) * this.zoom * dpr);
      if (cw > 0 && ch > 0 && cw * ch < 40e6) {
        const off = this._ground || (this._ground = document.createElement('canvas'));
        off.width = cw; off.height = ch;
        const g = off.getContext('2d');
        g.setTransform(dpr * this.zoom, 0, 0, dpr * this.zoom, -b.minX * dpr * this.zoom, -b.minY * dpr * this.zoom);
        this.paintGround(g, f);
        this._groundKey = key;
        this._groundBox = b;
      }
    }
    if (this._groundKey === key) {
      const b = this._groundBox;
      ctx.save();
      const dp = this.dpr || Math.min(2, window.devicePixelRatio || 1);
      ctx.setTransform(dp, 0, 0, dp, 0, 0);
      ctx.drawImage(this._ground,
        this.ox + b.minX * this.zoom, this.oy + b.minY * this.zoom,
        (b.maxX - b.minX) * this.zoom, (b.maxY - b.minY) * this.zoom);
      ctx.restore();
    }
  }

  paintGround(ctx, fac) {
    const f = this.dims(fac);
    // A plinth under the room reads as a building rather than a spreadsheet.
    const c0 = this.isoR(-0.5, -0.5), c1 = this.isoR(f.w - 0.5, -0.5);
    const c2 = this.isoR(f.w - 0.5, f.h - 0.5), c3 = this.isoR(-0.5, f.h - 0.5);
    const drop = 13;
    ctx.fillStyle = '#080a0d';
    ctx.beginPath();
    ctx.moveTo(c3.x, c3.y); ctx.lineTo(c2.x, c2.y); ctx.lineTo(c2.x, c2.y + drop);
    ctx.lineTo(c3.x, c3.y + drop); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#0d1015';
    ctx.beginPath();
    ctx.moveTo(c2.x, c2.y); ctx.lineTo(c1.x, c1.y); ctx.lineTo(c1.x, c1.y + drop);
    ctx.lineTo(c2.x, c2.y + drop); ctx.closePath(); ctx.fill();

    // Cool slate, not warm brown.
    //
    // The room used to be the same rusty brown as the machines standing in it,
    // which left nothing for the lamps to read against: a lit rack and the
    // floor beside it were the same value. A datacentre is cold steel with
    // coloured light in it, and the split is what makes the light land.
    ctx.strokeStyle = '#242a33';
    ctx.lineWidth = 1;
    for (let gy = 0; gy < f.h; gy++) {
      for (let gx = 0; gx < f.w; gx++) {
        const p = this.isoR(gx, gy);
        this.diamond(ctx, p);
        ctx.fillStyle = (gx + gy) % 2 ? '#161a20' : '#12151b';
        ctx.fill();
        ctx.stroke();
      }
    }
  }

  /** Trace the silhouette of whatever stands on a tile. */
  outlineSolid(ctx, t, colour, width, dashed) {
    const hit = this.hits.find((x) => x.gx === t.x && x.gy === t.y);
    if (!hit) return;
    ctx.save();
    ctx.strokeStyle = colour;
    ctx.lineWidth = width;
    ctx.lineJoin = 'round';
    if (dashed) ctx.setLineDash([6, 4]);
    ctx.shadowColor = colour;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    hit.poly.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }

  markTile(ctx, t, colour, dashed) {
    const p = this.iso(t.x, t.y, this._fac);
    ctx.strokeStyle = colour;
    ctx.lineWidth = 2;
    if (dashed) ctx.setLineDash([5, 4]);
    this.diamond(ctx, p, 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  /**
   * Work out the overlay colour for every tile, once.
   *
   * Kept apart from the drawing because the answer is needed twice: on the bare
   * floor before the machines go down, and again on the machines themselves
   * afterwards.
   */
  overlayMap(state, d, f) {
    const m = new Map();
    const put = (x, y, style) => m.set(x + ',' + y, style);

    if (this.overlay === 'heat') {
      for (const r of d.racks) {
        const t = clamp((r.temp - 20) / 50, 0, 1);
        put(r.x, r.y, `hsla(${(1 - t) * 200}, 85%, 50%, ${0.22 + t * 0.5})`);
      }
      return m;
    }
    if (this.overlay === 'net') {
      const ok = d.netFactor > 0.99;
      for (const r of d.racks) put(r.x, r.y, ok ? 'rgba(143,111,216,.32)' : 'rgba(232,97,95,.36)');
      return m;
    }

    const src = this.overlay === 'power' ? d.pdus : d.coolers;
    const cover = new Map();
    for (const s of src) {
      for (let y = s.y - s.radius; y <= s.y + s.radius; y++) {
        for (let x = s.x - s.radius; x <= s.x + s.radius; x++) {
          if (x < 0 || y < 0 || x >= f.w || y >= f.h) continue;
          const k = x + ',' + y;
          cover.set(k, (cover.get(k) || 0) + 1);
        }
      }
    }
    for (const [k, n] of cover) {
      const [x, y] = k.split(',').map(Number);
      put(x, y, this.overlay === 'power'
        ? `rgba(216,161,58,${Math.min(0.42, 0.15 + n * 0.07)})`
        : `rgba(79,220,168,${Math.min(0.42, 0.15 + n * 0.07)})`);
    }
    // A rack nothing reaches is the thing you opened the overlay to find.
    for (const r of d.racks) {
      if (!cover.get(r.x + ',' + r.y) && r.used > 0) put(r.x, r.y, 'rgba(232,97,95,.42)');
    }
    return m;
  }

  /** The overlay on bare floor, under everything. */
  drawOverlay(ctx, state, d, f) {
    this._ovl = this.overlayMap(state, d, f);
    for (const [k, style] of this._ovl) {
      const [x, y] = k.split(',').map(Number);
      this.diamond(ctx, this.iso(x, y, f));
      ctx.fillStyle = style;
      ctx.fill();
    }
  }

  /**
   * And the same overlay again, over the machines.
   *
   * Without this the overlays were painted on the floor and then buried under
   * the very machines they describe: on a floor with something on every tile —
   * which is every floor worth reading an overlay on — turning one on changed
   * nothing you could see. Reusing the silhouettes the solids already recorded
   * for hit testing means the wash follows the shape of what is standing there.
   */
  drawOverlayOver(ctx) {
    if (!this._ovl || !this._ovl.size || !this.hits.length) return;
    ctx.save();
    for (const hit of this.hits) {
      const style = this._ovl.get(hit.gx + ',' + hit.gy);
      if (!style) continue;
      ctx.beginPath();
      ctx.moveTo(hit.poly[0].x, hit.poly[0].y);
      for (let i = 1; i < hit.poly.length; i++) ctx.lineTo(hit.poly[i].x, hit.poly[i].y);
      ctx.closePath();
      ctx.fillStyle = style;
      ctx.fill();
    }
    ctx.restore();
  }

  drawRange(ctx, state, t, d) {
    const tile = tileAt(state, t.x, t.y);
    const b = tile ? BUILDINGS_BY_ID[tile.b] : BUILDINGS_BY_ID[this.tool];
    if (!b || !b.radius) return;
    const colour = b.cat === 'cooling' ? '#4fdca8' : '#d8a13a';
    const r = b.radius;
    ctx.fillStyle = colour + '22';
    ctx.strokeStyle = colour + '77';
    ctx.lineWidth = 1.2;
    for (let gy = t.y - r; gy <= t.y + r; gy++) {
      for (let gx = t.x - r; gx <= t.x + r; gx++) {
        if (gx < 0 || gy < 0) continue;
        this.diamond(ctx, this.iso(gx, gy, this._fac), 1);
        ctx.fill();
      }
    }
  }

  /**
   * One machine: a prism with a lit top, a shaded left face and a darker right
   * face, plus whatever detail the zoom level can carry.
   */
  drawSolid(ctx, gx, gy, b, rack, d, ghost, lift) {
    const base = this.iso(gx, gy, this._fac);
    const p = lift ? { x: base.x, y: base.y - lift } : base;
    const hw = TW / 2 - 4;
    const hh = TH / 2 - 2;
    let height = b.h * HSCALE;
    let colour = b.color;
    let body = null;

    if (rack) {
      // A rack is as tall as it is full, so a half-empty row is obvious.
      const fill = rack.cap > 0 ? clamp(rack.used / rack.cap, 0, 1) : 0;
      height = b.h * HSCALE * (0.6 + 0.4 * fill);
      const hot = clamp((rack.temp - 30) / 32, 0, 1);
      // Cabinets are dark steel; the colour lives in the edges and the lights.
      body = hot > 0.05 ? mix('#191b20', '#40181c', hot) : '#191b20';
    }

    // A soft contact shadow stops everything floating.
    if (!ghost && this.zoom > 0.5) {
      ctx.fillStyle = 'rgba(0,0,0,.35)';
      ctx.beginPath();
      ctx.ellipse(base.x, base.y + 3, TW / 2 - 7, TH / 2 - 5, 0, 0, 6.283);
      ctx.fill();
    }

    const top = { x: p.x, y: p.y - height };
    const A = { x: top.x, y: top.y - hh };          // far corner
    const B = { x: top.x + hw, y: top.y };          // right corner
    const C = { x: top.x, y: top.y + hh };          // near corner
    const D = { x: top.x - hw, y: top.y };          // left corner
    const C0 = { x: p.x, y: p.y + hh };
    const B0 = { x: p.x + hw, y: p.y };
    const D0 = { x: p.x - hw, y: p.y };

    // Distance. The far end of a big hall should sit back in the air rather
    // than being as sharp as the row under your nose; without it a two hundred
    // rack floor reads as wallpaper.
    const rot = this.rotate(gx, gy, this._fac);
    const span = this._fac.w + this._fac.h;
    // Kept deliberately light. At the strength that looked best in isolation
    // it muted the red on an overheating rack at the far end of the hall, and
    // atmosphere that hides what the site is telling you is a bad trade.
    const fog = span > 6 ? clamp(1 - (rot.x + rot.y) / (span - 2), 0, 1) ** 1.6 * 0.26 : 0;

    // Hand the lamp to the bloom pass. One per machine rather than one per bay:
    // by the time it has been blurred they are the same picture, and it is the
    // difference between a few hundred blits a frame and a few thousand.
    if (!ghost) {
      if (rack) {
        const live = Math.max(0, rack.used - rack.down);
        if (live > 0) {
          const hot = clamp((rack.temp - 30) / 32, 0, 1);
          const load = clamp(rack.load * rack.throttle, 0, 1);
          const colour = rack.down > 0 ? '255,104,96'
            : hot > 0.55 ? '255,148,132'
            : '116,255,204';
          // Lamps add together, so a dense hall is a hundred of these on top
          // of one another. Tuned bright enough to read one rack in the dark
          // and dim enough that fifty of them do not become one sheet of light
          // with no racks left in it — which is exactly what the first pass at
          // these numbers produced.
          const power = (0.085 + 0.165 * load) * (0.55 + this.night * 0.8) * (1 - fog * 1.2);
          this.lights.push({
            x: top.x, y: top.y + hh * 0.55, r: TW * 0.42, a: power, c: colour,
          });
          // A wider, flatter pool at its feet. Light that never touches the
          // ground reads as a sticker rather than a lamp.
          this.lights.push({
            x: base.x, y: base.y, r: TW * 0.66, a: power * 0.36, c: colour, flat: 0.44,
          });
        }
      } else if (b.supplyKW || b.powerCap) {
        // Switchgear and generators carry a standing amber lamp.
        this.lights.push({
          x: top.x, y: top.y + hh * 0.4, r: TW * 0.46,
          a: 0.085 * (0.5 + this.night) * (1 - fog * 1.2), c: '242,168,60',
        });
      } else if (b.research || b.uptime || b.staff) {
        // Anywhere with people in it has the lights on.
        this.lights.push({
          x: top.x, y: top.y + hh * 0.4, r: TW * 0.42,
          a: 0.10 * (0.4 + this.night * 1.2) * (1 - fog * 1.2), c: '255,214,150',
        });
      }
    }

    // Left face.
    ctx.fillStyle = body ? shade(body, 0.72) : shade(colour, 0.42, '#0d0a07');
    ctx.beginPath();
    ctx.moveTo(D.x, D.y); ctx.lineTo(C.x, C.y); ctx.lineTo(C0.x, C0.y); ctx.lineTo(D0.x, D0.y);
    ctx.closePath(); ctx.fill();

    // Right face.
    ctx.fillStyle = body ? shade(body, 0.48) : shade(colour, 0.27, '#0d0a07');
    ctx.beginPath();
    ctx.moveTo(C.x, C.y); ctx.lineTo(B.x, B.y); ctx.lineTo(B0.x, B0.y); ctx.lineTo(C0.x, C0.y);
    ctx.closePath(); ctx.fill();

    // Top face.
    ctx.fillStyle = body ? shade(body, 1.3) : shade(colour, 0.84, '#1c1610');
    ctx.beginPath();
    ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); ctx.lineTo(C.x, C.y); ctx.lineTo(D.x, D.y);
    ctx.closePath(); ctx.fill();
    if (this.zoom > 0.36) {
      ctx.strokeStyle = body ? shade(b.color, 1.1) : shade(colour, 1.35);
      ctx.lineWidth = body ? 1.4 : 1.1;
      ctx.stroke();
    }

    // Vertical corner edges.
    if (this.zoom > 0.5) {
      ctx.strokeStyle = body ? shade(b.color, 0.8) : shade(colour, 0.9);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(C.x, C.y); ctx.lineTo(C0.x, C0.y);
      ctx.moveTo(B.x, B.y); ctx.lineTo(B0.x, B0.y);
      ctx.moveTo(D.x, D.y); ctx.lineTo(D0.x, D0.y);
      ctx.stroke();
    }

    if (!ghost) {
      this.hits.push({
        gx, gy,
        poly: [A, B, B0, C0, D0, D],
      });
    }

    if (this.zoom < LID) return;

    if (rack) this.rackFace(ctx, rack, C, B, C0, B0, D, D0);
    else if (this.zoom >= DETAIL) this.decal(ctx, top, b, gx, gy);

    if (rack) this.rackWarnings(ctx, rack, top);

    // One translucent pass over the whole silhouette, rather than mixing the
    // colour of every face and every lit strip separately: the same picture
    // for one fill instead of a few thousand string-built colours a frame.
    if (fog > 0.012 && !ghost) {
      ctx.fillStyle = `rgba(12,16,23,${fog})`;
      ctx.beginPath();
      ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); ctx.lineTo(B0.x, B0.y);
      ctx.lineTo(C0.x, C0.y); ctx.lineTo(D0.x, D0.y); ctx.lineTo(D.x, D.y);
      ctx.closePath(); ctx.fill();
    }
  }

  /**
   * Server bays painted on the two faces you can see: a recessed slot with a
   * lit strip along it, so a rack reads as a rack rather than a coloured box.
   */
  rackFace(ctx, r, C, B, C0, B0, D, D0) {
    if (this.zoom < BAYS) return;
    const bays = 5;
    const live = Math.max(0, r.used - r.down);
    const liveFrac = r.cap > 0 ? live / r.cap : 0;
    const downFrac = r.cap > 0 ? r.down / r.cap : 0;
    const hot = clamp((r.temp - 30) / 32, 0, 1);
    const load = r.load * r.throttle;

    for (const [P, Q, P0, Q0] of [[C, B, C0, B0], [D, C, D0, C0]]) {
      for (let i = 0; i < bays; i++) {
        const a = 0.09 + (i / bays) * 0.84;
        const bEdge = a + 0.6 / bays;
        const frac = 1 - i / bays;
        const on = frac <= liveFrac;
        const dead = !on && frac <= liveFrac + downFrac;

        if (!on && !dead) {
          quad(ctx, lerpP(P, P0, a), lerpP(Q, Q0, a), lerpP(Q, Q0, bEdge), lerpP(P, P0, bEdge),
            0.1, 0.9, 'rgba(0,0,0,.38)');
          continue;
        }
        // Lit strip along the bottom of the bay.
        const blink = 0.55 + 0.45 * Math.sin(this.t * 6 + i * 1.7 + r.x * 2.1 + r.y * 1.3);
        // Lights read harder after dark, which is when a rack row looks best.
        const glow = 1 + this.night * 0.5;
        const style = dead ? 'rgba(255,105,100,.95)'
          : hot > 0.55 ? `rgba(255,150,135,${Math.min(1, (0.7 + blink * 0.3) * glow)})`
          : `rgba(120,255,205,${Math.min(1, (0.45 + load * blink * 0.55) * glow)})`;
        const lo = bEdge - 0.22 / bays;
        quad(ctx, lerpP(P, P0, lo), lerpP(Q, Q0, lo), lerpP(Q, Q0, bEdge), lerpP(P, P0, bEdge),
          0.14, 0.86, style);
      }
    }
  }

  rackWarnings(ctx, r, top) {
    if (r.used === 0 || this.zoom < 0.45) return;
    // Two different problems used to be two identically shaped triangles told
    // apart by colour, which is no way to tell them apart: through a
    // deuteranopia filter both come out the same pale yellow. A starved rack
    // gets a triangle, a cooking one gets a diamond, and the shape carries it.
    const marks = [];
    if (r.pduFactor < 0.95) marks.push(['#e8b44a', 'tri']);
    if (r.cover < 0.95 || r.temp > 40) marks.push(['#e8615f', 'dia']);
    if (!marks.length) return;
    const pulse = 0.55 + 0.45 * Math.sin(this.t * 4 + r.x + r.y);
    let y = top.y - 14;
    for (const [colour, shape] of marks) {
      ctx.globalAlpha = pulse;
      ctx.fillStyle = colour;
      ctx.beginPath();
      if (shape === 'dia') {
        ctx.moveTo(top.x, y - 7); ctx.lineTo(top.x + 6, y - 2);
        ctx.lineTo(top.x, y + 3); ctx.lineTo(top.x - 6, y - 2);
      } else {
        ctx.moveTo(top.x, y - 7); ctx.lineTo(top.x + 6, y + 3); ctx.lineTo(top.x - 6, y + 3);
      }
      ctx.closePath(); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#101821';
      ctx.fillRect(top.x - 0.8, y - 3.4, 1.6, 4);
      ctx.fillRect(top.x - 0.8, y + 1.2, 1.6, 1.4);
      y -= 13;
    }
  }

  /** The decal is drawn straight onto the top face, skewed into its plane. */
  decal(ctx, top, b, gx, gy) {
    const fn = DECALS[b.glyph];
    if (!fn) return;
    // A -10..10 decal box maps to a diamond; this keeps it inside the face.
    const s = 1.15;
    ctx.save();
    ctx.transform(s, s * (TH / TW), -s, s * (TH / TW), top.x, top.y);
    ctx.strokeStyle = shade(b.color, 1.75);
    ctx.fillStyle = shade(b.color, 1.75);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    fn(ctx, this.t, (gx * 0.7 + gy * 1.3) % 6.28);
    ctx.restore();
  }
}

// ------------------------------------------------------------------ helpers

/** Fill a quad, trimmed along its width so bays do not touch the corners. */
function quad(ctx, p0, p1, p2, p3, t0, t1, style) {
  const a = lerpP(p0, p1, t0), b = lerpP(p0, p1, t1);
  const c = lerpP(p3, p2, t1), d = lerpP(p3, p2, t0);
  ctx.fillStyle = style;
  ctx.beginPath();
  ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.lineTo(d.x, d.y);
  ctx.closePath();
  ctx.fill();
}

function lerpP(a, b, t) {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

function mix(a, b, t) {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  const c = (x, y) => Math.round(x + (y - x) * t).toString(16).padStart(2, '0');
  return '#' + c(r1, r2) + c(g1, g2) + c(b1, b2);
}

/**
 * One soft dot of light, drawn once and reused for every lamp on the floor.
 *
 * Making a radial gradient per light was the obvious way to do this and the
 * wrong one: a site with six hundred racks would build six hundred gradient
 * objects a frame. A sprite is a single drawImage each.
 */
const lightSprites = new Map();

export function lightSprite(rgb) {
  const hit = lightSprites.get(rgb);
  if (hit) return hit;
  const size = 64;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, `rgba(${rgb},0.95)`);
  grad.addColorStop(0.35, `rgba(${rgb},0.34)`);
  grad.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  lightSprites.set(rgb, c);
  return c;
}

function pointInPoly(px, py, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, yi = poly[i].y, xj = poly[j].x, yj = poly[j].y;
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function inRoom(f, p) {
  return p.x >= 0 && p.y >= 0 && p.x < f.w && p.y < f.h;
}

// --------------------------------------------------------------- list icons

const iconCache = new Map();

/**
 * The same glyph a machine wears on the floor, rendered flat for the build
 * list. Cached as a data URL so the panel can use it as a background image.
 */
export function iconFor(b, size = 30) {
  const key = b.id + ':' + size;
  const hit = iconCache.get(key);
  if (hit) return hit;
  const dpr = 2;
  const c = document.createElement('canvas');
  c.width = size * dpr; c.height = size * dpr;
  const g = c.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const fn = DECALS[b.glyph] || DECALS.switch;
  g.translate(size / 2, size / 2);
  const s = (size / 2 - 3) / 10;
  g.scale(s, s);
  g.strokeStyle = b.color;
  g.fillStyle = b.color;
  g.lineJoin = 'round';
  g.lineCap = 'round';
  fn(g, 0.4, 0);
  const url = c.toDataURL();
  iconCache.set(key, url);
  return url;
}
