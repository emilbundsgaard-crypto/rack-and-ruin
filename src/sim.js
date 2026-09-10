// The whole simulation: modifiers, the per-tick derived snapshot of the site,
// and the state mutations that follow from it.

import { clamp, sum, noise, weightedPick, fmt as fmtShort, fmtTime, money } from './util.js';

// Log it, but do not pop a toast for it: these are all already on screen
// somewhere the player is looking — the event strip, the Deals tab, the
// objective panel, or the running log along the bottom.
const QUIET = { toast: false };
import { HARDWARE_BY_ID } from './data/hardware.js';
import { BUILDINGS_BY_ID } from './data/buildings.js';
import { RESEARCH_BY_ID, RESEARCH } from './data/research.js';
import { CONTRACT_TEMPLATES, TEMPLATES_BY_ID, decorate, pickClient } from './data/contracts.js';
import { EVENTS, EVENTS_BY_ID } from './data/events.js';
import {
  FACILITIES, STAFF_BY_ID, UPGRADES_BY_ID, LEGACY_BY_ID,
  OBJECTIVES, ACHIEVEMENTS,
} from './data/progression.js';
import { facilityOf, roomOf, allTiles, DAY_SECONDS, ENERGY_RATE, WATER_RATE } from './state.js';
import { tickTown } from './town.js';

const MULT_KEYS = [
  'offerSize', 'computeMult', 'powerMult', 'heatMult', 'coolMult', 'coolDrawMult', 'waterMult',
  'wearMult', 'repairMult', 'researchMult', 'priceMult', 'repMult', 'gridCostMult',
  'waterCostMult', 'fuelMult', 'upkeepMult', 'hwCostMult', 'buildCostMult',
  'penaltyMult', 'priceStability', 'powerSupplyMult', 'waterSupplyMult',
];
const ADD_KEYS = [
  'boardSize', 'staffCap', 'offlineHours', 'offlineRate', 'uptimeBonus',
  'rackSlotBonus', 'securityBonus',
];

function baseMods() {
  const m = {};
  for (const k of MULT_KEYS) m[k] = 1;
  for (const k of ADD_KEYS) m[k] = 0;
  m.offerSize = 1;
  // Room for one person on the payroll before any office exists. Without this
  // you cannot hire your first technician until an office is researched and
  // built, which leaves broken servers with nobody to fix them through the
  // whole opening — and made the guide ask for something impossible.
  m.staffCap = 1;
  m.offlineHours = 2;
  m.offlineRate = 0.35;
  return m;
}

function applyEffects(mods, effects) {
  if (!effects) return;
  for (const k in effects) {
    if (MULT_KEYS.includes(k)) mods[k] *= effects[k];
    else if (ADD_KEYS.includes(k)) mods[k] += effects[k];
  }
}

/** Everything that multiplies or adds to the raw numbers. */
export function modifiers(state) {
  const m = baseMods();

  for (const id of state.research.done) applyEffects(m, RESEARCH_BY_ID[id]?.effects);
  for (const id of state.upgrades) applyEffects(m, UPGRADES_BY_ID[id]?.effects);

  const L = state.legacy.perks;
  const lv = (id) => L[id] || 0;
  m.computeMult *= Math.pow(1 + LEGACY_BY_ID.l_compute.per, lv('l_compute'));
  m.priceMult *= Math.pow(1 + LEGACY_BY_ID.l_money.per, lv('l_money'));
  m.coolMult *= Math.pow(1 + LEGACY_BY_ID.l_cool.per, lv('l_cool'));
  m.powerMult *= Math.pow(1 - LEGACY_BY_ID.l_power.per, lv('l_power'));
  m.waterMult *= Math.pow(1 - LEGACY_BY_ID.l_water.per, lv('l_water'));
  m.researchMult *= Math.pow(1 + LEGACY_BY_ID.l_research.per, lv('l_research'));
  m.wearMult *= Math.pow(1 - LEGACY_BY_ID.l_wear.per, lv('l_wear'));
  m.buildCostMult *= Math.pow(1 - LEGACY_BY_ID.l_build.per, lv('l_build'));
  m.hwCostMult *= Math.pow(1 - LEGACY_BY_ID.l_hw.per, lv('l_hw'));
  m.rackSlotBonus += LEGACY_BY_ID.l_slots.per * lv('l_slots');
  m.boardSize += LEGACY_BY_ID.l_contract.per * lv('l_contract');
  m.offlineHours += LEGACY_BY_ID.l_offline.per * lv('l_offline');

  // Staff.
  m.repairMult *= 1 + state.staff.tech * 0.06;
  m.uptimeBonus += Math.min(0.06, state.staff.ops * 0.004);
  m.repMult *= 1 + state.staff.sales * 0.05;
  m.securityBonus += Math.min(0.4, state.staff.ops * 0.02);

  // Events currently running.
  for (const ev of state.events.active) {
    // Weather comes in and goes out; it does not switch.
    //
    // Every event used to land at full strength in a single tick and leave the
    // same way. A 38% cut in cooling arriving between one frame and the next
    // can take a rack past 40°C and start breaking hardware before you have
    // seen the notification, which reads as being slapped rather than being
    // tested. The strength now ramps over the first and last stretch of its
    // life, so there is always time to answer it. Short events still reach
    // full strength, because the ramp is capped at a third of their run.
    const ramp = eventRamp(state, ev);
    const apply = (target, k, raw, add) => {
      if (add) target[k] += raw * ramp;
      else target[k] *= 1 + (raw - 1) * ramp;
    };

    // Outcomes of decision events carry their own modifiers under ids that are
    // not in the EVENTS table, so apply those before looking the event up.
    if (ev.mods) for (const k in ev.mods) if (MULT_KEYS.includes(k)) apply(m, k, ev.mods[k], false);
    const def = EVENTS_BY_ID[ev.id];
    if (!def) continue;
    const soften = 1 - Math.min(0.35, state.staff.ops * 0.025);
    for (const k in def.mods || {}) {
      const raw = def.mods[k];
      // Operators soften the bad half of every modifier.
      const val = raw < 1 ? 1 - (1 - raw) * soften : raw;
      if (MULT_KEYS.includes(k)) apply(m, k, val, false);
      else if (ADD_KEYS.includes(k)) apply(m, k, raw, true);
    }
  }
  return m;
}

export function rackCapacity(building, mods) {
  return Math.max(1, Math.floor(building.slots + mods.rackSlotBonus));
}

function chebyshev(ax, ay, bx, by) {
  return Math.max(Math.abs(ax - bx), Math.abs(ay - by));
}

/** Sun and outside air, both driven by the fractional part of the day. */
export function daylight(day) {
  const f = day % 1;
  return clamp(Math.sin((f - 0.22) * Math.PI * 2) * 1.35, 0, 1);
}

export function outsideTemp(state) {
  const f = state.day % 1;
  const base = facilityOf(state).ambient;
  return base + Math.sin((f - 0.30) * Math.PI * 2) * 7;
}

// ---------------------------------------------------------------- derive

/** How far into its life an event is, as a 0..1 strength. */
const EVENT_RAMP_DAYS = 0.5;

function eventRamp(state, ev) {
  const until = ev.until;
  if (until === undefined) return 1;
  const started = ev.started ?? (until - 2);
  const life = Math.max(0.2, until - started);
  const r = Math.min(EVENT_RAMP_DAYS, life / 3);
  if (r <= 0) return 1;
  return clamp(Math.min((state.day - started) / r, (until - state.day) / r), 0, 1);
}

