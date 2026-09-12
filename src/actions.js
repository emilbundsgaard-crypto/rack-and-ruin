// Everything the player can actually do. Each action validates, charges and
// mutates state; the UI just calls these and re-renders.

import { clamp, money } from './util.js';
import { HARDWARE_BY_ID } from './data/hardware.js';
import { BUILDINGS_BY_ID } from './data/buildings.js';
import { RESEARCH_BY_ID, available } from './data/research.js';
import { UPGRADES_BY_ID, FACILITIES, STAFF_BY_ID, LEGACY_BY_ID, perkCost } from './data/progression.js';
import { key, tileAt, inBounds, facilityOf, roomOf, EXPAND_CAP, newGame, DAY_SECONDS } from './state.js';
import { rackCapacity, legacyGain } from './sim.js';

export const buildCost = (b, d) => b.cost * d.mods.buildCostMult;
export const hwCost = (h, d) => h.cost * d.mods.hwCostMult;

/**
 * The bank has stopped lending and the site is losing money: nothing new gets
 * bought until that is fixed. Selling and demolishing stay open, because they
 * are the way out.
 */
function frozen(state) {
  // One rule, checked everywhere money is spent: a balance below zero buys
  // nothing at all. Selling and demolishing stay open — they are the way back.
  return state.money < 0
    ? 'You are overdrawn. Nothing can be bought until you are back above zero — '
      + 'sell servers you cannot run, or let staff go.'
    : null;
}

