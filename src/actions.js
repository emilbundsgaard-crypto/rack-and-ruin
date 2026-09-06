// Everything the player can actually do. Each action validates, charges and
// mutates state; the UI just calls these and re-renders.

import { clamp } from './util.js';
import { HARDWARE_BY_ID } from './data/hardware.js';
import { BUILDINGS_BY_ID } from './data/buildings.js';
import { RESEARCH_BY_ID, available } from './data/research.js';
import { UPGRADES_BY_ID, FACILITIES, STAFF_BY_ID, LEGACY_BY_ID, perkCost } from './data/progression.js';
import { key, tileAt, inBounds, facilityOf, newGame } from './state.js';
import { rackCapacity, legacyGain } from './sim.js';

export const buildCost = (b, d) => b.cost * d.mods.buildCostMult;
export const hwCost = (h, d) => h.cost * d.mods.hwCostMult;

export function place(state, d, x, y, buildingId, hooks) {
  const b = BUILDINGS_BY_ID[buildingId];
  if (!b) return 'Unknown building.';
  if (!inBounds(state, x, y)) return 'Outside the floor.';
  if (tileAt(state, x, y)) return 'That tile is taken.';
  const cost = buildCost(b, d);
  if (state.money < cost) return 'Not enough money.';
  state.money -= cost;
  state.stats.spentBuild += cost;
  state.stats.built++;
  state.tiles[key(x, y)] = b.cat === 'compute' ? { b: b.id, units: [] } : { b: b.id };
  hooks?.log(`Placed ${b.name}.`, 'info');
  return null;
}

export function sell(state, d, x, y, hooks) {
  const t = tileAt(state, x, y);
  if (!t) return 'Nothing there.';
  const b = BUILDINGS_BY_ID[t.b];
  let refund = buildCost(b, d) * 0.5;
  for (const g of t.units || []) {
    const hw = HARDWARE_BY_ID[g.t];
    if (hw) refund += hwCost(hw, d) * g.n * 0.5 * (0.4 + 0.6 * g.cond);
  }
  delete state.tiles[key(x, y)];
  state.money += refund;
  hooks?.log(`Removed ${b.name} for a 50% refund.`, 'info');
  return null;
}

export function moveTile(state, fromX, fromY, toX, toY) {
  const t = tileAt(state, fromX, fromY);
  if (!t) return 'Nothing there.';
  if (!inBounds(state, toX, toY)) return 'Outside the floor.';
  if (tileAt(state, toX, toY)) return 'Target tile is taken.';
  delete state.tiles[key(fromX, fromY)];
  state.tiles[key(toX, toY)] = t;
  return null;
}

export function freeSlots(state, d, tile) {
  const b = BUILDINGS_BY_ID[tile.b];
  if (!b || b.cat !== 'compute') return 0;
  const cap = rackCapacity(b, d.mods);
  const used = (tile.units || []).reduce((a, g) => a + g.n, 0);
  return Math.max(0, cap - used);
}

export function install(state, d, tile, hardwareId, count, hooks) {
  const hw = HARDWARE_BY_ID[hardwareId];
  if (!hw) return 'Unknown hardware.';
  if (hw.req && !state.research.done.includes(hw.req)) return 'Not researched yet.';
  const room = freeSlots(state, d, tile);
  if (room <= 0) return 'No free slots in that rack.';
  const unit = hwCost(hw, d);
  const affordable = Math.floor(state.money / unit);
  const n = Math.min(count, room, affordable);
  if (n <= 0) return 'Not enough money.';
  state.money -= n * unit;
  state.stats.spentHw += n * unit;
  state.stats.installed += n;
  tile.units = tile.units || [];
  const g = tile.units.find((u) => u.t === hardwareId);
  if (g) {
    g.cond = (g.cond * g.n + n) / (g.n + n);
    g.n += n;
  } else {
    tile.units.push({ t: hardwareId, n, broken: 0, cond: 1 });
  }
  hooks?.log(`Installed ${n} × ${hw.name}.`, 'info');
  return null;
}