export function derive(state) {
  const mods = modifiers(state);
  const fac = roomOf(state);
  const tiles = allTiles(state);

  const racks = [];
  const coolers = [];
  const pdus = [];
  const counts = {};
  let ownSupply = 0, miscDraw = 0, upkeep = 0, fuelCost = 0;
  let waterSupply = 0, waterCost = 0, netCap = 1.5, staffCap = mods.staffCap;
  let repairBoost = 1, uptimeBoost = 0, researchFlat = 0, boardBonus = 0, firmOwn = 0;
  let security = mods.securityBonus, genHeat = 0, freeSlots = 0, unitsTotal = 0;
  let brokenTotal = 0;
  const units = {};
  const sun = daylight(state.day);
  const windNoise = 0.45 + 0.55 * noise(Math.floor(state.day * 3) + state.market.phase);

  for (const { x, y, tile } of tiles) {
    const b = BUILDINGS_BY_ID[tile.b];
    if (!b) continue;
    counts[b.id] = (counts[b.id] || 0) + 1;
    counts['cat_' + b.cat] = (counts['cat_' + b.cat] || 0) + 1;
    if (b.powerCap) counts.anyPdu = (counts.anyPdu || 0) + 1;
    if (b.coolCap) counts.anyCooling = (counts.anyCooling || 0) + 1;
    if (b.net) counts.anySwitch = (counts.anySwitch || 0) + 1;
    if (b.supplyWater) counts.anyWater = (counts.anyWater || 0) + 1;
    if (b.upkeep) upkeep += b.upkeep;
    if (b.draw) miscDraw += b.draw * (b.cat === 'cooling' ? mods.coolDrawMult : 1);

    if (b.cat === 'compute') {
      counts.rackAll = (counts.rackAll || 0) + 1;
      const cap = rackCapacity(b, mods);
      let compute = 0, power = 0, heat = 0, net = 0, used = 0, broken = 0, down = 0, worst = 1;
      for (const g of tile.units || []) {
        const hw = HARDWARE_BY_ID[g.t];
        if (!hw) continue;
        used += g.n;
        broken += g.broken;
        worst = Math.min(worst, g.cond);
        // Below half condition a growing slice of the group is simply down.
        const degraded = Math.round(g.n * clamp((0.45 - g.cond) * 2, 0, 0.9));
        const live = Math.max(0, g.n - g.broken - degraded);
        down += g.broken + degraded;
        units[g.t] = (units[g.t] || 0) + g.n;
        const health = 0.7 + 0.3 * g.cond;
        compute += hw.compute * live * mods.computeMult * health;
        power += hw.power * live * mods.powerMult;
        heat += hw.heat * live * mods.heatMult;
        net += hw.net * live;
      }
      unitsTotal += used;
      brokenTotal += down;
      freeSlots += Math.max(0, cap - used);
      heat *= 1 - (b.coolSelf || 0);
      racks.push({ x, y, tile, b, cap, used, broken, down, cond: worst, compute, power, heat, net });
    } else if (b.cat === 'cooling') {
      coolers.push({ x, y, tile, b, cap: b.coolCap * mods.coolMult, radius: b.radius });
    } else if (b.powerCap) {
      pdus.push({ x, y, cap: b.powerCap, radius: b.radius });
    }

    if (b.supplyKW) {
      let out = b.supplyKW;
      if (b.solar) out *= sun;
      if (b.wind) out *= windNoise;
      ownSupply += out;
      if (!b.solar && !b.wind) firmOwn += b.supplyKW;
      if (b.fuel) fuelCost += out * b.fuel * mods.fuelMult * ENERGY_RATE;
      if (b.heatOut) genHeat += b.heatOut * (out / b.supplyKW);
    }
    if (b.supplyWater) {
      waterSupply += b.supplyWater;
      waterCost += b.supplyWater * (b.waterCost || 0);
    }
    if (b.net) netCap += b.net;
    if (b.staff) staffCap += b.staff;
    if (b.repair) repairBoost += b.repair;
    if (b.uptime) uptimeBoost += b.uptime;
    if (b.research) researchFlat += b.research;
    if (b.contract) boardBonus += b.contract;
    if (b.security) security += b.security;
    if (b.ride) counts.rideSeconds = (counts.rideSeconds || 0) + b.ride;
  }

  // --- pass A: how much power each rack can actually be handed locally.
  for (const r of racks) r.powerGot = 0;
  for (const p of pdus) {
    let demand = 0;
    const covered = [];
    for (const r of racks) {
      if (chebyshev(p.x, p.y, r.x, r.y) <= p.radius) { covered.push(r); demand += r.power; }
    }
    if (demand <= 0) continue;
    const share = Math.min(1, p.cap / demand);
    for (const r of covered) r.powerGot += r.power * share;
  }
  for (const r of racks) r.pduFactor = r.power > 0 ? clamp(r.powerGot / r.power, 0, 1) : (r.used > 0 ? 0 : 1);

  // --- pass B: site-wide electricity balance.
  const rackDraw = sum(racks, (r) => r.power * r.pduFactor);
  const coolDraw = sum(coolers, (c) => c.b.draw * mods.coolDrawMult);
  const demandKW = rackDraw + coolDraw + miscDraw;
  const gridSupply = state.gridPower * mods.powerSupplyMult;
  const supplyKW = gridSupply + ownSupply * mods.powerSupplyMult;
  const rawPowerFactor = demandKW > 0 ? clamp(supplyKW / demandKW, 0, 1) : 1;
  const ups = (counts.rideSeconds || 0) > 0 && state.upsCharge > 0.02 ? 1 : rawPowerFactor;
  const powerFactor = Math.max(rawPowerFactor, rawPowerFactor < 1 ? ups * 0.999 : 1);

  // --- water, sized against the heat cooling is being asked to remove.
  const heatLoad = sum(racks, (r) => r.heat * r.pduFactor * powerFactor) + genHeat * 0.15;
  const coolCapRaw = sum(coolers, (c) => c.cap * coolerAmbientBonus(c, state));
  const heatToRemove = Math.min(heatLoad, coolCapRaw);
  const waterDemand = sum(coolers, (c) => (c.b.water || 0) * c.cap * coolerAmbientBonus(c, state))
    * mods.waterMult * (coolCapRaw > 0 ? heatToRemove / coolCapRaw : 0);
  const waterAvail = waterSupply * mods.waterSupplyMult;
  const waterFactor = waterDemand > 0 ? clamp(waterAvail / waterDemand, 0, 1) : 1;
  // Without water a wet cooling plant is very nearly useless. It used to keep
  // 35% of its rating, which made water optional; it does not now.
  const waterEff = 0.08 + 0.92 * waterFactor;

  // --- pass C: cooling distribution, temperature, throttling.
  for (const r of racks) {
    r.load = r.pduFactor * powerFactor;
    r.liveHeat = r.heat * r.load;
    r.cooled = 0;
  }
  for (const c of coolers) {
    let demand = 0;
    const covered = [];
    for (const r of racks) {
      if (chebyshev(c.x, c.y, r.x, r.y) <= c.radius) { covered.push(r); demand += r.liveHeat; }
    }
    if (demand <= 0) continue;
    const capacity = c.cap * coolerAmbientBonus(c, state) * waterEff;
    const share = Math.min(1, capacity / demand);
    for (const r of covered) r.cooled += r.liveHeat * share;
  }

  const ambient = outsideTemp(state);
  let maxTemp = ambient, tempSum = 0, tempW = 0;
  for (const r of racks) {
    const cover = r.liveHeat > 0 ? clamp(r.cooled / r.liveHeat, 0, 1) : 1;
    r.cover = cover;
    r.temp = ambient + Math.pow(1 - cover, 1.15) * 58 + (genHeat > 0 ? 0.4 : 0);
    r.throttle = r.temp <= 30 ? 1 : clamp(1 - (r.temp - 30) / 30, 0.04, 1);
    if (r.used > 0) {
      maxTemp = Math.max(maxTemp, r.temp);
      tempSum += r.temp * r.used;
      tempW += r.used;
    }
  }

  // --- network.
  const netNeed = sum(racks, (r) => r.net * r.load);
  const netFactor = netNeed > 0 ? clamp(netCap / netNeed, 0.15, 1) : 1;

  // --- compute.
  let computeTotal = 0;
  for (const r of racks) {
    r.output = r.compute * r.load * r.throttle * netFactor;
    computeTotal += r.output;
  }

  const brokenFrac = unitsTotal > 0 ? brokenTotal / unitsTotal : 0;
  const baseUptime = clamp(0.965 + mods.uptimeBonus + uptimeBoost, 0, 0.9998);
  const uptime = clamp(baseUptime * (1 - brokenFrac * 0.75) * (0.35 + 0.65 * powerFactor), 0, 0.9999);

  const alloc = clamp(state.researchAlloc, 0, 0.6);
  const computeResearch = computeTotal * alloc;
  const computeSellable = computeTotal - computeResearch;

  // --- contracts.
  let contractDemand = 0;
  for (const c of state.contracts.active) contractDemand += c.demand;
  const deliverRatio = contractDemand > 0 ? clamp(computeSellable / contractDemand, 0, 1) : 1;
  let revenue = 0, contractResearch = 0;
  for (const c of state.contracts.active) {
    const t = TEMPLATES_BY_ID[c.tid];
    c.delivered = deliverRatio;
    c.instUptime = deliverRatio * uptime;
    if (c.effUptime === undefined) c.effUptime = c.instUptime;
    c.livePay = c.pay * mods.priceMult;
    revenue += c.livePay * deliverRatio * uptime;
    if (t && t.research) contractResearch += t.research * deliverRatio;
  }

  // --- research output.
  const engBonus = 1
    + 0.9 * state.staff.eng / (state.staff.eng + 15)
    + 0.9 * researchFlat / (researchFlat + 12);
  const rpPerSec = (0.075 * Math.pow(Math.max(0, computeResearch), 0.30) * engBonus
    + researchFlat / DAY_SECONDS + contractResearch / DAY_SECONDS) * mods.researchMult;

  // --- costs.
  const actualDraw = demandKW * powerFactor;
  const gridUsed = clamp(actualDraw - ownSupply * mods.powerSupplyMult, 0, gridSupply);
  const powerCost = gridUsed * state.market.power * mods.gridCostMult * ENERGY_RATE;
  const waterPrice = waterSupply > 0 ? waterCost / waterSupply : 0;
  const waterUsed = Math.min(waterDemand, waterAvail);
  const waterBill = waterUsed * waterPrice * mods.waterCostMult * WATER_RATE;
  const salaries = sum(Object.keys(state.staff), (k) => (state.staff[k] || 0) * (STAFF_BY_ID[k]?.salary || 0));
  const upkeepCost = (upkeep + salaries) * mods.upkeepMult / DAY_SECONDS;
  const penalties = sum(state.contracts.active, (c) => {
    const t = TEMPLATES_BY_ID[c.tid];
    if (!t) return 0;
    return c.effUptime < t.uptime ? (c.livePay || c.pay) * t.penalty * mods.penaltyMult : 0;
  });
  // Interest is a running cost like any other, so it shows up in the ledger
  // and in net income rather than silently eating the balance.
  const debt = state.bank?.debt || 0;
  const interestCost = debt * LOAN_RATE / DAY_SECONDS;
  // The limit follows what the site earns, so it has to be worked out here
  // rather than by calling creditLimit(), which wants a finished snapshot.
  const creditLine = Math.max(
    9_000 * Math.pow(2.8, state.facility),
    Math.max(0, revenue) * DAY_SECONDS * 10,
  ) * (1 + Math.min(1.5, (state.reputation || 0) / 90));
  const costs = powerCost + fuelCost + waterBill + upkeepCost + penalties + interestCost;

  // What is holding the site back right now, in plain words.
  let bottleneck = null;
  const worstCover = racks.length ? Math.min(...racks.map((r) => (r.used > 0 ? r.cover : 1))) : 1;
  const worstPdu = racks.length ? Math.min(...racks.map((r) => (r.used > 0 ? r.pduFactor : 1))) : 1;
  if (unitsTotal === 0) bottleneck = 'no servers installed';
  else if (rawPowerFactor < 0.98) bottleneck = 'not enough electricity';
  else if (worstPdu < 0.95) bottleneck = 'a rack has no power nearby';
  else if (netFactor < 0.98) bottleneck = 'not enough network';
  else if (waterFactor < 0.95) bottleneck = 'not enough water';
  else if (worstCover < 0.95 || maxTemp > 34) bottleneck = 'not enough cooling';
  else if (contractDemand < computeSellable * 0.8) bottleneck = 'compute going to waste';
  else if (freeSlots > unitsTotal * 0.25) bottleneck = 'empty space in your racks';
  else bottleneck = 'running clean';

  // A concrete to-do list. Only things the player can act on, worst first.
  const problems = [];
  if (state.money < 0) {
    problems.push({
      tone: 'bad', tab: 'site',
      text: `You are overdrawn by ${money(-state.money)}. Nothing can be bought until you are back `
        + 'above zero. Sell servers you cannot run and let staff go until the site earns more '
        + `than it spends — the ${Math.round(OVERDRAFT_RATE * 100)}% a day stops the moment it does.`,
    });
  } else if (debt > 0 && revenue < costs) {
    problems.push({
      tone: 'bad', tab: 'site',
      text: `You owe ${money(debt)} and the site is still losing money. `
        + `The debt grows ${Math.round(LOAN_RATE * 100)}% a day — open the Site tab.`,
    });
  } else if (revenue < costs && state.money > 0) {
    // The warning used to arrive only once you were already overdrawn, which
    // is after the window in which it is cheap to fix. A site can be quietly
    // losing money for ten minutes with everything green — no breakage, uptime
    // at 97% — because the electricity costs more than the compute is worth.
    // Say so while there is still money to act with, and name the cost, so the
    // answer is not a guessing game between five bills.
    const bleed = costs - revenue;
    const biggest = [
      ['electricity', powerCost], ['fuel', fuelCost], ['water', waterBill],
      ['upkeep and wages', upkeepCost], ['contract fines', penalties],
    ].sort((a, b) => b[1] - a[1])[0];
    problems.push({
      tone: 'warn', tab: 'site',
      text: `The site is losing ${money(bleed)} a second and the money runs out in `
        + `${fmtTime(state.money / bleed)}. Most of it is ${biggest[0]}.`,
    });
  }
  const noPower = racks.filter((r) => r.used > 0 && r.pduFactor < 0.95).length;
  const noCool = racks.filter((r) => r.used > 0 && r.cover < 0.95).length;
  if (rawPowerFactor < 0.98) {
    // Almost always the fix is a bigger utility connection, already available
    // and already affordable. Say that rather than leaving them to find it.
    const spareGrid = Math.max(0, fac.gridCap - state.gridPower);
    problems.push({
      tone: 'bad', tab: 'ops',
      text: `You need ${Math.ceil(demandKW - supplyKW)} kW more electricity — everything is running slow. `
        + (spareGrid > 0
          ? `The utility will sell you ${Math.round(spareGrid)} kW more on the Running tab.`
          : 'Your utility connection is maxed out: build generation, or move to a bigger site.'),
    });
  } else if (state.gridPower < fac.gridCap * 0.999 && supplyKW - demandKW < demandKW * 0.15
             && unitsTotal > 0) {
    // Not starved yet, but one more rack will do it, and the connection is
    // sitting there unbought.
    problems.push({
      tone: 'warn', tab: 'ops',
      text: `You are close to your electricity limit. The utility will sell you `
        + `${Math.round(fac.gridCap - state.gridPower)} kW more before you need it.`,
    });
  }
  if (noPower) {
    const worst = racks.filter((r) => r.used > 0).sort((a, b) => a.pduFactor - b.pduFactor)[0];
    problems.push({
      tone: 'bad', tab: 'build', cat: 'power', overlay: 'power',
      focus: worst && { x: worst.x, y: worst.y },
      text: `${noPower} rack${noPower > 1 ? 's have' : ' has'} no power point nearby.`,
    });
  }
  if (noCool) {
    const worst = racks.filter((r) => r.used > 0).sort((a, b) => a.cover - b.cover)[0];
    problems.push({
      tone: 'bad', tab: 'build', cat: 'cooling', overlay: 'cool',
      focus: worst && { x: worst.x, y: worst.y },
      text: `${noCool} rack${noCool > 1 ? 's need' : ' needs'} more cooling nearby.`,
    });
  }
  if (maxTemp > 40) {
    const worst = racks.filter((r) => r.used > 0).sort((a, b) => b.temp - a.temp)[0];
    problems.push({
      tone: 'bad', tab: 'build', cat: 'cooling', overlay: 'heat',
      focus: worst && { x: worst.x, y: worst.y },
      text: `Your hottest rack is ${maxTemp.toFixed(0)} °C. Over 40 °C the servers break quickly.`,
    });
  }
  if (waterFactor < 0.95) {
    problems.push({
      tone: 'bad', tab: 'build', cat: 'water',
      text: `Not enough water — your cooling is only working at ${Math.round(waterEff * 100)}%.`,
    });
  }
  if (brokenTotal > 0) {
    const perRack = repairRateOf(state, repairBoost, mods) / Math.max(1, racks.length);
    problems.push({
      tone: brokenTotal > unitsTotal * 0.05 ? 'bad' : 'warn',
      tab: 'ops',
      text: brokenTotal + ' broken server' + (brokenTotal > 1 ? 's' : '')
        + (state.staff.tech < 1 ? '. Hire a technician to get them fixed.'
          : '. Your technicians are falling behind — hire another.'),
    });
  }
  if (netFactor < 0.98) {
    problems.push({
      tone: 'warn', tab: 'build', cat: 'support',
      text: `Your network only reaches ${Math.round(netFactor * 100)}% of your servers. The rest sit idle.`,
    });
  }
  const freeCompute = computeSellable - contractDemand;
  const takeable = state.contracts.offers.filter((o) => o.demand <= freeCompute).length;
  if (takeable) {
    problems.push({
      tone: 'good', tab: 'deals',
      text: `${takeable} deal${takeable > 1 ? 's' : ''} you have the spare compute to take.`,
    });
  }
  if (contractDemand < computeSellable * 0.7 && computeSellable > 1) {
    problems.push({
      tone: 'warn', tab: 'deals',
      text: `You make ${fmtShort(computeSellable - contractDemand)} of compute nobody is paying for.`,
    });
  }
  if (freeSlots > 0 && unitsTotal > 0) {
    problems.push({
      tone: 'info', tab: 'racks',
      text: `${freeSlots} empty slot${freeSlots > 1 ? 's' : ''} in your racks. Put servers in them.`,
    });
  }
  const affordableRnD = RESEARCH.filter((r) => !state.research.done.includes(r.id)
    && r.req.every((q) => state.research.done.includes(q)) && state.rp >= r.cost).length;
  if (affordableRnD) {
    problems.push({
      tone: 'good', tab: 'upgrade',
      text: `You can afford ${affordableRnD} upgrade${affordableRnD > 1 ? 's' : ''} right now.`,
    });
  }
  if (state.facility >= 4) {
    const worth = Math.floor(Math.pow(Math.max(0, state.lifetimeEarnings) / 2.5e8, 0.40));
    if (worth >= 1) {
      problems.push({
        tone: 'good', tab: 'site',
        text: `You could sell the company for ${worth} legacy point${worth > 1 ? 's' : ''} and start again stronger.`,
      });
    }
  }
  const nextFac = FACILITIES[state.facility + 1];
  if (nextFac && state.money >= nextFac.cost && state.reputation >= (nextFac.rep || 0)) {
    problems.push({
      tone: 'good', tab: 'site',
      text: `You can afford to move into the ${nextFac.name}. More floor, more servers.`,
    });
  }

  return {
    state, mods, fac, racks, coolers, pdus, counts, units, unitsTotal, brokenTotal, bottleneck, problems,
    freeSlots, staffCap, staffTotal: sum(Object.keys(state.staff), (k) => state.staff[k] || 0),
    ownSupply, firmSupply: gridSupply + firmOwn * mods.powerSupplyMult,
    gridSupply, supplyKW, powerDraw: demandKW, actualDraw, gridUsed, powerFactor, rawPowerFactor,
    waterSupply: waterAvail, waterDemand, waterUsed, waterFactor,
    heatLoad, coolCap: coolCapRaw * waterEff, netCap, netNeed, netFactor,
    computeTotal, computeResearch, computeSellable, contractDemand, deliverRatio,
    uptime, baseUptime, maxTemp, avgTemp: tempW > 0 ? tempSum / tempW : ambient, ambient,
    revenue, costs, netIncome: revenue - costs,
    powerCost, fuelCost, waterBill, upkeepCost, penalties, interestCost,
    // Salaries are folded into upkeep for the maths, but the player needs to
    // see the wage bill on its own — it is the cost they can actually choose.
    salaries, salaryCost: salaries * mods.upkeepMult / DAY_SECONDS,
    machineUpkeep: upkeep * mods.upkeepMult / DAY_SECONDS,
    debt, creditLimit: creditLine, creditFree: Math.max(0, creditLine - debt),
    // Below zero you buy nothing. It is the plainest rule in the game and the
    // one the whole fail state hangs off.
    overdrawn: state.money < 0,
    overdraftCost: state.money < 0 ? -state.money * OVERDRAFT_RATE / DAY_SECONDS : 0,
    rpPerSec, freeCompute: computeSellable - contractDemand,
    boardSize: Math.max(3, Math.round(5 + mods.boardSize + boardBonus + Math.min(4, state.staff.sales / 2))),
    repairRate: (0.12 + state.staff.tech * 1.35) * repairBoost * mods.repairMult,
    rackCount: Math.max(1, racks.length),
    security: clamp(security, 0, 0.9), sun, sellPrice: state.market.compute,
  };
}

