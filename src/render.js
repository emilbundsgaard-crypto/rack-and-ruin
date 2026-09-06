// Canvas view of the floor: tiles, coverage overlays, heat map and the
// pan/zoom/pointer handling that goes with them.

import { clamp } from './util.js';
import { BUILDINGS_BY_ID } from './data/buildings.js';
import { facilityOf, tileAt } from './state.js';

export const TILE = 46;

export class FloorView {
  constructor(canvas, callbacks) {
    this.c = canvas;
    this.ctx = canvas.getContext('2d');
    this.cb = callbacks || {};
    this.zoom = 1;
    this.ox = 0;
    this.oy = 0;
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
    this.zoom = clamp(Math.min(this.w / (f.w * TILE + 70), this.h / (f.h * TILE + 70)), 0.32, 2.2);
    this.ox = (this.w - f.w * TILE * this.zoom) / 2;
    this.oy = (this.h - f.h * TILE * this.zoom) / 2;
    this.centred = true;
  }

  toTile(px, py) {
    const x = Math.floor((px - this.ox) / (TILE * this.zoom));
    const y = Math.floor((py - this.oy) / (TILE * this.zoom));
    return { x, y };
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
        if (this.button === 1 || this.button === 2 || this.pan || !this.tool) {
          this.ox += dx; this.oy += dy;
        } else if (this.tool && this.panned) {
          // drag-to-paint while a build tool is held
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
      this.zoom = clamp(this.zoom * (e.deltaY < 0 ? 1.12 : 1 / 1.12), 0.28, 2.4);
      const after = this.toTileF(p.x, p.y);
      this.ox += (after.x - before.x) * TILE * this.zoom;
      this.oy += (after.y - before.y) * TILE * this.zoom;
    }, { passive: false });
  }

  toTileF(px, py) {
    return { x: (px - this.ox) / (TILE * this.zoom), y: (py - this.oy) / (TILE * this.zoom) };
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

    const W = f.w * TILE, H = f.h * TILE;

    // Room shell.
    ctx.fillStyle = '#0f1620';
    ctx.fillRect(-8, -8, W + 16, H + 16);
    ctx.strokeStyle = '#2b3d52';
    ctx.lineWidth = 3;
    ctx.strokeRect(-8, -8, W + 16, H + 16);

    // Floor tiles.
    ctx.lineWidth = 1;
    for (let y = 0; y < f.h; y++) {
      for (let x = 0; x < f.w; x++) {
        ctx.fillStyle = (x + y) % 2 ? '#131c27' : '#151f2b';
        ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
        ctx.strokeStyle = '#1c2836';
        ctx.strokeRect(x * TILE + 0.5, y * TILE + 0.5, TILE - 1, TILE - 1);
      }
    }

    if (this.overlay !== 'none') this.drawOverlay(state, d, f);

    // Coverage rings for the hovered or selected support machine.
    const focus = this.sel || (this.tool ? this.hover : null);
    if (focus) this.drawRange(state, focus);

    for (const r of d.racks) this.drawRack(ctx, r);
    for (const r of d.racks) this.drawWarnings(ctx, r);
    for (const { x, y, tile } of tilesOf(state)) {
      const b = BUILDINGS_BY_ID[tile.b];
      if (!b || b.cat === 'compute') continue;
      this.drawMachine(ctx, x, y, b, d);
    }

    // Hover + selection.
    if (this.hover && inRoom(f, this.hover)) {
      const occupied = !!tileAt(state, this.hover.x, this.hover.y);
      ctx.strokeStyle = this.tool === 'sell' ? '#e8615f' : occupied && this.tool ? '#e8615f' : '#4fdca8';
      ctx.lineWidth = 2;
      ctx.strokeRect(this.hover.x * TILE + 1, this.hover.y * TILE + 1, TILE - 2, TILE - 2);
    }
    if (this.sel) {
      ctx.strokeStyle = '#ffffff';
      ctx.setLineDash([4, 3]);
      ctx.lineWidth = 2;
      ctx.strokeRect(this.sel.x * TILE + 1, this.sel.y * TILE + 1, TILE - 2, TILE - 2);
      ctx.setLineDash([]);
    }
    ctx.restore();
  }

  drawOverlay(state, d, f) {
    const ctx = this.ctx;
    if (this.overlay === 'heat') {
      for (const r of d.racks) {
        const t = clamp((r.temp - 20) / 50, 0, 1);
        ctx.fillStyle = `hsla(${(1 - t) * 200}, 85%, 50%, ${0.15 + t * 0.5})`;
        ctx.fillRect(r.x * TILE, r.y * TILE, TILE, TILE);
      }
      return;
    }
    if (this.overlay === 'net') {
      const ok = d.netFactor > 0.99;
      for (const r of d.racks) {
        ctx.fillStyle = ok ? 'rgba(143,111,216,.22)' : 'rgba(232,97,95,.28)';
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
          cover.set(x + ',' + y, (cover.get(x + ',' + y) || 0) + 1);
        }
      }
    }
    for (const [k, n] of cover) {
      const [x, y] = k.split(',').map(Number);
      ctx.fillStyle = this.overlay === 'power'
        ? `rgba(216,161,58,${Math.min(0.34, 0.12 + n * 0.07)})`
        : `rgba(79,220,168,${Math.min(0.34, 0.12 + n * 0.07)})`;
      ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
    }
    // Racks with no coverage at all get a red hatch.
    for (const r of d.racks) {
      const has = cover.get(r.x + ',' + r.y);
      if (!has && r.used > 0) {
        ctx.fillStyle = 'rgba(232,97,95,.30)';
        ctx.fillRect(r.x * TILE, r.y * TILE, TILE, TILE);
      }
    }
  }

  drawRange(state, tilePos) {
    const t = tileAt(state, tilePos.x, tilePos.y);
    const b = t ? BUILDINGS_BY_ID[t.b] : BUILDINGS_BY_ID[this.tool];
    if (!b || !b.radius) return;
    const ctx = this.ctx;
    ctx.strokeStyle = b.cat === 'cooling' ? '#4fdca8aa' : '#d8a13aaa';
    ctx.setLineDash([5, 4]);
    ctx.lineWidth = 1.5;
    const r = b.radius;
    ctx.strokeRect((tilePos.x - r) * TILE + 1, (tilePos.y - r) * TILE + 1,
      (r * 2 + 1) * TILE - 2, (r * 2 + 1) * TILE - 2);
    ctx.setLineDash([]);
  }

  drawRack(ctx, r) {
    const x = r.x * TILE, y = r.y * TILE;
    const pad = 5;
    const hot = clamp((r.temp - 28) / 34, 0, 1);

    ctx.fillStyle = '#0c1219';
    roundRect(ctx, x + pad, y + pad, TILE - pad * 2, TILE - pad * 2, 4);
    ctx.fill();
    ctx.strokeStyle = hot > 0.05 ? `rgba(${180 + hot * 70}, ${120 - hot * 90}, ${90 - hot * 60}, .9)` : r.b.color + 'cc';
    ctx.lineWidth = 1.6;
    ctx.stroke();

    const live = r.used - r.down;
    const blink = 0.55 + 0.45 * Math.sin(this.t * 7 + r.x * 2.1 + r.y * 1.3);

    // Big cabinets and zoomed-out views get a bar instead of one LED per slot;
    // 84 rectangles per rack across 500 racks is not a frame budget.
    if (r.cap > 24 || this.zoom < 0.62) {
      const bw = TILE - pad * 2 - 6, bh = TILE - pad * 2 - 12;
      const bx = x + pad + 3, by = y + pad + 3;
      ctx.fillStyle = 'rgba(90,110,132,.22)';
      ctx.fillRect(bx, by, bw, bh);
      const used = r.cap > 0 ? r.used / r.cap : 0;
      const load = r.load * r.throttle;
      ctx.fillStyle = hot > 0.6
        ? `rgba(232,97,95,${0.5 + blink * 0.35})`
        : `rgba(79,220,168,${0.3 + load * blink * 0.55})`;
      ctx.fillRect(bx, by + bh * (1 - used), bw, bh * used);
      if (r.down > 0) {
        const bad = r.used > 0 ? r.down / r.cap : 0;
        ctx.fillStyle = 'rgba(232,97,95,.9)';
        ctx.fillRect(bx, by, bw, bh * bad);
      }
      if (r.used === 0) {
        ctx.fillStyle = '#3c556e';
        ctx.font = '9px ui-monospace, monospace';
        ctx.textAlign = 'center';
        ctx.fillText('empty', x + TILE / 2, y + TILE - 8);
        ctx.textAlign = 'left';
      }
      return;
    }

    // Slot LEDs, four per row.
    const cols = 4;
    const rows = Math.max(1, Math.ceil(r.cap / cols));
    const cw = (TILE - pad * 2 - 6) / cols;
    const ch = Math.min(4.4, (TILE - pad * 2 - 6) / rows);
    for (let i = 0; i < r.cap; i++) {
      const cx = x + pad + 3 + (i % cols) * cw;
      const cy = y + pad + 3 + Math.floor(i / cols) * ch;
      if (i < live) {
        const load = r.load * r.throttle;
        ctx.fillStyle = hot > 0.6
          ? `rgba(232,97,95,${0.5 + blink * 0.4})`
          : `rgba(79,220,168,${0.28 + load * blink * 0.62})`;
      } else if (i < r.used) {
        ctx.fillStyle = 'rgba(232,97,95,.85)';
      } else {
        ctx.fillStyle = 'rgba(90,110,132,.28)';
      }
      ctx.fillRect(cx, cy, cw - 2.2, Math.max(1.6, ch - 1.6));
    }

    if (r.used === 0) {
      ctx.fillStyle = '#3c556e';
      ctx.font = '9px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('empty', x + TILE / 2, y + TILE - 8);
      ctx.textAlign = 'left';
    }
  }

  /**
   * A rack starved of power or cooling gets a badge whether or not an overlay
   * is on, because that is the mistake everybody makes and nobody spots.
   */
  drawWarnings(ctx, r) {
    if (r.used === 0 || this.zoom < 0.45) return;
    const marks = [];
    if (r.pduFactor < 0.95) marks.push('#e8b44a');
    if (r.cover < 0.95 || r.temp > 40) marks.push('#e8615f');
    if (!marks.length) return;
    const pulse = 0.55 + 0.45 * Math.sin(this.t * 4 + r.x + r.y);
    let px = r.x * TILE + TILE - 8;
    const py = r.y * TILE + 8;
    for (const colour of marks) {
      ctx.globalAlpha = pulse;
      ctx.fillStyle = colour;
      ctx.beginPath();
      ctx.moveTo(px, py - 5.5);
      ctx.lineTo(px + 5, py + 3.5);
      ctx.lineTo(px - 5, py + 3.5);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#121a24';
      ctx.fillRect(px - 0.7, py - 2.6, 1.4, 3.6);
      ctx.fillRect(px - 0.7, py + 1.6, 1.4, 1.4);
      px -= 12;
    }
  }

  drawMachine(ctx, tx, ty, b, d) {
    const x = tx * TILE, y = ty * TILE, pad = 6;
    ctx.fillStyle = '#0d141c';
    roundRect(ctx, x + pad, y + pad, TILE - pad * 2, TILE - pad * 2, 5);
    ctx.fill();
    ctx.strokeStyle = b.color + 'cc';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    const cx = x + TILE / 2, cy = y + TILE / 2;
    ctx.save();
    ctx.translate(cx, cy);
    if (b.cat === 'cooling') {
      // Spinning fan.
      const speed = 4 + (d.heatLoad > 0 ? 5 : 0);
      ctx.rotate(this.t * speed);
      ctx.strokeStyle = b.color;
      ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(0, 0, 8, i * 2.09, i * 2.09 + 1.1);
        ctx.stroke();
      }
    } else if (b.supplyKW) {
      const pulse = 0.6 + 0.4 * Math.sin(this.t * 3 + tx);
      ctx.strokeStyle = b.color;
      ctx.globalAlpha = pulse;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-2, -8); ctx.lineTo(-6, 1); ctx.lineTo(0, 1); ctx.lineTo(-1, 9);
      ctx.lineTo(6, -1); ctx.lineTo(0, -1); ctx.closePath();
      ctx.stroke();
    } else if (b.powerCap) {
      ctx.strokeStyle = b.color;
      ctx.lineWidth = 2;
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath(); ctx.moveTo(i * 5, -8); ctx.lineTo(i * 5, 8); ctx.stroke();
      }
    } else if (b.supplyWater) {
      const wob = Math.sin(this.t * 2 + ty) * 1.6;
      ctx.strokeStyle = b.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-8, 2 + wob);
      ctx.quadraticCurveTo(-3, -3 + wob, 0, 2 + wob);
      ctx.quadraticCurveTo(3, 7 + wob, 8, 2 + wob);
      ctx.stroke();
    } else if (b.net) {
      ctx.strokeStyle = b.color;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(-8, 0); ctx.lineTo(8, 0);
      ctx.moveTo(-4, -6); ctx.lineTo(-4, 6);
      ctx.moveTo(4, -6); ctx.lineTo(4, 6);
      ctx.stroke();
    } else {
      ctx.fillStyle = b.color;
      ctx.fillRect(-6, -6, 12, 12);
      ctx.fillStyle = '#0d141c';
      ctx.fillRect(-3, -3, 6, 6);
    }
    ctx.restore();

    ctx.globalAlpha = 1;
    if (this.zoom < 0.55) return;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x + 1, y + TILE - 14, TILE - 2, 13);
    ctx.clip();
    ctx.fillStyle = '#63788f';
    ctx.font = '7.5px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(shortName(b), cx, y + TILE - 4);
    ctx.restore();
    ctx.textAlign = 'left';
  }
}

/** Tile captions have about 44 px to play with. */
function shortName(b) {
  const first = b.name.split(' ')[0];
  const word = first.length >= 5 ? first : b.name;
  return word.length > 9 ? word.slice(0, 8) + '…' : word;
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
