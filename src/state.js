import { FACILITIES, LEGACY_BY_ID } from './data/progression.js';

export const SAVE_KEY = 'rack-and-ruin-save-v1';
export const SAVE_VERSION = 1;

/** Seconds of real time per in-game day. */
export const DAY_SECONDS = 60;

/** $ per kW per real second, at a price of $1/kWh. Time is compressed. */
export const ENERGY_RATE = 9.6;

/** $ per litre per real second, at a price of $1/m³. */
export const WATER_RATE = 2.64;

export function legacyLevel(state, id) {
  return state.legacy.perks[id] || 0;
}

export function newGame(legacy) {
  const lg = legacy || { points: 0, perks: {}, resets: 0, lifetime: 0 };
  const seedLevels = lg.perks.l_start || 0;
  const headStart = Math.min(FACILITIES.length - 1, lg.perks.l_head || 0);
  const repStart = (lg.perks.l_rep || 0) * LEGACY_BY_ID.l_rep.per;

  const state = {
    version: SAVE_VERSION,
    createdAt: Date.now(),
    lastTick: Date.now(),
    playtime: 0,
    day: 0,

    money: 6_000 * Math.pow(LEGACY_BY_ID.l_start.per, seedLevels),
    lifetimeEarnings: 0,
    reputation: repStart,
    repPeak: repStart,
    rp: 0,
    rpLifetime: 0,

    facility: headStart,
    expand: { w: 0, h: 0 },
    tiles: {},
    gridPower: 6,            // kW of utility connection bought so far
    researchAlloc: 0.15,     // fraction of compute diverted to R&D

    research: { done: [] },
    upgrades: [],
    staff: { tech: 0, eng: 0, sales: 0, ops: 0 },
    contracts: { active: [], offers: [], nextOffer: 0, seq: 1 },
    events: { active: [], next: 90, pending: null, seq: 1 },
    objectives: { done: [] },
    tutorial: { step: 0, skipped: false },
    achievements: [],
    legacy: { points: lg.points, perks: { ...lg.perks }, resets: lg.resets, lifetime: lg.lifetime },

    market: { power: 0.16, compute: 3.36, phase: Math.random() * 1000 },
    history: { at: 0, income: [], compute: [], temp: [] },
    town: { damage: 0, seen: [], sinceDay: {} },
    uptimeAvg: 1,
    upsCharge: 1,

    stats: {
      built: 0, installed: 0, repaired: 0, failed: 0, breaches: 0,
      contractsDone: 0, dryDays: 0, brownDays: 0, nineDays: 0,
      peakCompute: 0, peakIncome: 0, spentBuild: 0, spentHw: 0, powerBought: 0,
    },
    settings: { overlay: 'none', speed: 1, lastSpeed: 1, notify: true, autoSign: false },
    log: [],
  };
  return state;
}

export function facilityOf(state) {
  return FACILITIES[Math.min(state.facility, FACILITIES.length - 1)];
}

/** How much floor you can buy on top of the facility's own footprint. */
export const EXPAND_CAP = 8;

/**
 * The room you actually have: the facility's footprint plus whatever extra
 * rows and columns you have paid for. Everything that asks how big the floor
 * is asks this, not the facility.
 */
export function roomOf(state) {
  const f = facilityOf(state);
  const e = state.expand || { w: 0, h: 0 };
  return {
    id: f.id, name: f.name, ambient: f.ambient, gridCap: f.gridCap, desc: f.desc,
    baseW: f.w, baseH: f.h,
    w: f.w + Math.min(EXPAND_CAP, e.w || 0),
    h: f.h + Math.min(EXPAND_CAP, e.h || 0),
  };
}

export const key = (x, y) => x + ',' + y;

export function tileAt(state, x, y) {
  return state.tiles[key(x, y)] || null;
}

export function inBounds(state, x, y) {
  const f = roomOf(state);
  return x >= 0 && y >= 0 && x < f.w && y < f.h;
}

/** All placed tiles as {x, y, tile}. */
export function allTiles(state) {
  const out = [];
  for (const k in state.tiles) {
    const [x, y] = k.split(',').map(Number);
    out.push({ x, y, tile: state.tiles[k] });
  }
  return out;
}

// ------------------------------------------------------------------ saving

export function save(state) {
  try {
    state.lastTick = Date.now();
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    return true;
  } catch (err) {
    console.warn('save failed', err);
    return false;
  }
}

export function load() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    return migrate(data);
  } catch (err) {
    console.warn('load failed', err);
    return null;
  }
}

export function wipe() {
  try { localStorage.removeItem(SAVE_KEY); } catch (err) { /* ignore */ }
}

/** Fill in anything a newer version added, so old saves keep working. */
export function migrate(data) {
  const fresh = newGame(data.legacy);
  const merged = { ...fresh, ...data };
  merged.stats = { ...fresh.stats, ...(data.stats || {}) };
  merged.settings = { ...fresh.settings, ...(data.settings || {}) };
  merged.staff = { ...fresh.staff, ...(data.staff || {}) };
  merged.market = { ...fresh.market, ...(data.market || {}) };
  merged.contracts = { ...fresh.contracts, ...(data.contracts || {}) };
  merged.events = { ...fresh.events, ...(data.events || {}) };
  merged.research = { ...fresh.research, ...(data.research || {}) };
  merged.objectives = { ...fresh.objectives, ...(data.objectives || {}) };
  merged.tutorial = { ...fresh.tutorial, ...(data.tutorial || {}) };
  merged.legacy = { ...fresh.legacy, ...(data.legacy || {}) };
  merged.history = { ...fresh.history, ...(data.history || {}) };
  merged.expand = { ...fresh.expand, ...(data.expand || {}) };
  merged.town = { ...fresh.town, ...(data.town || {}) };
  merged.version = SAVE_VERSION;
  return merged;
}

export function exportSave(state) {
  return btoa(unescape(encodeURIComponent(JSON.stringify(state))));
}

export function importSave(text) {
  const data = JSON.parse(decodeURIComponent(escape(atob(text.trim()))));
  return migrate(data);
}