function repairRateOf(state, repairBoost, mods) {
  return (0.12 + state.staff.tech * 1.35) * repairBoost * mods.repairMult;
}

function coolerAmbientBonus(c, state) {
  if (!c.b.ambient) return 1;
  const t = outsideTemp(state);
  return clamp(1.6 - (t - 12) * 0.045, 0.55, 1.6);
}

// ------------------------------------------------------------------ ticking

export function tick(state, dt, d, hooks) {
  const days = dt / DAY_SECONDS;
  state.day += days;
  state.playtime += dt;

  // Market drift.
  const stab = d.mods.priceStability;
  const phase = state.market.phase;
  const dayF = state.day % 1;
  const nightDiscount = 1 - 0.28 * Math.max(0, Math.cos((dayF - 0.5) * Math.PI * 2));
  const swing = 1 + (0.5 * Math.sin(state.day * 1.7 + phase) + 0.3 * Math.sin(state.day * 0.41 + phase * 2)) * stab;
  state.market.power = clamp(0.16 * swing * nightDiscount, 0.03, 1.4);
  state.market.compute = clamp(3.36 * (1 + 0.28 * Math.sin(state.day * 0.63 + phase * 3) * stab), 1.2, 9);

  // Money. Income lands, the bank takes its cut, and whatever is left is your
  // balance — which can go below zero. An overdrawn site buys nothing and is
  // charged for the privilege until it is back in the black.
  const bank = state.bank;
  state.money += d.netIncome * dt;
  if (d.revenue > 0) state.lifetimeEarnings += d.revenue * dt;

  // What the site has taken, in total, for the closing statement. Kept as
  // running totals rather than worked out at the end from a snapshot: a site
  // that ran hot for a hundred days and was then half sold off would otherwise
  // account for almost none of what it actually drank.
  state.stats.waterTaken = (state.stats.waterTaken || 0) + d.waterUsed * dt;
  state.stats.powerDrawn = (state.stats.powerDrawn || 0) + d.actualDraw * (dt / 3600);

  if (bank) {
    // Interest on a loan you chose to take, capped so it can never compound
    // past the credit line. Without that ceiling, coming back to an idle site
    // after a couple of hours — a hundred game days, and more with offline
    // research — would turn a small loan into a number no amount of selling
    // could clear.
    const ceiling = creditLimit(state, d);
    if (bank.debt > 0) {
      const interest = bank.debt * LOAN_RATE * days;
      const charged = Math.max(0, Math.min(interest, ceiling - bank.debt));
      bank.debt += charged;
      bank.interestPaid += charged;
    }

    // A share of what you actually make goes back to the bank before it is
    // yours to spend, so a loan clears itself if the site is earning.
    if (bank.debt > 0 && d.netIncome > 0 && state.money > 0) {
      const pay = Math.min(bank.debt, d.netIncome * REPAY_SHARE * dt, state.money);
      if (pay > 0) { state.money -= pay; bank.debt -= pay; }
      if (bank.debt < 0.01) {
        bank.debt = 0;
        hooks?.log('Loan cleared. The site pays for itself again.', 'good');
      }
    }

    // Overdrawn. The balance is allowed to sink — that is the fail state, and
    // it has to be visible as a number going the wrong way rather than a
    // counter pinned at zero. It costs more than a loan does, and your name
    // suffers for as long as it lasts.
    if (state.money < 0) {
// Interest on the hole, but only while the site is still losing money.
      //
      // Charged unconditionally it is a death sentence rather than a pressure:
      // at 10% a day on a $44,000 hole the interest alone was $4,400 a day,
      // more than a small site can earn, so a player who did exactly what the
      // game told them — sell what you cannot run, let staff go — still sank
      // to the floor and could never buy anything again. The way out has to
      // work. Get operations back above water and the bank stops charging;
      // the balance then climbs on its own.
      //
      // It is also bounded, because compounding on an unbounded hole runs to
      // billions and puts the number beyond anything a person could answer.
      if (d.netIncome < 0 && state.money > OVERDRAFT_FLOOR) {
        state.money = Math.max(OVERDRAFT_FLOOR, state.money + state.money * OVERDRAFT_RATE * days);
      }
      bank.overdraftDays = (bank.overdraftDays || 0) + days;
      state.reputation = Math.max(0, state.reputation - 2 * days);
      if (state.day - (state.lastOverdraft || -99) > 5) {
        state.lastOverdraft = state.day;
        bank.overdrafts++;
        hooks?.log(`Overdrawn by ${money(-state.money)}. Nothing can be bought until you are back `
          + `above zero — sell what you cannot run.`, 'bad');
      }

      // Deep enough in and the bank offers a way out, on terms designed to
      // hurt. The offer stands until it is answered, so it is only made once
      // per threshold.
      if (!state.rescue) {
        const level = bank.rescueLevel || 0;
        // The three lending offers land exactly on their thresholds. Once the
        // bank is done lending the threshold stops moving, so that last
        // offer — restart, or keep trying — is spaced out rather than
        // re-asked every tick.
        const spaced = canBorrowOut(state)
          || state.day - (state.lastRescueOffer || -99) > 15;
        if (spaced && -state.money >= rescueThreshold(level)) {
          state.lastRescueOffer = state.day;
          state.rescue = { level, short: -state.money, day: state.day, net: d.netIncome };
          hooks?.onRescue?.(state.rescue);
        }
      }
    } else if (state.money > 0) {
      state.lastOverdraft = -99;
    }
  }

  // Research.
  const rp = d.rpPerSec * dt;
  state.rp += rp;
  state.rpLifetime += rp;

  // UPS charge.
  const ride = d.counts.rideSeconds || 0;
  if (ride > 0) {
    if (d.rawPowerFactor < 0.999) state.upsCharge = clamp(state.upsCharge - dt / ride, 0, 1);
    else state.upsCharge = clamp(state.upsCharge + dt / (ride * 6), 0, 1);
  } else state.upsCharge = 1;

  // Wear, failure and repair.
  wearAndRepair(state, d, days, hooks);

  // Uptime bookkeeping.
  state.uptimeAvg = state.uptimeAvg * 0.995 + d.uptime * 0.005;
  if (d.uptime >= 0.999) state.stats.nineDays += days;
  if (d.waterFactor < 0.95) state.stats.dryDays += days;
  if (d.rawPowerFactor < 0.98) state.stats.brownDays += days;
  state.stats.peakCompute = Math.max(state.stats.peakCompute, d.computeTotal);
  state.stats.peakIncome = Math.max(state.stats.peakIncome, d.netIncome);

  // A rolling picture of the run, sampled every couple of game days.
  const h = state.history;
  h.at = (h.at || 0) + days;
  if (h.at >= 0.5) {
    h.at = 0;
    h.income.push(d.netIncome);
    h.compute.push(d.computeTotal);
    h.temp.push(d.maxTemp);
    for (const key of ['income', 'compute', 'temp']) {
      if (h[key].length > 240) h[key].shift();
    }
  }

  tickTown(state, d, hooks);
  contractsTick(state, d, days, hooks);
  eventsTick(state, d, dt, hooks);
  checkObjectives(state, d, hooks);
}