export function place(state, d, x, y, buildingId, hooks) {
  const b = BUILDINGS_BY_ID[buildingId];
  if (!b) return 'Unknown building.';
  if (!inBounds(state, x, y)) return 'Outside the floor.';
  if (tileAt(state, x, y)) return 'That tile is taken.';
  const cost = buildCost(b, d);
  const stop = frozen(state);
  if (stop) return stop;
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
  const stop = frozen(state);
  if (stop) return stop;
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
 *
 * It also stops short of your last dollar, and by more than it looks.
 *
 * The guide sends a new player at this button before it asks them to buy
 * utility power and hire a technician, so a button that spends everything
 * leaves them unable to do either: measured across five guided walks, every
 * one of them finished the guide with between minus sixty and seven dollars
 * in the bank, whatever the opening float was set to. Raising the float did
 * not help, because this button simply took that too — the float is not the
 * lever here, this is.
 *
 * So it keeps two fifths back. That is deliberately a lot, and it is the
 * right shape: at the start it is the difference between a working site and
 * an overdrawn one, and later it costs nothing, because the button is
 * repeatable — press it twice and you have spent nearly two thirds, three
 * times and it is seven eighths.
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
  const reserve = Math.min(state.money * 0.6,
    Math.max(state.money * 0.4, d.costs * DAY_SECONDS * 2));
  const spendable = Math.max(0, state.money - reserve);

  for (const k in state.tiles) {
    if (allowed <= 0) { stoppedOnPower = true; break; }
    const tile = state.tiles[k];
    const b = BUILDINGS_BY_ID[tile.b];
    if (!b || b.cat !== 'compute') continue;
    const room = Math.min(freeSlots(state, d, tile), allowed,
      Math.floor((spendable - unit * placed) / unit));
    if (room <= 0) continue;
    install(state, d, tile, hardwareId, room, null);
    placed += room;
    allowed -= room;
  }
  // Say what to do about it, not just what went wrong. Nearly always the
  // answer is a bigger utility connection, which is one click away in Ops and
  // which the player usually has the money for.
  const spare = Math.max(0, gridCap(state) - state.gridPower);
  const where = spare > 0
    ? ` The utility will sell you ${Math.round(spare)} kW more — Running tab, Power.`
    : ' Build your own generation, or move to a site with a bigger connection.';

  let msg;
  if (placed && stoppedOnPower) {
    msg = `Installed ${placed} × ${hw.name}, then ran out of electricity.${where}`;
  } else if (placed) {
    msg = `Installed ${placed} × ${hw.name} across the floor.`;
  } else if (allowed <= 0) {
    msg = `No electricity left for another server.${where}`;
  } else if (Math.floor(state.money / unit) < 1) {
    msg = `Not enough money — ${hw.name} costs ${money(unit)} each.`;
  } else {
    msg = 'Nothing to install — every rack is already full.';
  }
  hooks?.log(msg, placed ? 'good' : 'bad');

  // Machines in a rack with no power draw nothing and produce nothing, and the
  // install otherwise looks like it worked. Say so.
  if (placed) {
    const dark = d.racks.filter((r) => r.used > 0 && r.pduFactor < 0.05).length;
    if (dark > 0) {
      hooks?.log(dark === 1
        ? 'One rack has no power reaching it — the servers in it are doing nothing. Put a power strip within reach.'
        : `${dark} racks have no power reaching them — the servers in them are doing nothing. `
          + 'Put power strips within reach.', 'bad');
    }
  }
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

/**
 * Swap every rack on the floor for a roomier model, keeping whatever is
 * installed. Late on you own two hundred cabinets; replacing them one at a
 * time is not a decision, it is a chore.
 */
export function upgradeRacks(state, d, buildingId, hooks) {
  const target = BUILDINGS_BY_ID[buildingId];
  if (!target || target.cat !== 'compute') return 'Not a rack.';
  if (target.req && !state.research.done.includes(target.req)) return 'Not researched yet.';
  const stop = frozen(state);
  if (stop) return stop;
  const unit = buildCost(target, d);
  let done = 0, spent = 0;
  for (const k in state.tiles) {
    const tile = state.tiles[k];
    const old = BUILDINGS_BY_ID[tile.b];
    if (!old || old.cat !== 'compute' || old.slots >= target.slots) continue;
    const net = unit - buildCost(old, d) * 0.5;
    if (state.money < net) break;
    state.money -= net;
    spent += net;
    tile.b = target.id;
    done++;
  }
  state.stats.spentBuild += spent;
  hooks?.log(done
    ? `Swapped ${done} rack${done > 1 ? 's' : ''} for ${target.name.toLowerCase()}s, hardware and all.`
    : 'Nothing to upgrade — either they are all this good already, or you cannot afford it.',
    done ? 'good' : 'bad');
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
  const stop = frozen(state);
  if (stop) return stop;
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

/**
 * What it costs to sign somebody, on top of their wages.
 *
 * It was twelve days of salary, which made the up-front lump the whole
 * decision and the wage an afterthought — the wrong way round for a game
 * where the wage bill is the recurring cost you are meant to manage. It also
 * put a wall in the middle of the guide: the step that tells you to hire a
 * technician wanted $2,880 from an opening float of $5,200, and a third of
 * guided starts stalled there waiting to afford the thing the game was
 * pointing at. Four days is a recruiter's fee rather than a year's budget,
 * and the wage still has to be earned every day after it.
 */
export function staffCost(role, have) {
  const def = STAFF_BY_ID[role];
  return def.salary * 4 * Math.pow(1.04, have);
}

export function hire(state, d, role, hooks) {
  const def = STAFF_BY_ID[role];
  if (!def) return 'Unknown role.';
  if (def.req && !state.research.done.includes(def.req)) return 'Not unlocked yet.';
  if (d.staffTotal >= d.staffCap) return 'No desk space — build another office.';
  const stop = frozen(state);
  if (stop) return stop;
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
  const stop = frozen(state);
  if (stop) return stop;
  if (state.money < u.cost) return 'Not enough money.';
  state.money -= u.cost;
  state.upgrades.push(id);
  hooks?.log(`Bought ${u.name}.`, 'good');
  return null;
}

// -------------------------------------------------------------------- floor

/** Extra rows and columns get steadily dearer, and cap out per facility. */
export function expandCost(state, d) {
  const f = facilityOf(state);
  const bought = (state.expand.w || 0) + (state.expand.h || 0);
  const base = Math.max(600, f.cost > 0 ? f.cost * 0.055 : 3_000);
  return base * Math.pow(1.42, bought) * (d ? d.mods.buildCostMult : 1);
}

export function canExpand(state, axis) {
  return (state.expand[axis] || 0) < EXPAND_CAP;
}

export function expand(state, d, axis, hooks) {
  if (axis !== 'w' && axis !== 'h') return 'Unknown direction.';
  if (!canExpand(state, axis)) return 'This site cannot take any more floor. Move somewhere bigger.';
  const cost = expandCost(state, d);
  const stop = frozen(state);
  if (stop) return stop;
  if (state.money < cost) return 'Not enough money.';
  state.money -= cost;
  state.stats.spentBuild += cost;
  state.expand[axis] = (state.expand[axis] || 0) + 1;
  const r = roomOf(state);
  hooks?.log(`Knocked through. The floor is now ${r.w} × ${r.h} tiles.`, 'good');
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
  const stop = frozen(state);
  if (stop) return stop;
  if (state.money < next.cost) return 'Not enough money.';
  state.money -= next.cost;
  state.facility++;
  // Bought floor carries over as the site grows.
  hooks?.log(`Moved into the ${next.name}. The floor just got bigger.`, 'good');
  hooks?.onMilestone?.('New site', next.name, next.desc || 'More floor, and room for what comes next.');
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
  hooks?.onMilestone?.('Sold', `${gain} legacy points`, 'Back to the cupboard, and this time you know what you are doing.');
  return fresh;
}
