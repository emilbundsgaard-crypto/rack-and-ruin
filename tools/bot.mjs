// A crude but competent player bot, used to check pacing over a long run.
import { newGame, facilityOf, tileAt, key } from '../src/state.js';
import { derive, tick, signContract, resolveDecision, legacyGain } from '../src/sim.js';
import * as A from '../src/actions.js';
import { HARDWARE } from '../src/data/hardware.js';
import { BUILDINGS } from '../src/data/buildings.js';
import { RESEARCH, available } from '../src/data/research.js';
import { UPGRADES } from '../src/data/progression.js';
import { fmt, money, fmtTime } from '../src/util.js';

const quiet = { log: () => {}, onDecision: (ev) => { pending = ev; } };
let pending = null;

const s = newGame();
let d = derive(s);

const best = (list, pred) => list.filter(pred).slice(-1)[0];
const unlockedB = (cat) => BUILDINGS.filter((b) => b.cat === cat && (!b.req || s.research.done.includes(b.req)));

function freeTile(near) {
  const f = facilityOf(s);
  let bestT = null, bestD = Infinity;
  for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) {
    if (tileAt(s, x, y)) continue;
    const dist = near ? Math.max(Math.abs(x - near.x), Math.abs(y - near.y)) : (y * f.w + x) * 0.001;
    if (dist < bestD) { bestD = dist; bestT = { x, y }; }
  }
  return bestT;
}

/** Place next to whichever rack is worst off for this kind of machine. */
function put(id, worstBy) {
  let near = null;
  if (worstBy) {
    let score = Infinity;
    for (const r of d.racks) {
      const v = worstBy(r);
      if (v < score) { score = v; near = r; }
    }
  }
  const t = freeTile(near);
  if (!t) return false;
  return !A.place(s, d, t.x, t.y, id, quiet);
}

function step() {
  d = derive(s);
  const reserve = s.money * 0.15;
  const can = (c) => s.money - c > reserve;

  // Answer decision events immediately.
  if (pending) {
    resolveDecision(s, d, pending.options[0].effect, quiet);
    s.events.pending = null;
    pending = null;
  }

  // Research: cheapest available first.
  const rnd = RESEARCH.filter((r) => !s.research.done.includes(r.id) && available(r, s))
    .sort((a, b) => a.cost - b.cost)[0];
  if (rnd && s.rp >= rnd.cost) A.buyResearch(s, rnd.id, quiet);

  // Facility.
  const next = A.nextFacility(s);
  if (next && s.reputation >= (next.rep || 0) && s.money > next.cost * 1.25) {
    A.upgradeFacility(s, quiet);
    d = derive(s);
  }

  // Utility feed: buy grid first, then build generation for whatever is left.
  if (d.firmSupply < d.powerDraw * 1.3) {
    const room = A.gridCap(s) - s.gridPower;
    if (room > 0.5) {
      const want = Math.min(room, Math.max(2, d.powerDraw * 0.5));
      const cost = A.gridUpgradeCost(s, want);
      if (can(cost)) { A.buyGrid(s, want, quiet); d = derive(s); }
    }
    if (d.firmSupply < d.powerDraw * 1.3) {
      const gens = unlockedB('power').filter((b) => b.supplyKW && !b.solar && !b.wind);
      const gen = gens.sort((a, b) => a.supplyKW - b.supplyKW)
        .filter((b) => can(A.buildCost(b, d) * 1.5)).slice(-1)[0];
      if (gen) { put(gen.id); d = derive(s); }
    }
  }

  // Racks first: floor space is the scarce thing.
  const rackEarly = best(unlockedB('compute'), () => true);
  if (rackEarly && d.freeSlots < 4 && can(A.buildCost(rackEarly, d) * 2)) { put(rackEarly.id); d = derive(s); }

  // Cooling.
  if (d.coolCap < d.heatLoad * 1.3 || d.racks.some((r) => r.cover < 0.98)) {
    const cool = best(unlockedB('cooling'), (b) => b.coolCap);
    if (cool && can(A.buildCost(cool, d))) put(cool.id, (r) => r.cover);
  }
  // Water.
  if (d.waterSupply < d.waterDemand * 1.35) {
    const w = best(unlockedB('water'), (b) => b.supplyWater);
    if (w && can(A.buildCost(w, d))) put(w.id);
  }
  // Local power distribution.
  if (d.racks.some((r) => r.pduFactor < 0.98) || d.pdus.length === 0) {
    const p = best(unlockedB('power'), (b) => b.powerCap);
    if (p && can(A.buildCost(p, d))) put(p.id, (r) => r.pduFactor);
  }
  // Network.
  if (d.netCap < d.netNeed * 1.2) {
    const n = best(unlockedB('support'), (b) => b.net);
    if (n && can(A.buildCost(n, d))) put(n.id);
  }
  // Desks, workshop, lab, noc, sales, security.
  for (const id of ['office', 'workshop', 'lab', 'noc', 'sales', 'security', 'ups']) {
    const b = [...unlockedB('support'), ...unlockedB('power')].find((x) => x.id === id);
    if (!b) continue;
    const have = d.counts[id] || 0;
    const want = id === 'office' ? Math.min(14, Math.ceil((d.racks.length / 6) / 4) + 1) : Math.max(1, Math.floor(d.racks.length / 22));
    if (have < want && can(A.buildCost(b, d) * 3)) put(b.id);
  }

  // Racks: keep some free slots ahead of demand.
  const rackB = best(unlockedB('compute'), () => true);
  if (rackB && d.freeSlots < 4 && can(A.buildCost(rackB, d) * 2) && freeTile()) put(rackB.id);

  // Hardware: retire the previous generation once the new one is affordable.
  const hw = [...HARDWARE].reverse().find((h) => (!h.req || s.research.done.includes(h.req))
    && s.money > A.hwCost(h, d) * 4);
  if (hw) {
    const older = Object.entries(d.units).filter(([id, n]) =>
      n > 0 && HARDWARE.find((x) => x.id === id).compute < hw.compute);
    const olderCount = older.reduce((a, [, n]) => a + n, 0);
    if (olderCount > 0 && s.money > A.hwCost(hw, d) * (olderCount + 4)) {
      A.retireOlderThan(s, d, hw.id, quiet);
      d = derive(s);
    }
    if (d.freeSlots > 0 && s.money > A.hwCost(hw, d) * 2.5) {
      A.fillAll(s, d, hw.id, quiet);
      d = derive(s);
    }
  }

  // Staff.
  d = derive(s);
  for (const role of ['tech', 'eng', 'sales', 'ops']) {
    if (d.staffTotal < d.staffCap) {
      const c = A.staffCost(role, s.staff[role]);
      if (can(c * 4)) A.hire(s, d, role, quiet);
    }
  }

  // Upgrades.
  const up = UPGRADES.filter((u) => !s.upgrades.includes(u.id)).sort((a, b) => a.cost - b.cost)[0];
  if (up && s.money > up.cost * 4) A.buyUpgrade(s, d, up.id, quiet);

  // Contracts.
  d = derive(s);
  let free = d.computeSellable - s.contracts.active.reduce((a, c) => a + c.demand, 0);
  const fits = s.contracts.offers.filter((o) => o.demand <= free * 0.92).sort((a, b) => b.pay - a.pay);
  for (const o of fits) {
    if (s.contracts.active.length >= d.contractSlots) break;
    free -= o.demand;
    signContract(s, d, o, quiet);
  }
}