function wearAndRepair(state, d, days, hooks) {
  // Repair effort is shared out over the racks, so a bigger site needs more
  // technicians, workshops and automation to stand still.
  const perRack = (d.repairRate / d.rackCount) * days;
  for (const r of d.racks) {
    const tempStress = Math.pow(2, Math.max(0, r.temp - 26) / 13);
    const groups = r.tile.units || [];
    if (!groups.length) continue;
    const share = perRack / groups.length;
    for (const g of groups) {
      const hw = HARDWARE_BY_ID[g.t];
      if (!hw) continue;
      g.cond = clamp(g.cond - hw.wear * d.mods.wearMult * tempStress * days * 0.006, 0, 1);

      // Outright failures are rare and mostly a heat problem.
      const risk = clamp((0.75 - g.cond), 0, 1) * 0.03 * tempStress * days;
      if (risk > 0) {
        const live = g.n - g.broken;
        const expected = live * risk;
        let dead = Math.floor(expected);
        if (Math.random() < expected - dead) dead++;
        dead = Math.min(live, dead);
        if (dead > 0) { g.broken += dead; state.stats.failed += dead; }
      }

      // Swap the dead boards out first, then bring condition back up.
      let effort = share;
      if (g.broken > 0 && effort > 0) {
        const fixable = Math.min(g.broken, effort * 8);
        let fixed = Math.floor(fixable);
        if (Math.random() < fixable - fixed) fixed++;
        fixed = Math.min(g.broken, fixed);
        g.broken -= fixed;
        state.stats.repaired += fixed;
        effort -= fixed / 8;
      }
      if (effort > 0 && g.cond < 1) {
        g.cond = clamp(g.cond + effort * 0.5, 0, 1);
      }
    }
  }
}

