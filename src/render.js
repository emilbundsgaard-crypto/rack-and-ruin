// Canvas view of the floor.
//
// Every machine is drawn as a tile: a rounded plate, a glyph that says what it
// is at a glance, and a caption strip inset along the bottom edge so text never
// sits on the border. Racks get a slot grid instead of a glyph, because how
// full and how healthy a rack is matters more than the fact it is a rack.

import { clamp } from './util.js';
import { BUILDINGS_BY_ID } from './data/buildings.js';
import { facilityOf, tileAt } from './state.js';

export const TILE = 54;

const PAD = 5;              // plate inset inside the tile
const CAP_H = 11;           // caption strip height
const CAP_ZOOM = 0.72;      // below this, captions are unreadable, so skip them
const DETAIL_ZOOM = 0.72;   // and below it, tiles drop to their cheap form
const GLYPH_ZOOM = 0.34;

// --------------------------------------------------------------- glyph set

/**
 * Each glyph draws inside a -11..11 box, already translated and coloured.
 * `t` is the animation clock; `k` is a per-tile phase so a row of fans does
 * not spin in lockstep.
 */
const GLYPHS = {
  plug(c, t, k) {
    c.lineWidth = 1.8;
    c.beginPath(); c.moveTo(-5, -9); c.lineTo(-5, -3); c.moveTo(5, -9); c.lineTo(5, -3); c.stroke();
    c.beginPath();
    c.moveTo(-8, -3); c.lineTo(8, -3); c.lineTo(8, 1); c.arc(0, 1, 8, 0, Math.PI); c.closePath();
    c.stroke();
    c.beginPath(); c.moveTo(0, 9); c.lineTo(0, 5); c.stroke();
  },
  busbar(c) {
    c.lineWidth = 2.4;
    for (const x of [-6, 0, 6]) { c.beginPath(); c.moveTo(x, -9); c.lineTo(x, 9); c.stroke(); }
    c.lineWidth = 1.2;
    c.beginPath(); c.moveTo(-9, -4); c.lineTo(9, -4); c.moveTo(-9, 4); c.lineTo(9, 4); c.stroke();
  },
  transformer(c) {
    c.lineWidth = 1.6;
    c.beginPath(); c.arc(-3.5, 0, 5.5, 0, Math.PI * 2); c.stroke();
    c.beginPath(); c.arc(3.5, 0, 5.5, 0, Math.PI * 2); c.stroke();
    c.lineWidth = 2;
    c.beginPath(); c.moveTo(-1, -9); c.lineTo(-4, -1); c.lineTo(1, -1); c.lineTo(-1, 8); c.stroke();
  },
  battery(c, t) {
    c.lineWidth = 1.6;
    c.strokeRect(-8, -6, 14, 12);
    c.beginPath(); c.moveTo(6, -2.5); c.lineTo(9, -2.5); c.lineTo(9, 2.5); c.lineTo(6, 2.5); c.stroke();
    const n = 2 + Math.floor((Math.sin(t * 1.5) * 0.5 + 0.5) * 2);
    for (let i = 0; i < n; i++) c.fillRect(-6.5 + i * 4, -4, 3, 8);
  },
  engine(c, t, k) {
    c.lineWidth = 1.6;
    c.strokeRect(-9, -3, 18, 9);
    const bob = Math.sin(t * 9 + k) * 1.6;
    c.beginPath(); c.moveTo(-4, -3); c.lineTo(-4, -8 + bob); c.moveTo(4, -3); c.lineTo(4, -6 - bob); c.stroke();
    c.beginPath(); c.arc(-4, -9 + bob, 1.8, 0, Math.PI * 2); c.stroke();
    c.beginPath(); c.arc(4, -7 - bob, 1.8, 0, Math.PI * 2); c.stroke();
  },
  sun(c, t) {
    c.lineWidth = 1.6;
    c.beginPath(); c.arc(0, 0, 4.5, 0, Math.PI * 2); c.stroke();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + t * 0.25;
      c.beginPath();
      c.moveTo(Math.cos(a) * 6.6, Math.sin(a) * 6.6);
      c.lineTo(Math.cos(a) * 9.6, Math.sin(a) * 9.6);
      c.stroke();
    }
  },
  turbine(c, t, k) {
    c.lineWidth = 1.7;
    c.beginPath(); c.moveTo(0, 2); c.lineTo(0, 10); c.stroke();
    c.save();
    c.rotate(t * 2.2 + k);
    for (let i = 0; i < 3; i++) {
      c.rotate((Math.PI * 2) / 3);
      c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(3, -5, 1, -9.5); c.stroke();
    }
    c.restore();
  },
  flame(c, t, k) {
    c.lineWidth = 1.7;
    const w = 1 + Math.sin(t * 6 + k) * 0.12;
    c.beginPath();
    c.moveTo(0, 9);
    c.bezierCurveTo(-7 * w, 4, -4 * w, -2, 0, -9);
    c.bezierCurveTo(4 * w, -2, 7 * w, 4, 0, 9);
    c.stroke();
  },
  atom(c, t) {
    c.lineWidth = 1.4;
    for (let i = 0; i < 3; i++) {
      c.save();
      c.rotate((i / 3) * Math.PI);
      c.beginPath(); c.ellipse(0, 0, 9.5, 3.6, 0, 0, Math.PI * 2); c.stroke();
      c.restore();
    }
    c.beginPath(); c.arc(0, 0, 2, 0, Math.PI * 2); c.fill();
  },
  star(c, t) {
    c.lineWidth = 1.4;
    const p = 0.85 + Math.sin(t * 3) * 0.15;
    c.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      const r = (i % 2 ? 4 : 10) * p;
      i ? c.lineTo(Math.cos(a) * r, Math.sin(a) * r) : c.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    c.closePath(); c.stroke();
  },
  fan(c, t, k) {
    c.lineWidth = 1.9;
    c.save();
    c.rotate(t * 4 + k);
    for (let i = 0; i < 3; i++) {
      c.rotate((Math.PI * 2) / 3);
      c.beginPath(); c.arc(0, 0, 8, -0.35, 0.9); c.stroke();
    }
    c.restore();
    c.beginPath(); c.arc(0, 0, 2.2, 0, Math.PI * 2); c.fill();
  },
  coil(c, t, k) {
    c.lineWidth = 1.7;
    c.beginPath();
    for (let i = 0; i <= 40; i++) {
      const x = -9 + (i / 40) * 18;
      const y = Math.sin(i / 40 * Math.PI * 4 + t * 2 + k) * 5;
      i ? c.lineTo(x, y) : c.moveTo(x, y);
    }
    c.stroke();
  },
  louvre(c, t, k) {
    c.lineWidth = 1.8;
    for (let i = 0; i < 4; i++) {
      const y = -7 + i * 4.6;
      const tilt = Math.sin(t * 1.4 + k + i * 0.4) * 1.6;
      c.beginPath(); c.moveTo(-9, y - tilt); c.lineTo(9, y + tilt); c.stroke();
    }
  },
  cooltower(c, t, k) {
    c.lineWidth = 1.7;
    c.beginPath();
    c.moveTo(-7, 9); c.quadraticCurveTo(-2.5, 0, -5, -7);
    c.lineTo(5, -7); c.quadraticCurveTo(2.5, 0, 7, 9);
    c.closePath(); c.stroke();
    c.globalAlpha = 0.55 + Math.sin(t * 2 + k) * 0.25;
    c.beginPath();
    c.arc(-2, -10, 2.4, 0, Math.PI * 2);
    c.arc(2.5, -11.5, 1.8, 0, Math.PI * 2);
    c.stroke();
    c.globalAlpha = 1;
  },
  snow(c, t) {
    c.lineWidth = 1.5;
    for (let i = 0; i < 3; i++) {
      c.save();
      c.rotate((i / 3) * Math.PI + t * 0.2);
      c.beginPath(); c.moveTo(0, -9.5); c.lineTo(0, 9.5); c.stroke();
      c.beginPath(); c.moveTo(-2.6, -6); c.lineTo(0, -8.6); c.lineTo(2.6, -6); c.stroke();
      c.beginPath(); c.moveTo(-2.6, 6); c.lineTo(0, 8.6); c.lineTo(2.6, 6); c.stroke();
      c.restore();
    }
  },
  tank(c, t, k) {
    c.lineWidth = 1.7;
    c.strokeRect(-9, -7, 18, 14);
    const lvl = 1.5 + Math.sin(t * 1.6 + k) * 0.8;
    c.beginPath();
    for (let i = 0; i <= 18; i++) {
      const x = -8 + i;
      const y = lvl + Math.sin(i / 2 + t * 2.4 + k) * 0.9;
      i ? c.lineTo(x, y) : c.moveTo(x, y);
    }
    c.stroke();
    c.globalAlpha = 0.35;
    c.fillRect(-8, lvl + 1, 16, 5.5 - lvl);
    c.globalAlpha = 1;
  },
  cryo(c, t) {
    c.lineWidth = 1.6;
    c.strokeRect(-8.5, -8.5, 17, 17);
    GLYPHS.snow(c, t * 0.5, 0);
  },
  barrel(c, t, k) {
    c.lineWidth = 1.7;
    c.beginPath(); c.ellipse(0, -6.5, 7, 2.6, 0, 0, Math.PI * 2); c.stroke();
    c.beginPath(); c.moveTo(-7, -6.5); c.lineTo(-7, 6); c.moveTo(7, -6.5); c.lineTo(7, 6); c.stroke();
    c.beginPath(); c.ellipse(0, 6, 7, 2.6, 0, 0, Math.PI); c.stroke();
  },
  tap(c, t, k) {
    c.lineWidth = 1.7;
    c.beginPath(); c.moveTo(-8, -6); c.lineTo(2, -6); c.lineTo(2, 0); c.stroke();
    c.beginPath(); c.moveTo(-8, -9); c.lineTo(-8, -3); c.stroke();
    const drop = ((t * 22 + (k || 0) * 10) % 11);
    c.beginPath(); c.arc(2, 1 + drop * 0.7, 1.5, 0, Math.PI * 2); c.fill();
  },
  well(c, t, k) {
    c.lineWidth = 1.7;
    c.strokeRect(-8, 0, 16, 9);
    c.beginPath(); c.moveTo(-9, 0); c.lineTo(0, -6); c.lineTo(9, 0); c.stroke();
    c.beginPath(); c.moveTo(0, -6); c.lineTo(0, 4 + Math.sin(t * 1.8 + k) * 1.5); c.stroke();
  },
  recycle(c, t) {
    c.lineWidth = 1.8;
    c.save(); c.rotate(t * 0.8);
    for (let i = 0; i < 3; i++) {
      c.rotate((Math.PI * 2) / 3);
      c.beginPath(); c.arc(0, 0, 8, -0.5, 1.1); c.stroke();
      c.beginPath();
      c.moveTo(Math.cos(1.1) * 8, Math.sin(1.1) * 8);
      c.lineTo(Math.cos(1.1) * 8 - 3.4, Math.sin(1.1) * 8 - 0.4);
      c.lineTo(Math.cos(1.1) * 8 - 0.6, Math.sin(1.1) * 8 + 3.2);
      c.closePath(); c.fill();
    }
    c.restore();
  },
  wave(c, t, k) {
    c.lineWidth = 1.7;
    for (let r = 0; r < 3; r++) {
      c.beginPath();
      for (let i = 0; i <= 20; i++) {
        const x = -9 + i * 0.9;
        const y = -5 + r * 5 + Math.sin(i / 2.4 + t * 2.6 + k + r) * 1.8;
        i ? c.lineTo(x, y) : c.moveTo(x, y);
      }
      c.stroke();
    }
  },
  switch(c, t, k) {
    c.lineWidth = 1.6;
    c.strokeRect(-9.5, -4, 19, 8);
    const on = Math.floor(t * 6 + k) % 4;
    for (let i = 0; i < 4; i++) {
      c.globalAlpha = i === on ? 1 : 0.32;
      c.fillRect(-7.5 + i * 4, -1.4, 2.6, 2.8);
    }
    c.globalAlpha = 1;
    c.beginPath(); c.moveTo(-6, -4); c.lineTo(-6, -8); c.moveTo(6, -4); c.lineTo(6, -8); c.stroke();
  },
  fibre(c, t, k) {
    c.lineWidth = 1.6;
    for (let i = -1; i <= 1; i++) {
      c.beginPath();
      c.moveTo(-10, i * 5.5);
      c.bezierCurveTo(-2, i * 5.5, 2, i * 1.5, 10, i * 1.5);
      c.stroke();
    }
    const p = ((t * 26 + (k || 0) * 8) % 20) - 10;
    c.globalAlpha = 0.9;
    c.beginPath(); c.arc(p, 0, 1.8, 0, Math.PI * 2); c.fill();
    c.globalAlpha = 1;
  },
  globe(c, t) {
    c.lineWidth = 1.5;
    c.beginPath(); c.arc(0, 0, 9, 0, Math.PI * 2); c.stroke();
    c.beginPath(); c.ellipse(0, 0, 4, 9, 0, 0, Math.PI * 2); c.stroke();
    c.beginPath(); c.moveTo(-9, -3); c.lineTo(9, -3); c.moveTo(-9, 3); c.lineTo(9, 3); c.stroke();
  },
  desk(c) {
    c.lineWidth = 1.7;
    c.beginPath(); c.moveTo(-10, -2); c.lineTo(10, -2); c.stroke();
    c.beginPath(); c.moveTo(-7, -2); c.lineTo(-7, 8); c.moveTo(7, -2); c.lineTo(7, 8); c.stroke();
    c.beginPath(); c.arc(-1, -7, 3, 0, Math.PI * 2); c.stroke();
  },
  wrench(c) {
    c.lineWidth = 1.9;
    c.beginPath();
    c.arc(-4.5, -4.5, 5, 0.6, 5.2);
    c.stroke();
    c.beginPath(); c.moveTo(-1.5, -1.5); c.lineTo(7.5, 7.5); c.stroke();
    c.beginPath(); c.arc(8, 8, 2.2, 0, Math.PI * 2); c.fill();
  },
  screen(c, t, k) {
    c.lineWidth = 1.6;
    c.strokeRect(-9.5, -7.5, 19, 12);
    c.beginPath(); c.moveTo(0, 4.5); c.lineTo(0, 8); c.moveTo(-5, 8); c.lineTo(5, 8); c.stroke();
    c.lineWidth = 1.2;
    c.beginPath();
    for (let i = 0; i <= 14; i++) {
      const x = -7.5 + i;
      const y = Math.sin(i * 1.1 + t * 4 + k) * 2.4;
      i ? c.lineTo(x, y) : c.moveTo(x, y);
    }
    c.stroke();
  },
  shield(c) {
    c.lineWidth = 1.7;
    c.beginPath();
    c.moveTo(0, -9.5); c.lineTo(8, -6); c.lineTo(8, 1); c.quadraticCurveTo(8, 7, 0, 9.5);
    c.quadraticCurveTo(-8, 7, -8, 1); c.lineTo(-8, -6); c.closePath();
    c.stroke();
    c.beginPath(); c.moveTo(-3.4, -0.5); c.lineTo(-0.8, 2.6); c.lineTo(4, -3.4); c.stroke();
  },
  flask(c, t, k) {
    c.lineWidth = 1.7;
    c.beginPath();
    c.moveTo(-3, -9); c.lineTo(-3, -2); c.lineTo(-8, 7); c.quadraticCurveTo(-9, 9.5, -6, 9.5);
    c.lineTo(6, 9.5); c.quadraticCurveTo(9, 9.5, 8, 7); c.lineTo(3, -2); c.lineTo(3, -9);
    c.closePath(); c.stroke();
    c.beginPath(); c.moveTo(-5, -9); c.lineTo(5, -9); c.stroke();
    c.globalAlpha = 0.45;
    c.beginPath(); c.arc(-2, 5 - (t * 8 + k * 3) % 9, 1.3, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(2.5, 6 - (t * 6 + k * 5) % 10, 1, 0, Math.PI * 2); c.fill();
    c.globalAlpha = 1;
  },
  tag(c) {
    c.lineWidth = 1.7;
    c.beginPath();
    c.moveTo(-9, -2); c.lineTo(-1, -9.5); c.lineTo(9.5, -9.5); c.lineTo(9.5, 1);
    c.lineTo(2, 9); c.closePath();
    c.stroke();
    c.beginPath(); c.arc(5.5, -5.5, 1.9, 0, Math.PI * 2); c.stroke();
  },
  rack(c) {
    c.lineWidth = 1.6;
    c.strokeRect(-8, -9, 16, 18);
    for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(-8, -5 + i * 4); c.lineTo(8, -5 + i * 4); c.stroke(); }
  },
};

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
    this.tool = null;         // building id being placed, or 'sell'
    this.overlay = 'none';    // none | power | cool | heat | net
    this.t = 0;
    this.dragging = false;
    this.panned = false;
    this.centred = false;
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

  centre(state) {
    const f = facilityOf(state);
    this.zoom = clamp(Math.min(this.w / (f.w * TILE + 70), this.h / (f.h * TILE + 70)), 0.3, 1.5);
    this.ox = (this.w - f.w * TILE * this.zoom) / 2;
    this.oy = (this.h - f.h * TILE * this.zoom) / 2;
    this.centred = true;
  }

  toTile(px, py) {
    return {
      x: Math.floor((px - this.ox) / (TILE * this.zoom)),
      y: Math.floor((py - this.oy) / (TILE * this.zoom)),
    };
  }

  toTileF(px, py) {
    return { x: (px - this.ox) / (TILE * this.zoom), y: (py - this.oy) / (TILE * this.zoom) };
  }

  /** Screen coordinates of a tile centre — used by the automated checks. */
  tileCentre(gx, gy) {
    const r = this.c.getBoundingClientRect();
    const s = TILE * this.zoom;
    return { x: r.left + this.ox + gx * s + s / 2, y: r.top + this.oy + gy * s + s / 2 };
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
      this.hover = this.toTile(p.x, p.y);
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
        const t = this.toTile(p.x, p.y);
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
      const before = this.toTileF(p.x, p.y);
      this.zoom = clamp(this.zoom * (e.deltaY < 0 ? 1.12 : 1 / 1.12), 0.24, 2.2);
      const after = this.toTileF(p.x, p.y);
      this.ox += (after.x - before.x) * TILE * this.zoom;
      this.oy += (after.y - before.y) * TILE * this.zoom;
    }, { passive: false });
  }

  // ---------------------------------------------------------------- drawing

  draw(state, d, dt) {
    this.t += dt;
    const ctx = this.ctx;
    const f = facilityOf(state);
    if (!this.centred && this.w) this.centre(state);
    ctx.clearRect(0, 0, this.w, this.h);
    ctx.save();
    ctx.translate(this.ox, this.oy);
    ctx.scale(this.zoom, this.zoom);

    const W = f.w * TILE, H = f.h * TILE;

    // Room shell.
    ctx.fillStyle = '#0d141d';
    roundRect(ctx, -10, -10, W + 20, H + 20, 10);
    ctx.fill();
    ctx.strokeStyle = '#2b3d52';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Bare floor: a dot grid reads calmer than a full lattice. Squares rather
    // than arcs — six hundred paths a frame is not worth the rounded corner.
    if (this.zoom > 0.34) {
      ctx.fillStyle = '#1b2634';
      const dot = this.zoom > DETAIL_ZOOM ? 3 : 4;
      for (let y = 0; y <= f.h; y++) {
        for (let x = 0; x <= f.w; x++) {
          ctx.fillRect(x * TILE - dot / 2, y * TILE - dot / 2, dot, dot);
        }
      }
    }

    if (this.overlay !== 'none') this.drawOverlay(state, d, f);

    // Where the machine under the cursor, or the one being placed, reaches.
    const focus = this.tool && this.tool !== 'sell' ? this.hover : this.sel;
    if (focus) this.drawRange(state, focus, d);

    for (const r of d.racks) this.drawRack(ctx, r);
    for (const { x, y, tile } of tilesOf(state)) {
      const b = BUILDINGS_BY_ID[tile.b];
      if (!b || b.cat === 'compute') continue;
      this.drawMachine(ctx, x, y, b, d);
    }
    for (const r of d.racks) this.drawWarnings(ctx, r);

    // Hover and selection.
    if (this.hover && inRoom(f, this.hover)) {
      const taken = !!tileAt(state, this.hover.x, this.hover.y);
      const bad = this.tool === 'sell' ? !taken : this.tool ? taken : false;
      ctx.strokeStyle = bad ? '#e8615f' : this.tool === 'sell' ? '#e8615f' : '#4fdca8';
      ctx.lineWidth = 2;
      roundRect(ctx, this.hover.x * TILE + 2, this.hover.y * TILE + 2, TILE - 4, TILE - 4, 7);
      ctx.stroke();
    }
    if (this.sel) {
      ctx.strokeStyle = '#eaf2fa';
      ctx.setLineDash([5, 3]);
      ctx.lineWidth = 1.8;
      roundRect(ctx, this.sel.x * TILE + 2, this.sel.y * TILE + 2, TILE - 4, TILE - 4, 7);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.restore();
  }

  drawOverlay(state, d, f) {
    const ctx = this.ctx;
    if (this.overlay === 'heat') {
      for (const r of d.racks) {
        const t = clamp((r.temp - 20) / 50, 0, 1);
        ctx.fillStyle = `hsla(${(1 - t) * 200}, 85%, 50%, ${0.14 + t * 0.5})`;
        ctx.fillRect(r.x * TILE, r.y * TILE, TILE, TILE);
      }
      return;
    }
    if (this.overlay === 'net') {
      const ok = d.netFactor > 0.99;
      for (const r of d.racks) {
        ctx.fillStyle = ok ? 'rgba(143,111,216,.20)' : 'rgba(232,97,95,.26)';
        ctx.fillRect(r.x * TILE, r.y * TILE, TILE, TILE);
      }
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
      ctx.fillStyle = this.overlay === 'power'
        ? `rgba(216,161,58,${Math.min(0.32, 0.11 + n * 0.06)})`
        : `rgba(79,220,168,${Math.min(0.32, 0.11 + n * 0.06)})`;
      ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
    }
    for (const r of d.racks) {
      if (!cover.get(r.x + ',' + r.y) && r.used > 0) {
        ctx.fillStyle = 'rgba(232,97,95,.28)';
        ctx.fillRect(r.x * TILE, r.y * TILE, TILE, TILE);
      }
    }
  }

  /** Dashed reach of a machine, with the racks it would serve picked out. */
  drawRange(state, tilePos, d) {
    const t = tileAt(state, tilePos.x, tilePos.y);
    const b = t ? BUILDINGS_BY_ID[t.b] : BUILDINGS_BY_ID[this.tool];
    if (!b || !b.radius) return;
    const ctx = this.ctx;
    const colour = b.cat === 'cooling' ? '#4fdca8' : '#d8a13a';
    const r = b.radius;
    ctx.strokeStyle = colour + '99';
    ctx.setLineDash([6, 4]);
    ctx.lineWidth = 1.6;
    roundRect(ctx, (tilePos.x - r) * TILE + 2, (tilePos.y - r) * TILE + 2,
      (r * 2 + 1) * TILE - 4, (r * 2 + 1) * TILE - 4, 8);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = colour + '1f';
    for (const rack of d.racks) {
      if (Math.max(Math.abs(rack.x - tilePos.x), Math.abs(rack.y - tilePos.y)) <= r) {
        ctx.fillRect(rack.x * TILE, rack.y * TILE, TILE, TILE);
      }
    }
  }

  /** Plate, border and caption strip shared by every machine and rack. */
  plate(ctx, x, y, colour, temper) {
    const px = x * TILE + PAD, py = y * TILE + PAD;
    const w = TILE - PAD * 2, h = TILE - PAD * 2;
    // A flat plate with one lighter band reads like a gradient and costs a
    // fraction of building 600 gradient objects every frame.
    ctx.fillStyle = '#0f1721';
    ctx.strokeStyle = temper || (colour + 'cc');
    ctx.lineWidth = 1.5;
    if (this.zoom < DETAIL_ZOOM) {
      // Square plates below the detail threshold: the rounding is sub-pixel anyway and
      // the path costs more than the fill.
      ctx.fillRect(px, py, w, h);
      ctx.strokeRect(px, py, w, h);
      return { px, py, w, h };
    }
    roundRect(ctx, px, py, w, h, 6);
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.fillStyle = '#18222f';
    ctx.fillRect(px, py, w, h * 0.45);
    ctx.restore();
    ctx.stroke();
    return { px, py, w, h };
  }

  caption(ctx, x, y, text, colour) {
    if (this.zoom < CAP_ZOOM) return;
    const px = x * TILE + PAD, py = y * TILE + PAD;
    const w = TILE - PAD * 2, h = TILE - PAD * 2;
    ctx.save();
    roundRect(ctx, px, py + h - CAP_H, w, CAP_H, 5);
    ctx.clip();
    ctx.fillStyle = '#0a1119';
    ctx.fillRect(px, py + h - CAP_H, w, CAP_H);
    ctx.fillStyle = colour || '#7e93a9';
    ctx.font = '600 7.5px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, px + w / 2, py + h - CAP_H / 2 + 0.5);
    ctx.restore();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }

  drawRack(ctx, r) {
    const hot = clamp((r.temp - 30) / 32, 0, 1);
    const border = hot > 0.04
      ? `rgb(${Math.round(90 + hot * 142)}, ${Math.round(150 - hot * 90)}, ${Math.round(140 - hot * 85)})`
      : r.b.color + 'cc';
    const { px, py, w, h } = this.plate(ctx, r.x, r.y, r.b.color, border);

    // Slot grid: always 4 × 5 cells standing in for the whole rack, so a
    // 112-slot cryo vault reads the same way an 8-slot frame does.
    const capH = this.zoom >= CAP_ZOOM ? CAP_H : 0;
    const cols = 4, rows = 5;
    const gx = px + 4, gy = py + 4;
    const gw = w - 8, gh = h - 8 - capH;
    const cw = gw / cols, ch = gh / rows;
    const cells = cols * rows;
    const live = Math.max(0, r.used - r.down);
    const liveCells = r.cap > 0 ? (live / r.cap) * cells : 0;
    const downCells = r.cap > 0 ? (r.down / r.cap) * cells : 0;
    const blink = 0.6 + 0.4 * Math.sin(this.t * 5 + r.x * 2.1 + r.y * 1.3);
    const load = r.load * r.throttle;

    // Zoomed out over a few hundred racks, twenty rectangles each is the whole
    // frame budget. One bar carries the same information at that size.
    if (this.zoom < DETAIL_ZOOM) {
      ctx.fillStyle = 'rgba(96,118,142,.20)';
      ctx.fillRect(gx, gy, gw, gh);
      const usedFrac = r.cap > 0 ? live / r.cap : 0;
      ctx.fillStyle = hot > 0.55
        ? `rgba(232,97,95,${0.55 + blink * 0.3})`
        : `rgba(79,220,168,${0.3 + load * blink * 0.6})`;
      ctx.fillRect(gx, gy + gh * (1 - usedFrac), gw, gh * usedFrac);
      if (r.down > 0) {
        ctx.fillStyle = 'rgba(232,97,95,.9)';
        ctx.fillRect(gx, gy, gw, gh * (r.down / Math.max(1, r.cap)));
      }
      return;
    }

    for (let i = 0; i < cells; i++) {
      const cx = gx + (i % cols) * cw;
      const cy = gy + Math.floor(i / cols) * ch;
      const ww = Math.max(1.5, cw - 2), hh = Math.max(1.4, ch - 2);
      if (i < liveCells) {
        ctx.fillStyle = hot > 0.55
          ? `rgba(232,97,95,${0.55 + blink * 0.35})`
          : `rgba(79,220,168,${0.3 + load * blink * 0.6})`;
      } else if (i < liveCells + downCells) {
        ctx.fillStyle = 'rgba(232,97,95,.9)';
      } else {
        ctx.fillStyle = 'rgba(96,118,142,.22)';
      }
      ctx.fillRect(cx, cy, ww, hh);
    }

    if (r.used === 0) {
      this.caption(ctx, r.x, r.y, 'EMPTY', '#5c728a');
    } else {
      this.caption(ctx, r.x, r.y,
        r.used + '/' + r.cap + '  ' + Math.round(r.temp) + '°',
        hot > 0.4 ? '#e8615f' : '#8fa6bd');
    }
  }

  drawMachine(ctx, tx, ty, b, d) {
    this.plate(ctx, tx, ty, b.color);
    const capH = this.zoom >= CAP_ZOOM ? CAP_H : 0;
    const cx = tx * TILE + TILE / 2;
    const cy = ty * TILE + (TILE - capH) / 2 + 1;

    if (this.zoom > GLYPH_ZOOM) {
      const glyph = GLYPHS[b.glyph] || GLYPHS.switch;
      const scale = Math.min(1, (TILE - PAD * 2 - capH - 4) / 24);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(scale, scale);
      ctx.strokeStyle = b.color;
      ctx.fillStyle = b.color;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      glyph(ctx, this.t, (tx * 0.7 + ty * 1.3) % 6.28);
      ctx.restore();
    }
    this.caption(ctx, tx, ty, shortName(b), '#8296ab');
  }

  /**
   * A rack starved of power or cooling gets a badge whether or not an overlay
   * is on, because that is the mistake everybody makes and nobody spots.
   */
  drawWarnings(ctx, r) {
    if (r.used === 0 || this.zoom < 0.4) return;
    const marks = [];
    if (r.pduFactor < 0.95) marks.push('#e8b44a');
    if (r.cover < 0.95 || r.temp > 40) marks.push('#e8615f');
    if (!marks.length) return;
    const pulse = 0.6 + 0.4 * Math.sin(this.t * 4 + r.x + r.y);
    let px = r.x * TILE + TILE - 9;
    const py = r.y * TILE + 9;
    for (const colour of marks) {
      ctx.globalAlpha = pulse;
      ctx.fillStyle = colour;
      ctx.beginPath();
      ctx.moveTo(px, py - 6);
      ctx.lineTo(px + 5.5, py + 4);
      ctx.lineTo(px - 5.5, py + 4);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#101821';
      ctx.fillRect(px - 0.7, py - 2.8, 1.4, 3.8);
      ctx.fillRect(px - 0.7, py + 1.8, 1.4, 1.4);
      px -= 13;
    }
  }
}

/** Every building carries an explicit short tag; captions never guess. */
function shortName(b) {
  return b.tag || b.name.split(' ')[0].toUpperCase();
}

function inRoom(f, p) {
  return p.x >= 0 && p.y >= 0 && p.x < f.w && p.y < f.h;
}

function tilesOf(state) {
  const out = [];
  for (const k in state.tiles) {
    const [x, y] = k.split(',').map(Number);
    out.push({ x, y, tile: state.tiles[k] });
  }
  return out;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
