// Isometric view of the floor.
//
// Tiles are diamonds; machines are extruded prisms standing on them, sorted
// back to front. Identity comes from silhouette, height and colour, with a
// decal painted flat on the top face — not from a caption on every box.
// Hovering names the thing; the floor stays quiet.

import { clamp } from './util.js';
import { BUILDINGS_BY_ID } from './data/buildings.js';
import { facilityOf, tileAt } from './state.js';

export const TW = 68;            // tile width on screen
export const TH = 34;            // tile height on screen (2:1 isometric)
export const TILE = TW;          // kept for callers that just want a scale

const DETAIL = 0.5;              // below this zoom, decals are skipped
const BAYS = 0.78;               // and below this, racks lose their server bays
const LID = 0.34;                // and below this, machines are plain blocks
const HSCALE = 1.35;             // volumes read better a little taller than life

// ------------------------------------------------------------ colour tools

function hexToRgb(h) {
  const v = h.replace('#', '');
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
}

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
    this.ox = 0;
    this.oy = 0;
    this.w = 0;
    this.h = 0;
    this.hover = null;
    this.sel = null;
    this.tool = null;
    this.overlay = 'none';
    this.t = 0;
    this.dragging = false;
    this.panned = false;
    this.centred = false;
    this.hits = [];
    this._bind();
  }

  resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const r = this.c.getBoundingClientRect();
    this.w = r.width; this.h = r.height;
    this.c.width = Math.max(1, Math.round(r.width * dpr));
    this.c.height = Math.max(1, Math.round(r.height * dpr));
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /** World position of a tile's ground centre, before pan and zoom. */
  iso(gx, gy) {
    return { x: (gx - gy) * (TW / 2), y: (gx + gy) * (TH / 2) };
  }

  centre(state) {
    const f = facilityOf(state);
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
  tileCentre(gx, gy) {
    const r = this.c.getBoundingClientRect();
    const p = this.iso(gx, gy);
    return { x: r.left + this.ox + p.x * this.zoom, y: r.top + this.oy + p.y * this.zoom };
  }

  /**
   * Pointer picking walks the draw list backwards so the machine in front wins,
   * then falls back to the ground plane for empty tiles.
   */
  pick(px, py) {
    // Hit polygons are recorded in world space during the draw, so convert the
    // pointer once and walk the list backwards: whatever is in front wins.
    const wx = (px - this.ox) / this.zoom;
    const wy = (py - this.oy) / this.zoom;
    for (let i = this.hits.length - 1; i >= 0; i--) {
      const hit = this.hits[i];
      if (pointInPoly(wx, wy, hit.poly)) return { x: hit.gx, y: hit.gy };
    }
    const a = wx / (TW / 2);
    const b = wy / (TH / 2);
    return { x: Math.round((a + b) / 2), y: Math.round((b - a) / 2) };
  }

  _bind() {
    const c = this.c;
    let last = null;
    const pos = (e) => {
      const r = c.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };

    c.addEventListener('pointerdown', (e) => {
      c.setPointerCapture(e.pointerId);
      last = pos(e);
      this.dragging = true;
      this.panned = false;
      this.button = e.button;
    });

    c.addEventListener('pointermove', (e) => {
      const p = pos(e);
      this.hover = this.pick(p.x, p.y);
      if (this.dragging && last) {
        const dx = p.x - last.x, dy = p.y - last.y;
        if (Math.abs(dx) + Math.abs(dy) > 3) this.panned = true;
        if (this.button === 1 || this.button === 2 || !this.tool) {
          this.ox += dx; this.oy += dy;
        } else if (this.tool && this.panned) {
          this.cb.onPaint?.(this.hover.x, this.hover.y);
        }
        last = p;
      }
      this.cb.onHover?.(this.hover);
    });

    const end = (e) => {
      if (this.dragging && !this.panned) {
        const p = pos(e);
        const t = this.pick(p.x, p.y);
        this.cb.onClick?.(t.x, t.y, e.shiftKey);
      }
      this.dragging = false;
      last = null;
    };
    c.addEventListener('pointerup', end);
    c.addEventListener('pointercancel', () => { this.dragging = false; last = null; });
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
    this.t += dt;
    const ctx = this.ctx;
    const f = facilityOf(state);
    if (!this.centred && this.w) this.centre(state);
    ctx.clearRect(0, 0, this.w, this.h);
    ctx.save();
    ctx.translate(this.ox, this.oy);
    ctx.scale(this.zoom, this.zoom);

    this.drawGround(ctx, state, d, f);
    if (this.overlay !== 'none') this.drawOverlay(ctx, state, d, f);

    const focus = this.tool && this.tool !== 'sell' ? this.hover : this.sel;
    if (focus) this.drawRange(ctx, state, focus, d);

    // Ground markers sit under the volumes so a tall rack never hides them.
    if (this.sel) this.markTile(ctx, this.sel, '#eaf2fa', true);
    if (this.hover && inRoom(f, this.hover)) {
      const taken = !!tileAt(state, this.hover.x, this.hover.y);
      const bad = this.tool === 'sell' ? !taken : this.tool ? taken : false;
      this.markTile(ctx, this.hover, bad ? '#e8615f' : this.tool === 'sell' ? '#e8615f' : '#4fdca8');
    }

    // Everything on the floor, back to front.
    const order = [];
    for (const k in state.tiles) {
      const [gx, gy] = k.split(',').map(Number);
      order.push({ gx, gy, tile: state.tiles[k] });
    }
    order.sort((a, b) => (a.gx + a.gy) - (b.gx + b.gy) || a.gx - b.gx);

    const rackAt = new Map();
    for (const r of d.racks) rackAt.set(r.x + ',' + r.y, r);

    this.hits.length = 0;
    for (const item of order) {
      const b = BUILDINGS_BY_ID[item.tile.b];
      if (!b) continue;
      const rack = rackAt.get(item.gx + ',' + item.gy);
      this.drawSolid(ctx, item.gx, item.gy, b, rack, d);
    }

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
  }

  /** Bounds of the whole room in world space, including the plinth. */
  groundBounds(f) {
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
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const key = f.id + ':' + this.zoom.toFixed(3) + ':' + dpr;
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
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      const dp = Math.min(2, window.devicePixelRatio || 1);
      ctx.scale(dp, dp);
      ctx.drawImage(this._ground,
        this.ox + b.minX * this.zoom, this.oy + b.minY * this.zoom,
        (b.maxX - b.minX) * this.zoom, (b.maxY - b.minY) * this.zoom);
      ctx.restore();
    }
  }

  paintGround(ctx, f) {
    // A plinth under the room reads as a building rather than a spreadsheet.
    const c0 = this.iso(-0.5, -0.5), c1 = this.iso(f.w - 0.5, -0.5);
    const c2 = this.iso(f.w - 0.5, f.h - 0.5), c3 = this.iso(-0.5, f.h - 0.5);
    const drop = 13;
    ctx.fillStyle = '#0a1017';
    ctx.beginPath();
    ctx.moveTo(c3.x, c3.y); ctx.lineTo(c2.x, c2.y); ctx.lineTo(c2.x, c2.y + drop);
    ctx.lineTo(c3.x, c3.y + drop); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#0c141d';
    ctx.beginPath();
    ctx.moveTo(c2.x, c2.y); ctx.lineTo(c1.x, c1.y); ctx.lineTo(c1.x, c1.y + drop);
    ctx.lineTo(c2.x, c2.y + drop); ctx.closePath(); ctx.fill();

    ctx.strokeStyle = '#212e3d';
    ctx.lineWidth = 1;
    for (let gy = 0; gy < f.h; gy++) {
      for (let gx = 0; gx < f.w; gx++) {
        const p = this.iso(gx, gy);
        this.diamond(ctx, p);
        ctx.fillStyle = (gx + gy) % 2 ? '#16212e' : '#121c27';
        ctx.fill();
        ctx.stroke();
      }
    }
  }

  markTile(ctx, t, colour, dashed) {
    const p = this.iso(t.x, t.y);
    ctx.strokeStyle = colour;
    ctx.lineWidth = 2;
    if (dashed) ctx.setLineDash([5, 4]);
    this.diamond(ctx, p, 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  drawOverlay(ctx, state, d, f) {
    const paint = (gx, gy, style) => {
      this.diamond(ctx, this.iso(gx, gy));
      ctx.fillStyle = style;
      ctx.fill();
    };
    if (this.overlay === 'heat') {
      for (const r of d.racks) {
        const t = clamp((r.temp - 20) / 50, 0, 1);
        paint(r.x, r.y, `hsla(${(1 - t) * 200}, 85%, 50%, ${0.2 + t * 0.5})`);
      }
      return;
    }
    if (this.overlay === 'net') {
      const ok = d.netFactor > 0.99;
      for (const r of d.racks) paint(r.x, r.y, ok ? 'rgba(143,111,216,.3)' : 'rgba(232,97,95,.34)');
      return;
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
      paint(x, y, this.overlay === 'power'
        ? `rgba(216,161,58,${Math.min(0.4, 0.14 + n * 0.07)})`
        : `rgba(79,220,168,${Math.min(0.4, 0.14 + n * 0.07)})`);
    }
    for (const r of d.racks) {
      if (!cover.get(r.x + ',' + r.y) && r.used > 0) paint(r.x, r.y, 'rgba(232,97,95,.36)');
    }
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
        this.diamond(ctx, this.iso(gx, gy), 1);
        ctx.fill();
      }
    }
  }

  /**
   * One machine: a prism with a lit top, a shaded left face and a darker right
   * face, plus whatever detail the zoom level can carry.
   */
  drawSolid(ctx, gx, gy, b, rack, d, ghost) {
    const p = this.iso(gx, gy);
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
      body = hot > 0.05 ? mix('#141c26', '#40181c', hot) : '#141c26';
    }

    // A soft contact shadow stops everything floating.
    if (!ghost && this.zoom > 0.5) {
      ctx.fillStyle = 'rgba(0,0,0,.35)';
      ctx.beginPath();
      ctx.ellipse(p.x, p.y + 3, TW / 2 - 7, TH / 2 - 5, 0, 0, 6.283);
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

    // Left face.
    ctx.fillStyle = body ? shade(body, 0.72) : shade(colour, 0.40, '#0a1017');
    ctx.beginPath();
    ctx.moveTo(D.x, D.y); ctx.lineTo(C.x, C.y); ctx.lineTo(C0.x, C0.y); ctx.lineTo(D0.x, D0.y);
    ctx.closePath(); ctx.fill();

    // Right face.
    ctx.fillStyle = body ? shade(body, 0.48) : shade(colour, 0.26, '#0a1017');
    ctx.beginPath();
    ctx.moveTo(C.x, C.y); ctx.lineTo(B.x, B.y); ctx.lineTo(B0.x, B0.y); ctx.lineTo(C0.x, C0.y);
    ctx.closePath(); ctx.fill();

    // Top face.
    ctx.fillStyle = body ? shade(body, 1.25) : shade(colour, 0.80, '#16202c');
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
        const style = dead ? 'rgba(255,105,100,.95)'
          : hot > 0.55 ? `rgba(255,150,135,${0.7 + blink * 0.3})`
          : `rgba(120,255,205,${0.45 + load * blink * 0.55})`;
        const lo = bEdge - 0.22 / bays;
        quad(ctx, lerpP(P, P0, lo), lerpP(Q, Q0, lo), lerpP(Q, Q0, bEdge), lerpP(P, P0, bEdge),
          0.14, 0.86, style);
      }
    }
  }

  rackWarnings(ctx, r, top) {
    if (r.used === 0 || this.zoom < 0.45) return;
    const marks = [];
    if (r.pduFactor < 0.95) marks.push('#e8b44a');
    if (r.cover < 0.95 || r.temp > 40) marks.push('#e8615f');
    if (!marks.length) return;
    const pulse = 0.55 + 0.45 * Math.sin(this.t * 4 + r.x + r.y);
    let y = top.y - 14;
    for (const colour of marks) {
      ctx.globalAlpha = pulse;
      ctx.fillStyle = colour;
      ctx.beginPath();
      ctx.moveTo(top.x, y - 7); ctx.lineTo(top.x + 6, y + 3); ctx.lineTo(top.x - 6, y + 3);
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