// ------------------------------------------------------------------ contracts

export function makeOffer(state, d, seedIndex) {
  const pool = CONTRACT_TEMPLATES.filter((t) => t.minRep <= state.reputation);
  if (!pool.length) return null;
  // Keep the board varied: only repeat a client when there is nothing else.
  const onBoard = new Set(state.contracts.offers.map((o) => o.tid));
  const fresh = pool.filter((x) => !onBoard.has(x.id));
  const t = weightedPick(fresh.length ? fresh : pool, (x) => 1 + x.minRep / 40);
  const committed = sum(state.contracts.active, (c) => c.demand);
  const free = Math.max(4, d.computeSellable - committed);
  // A mix of sizes: without a slot limit, the useful board is one where a
  // small job can always top up whatever headroom you have left.
  const r = Math.random();
  const band = r < 0.34 ? 0.3 + Math.random() * 0.2
    : r < 0.82 ? 0.7 + Math.random() * 0.5
    : 1.3 + Math.random() * 0.4;
  const scale = band;
  const demand = Math.max(2, free * t.size * scale * d.mods.offerSize);
  const repBonus = 1 + Math.min(1.5, state.reputation / 220);
  const pay = demand * state.market.compute * t.pay * repBonus;
  return {
    cid: state.contracts.seq++,
    tid: t.id,
    name: decorate(t, Math.random()),
    client: pickClient(t),
    demand,
    net: (demand / 1000) * t.net,
    pay,
    days: Math.round(t.days * (0.8 + Math.random() * 0.5)),
    uptimeReq: t.uptime,
    penalty: t.penalty,
    seed: seedIndex,
  };
}