export function uninstall(state, d, tile, hardwareId, count, hooks) {
  const g = (tile.units || []).find((u) => u.t === hardwareId);
  if (!g) return 'Nothing to remove.';
  const hw = HARDWARE_BY_ID[hardwareId];
  const n = Math.min(count, g.n);
  g.n -= n;
  g.broken = Math.min(g.broken, g.n);
  state.money += hwCost(hw, d) * n * 0.5 * (0.4 + 0.6 * g.cond);
  if (g.n <= 0) tile.units = tile.units.filter((u) => u !== g);
  hooks?.log(`Removed ${n} × ${hw.name} for a 50% refund.`, 'info');
  return null;
}

/**
 * Fill every rack with as much of one type as money — and the electricity
 * supply — will carry. Overfilling browns the whole site out, so the button
 * stops at the headroom rather than handing you a wrecked floor.
 */
export function fillAll(state, d, hardwareId, hooks) {
  const hw = HARDWARE_BY_ID[hardwareId];
  if (!hw) return 'Unknown hardware.';
  if (hw.req && !state.research.done.includes(hw.req)) return 'Not researched yet.';
  const unit = hwCost(hw, d);
  const perUnitKW = hw.power * d.mods.powerMult;
  const firm = d.firmSupply !== undefined ? d.firmSupply : d.supplyKW;
  let budget = Math.max(0, (firm * 0.95) - d.actualDraw);
  let allowed = perUnitKW > 0 ? Math.floor(budget / perUnitKW) : Infinity;
  let placed = 0, stoppedOnPower = false;

  for (const k in state.tiles) {
    if (allowed <= 0) { stoppedOnPower = true; break; }
    const tile = state.tiles[k];
    const b = BUILDINGS_BY_ID[tile.b];
    if (!b || b.cat !== 'compute') continue;
    const room = Math.min(freeSlots(state, d, tile), allowed, Math.floor(state.money / unit));
    if (room <= 0) continue;
    install(state, d, tile, hardwareId, room, null);
    placed += room;
    allowed -= room;
  }
  const msg = placed
    ? `Installed ${placed} × ${hw.name}` + (stoppedOnPower ? ' — stopped at the power headroom.' : ' across the floor.')
    : (allowed <= 0 ? 'No power headroom. Buy more supply first.' : 'Nothing to install — no free slots or no money.');
  hooks?.log(msg, placed ? 'good' : 'bad');
  return null;
}

/** Sell every unit older than the given type, freeing slots for the new one. */
export function retireOlderThan(state, d, hardwareId, hooks) {
  const target = HARDWARE_BY_ID[hardwareId];
  if (!target) return 'Unknown hardware.';
  let removed = 0;
  for (const k in state.tiles) {
    const tile = state.tiles[k];
    for (const g of [...(tile.units || [])]) {
      const hw = HARDWARE_BY_ID[g.t];
      if (hw && hw.compute < target.compute) {
        removed += g.n;
        uninstall(state, d, tile, g.t, g.n, null);
      }
    }
  }
  hooks?.log(removed ? `Retired ${removed} older units.` : 'Nothing older to retire.', 'info');
  return null;
}

// ------------------------------------------------------------- utility feed

/** The utility will only sell so much to a site of this size. */
export function gridCap(state) {
  return facilityOf(state).gridCap;
}

export function gridPricePerKW(state) {
  return 300 * Math.pow(1 + state.gridPower / 45, 0.72);
}

export function gridUpgradeCost(state, kw) {
  const steps = Math.max(1, Math.ceil(kw / 5));
  let total = 0, g = state.gridPower;
  for (let i = 0; i < steps; i++) {
    const chunk = kw / steps;
    total += 300 * Math.pow(1 + g / 45, 0.72) * chunk;
    g += chunk;
  }
  return total;
}

export function buyGrid(state, kw, hooks) {
  kw = Math.min(kw, gridCap(state) - state.gridPower);
  if (kw <= 0) return 'The utility will not sell you any more at this site size.';
  const cost = gridUpgradeCost(state, kw);
  if (state.money < cost) return 'Not enough money.';
  state.money -= cost;
  state.gridPower += kw;
  state.stats.powerBought += kw;
  hooks?.log(`Utility connection upgraded to ${Math.round(state.gridPower)} kW.`, 'info');
  return null;
}