const DT = 0.25;
const HOURS = 5;
const total = HOURS * 3600;
let t = 0, nextStep = 0, nextReport = 0, lastTier = -1, treeDone = false, objDone = false;
const t0 = Date.now();
while (t < total) {
  d = derive(s);
  tick(s, DT, d, quiet);
  t += DT;
  if (t >= nextStep) { step(); nextStep = t + 2; }
  if (s.facility !== lastTier) {
    lastTier = s.facility;
    console.log('MILESTONE ' + String(Math.round(t / 60)).padStart(4) + 'm  facility tier ' + s.facility);
  }
  if (s.research.done.length === RESEARCH.length && !treeDone) {
    treeDone = true;
    console.log('MILESTONE ' + String(Math.round(t / 60)).padStart(4) + 'm  research tree complete');
  }
  if (s.objectives.done.length === 35 && !objDone) {
    objDone = true;
    console.log('MILESTONE ' + String(Math.round(t / 60)).padStart(4) + 'm  all objectives complete');
  }
  if (t >= nextReport) {
    nextReport = t + 900;
    d = derive(s);
    console.log(
      String(Math.round(t / 60)).padStart(4) + 'm',
      '| tier', s.facility,
      '| $' + fmt(s.money).padStart(7),
      '| net', (money(d.netIncome) + '/s').padStart(11),
      '| compute', fmt(d.computeTotal).padStart(8),
      '| rnd', String(s.research.done.length).padStart(2) + '/' + RESEARCH.length,
      '| rep', fmt(s.reputation).padStart(6),
      '| obj', String(s.objectives.done.length).padStart(2),
      '| temp', d.maxTemp.toFixed(0).padStart(3),
      '| up', (d.uptime * 100).toFixed(1),
      '| town', ((s.town?.damage || 0) * 100).toFixed(0) + '%',
      '| LP', legacyGain(s));
  }
}

// --- diagnostics
{
  d = derive(s);
  const conds = [];
  let broken = 0, total = 0;
  for (const r of d.racks) for (const g of (r.tile.units || [])) { conds.push(g.cond); broken += g.broken; total += g.n; }
  conds.sort((a,b)=>a-b);
  console.log('DIAG racks', d.racks.length, 'units', total, 'broken', broken,
    'brokenFrac', (d.brokenTotal/Math.max(1,d.unitsTotal)).toFixed(3),
    'cond min/med/max', conds[0]?.toFixed(2), conds[Math.floor(conds.length/2)]?.toFixed(2), conds[conds.length-1]?.toFixed(2));
  console.log('DIAG staff', JSON.stringify(s.staff), 'cap', d.staffCap, 'repairRate', d.repairRate.toFixed(2),
    'powerFactor', d.powerFactor.toFixed(3), 'netFactor', d.netFactor.toFixed(3),
    'uptime', d.uptime.toFixed(3), 'contracts', s.contracts.active.length, '/', d.contractSlots,
    'offers', s.contracts.offers.length, 'freeTiles', (facilityOf(s).w*facilityOf(s).h)-Object.keys(s.tiles).length);
  const kinds = {};
  for (const k in s.tiles) kinds[s.tiles[k].b] = (kinds[s.tiles[k].b]||0)+1;
  console.log('DIAG tiles', JSON.stringify(kinds));
  console.log('DIAG contractsDone', s.stats.contractsDone, 'breaches', s.stats.breaches, 'failed', s.stats.failed, 'repaired', s.stats.repaired);
}
console.log('wall time', ((Date.now() - t0) / 1000).toFixed(1) + 's');
console.log('final: tier', s.facility, 'research', s.research.done.length + '/' + RESEARCH.length,
  'upgrades', s.upgrades.length + '/' + UPGRADES.length,
  'objectives', s.objectives.done.length, 'achievements', s.achievements.length,
  'town', ((s.town?.damage || 0) * 100).toFixed(0) + '%',
  'lifetime', money(s.lifetimeEarnings), 'legacy', legacyGain(s));