/**
 * Why a contract is not delivering everything it promised.
 *
 * Delivery is a product of four things, and the panel only ever showed the
 * result — you could watch a deal sit at 71% with no way to find out which of
 * them was costing you what. Each factor is quantified against the same maths
 * that produced the figure:
 *
 *   instUptime = deliverRatio x baseUptime x (1 - brokenFrac * 0.75)
 *                             x (0.35 + 0.65 * powerFactor)
 *
 * so the share each one is taking is exactly what it multiplies away. Ranked
 * by that, so the first line is the one worth acting on.
 */
export function deliveryReport(state, d) {
  const reasons = [];
  const pc = (x) => (x * 100).toFixed(x < 0.1 ? 1 : 0) + '%';

  const oversold = 1 - clamp(d.deliverRatio ?? 1, 0, 1);
  if (oversold > 0.001) {
    const short = Math.max(0, (d.contractDemand || 0) - (d.computeSellable || 0));
    const rnd = d.computeResearch || 0;
    reasons.push({
      lost: oversold,
      what: `Oversold by ${fmtShort(short)} compute. You have promised `
        + `${fmtShort(d.contractDemand || 0)} and can sell ${fmtShort(d.computeSellable || 0)}.`,
      fix: rnd > short * 0.5
        ? `Build more servers, turn the R&D share down — it is holding back ${fmtShort(rnd)} `
          + 'compute — or walk away from a deal.'
        : 'Build more servers, or walk away from a deal you cannot cover.',
    });
  }

  const brokenFrac = d.unitsTotal > 0 ? (d.brokenTotal || 0) / d.unitsTotal : 0;
  if (brokenFrac > 0.001) {
    reasons.push({
      lost: brokenFrac * 0.75,
      what: `${fmtShort(d.brokenTotal)} of ${fmtShort(d.unitsTotal)} `
        + `server${d.brokenTotal === 1 ? ' is' : 's are'} down.`,
      fix: (state.staff?.tech || 0) > 0
        ? `Your ${state.staff.tech} technician${state.staff.tech > 1 ? 's are' : ' is'} working `
          + `through them at ${fmtShort(d.repairRate || 0)} a day. More would be quicker.`
        : 'You have no technicians. Nothing gets repaired without one — hire on Utilities.',
    });
  }

  const powerLoss = 0.65 * (1 - clamp(d.powerFactor ?? 1, 0, 1));
  if (powerLoss > 0.001) {
    reasons.push({
      lost: powerLoss,
      what: `Power is meeting ${pc(d.powerFactor)} of what the floor is drawing.`,
      fix: 'Buy a bigger utility connection or build your own supply, on Utilities.',
    });
  }

  const base = d.baseUptime ?? 0.965;
  if (1 - base > 0.001) {
    reasons.push({
      lost: 1 - base,
      what: `Ordinary faults take ${pc(1 - base)} of the time whatever you do.`,
      fix: 'An operations centre and ops staff bring it down; some research does too.',
    });
  }

  reasons.sort((a, b) => b.lost - a.lost);
  return { delivering: d.uptime * (d.deliverRatio ?? 1), reasons };
}

export function signContract(state, d, offer, hooks) {
  // Compute is the only limit. If you cannot produce it, you cannot promise it.
  const free = d.computeSellable - sum(state.contracts.active, (c) => c.demand);
  if (offer.demand > free) {
    return `You would need ${Math.ceil(offer.demand - free)} more compute to take this on.`;
  }
  state.contracts.offers = state.contracts.offers.filter((o) => o.cid !== offer.cid);
  const c = { ...offer, startDay: state.day, endDay: state.day + offer.days, breached: false, delivered: 1, effUptime: 1 };
  state.contracts.active.push(c);
  hooks?.log(`Signed ${c.name} with ${c.client} — ${c.days} days.`, 'good', QUIET);
  return null;
}

/**
 * Walk away from a contract you cannot keep.
 *
 * Until now the active list was only ever added to. A site that promised more
 * than it could deliver was fined every second for the rest of the term, and
 * because being overdrawn stops you buying anything, it could not buy the
 * capacity that would end the fines. The bot found this the hard way: ten
 * contracts at ten minutes in, fines of $87.50 a second against $14.91 of
 * revenue, uptime at 97% and nothing broken. There was no move that helped.
 *
 * The price is reputation, never cash. A way out of a hole that puts you
 * further into it is not a way out — and reputation is what welching on a deal
 * actually costs you: it gates the next site, and it is slow to earn back.
 */
export function breakContract(state, id, hooks) {
  const i = state.contracts.active.findIndex((c) => c.cid === id);
  if (i < 0) return 'That contract is not running.';
  const c = state.contracts.active[i];
  const t = TEMPLATES_BY_ID[c.tid];
  const left = Math.max(0, (c.endDay ?? state.day) - state.day);
  // Bigger promises and longer left to run cost more to walk away from.
  const cost = Math.max(3, Math.round(
    (state.reputation || 0) * 0.10 + left * 0.6 + (t ? t.penalty * 8 : 2)));
  state.contracts.active.splice(i, 1);
  state.reputation = Math.max(0, (state.reputation || 0) - cost);
  state.stats.broken = (state.stats.broken || 0) + 1;
  hooks?.log(`Walked away from ${c.name}. ${c.client} will tell people: -${cost} reputation.`, 'bad');
  return null;
}

function contractsTick(state, d, days, hooks) {
  // Penalties and breach tracking. A brief dip is survivable; a bad day is not.
  let breaching = 0;
  for (const c of state.contracts.active) {
    const k = Math.min(1, days * 1.6);
    c.effUptime = c.effUptime * (1 - k) + (c.instUptime ?? c.effUptime) * k;
    if (c.effUptime < c.uptimeReq) {
      breaching++;
      if (!c.breached) {
        c.breached = true;
        state.stats.breaches++;
        hooks?.log(`You are under-delivering on ${c.name}. ${c.client} is not pleased.`, 'bad', QUIET);
      }
    } else if (c.breached && c.effUptime > c.uptimeReq + 0.01) {
      c.breached = false;
    }
  }
  // Your name takes one hit for the site's performance, however many customers
  // are on the phone about it. The per-contract fines are punishment enough.
  if (breaching) {
    const share = breaching / Math.max(1, state.contracts.active.length);
    const floor = (state.repPeak || 0) * 0.6;
    state.reputation = Math.max(floor, state.reputation - days * 0.9 * share);
  }

  // Completion.
  const finished = state.contracts.active.filter((c) => state.day >= c.endDay);
  for (const c of finished) {
    const t = TEMPLATES_BY_ID[c.tid];
    const clean = !c.breached && c.effUptime >= c.uptimeReq;
    const gain = (2.5 + (t?.minRep || 0) * 0.09) * (clean ? 1 : 0.25) * Math.sqrt(d.mods.repMult);
    state.reputation += gain;
    state.repPeak = Math.max(state.repPeak || 0, state.reputation);
    state.stats.contractsDone++;
    if (clean) {
      const bonus = (c.livePay || c.pay) * DAY_SECONDS * 1.5;
      state.money += bonus;
      state.lifetimeEarnings += bonus;
      hooks?.log(`${c.name} completed cleanly. +${Math.round(gain * 10) / 10} reputation and a completion bonus.`, 'good', QUIET);
    } else {
      hooks?.log(`${c.name} ended with the SLA broken. Reputation barely moved.`, 'bad', QUIET);
    }
  }
  if (finished.length) {
    state.contracts.active = state.contracts.active.filter((c) => state.day < c.endDay);
  }

  // The board is a stream rather than a periodic dump: offers arrive one at a
  // time, sit there for a few days, and go stale on their own. Something is
  // always about to appear, and nothing ever vanishes in a batch.
  const before = state.contracts.offers.length;
  state.contracts.offers = state.contracts.offers.filter((o) => state.day < o.expires);
  if (state.contracts.offers.length < before) hooks?.onBoard?.();

  const cap = d.boardSize;
  const post = () => {
    const o = makeOffer(state, d, state.contracts.seq);
    if (!o) return false;
    o.posted = state.day;
    o.expires = state.day + 5 + Math.random() * 6;
    state.contracts.offers.push(o);
    return true;
  };

  // Seed the board the moment a run starts, so step five of the guide always
  // has something signable waiting.
  if (!state.contracts.offers.length && !state.contracts.active.length) {
    for (let i = 0; i < 3; i++) post();
    state.contracts.nextOffer = 1.5;
  }

  state.contracts.nextOffer -= days;
  if (state.contracts.nextOffer <= 0 && state.contracts.offers.length < cap) {
    post();
    // Deal flow follows demand: an empty board or a free slot pulls the next
    // offer in sooner.
    const keen = state.contracts.offers.length < 3 || d.freeCompute > d.computeSellable * 0.2;
    state.contracts.nextOffer = (keen ? 0.7 : 1.9) + Math.random() * 1.2;
  }

  // Optional hands-off signing, for when placing servers is the fun part.
  //
  // It takes the best-paying offer that fits, and the best-paying offers are
  // the ones demanding 99.5% uptime — which is how a hands-off site ends up
  // committed to promises it cannot keep the first time the weather turns.
  // The cap is the answer: leave it at 100% to take anything, or pull it down
  // and let the punishing deals go past.
  if (state.settings.autoSign) {
    const cap = state.settings.autoSignUptime ?? 1;
    let free = d.computeSellable - sum(state.contracts.active, (c) => c.demand);
    for (let guard = 0; guard < 8; guard++) {
      const fits = state.contracts.offers
        .filter((o) => o.demand <= free && (o.uptimeReq ?? 1) <= cap + 1e-6)
        .sort((a, b) => b.pay - a.pay);
      if (!fits.length) break;
      free -= fits[0].demand;
      signContract(state, d, fits[0], hooks);
    }
  }
}

