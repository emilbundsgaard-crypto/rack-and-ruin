// A crude but competent player bot, used to check pacing over a long run.
import { newGame, facilityOf, tileAt, key, DAY_SECONDS } from '../src/state.js';
import { derive, tick, signContract, resolveDecision, legacyGain, takeRescue, breakContract } from '../src/sim.js';
import * as A from '../src/actions.js';
import { HARDWARE } from '../src/data/hardware.js';
import { BUILDINGS } from '../src/data/buildings.js';
import { RESEARCH, available } from '../src/data/research.js';
import { UPGRADES, OBJECTIVES, STAFF_BY_ID } from '../src/data/progression.js';
import { fmt, money, fmtTime } from '../src/util.js';
import { writeFileSync } from 'node:fs';

const quiet = { log: () => {}, onDecision: (ev) => { pending = ev; } };
let pending = null;

/**
 * How this run plays, so many runs can be compared across play styles rather
 * than one crude policy standing in for every player.
 *
 *   sell     how much of its sellable compute it is willing to promise
 *   cap      the highest uptime it will sign up to
 *   ahead    how much firm supply it keeps ahead of the draw
 *   payroll  the share of net income it will spend on a new wage
 *   quietly  suppress the running commentary (for batch runs)
 */
const STYLES = {
  balanced:   { sell: 0.92, cap: 1.00, ahead: 1.30, payroll: 0.25 },
  cautious:   { sell: 0.70, cap: 0.95, ahead: 1.70, payroll: 0.15 },
  aggressive: { sell: 1.00, cap: 1.00, ahead: 1.10, payroll: 0.40 },
};
const STYLE = STYLES[process.env.BOT_STYLE] || STYLES.balanced;
const QUIET_RUN = process.env.BOT_QUIET === '1';
const say = (...a) => { if (!QUIET_RUN) console.log(...a); };

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

  // Answer the bank the way a player would: take the terms rather than let
  // the site sink. Without this the offer sits unanswered for the whole run.
  if (s.rescue) {
    takeRescue(s, d, quiet);
    d = derive(s);
  }

  // Cut the site down when it is losing money.
  //
  // This is what the game tells an overdrawn player to do in as many words —
  // "sell servers you cannot run" — and the bot never did it, which is why
  // every losing run ran all the way to the bottom. Without this the bot
  // cannot answer the question of whether the hole is escapable at all.
  if (d.netIncome < 0 && (s.money < 0 || d.netIncome < -d.revenue * 0.4)) {
    const worst = d.racks
      .filter((r) => r.used > 0)
      .sort((a, b) => b.draw - a.draw)[0];
    if (worst) {
      const tile = tileAt(s, worst.x, worst.y);
      const held = tile && tile.units && tile.units.length ? tile.units[0] : null;
      if (held) { A.uninstall(s, d, tile, held.id ?? held, 1, quiet); d = derive(s); }
    }
  }

  // Drop work the site cannot do. A player watching fines outrun revenue would
  // walk away from the worst deal rather than pay for the rest of its term;
  // without this the bot sits and takes it, which is how the trap was found.
  if (d.penalties > d.revenue * 0.5 || s.money < 0) {
    const bad = s.contracts.active
      .filter((c) => c.effUptime < c.uptimeReq)
      .sort((a, b) => (b.livePay || b.pay) - (a.livePay || a.pay))[0];
    if (bad) { breakContract(s, bad.cid, quiet); d = derive(s); }
  }

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
  if (d.firmSupply < d.powerDraw * STYLE.ahead) {
    const room = A.gridCap(s) - s.gridPower;
    if (room > 0.5) {
      const want = Math.min(room, Math.max(2, d.powerDraw * 0.5));
      const cost = A.gridUpgradeCost(s, want);
      if (can(cost)) { A.buyGrid(s, want, quiet); d = derive(s); }
    }
    if (d.firmSupply < d.powerDraw * STYLE.ahead) {
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

  // Staff. Hiring used to be free money when objectives paid for everything;
  // now a wage is a standing cost, so only take one on if the site is earning
  // and the salary is a small share of that. Otherwise a cupboard hires three
  // technicians it cannot pay and never recovers.
  d = derive(s);
  for (const role of ['tech', 'eng', 'sales', 'ops']) {
    if (d.staffTotal >= d.staffCap) continue;
    const def = STAFF_BY_ID[role];
    const wage = (def?.salary || 0) / DAY_SECONDS;
    if (d.netIncome <= 0 || wage > d.netIncome * STYLE.payroll) continue;
    const c = A.staffCost(role, s.staff[role]);
    if (can(c * 4)) A.hire(s, d, role, quiet);
  }

  // And let people go if the payroll has outgrown the site.
  if (d.netIncome < 0 && d.salaryCost > 0) {
    for (const role of ['sales', 'ops', 'eng', 'tech']) {
      if ((s.staff[role] || 0) > 0 && d.salaryCost > Math.max(0, d.revenue) * 0.4) {
        A.fire(s, role, quiet);
        d = derive(s);
      }
    }
  }

  // Upgrades.
  const up = UPGRADES.filter((u) => !s.upgrades.includes(u.id)).sort((a, b) => a.cost - b.cost)[0];
  if (up && s.money > up.cost * 4) A.buyUpgrade(s, d, up.id, quiet);

  // Contracts.
  d = derive(s);
  let free = d.computeSellable - s.contracts.active.reduce((a, c) => a + c.demand, 0);
  // No slot limit any more: keep taking work while there is compute for it.
  for (let guard = 0; guard < 12; guard++) {
    const fits = s.contracts.offers
      .filter((o) => o.demand <= free * STYLE.sell && (o.uptimeReq ?? 1) <= STYLE.cap + 1e-6)
      .sort((a, b) => b.pay - a.pay);
    if (!fits.length) break;
    free -= fits[0].demand;
    signContract(s, d, fits[0], quiet);
  }
}

// A run is measured in game-days, because that is the unit the pacing target
// is in: at 10x speed one day is six real seconds, so ten hours of play is
// 6,000 days. The step can be coarsened for long pacing runs — it costs some
// resolution on wear and events, which is acceptable for "what day does the
// tree finish" and is not for balance trials.
const DT = Number(process.env.BOT_DT || 0.25);
const DAYS = Number(process.env.BOT_DAYS || 300);
const total = DAYS * DAY_SECONDS;
let botWentUnder = false;
let t = 0, nextStep = 0, nextReport = 0, lastTier = -1, treeDone = false, objDone = false;
let dayTier9 = null, dayResearch = null, dayObjectives = null;
let peakTier = 0, underAt = null, peakMoney = 0;
const t0 = Date.now();
// When the point of the run is "what day is it finished", carrying on past
// the finish is the most expensive part of the measurement: a mature site is
// hundreds of tiles and every step derives every one of them.
const STOP_WHEN_DONE = process.env.BOT_STOP_DONE === '1';
// A machine-readable trace of the quantities balance work is about. Tuning a
// curve by re-running a twenty-hour game per candidate is not tuning, it is
// waiting: with the trajectory on disk you can integrate any number of
// candidate curves over the same run offline and only re-run to confirm.
const TRACE = process.env.BOT_TRACE || '';
const trace = [];
let nextTrace = 0;
while (t < total) {
  if (STOP_WHEN_DONE && dayResearch !== null && dayTier9 !== null && objDone) break;
  d = derive(s);
  tick(s, DT, d, quiet);
  t += DT;
  if (t >= nextStep) { step(); nextStep = t + 2; }
  if (s.facility !== lastTier) {
    lastTier = s.facility;
    if (s.facility >= 9 && dayTier9 === null) dayTier9 = t / 60;
    say('MILESTONE ' + String(Math.round(t / 60)).padStart(4) + 'd  facility tier ' + s.facility);
  }
  if (s.research.done.length === RESEARCH.length && !treeDone) {
    treeDone = true;
    dayResearch = t / 60;
    say('MILESTONE ' + String(Math.round(t / 60)).padStart(4) + 'd  research tree complete');
  }
  if (s.objectives.done.length === OBJECTIVES.length && !objDone) {
    objDone = true;
    dayObjectives = t / 60;
    say('MILESTONE ' + String(Math.round(t / 60)).padStart(4) + 'd  all objectives complete');
  }
  if (s.facility > peakTier) peakTier = s.facility;
  if (s.money > peakMoney) peakMoney = s.money;
  if (s.money < 0 && underAt === null) underAt = t / 60;
  if (s.money < 0 && !botWentUnder) {
    botWentUnder = true;
    // Where the money is going, not just how fast. Inferring this from the net
    // figure is guesswork, and guessing is how you end up fixing the wrong cost.
    say('DIAG went overdrawn at ' + (t/60).toFixed(1) + 'm  tier ' + s.facility
      + '  net ' + d.netIncome.toFixed(1) + '  staff ' + JSON.stringify(s.staff)
      + '  tiles ' + Object.keys(s.tiles).length + '  rescues ' + s.bank.rescues);
    say('DIAG   revenue ' + d.revenue.toFixed(2)
      + ' | power ' + d.powerCost.toFixed(2)
      + ' | fuel ' + d.fuelCost.toFixed(2)
      + ' | water ' + d.waterBill.toFixed(2)
      + ' | upkeep+wages ' + d.upkeepCost.toFixed(2)
      + ' | fines ' + d.penalties.toFixed(2)
      + ' | interest ' + d.interestCost.toFixed(2)
      + ' | broken ' + d.brokenTotal + '/' + d.unitsTotal
      + ' | contracts ' + s.contracts.active.length
      + ' | uptime ' + (d.uptime * 100).toFixed(0) + '%');
  }
  if (TRACE && t >= nextTrace) {
    nextTrace = t + 60;
    d = derive(s);
    trace.push({
      day: Math.round(t / 60), tier: s.facility, money: s.money,
      computeTotal: d.computeTotal, computeResearch: d.computeResearch,
      computeSellable: d.computeSellable, contractDemand: d.contractDemand,
      rpCompute: d.rpCompute, rpFlat: d.rpFlat,
      revenue: d.revenue, costs: d.costs,
      powerCost: d.powerCost, fuelCost: d.fuelCost, waterBill: d.waterBill,
      upkeepCost: d.upkeepCost, interestCost: d.interestCost,
      actualDraw: d.actualDraw, billedDraw: d.billedDraw, gridUsed: d.gridUsed,
      sellPrice: d.sellPrice, listPrice: d.listPrice,
      rnd: s.research.done.length, contracts: s.contracts.active.length,
      eng: s.staff.eng, alloc: s.researchAlloc,
    });
  }
  if (t >= nextReport) {
    // Dense at the start. Most losing runs are over inside ten minutes, and a
    // quarter-hour report shows one row before the balance is already gone.
    nextReport = t + (t < 1200 ? 60 : 900);
    d = derive(s);
    say(
      String(Math.round(t / 60)).padStart(4) + 'm',
      '| tier', s.facility,
      '| $' + fmt(s.money).padStart(7),
      '| net', (money(d.netIncome) + '/s').padStart(11),
      '| compute', fmt(d.computeTotal).padStart(8),
      '| rev', fmt(d.revenue).padStart(8),
      '| cost', fmt(d.costs).padStart(8),
      '| r/c', (d.costs > 0 ? (d.revenue / d.costs) : 0).toFixed(1).padStart(9),
      '| $/cu', (d.computeTotal > 0 ? d.revenue / d.computeTotal : 0).toExponential(1).padStart(8),
      '| kW', fmt(d.actualDraw).padStart(7),
      '| rp', (d.rpCompute + d.rpFlat).toFixed(1).padStart(7),
      '| rpC%', String(Math.round(100 * d.rpCompute / Math.max(1e-9, d.rpCompute + d.rpFlat))).padStart(3),
      '| pwr%', String(Math.round(100 * (d.powerCost + d.fuelCost) / Math.max(1e-9, d.costs))).padStart(3),
      '| mkt%', String(Math.round(100 * d.sellPrice / Math.max(1e-9, d.listPrice))).padStart(3),
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
  say('DIAG racks', d.racks.length, 'units', total, 'broken', broken,
    'brokenFrac', (d.brokenTotal/Math.max(1,d.unitsTotal)).toFixed(3),
    'cond min/med/max', conds[0]?.toFixed(2), conds[Math.floor(conds.length/2)]?.toFixed(2), conds[conds.length-1]?.toFixed(2));
  say('DIAG staff', JSON.stringify(s.staff), 'cap', d.staffCap, 'repairRate', d.repairRate.toFixed(2),
    'powerFactor', d.powerFactor.toFixed(3), 'netFactor', d.netFactor.toFixed(3),
    'uptime', d.uptime.toFixed(3), 'contracts', s.contracts.active.length,
    'offers', s.contracts.offers.length, 'freeTiles', (facilityOf(s).w*facilityOf(s).h)-Object.keys(s.tiles).length);
  const kinds = {};
  for (const k in s.tiles) kinds[s.tiles[k].b] = (kinds[s.tiles[k].b]||0)+1;
  say('DIAG tiles', JSON.stringify(kinds));
  say('DIAG contractsDone', s.stats.contractsDone, 'breaches', s.stats.breaches, 'failed', s.stats.failed, 'repaired', s.stats.repaired);
}
{
  const left = OBJECTIVES.filter((o) => !s.objectives.done.includes(o.id));
  if (left.length) say('DIAG objectives not done:',
    left.map((o) => o.id + ' ' + o.name).join(' | '));
}
say('wall time', ((Date.now() - t0) / 1000).toFixed(1) + 's');
// One machine-readable line, so many runs can be compared without parsing prose.
if (TRACE) {
  writeFileSync(TRACE, JSON.stringify(trace));
  say('TRACE ' + trace.length + ' samples -> ' + TRACE);
}
console.log('RESULT ' + JSON.stringify({
  style: process.env.BOT_STYLE || 'balanced',
  tier: s.facility,
  peakTier,
  research: s.research.done.length,
  researchOf: RESEARCH.length,
  objectives: s.objectives.done.length,
  objectivesOf: OBJECTIVES.length,
  town: +((s.town?.damage || 0)).toFixed(3),
  lifetime: s.lifetimeEarnings,
  endMoney: s.money,
  peakMoney,
  underAt: underAt === null ? null : +underAt.toFixed(1),
  breaches: s.stats.breaches,
  survived: s.money >= 0 && s.facility >= 1,
  // The pacing target is measured in game-days: at 10x speed one day is six
  // real seconds, so ten hours of play is 6,000 days.
  dayTier9: dayTier9 === null ? null : Math.round(dayTier9),
  dayResearch: dayResearch === null ? null : Math.round(dayResearch),
  dayObjectives: dayObjectives === null ? null : Math.round(dayObjectives),
  endDay: Math.round(t / 60),
}));
say('final: tier', s.facility, 'research', s.research.done.length + '/' + RESEARCH.length,
  'upgrades', s.upgrades.length + '/' + UPGRADES.length,
  'objectives', s.objectives.done.length, 'achievements', s.achievements.length,
  'town', ((s.town?.damage || 0) * 100).toFixed(0) + '%',
  'lifetime', money(s.lifetimeEarnings), 'legacy', legacyGain(s));