export function maxGrid(state) {
  let lo = 0, hi = Math.max(0, gridCap(state) - state.gridPower);
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (gridUpgradeCost(state, mid) <= state.money) lo = mid; else hi = mid;
  }
  return Math.floor(lo);
}

// -------------------------------------------------------------------- staff

export function staffCost(role, have) {
  const def = STAFF_BY_ID[role];
  return def.salary * 12 * Math.pow(1.04, have);
}

export function hire(state, d, role, hooks) {
  const def = STAFF_BY_ID[role];
  if (!def) return 'Unknown role.';
  if (def.req && !state.research.done.includes(def.req)) return 'Not unlocked yet.';
  if (d.staffTotal >= d.staffCap) return 'No desk space — build another office.';
  const cost = staffCost(role, state.staff[role]);
  if (state.money < cost) return 'Not enough money for the signing cost.';
  state.money -= cost;
  state.staff[role]++;
  hooks?.log(`Hired a ${def.name.toLowerCase()}.`, 'info');
  return null;
}

export function fire(state, role, hooks) {
  if (!state.staff[role]) return 'Nobody to let go.';
  state.staff[role]--;
  hooks?.log(`Let a ${STAFF_BY_ID[role].name.toLowerCase()} go.`, 'info');
  return null;
}

// ----------------------------------------------------------------- research

export function buyResearch(state, id, hooks) {
  const node = RESEARCH_BY_ID[id];
  if (!node) return 'Unknown research.';
  if (state.research.done.includes(id)) return 'Already researched.';
  if (!available(node, state)) return 'Prerequisites missing.';
  if (state.rp < node.cost) return 'Not enough research points.';
  state.rp -= node.cost;
  state.research.done.push(id);
  hooks?.log(`Research complete — ${node.name}.`, 'good');
  return null;
}

export function buyUpgrade(state, d, id, hooks) {
  const u = UPGRADES_BY_ID[id];
  if (!u) return 'Unknown upgrade.';
  if (state.upgrades.includes(id)) return 'Already owned.';
  if (state.money < u.cost) return 'Not enough money.';
  state.money -= u.cost;
  state.upgrades.push(id);
  hooks?.log(`Bought ${u.name}.`, 'good');
  return null;
}

// ----------------------------------------------------------------- facility

export function nextFacility(state) {
  return FACILITIES[state.facility + 1] || null;
}

export function upgradeFacility(state, hooks) {
  const next = nextFacility(state);
  if (!next) return 'This is the largest site there is.';
  if (state.reputation < (next.rep || 0)) return `Needs ${next.rep} reputation.`;
  if (state.money < next.cost) return 'Not enough money.';
  state.money -= next.cost;
  state.facility++;
  hooks?.log(`Moved into the ${next.name}. The floor just got bigger.`, 'good');
  return null;
}

// ----------------------------------------------------------------- prestige

export function buyPerk(state, id, hooks) {
  const perk = LEGACY_BY_ID[id];
  if (!perk) return 'Unknown perk.';
  const level = state.legacy.perks[id] || 0;
  if (level >= perk.max) return 'Already at maximum.';
  const cost = perkCost(perk, level);
  if (state.legacy.points < cost) return 'Not enough legacy points.';
  state.legacy.points -= cost;
  state.legacy.perks[id] = level + 1;
  hooks?.log(`Legacy perk — ${perk.name} ${level + 1}.`, 'good');
  return null;
}

export function prestige(state, hooks) {
  const gain = legacyGain(state);
  if (gain < 1) return 'Nothing to hand over yet.';
  const legacy = {
    points: state.legacy.points + gain,
    perks: { ...state.legacy.perks },
    resets: state.legacy.resets + 1,
    lifetime: state.legacy.lifetime + state.lifetimeEarnings,
  };
  const fresh = newGame(legacy);
  fresh.achievements = [...state.achievements];
  hooks?.log(`Sold the company for ${gain} legacy points. Time to do it properly.`, 'good');
  return fresh;
}