// -------------------------------------------------------------------- events

function eventsTick(state, d, dt, hooks) {
  state.events.active = state.events.active.filter((e) => state.day < e.until);

  state.events.next -= dt;
  if (state.events.next > 0 || state.events.pending) return;
  state.events.next = 75 + Math.random() * 95;

  // A tier gate is not enough on its own: an event has to make sense for the
  // site it lands on. Nobody poaches technicians you have not hired, and a UPS
  // cannot catch fire before you own one.
  const pool = EVENTS.filter((e) => {
    if ((e.minTier || 0) > state.facility) return false;
    if (!e.when) return true;
    try { return !!e.when(state, d); } catch (err) { return false; }
  });
  if (!pool.length) return;
  const ev = weightedPick(pool, (e) => e.weight);

  if (ev.choice) {
    state.events.pending = { id: ev.id, at: state.day };
    hooks?.onDecision?.(ev);
    return;
  }
  fireEvent(state, ev, hooks);
}

export function fireEvent(state, ev, hooks) {
  state.events.active.push({ id: ev.id, until: state.day + (ev.days || 2), started: state.day });
  // The event strip above the floor already shows this, with a countdown.
  hooks?.log(`${ev.name}: ${ev.text}`, ev.tone === 'good' ? 'good' : ev.tone === 'bad' ? 'bad' : 'info', QUIET);
}

/** Resolve a decision event. Returns a description of what happened. */
export function resolveDecision(state, d, effect, hooks) {
  const salaries = d.salaries;
  switch (effect) {
    case 'poach_pay': {
      const cost = salaries * 6;
      state.money = Math.max(0, state.money - cost);
      return 'You matched the offer. Nobody left, and payroll took the hit.';
    }
    case 'poach_lose':
      state.staff.tech = Math.max(0, state.staff.tech - 2);
      return 'Two technicians handed in their badges on the way out.';
    case 'ransom_pay': {
      const cost = state.money * 0.04 * (1 - d.security);
      state.money -= cost;
      return 'You paid. The keys arrived. Nobody outside the room knows.';
    }
    case 'ransom_rebuild':
      state.events.active.push({ id: 'ransom', label: 'Rebuilding from backup', tone: 'bad', started: state.day, until: state.day + 2, mods: { computeMult: 0.45 } });
      state.reputation = Math.max(0, state.reputation - 6 * (1 - d.security));
      return 'Two days of restoring from cold backup, and an awkward customer call.';
    case 'vc_take': {
      const cash = Math.max(50_000, d.netIncome * DAY_SECONDS * 30);
      state.money += cash;
      state.events.active.push({ id: 'vc', label: 'Investor revenue share', tone: 'neutral', started: state.day, until: state.day + 20, mods: { priceMult: 0.88 } });
      return 'The money landed this morning. Revenue share starts immediately.';
    }
    case 'vc_decline':
      state.reputation += 8;
      return 'You kept the cap table clean. The industry noticed.';
    case 'town_buy': {
      const cost = Math.max(120_000, d.netIncome * DAY_SECONDS * 8);
      if (state.money < cost) return 'You cannot cover the purchase. The families stay put.';
      state.money -= cost;
      state.expand.h = (state.expand.h || 0) + 2;
      state.reputation = Math.max(0, state.reputation - 6);
      return 'The row came down over a weekend. Two more rows of floor, and nobody left to object.';
    }
    case 'town_leave':
      state.reputation += 10;
      return 'You let them stay. It cost you nothing but the floor you did not take.';
    case 'recall_return': {
      let removed = 0, refund = 0;
      for (const r of d.racks) {
        for (const g of r.tile.units || []) {
          const take = Math.floor(g.n * 0.12);
          if (take > 0) {
            g.n -= take;
            g.broken = Math.min(g.broken, g.n);
            removed += take;
            refund += (HARDWARE_BY_ID[g.t]?.cost || 0) * take * 0.7;
          }
        }
        r.tile.units = (r.tile.units || []).filter((g) => g.n > 0);
      }
      state.money += refund;
      return `Returned ${removed} units for a partial refund.`;
    }
    case 'recall_keep':
      state.events.active.push({ id: 'recall', label: 'Recalled boards in service', tone: 'bad', started: state.day, until: state.day + 8, mods: { wearMult: 2 } });
      return 'You kept them in production. Expect them to fail early.';
    case 'anchor_sign': {
      const cash = Math.max(200_000, d.netIncome * DAY_SECONDS * 90);
      state.money += cash;
      state.events.active.push({ id: 'anchor', label: 'Anchor tenant discount', tone: 'neutral', started: state.day, until: state.day + 30, mods: { priceMult: 0.82 } });
      return 'A year of capacity, sold up front, at their price.';
    }
    case 'anchor_decline':
      state.reputation += 14;
      return 'You held the line on price. Word gets around.';
    case 'grant_take':
      state.events.active.push({ id: 'grant', label: 'Research grant running', tone: 'good', started: state.day, until: state.day + 10, mods: { researchMult: 2.6, priceMult: 0.9 } });
      return 'Their benchmark now runs on your floor. Research is flying.';
    case 'grant_decline':
      return 'You passed. The paperwork alone would have cost a week.';
    case 'fire_shutdown':
      state.events.active.push({ id: 'fireoff', label: 'Emergency shutdown', tone: 'bad', until: state.day + 1.5, mods: { computeMult: 0.05, powerSupplyMult: 0.3 } });
      return 'Everything down, everything safe. It will be a long day and a half.';
    case 'fire_isolate': {
      let hurt = 0;
      for (const r of d.racks) {
        for (const g of r.tile.units || []) {
          const take = Math.min(g.n - g.broken, Math.ceil(g.n * 0.08));
          if (take > 0) { g.broken += take; hurt += take; }
        }
      }
      state.stats.failed += hurt;
      return `Stayed online. ${hurt} units did not survive the isolation.`;
    }
    default:
      return 'Nothing happened.';
  }
}

// ------------------------------------------------------------------ the bank

// Interest is charged per game day on whatever is outstanding. It is meant to
// be felt: a loan taken to buy a rack should be paid off by that rack inside a
// few days, and sitting on the debt should hurt.
export const LOAN_RATE = 0.05;        // per day, on a loan you chose to take
export const OVERDRAFT_RATE = 0.03;   // per day, on a balance below zero
export const REPAY_SHARE = 0.4;       // of positive income, while you owe

