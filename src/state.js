import { FACILITIES, LEGACY_BY_ID } from './data/progression.js';
import { tune } from './util.js';

export const SAVE_KEY = 'rack-and-ruin-save-v1';
export const SAVE_VERSION = 1;

// Bumped whenever the files change, and shown in the Menu. It exists so that
// "is the server actually running the new code?" is a question you can answer
// by looking, instead of by guessing from behaviour.
export const BUILD = '2026-09-12d';

/** Seconds of real time per in-game day. */
export const DAY_SECONDS = 60;

/** $ per kW per real second, at a price of $1/kWh. Time is compressed. */
export const ENERGY_RATE = 9.6;

/** $ per litre per real second, at a price of $1/m³. */
export const WATER_RATE = 2.64;

/**
 * What you start with.
 *
 * It used to be ten thousand, which is roughly twice what the guide asks you
 * to spend, and enough to coast: a player reported fifty thousand dollars two
 * minutes in, before they had understood a single system.
 *
 * This is what the guide actually costs, added up, plus a rack's worth of
 * salvaged desktops and nothing else. A power strip, a rack and a box fan is
 * $1,850; the first kilowatt of utility power is $657; the technician it
 * tells you to hire is $960 to sign. That is $3,467 of asks, and the machines
 * that have to earn them back come out of the rest.
 *
 * At $5,200 the guide finished but one walk in two ended it overdrawn, which
 * is the one state in this game that stops you buying anything — a poor
 * thing to hand somebody in the minute they stop being told what to do.
 *
 * Going lower was tried and measured: at $3,600 — before the signing cost
 * came down — the walk reached the eighth step and stopped, unable to afford
 * the technician the guide was pointing at, and two of eight bot runs died
 * inside fifty days. A squeeze is the point; a guide you cannot finish is
 * not.
 */
export const START_MONEY = tune('START_MONEY', 7_500);

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
    // Which build wrote this save, so a balance change that alters what an
    // existing site draws can say so instead of silently throttling it.
    build: BUILD,
    createdAt: Date.now(),
    lastTick: Date.now(),
    playtime: 0,
    day: 0,

    money: START_MONEY * Math.pow(LEGACY_BY_ID.l_start.per, seedLevels),
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
    tutorial: { step: 0, skipped: false, sawTown: false },
    achievements: [],
    legacy: { points: lg.points, perks: { ...lg.perks }, resets: lg.resets, lifetime: lg.lifetime },

    // What you owe. Debt is real money: it charges interest every day, it is
    // repaid out of income before it reaches your pocket, and if it runs past
    // the credit limit the bank stops lending and the site seizes up.
    bank: {
      debt: 0, borrowed: 0, interestPaid: 0,
      overdrafts: 0, overdraftDays: 0,
      // Which rescue offer comes next, and how many you have already taken.
      rescueLevel: 0, rescues: 0,
    },

    // The public company, once there is one. Before the float this is all
    // zeroes and the panel is a prospectus; after it, the dividend is a
    // standing charge on income that never goes away and grows on a schedule
    // the shareholders were promised in writing.
    ipo: {
      floated: false,      // has the company gone public
      day: 0,              // the game-day it floated
      raised: 0,           // cash the float put on the balance sheet
      valuation: 0,        // what it was valued at on the day
      paid: 0,             // dividends paid since
      years: 0,            // completed dividend years, which set the rate
    },

    market: { power: 0.16, compute: 3.36, phase: Math.random() * 1000 },
    history: { at: 0, income: [], compute: [], temp: [] },
    town: { damage: 0, seen: [], sinceDay: {} },
    uptimeAvg: 1,
    upsCharge: 1,

    stats: {
      built: 0, installed: 0, repaired: 0, failed: 0, breaches: 0,
      contractsDone: 0, dryDays: 0, brownDays: 0, nineDays: 0,
      peakCompute: 0, peakIncome: 0, spentBuild: 0, spentHw: 0, powerBought: 0,
      waterTaken: 0, powerDrawn: 0,
    },
    settings: { overlay: 'none', speed: 1, lastSpeed: 1, notify: true, autoSign: false, autoSignUptime: 1, sound: true },
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
  merged.bank = { ...fresh.bank, ...(data.bank || {}) };
  // A save written before the company could float has no ipo block at all, so
  // it takes the fresh one and stays private, which is the right answer.
  merged.ipo = { ...fresh.ipo, ...(data.ipo || {}) };
  merged.version = SAVE_VERSION;

  // A save from before machines stopped being free to power needs telling.
  //
  // Hardware draw is read from the data files, not from the save, so a site
  // built under the old efficiency curve wakes up drawing far more than it
  // did and browns out on the spot through no fault of its owner. The
  // connection is topped up to whatever the site is allowed, for nothing, and
  // the player gets told what changed and what to build — which is a great
  // deal better than opening the tab to a throttled site and no explanation.
  if (merged.build && merged.build !== BUILD && Object.keys(merged.tiles || {}).length) {
    merged.powerRebalance = merged.build;
    const cap = facilityOf(merged).gridCap;
    if (merged.gridPower < cap) merged.gridPower = cap;
  }
  merged.build = BUILD;
  return merged;
}

export function exportSave(state) {
  return btoa(unescape(encodeURIComponent(JSON.stringify(state))));
}

export function importSave(text) {
  const data = JSON.parse(decodeURIComponent(escape(atob(text.trim()))));
  return migrate(data);
}