// How far under you have to be before the bank offers a way out. There are
// three, and only three. Letting them go on doubling forever made the terms
// compound: every rescue added debt, the interest on it sank the site faster,
// and the next rescue was bigger — a loop that ran to infinity. After the
// third the bank is done lending and the only way out is to start again.
export const RESCUE_STEPS = [100_000, 500_000, 1_000_000];
export const OVERDRAFT_FLOOR = -4_000_000;

export function rescueThreshold(level) {
  return RESCUE_STEPS[Math.min(level, RESCUE_STEPS.length - 1)];
}

/** Whether the bank will still lend, or whether it is restart-or-nothing. */
export function canBorrowOut(state) {
  return (state.bank?.rescueLevel || 0) < RESCUE_STEPS.length;
}

/**
 * What the bank wants for clearing the overdraft. Deliberately awful, and
 * worse every time: you owe multiples of the hole, your name takes a beating,
 * and your contracts pay less for a month while the terms run.
 */
export function rescueTerms(state, d) {
  const level = state.rescue?.level ?? (state.bank?.rescueLevel || 0);
  const short = state.rescue?.short ?? 0;
  const multiple = 2.5 + level * 0.75;
  // Clearing the hole alone would be useless: a site losing money is back
  // under within a tick, and you still could not buy the thing that fixes it.
  // So the deal includes a working float — but tied to the hole, never to the
  // size of the loss. Scaling it with losses made repeated rescues a money
  // printer: run at a huge deficit, take the terms, and be handed three days
  // of those costs in cash, over and over.
  const float = short * 0.2;
  return {
    level,
    short,
    float,
    owed: (short + float) * multiple,
    multiple,
    repCost: Math.min(state.reputation, 20 + level * 15),
    payCut: Math.min(0.45, 0.2 + level * 0.08),
    days: 30 + level * 10,
  };
}

/** Take the bank's offer: back to zero, and paying for it for a long time. */
export function takeRescue(state, d, hooks) {
  if (!state.rescue) return 'There is nothing to settle.';
  if (!canBorrowOut(state)) {
    return 'The bank has lent you all it is going to. There is nothing left but to start again.';
  }
  const bank = state.bank;
  // Settle against the balance as it stands now, not as it stood when the
  // offer was made, so accepting always leaves you at exactly zero.
  state.rescue.short = Math.max(state.rescue.short, -state.money);
  const t = rescueTerms(state, d);
  state.money = t.float;
  bank.debt += t.owed;
  bank.borrowed += t.short + t.float;
  bank.rescues = (bank.rescues || 0) + 1;
  bank.rescueLevel = t.level + 1;
  state.reputation = Math.max(0, state.reputation - t.repCost);
  // Carried as a running event so it shows in the event strip and expires on
  // its own, like every other temporary modifier.
  state.events.active.push({
    id: 'rescue_terms_' + bank.rescues,
    label: 'Rescue terms',
    tone: 'bad',
    until: state.day + t.days,
    started: state.day,
    mods: { priceMult: 1 - t.payCut, repMult: 0.5 },
  });
  state.rescue = null;
  hooks?.log(`The bank cleared ${money(t.short)}, left you ${money(t.float)} to work with, and `
    + `wants ${money(t.owed)} back. Contracts pay ${Math.round(t.payCut * 100)}% less `
    + `for ${t.days} days.`, 'bad');
  return null;
}

/** Turn the offer down and keep sinking. It will be made again if it gets worse. */
export function declineRescue(state) {
  if (!state.rescue) return;
  state.bank.rescueLevel = (state.rescue.level || 0) + 1;
  state.rescue = null;
}

/**
 * How much the bank will lend in total. Small at the start — a few thousand
 * against a cupboard — and widening as the site starts earning, so a loan is
 * always a nudge rather than a way to skip a tier.
 */
export function creditLimit(state, d) {
  if (d && typeof d.creditLimit === 'number') return d.creditLimit;
  const base = 9_000 * Math.pow(2.8, state.facility);
  const againstEarnings = Math.max(0, d?.revenue || 0) * DAY_SECONDS * 10;
  const standing = 1 + Math.min(1.5, (state.reputation || 0) / 90);
  return Math.max(base, againstEarnings) * standing;
}

/** What is left to draw right now. */
export function creditFree(state, d) {
  return Math.max(0, creditLimit(state, d) - (state.bank?.debt || 0));
}

/** Take a loan. The money is yours immediately; so is the interest. */
export function borrow(state, d, amount, hooks) {
  const bank = state.bank;
  if (!bank) return 'No bank.';
  const free = creditFree(state, d);
  if (free < 1) return 'The bank will not lend you any more until you have paid some back.';
  const take = Math.min(amount, free);
  if (!(take > 0)) return 'Nothing to borrow.';
  bank.debt += take;
  bank.borrowed += take;
  state.money += take;
  hooks?.log(`Borrowed ${money(take)}. Interest runs at 5% a day until it is paid off.`, 'warn');
  return null;
}

/** Pay off what you can, from cash. */
export function repay(state, amount, hooks) {
  const bank = state.bank;
  if (!bank || bank.debt <= 0) return 'You do not owe anything.';
  const pay = Math.min(amount, bank.debt, state.money);
  if (!(pay > 0)) return 'No cash to pay with.';
  state.money -= pay;
  bank.debt -= pay;
  if (bank.debt < 0.01) bank.debt = 0;
  hooks?.log(bank.debt > 0 ? `Paid ${money(pay)} off the loan.` : 'Loan cleared.',
    bank.debt > 0 ? 'info' : 'good');
  return null;
}

// -------------------------------------------------------- objectives & badges

/**
 * What an objective actually pays. The numbers in the table are ceilings from
 * a time when they were the whole economy: taken literally they hand you
 * $815,000 by the thirteenth objective, which arrives in the first few minutes
 * and drowns out every contract you will ever sign.
 *
 * A reward is a nudge towards the next purchase, not the income. So it is the
 * smaller of what the table says and half a day of what the site currently
 * earns, floored at an amount that keeps the opening hour moving before there
 * is any revenue at all.
 */
export function objectiveReward(o, d, index) {
  const declared = o.reward?.money || 0;
  if (!declared) return 0;
  const halfDay = Math.max(0, d.revenue) * DAY_SECONDS * 0.5;
  const floor = 400 * Math.pow(1.3, index);
  return Math.min(declared, Math.max(floor, halfDay));
}

export function checkObjectives(state, d, hooks) {
  const total = RESEARCH.length;
  const met = (x) => { try { return !!x.check(d, total); } catch (err) { return false; } };
  // The chain runs in order, one at a time, because it doubles as the guide.
  // But it is a guide and not a gate: an objective naming one specific machine
  // can be overtaken — build a fusion tokamak without ever commissioning the
  // reactor below it and "Fission" can never be met — which used to strand
  // every objective after it. If anything further down the chain is already
  // true, the current one has been passed, so it lands too.
  const i = state.objectives.done.length;
  const o = OBJECTIVES[i];
  if (o) {
    const ok = met(o) || OBJECTIVES.slice(i + 1).some(met);
    if (ok) {
      state.objectives.done.push(o.id);
      const cash = objectiveReward(o, d, i);
      if (cash > 0) { state.money += cash; state.lifetimeEarnings += cash; }
      if (o.reward?.rp) state.rp += o.reward.rp;
      hooks?.log(`Objective complete — ${o.name}.`, 'good', QUIET);
      hooks?.onObjective?.(o);
    }
  }
  for (const a of ACHIEVEMENTS) {
    if (state.achievements.includes(a.id)) continue;
    let ok = false;
    try { ok = a.check(d, total, OBJECTIVES.length); } catch (err) { ok = false; }
    if (!ok) continue;
    state.achievements.push(a.id);
    hooks?.log(`Achievement unlocked — ${a.name}.`, 'good', QUIET);
    hooks?.onAchievement?.(a);
  }
}

// ------------------------------------------------------------------ prestige

/** Points this run would hand over if you sold the company right now. */
export function legacyGain(state) {
  const run = Math.max(0, state.lifetimeEarnings);
  return Math.floor(Math.pow(run / 2.5e8, 0.40));
}

export function canPrestige(state) {
  return state.facility >= 4 && legacyGain(state) >= 1;
}
