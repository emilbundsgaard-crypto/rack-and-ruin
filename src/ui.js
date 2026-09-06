// All DOM panels. initUI() wires the shell once; renderUI() refreshes the
// parts that change. Heavy lists are only rebuilt when their tab is open.

import { fmt, fmtInt, fmtTime, money, rate, el, fill, clamp } from './util.js';
import { HARDWARE, HARDWARE_BY_ID } from './data/hardware.js';
import { BUILDINGS, BUILDINGS_BY_ID, CATEGORIES } from './data/buildings.js';
import { RESEARCH, RESEARCH_BY_ID, RESEARCH_CATS, available } from './data/research.js';
import { TEMPLATES_BY_ID } from './data/contracts.js';
import { EVENTS_BY_ID } from './data/events.js';
import {
  FACILITIES, STAFF, UPGRADES, OBJECTIVES, ACHIEVEMENTS,
  LEGACY_PERKS, perkCost,
} from './data/progression.js';
import * as A from './actions.js';
import { legacyGain, canPrestige, rackCapacity, signContract } from './sim.js';
import { tileAt, DAY_SECONDS } from './state.js';
import { iconFor } from './render.js';
import { STEPS, current as tutStep, skip as tutSkip } from './tutorial.js';

let app = null;
let tab = 'build';
let buildCat = 'compute';
let researchCat = 'hardware';
let dirty = true;

/** Which tab actually fixes each bottleneck the simulation can report. */
const FIX_TAB = {
  'no hardware installed': 'racks',
  'short of electricity': 'utils',
  'a rack has no PDU in range': 'build',
  'short of switching': 'build',
  'short of water': 'build',
  'cooling is behind': 'build',
  'compute is unsold': 'contracts',
  'empty rack slots': 'racks',
};

export const TABS = [
  { id: 'build', name: 'Build' },
  { id: 'racks', name: 'Hardware' },
  { id: 'contracts', name: 'Contracts' },
  { id: 'research', name: 'R&D' },
  { id: 'upgrades', name: 'Upgrades' },
  { id: 'staff', name: 'Staff' },
  { id: 'utils', name: 'Utilities' },
  { id: 'site', name: 'Site' },
  { id: 'legacy', name: 'Legacy' },
];

export function initUI(a) {
  app = a;
  const tabs = document.getElementById('tabs');
  fill(tabs, TABS.map((t) => {
    const b = el('button', 'tab' + (t.id === tab ? ' on' : ''), t.name);
    b.dataset.tab = t.id;
    b.onclick = () => { tab = t.id; markDirty(); syncTabs(); renderUI(); };
    return b;
  }));

  const tools = document.getElementById('floortools');
  const overlays = [
    ['none', 'No overlay', 'Just the floor.'],
    ['power', 'Power', 'Shades every tile a PDU reaches. Racks nothing reaches get red hatching.'],
    ['cool', 'Cooling', 'Shades every tile a cooler reaches. This is the one that finds your hot racks.'],
    ['heat', 'Heat', 'Colours every rack by temperature, blue to red.'],
    ['net', 'Network', 'Purple while switching keeps up, red when it does not.'],
  ];
  const overlayBtns = overlays.map(([id, name, tip]) => {
    const b = el('button', 'tool' + (id === 'none' ? ' on' : ''), name);
    b.dataset.tip = name + '|' + tip;
    b.onclick = () => {
      app.view.overlay = id;
      overlayBtns.forEach((x) => x.classList.remove('on'));
      b.classList.add('on');
    };
    return b;
  });
  const sellBtn = el('button', 'tool', 'Demolish');
  sellBtn.dataset.tip = 'Demolish|Click machines to remove them. You get half the money back. Drag to clear a row.';
  sellBtn.onclick = () => {
    app.view.tool = app.view.tool === 'sell' ? null : 'sell';
    sellBtn.classList.toggle('on', app.view.tool === 'sell');
    markDirty(); renderUI();
  };
  const centreBtn = el('button', 'tool', 'Recentre');
  centreBtn.dataset.tip = 'Recentre|Fit the whole floor back on screen.';
  centreBtn.onclick = () => app.view.centre(app.state);
  fill(tools, [...overlayBtns, sellBtn, centreBtn]);
  app.sellBtn = sellBtn;
}

function syncTabs() {
  for (const b of document.querySelectorAll('#tabs .tab')) {
    b.classList.toggle('on', b.dataset.tab === tab);
  }
}

export function markDirty() { dirty = true; }
export function setBuildCat(c) { buildCat = c; }
export function currentTab() { return tab; }
export function goTab(id) { tab = id; syncTabs(); markDirty(); renderUI(); }

// ------------------------------------------------------------------ top bar

let topBuilt = null;

/**
 * Built once and written into. Grouped rather than gridded: money and compute
 * read as headlines, the four utilities as meters, everything else as small
 * pairs. Eleven identical boxes was a spreadsheet, not a control room.
 */
export function renderTop(state, d) {
  const bar = document.getElementById('topbar');
  if (!topBuilt) {
    const mk = {};
    const vital = (id, label) => {
      const n = el('div', 'vital');
      const big = el('div', 'big');
      const sub = el('div', 'sub');
      n.append(el('div', 'lbl', label), big, sub);
      mk[id] = { n, big, sub };
      return n;
    };
    const meter = (id, label) => {
      const n = el('div', 'meter');
      const fillEl = el('i');
      const barEl = el('div', 'mbar');
      barEl.append(fillEl);
      const val = el('div', 'mv');
      n.append(el('div', 'mk', label), barEl, val);
      mk[id] = { n, fill: fillEl, val };
      return n;
    };
    const mini = (id, label) => {
      const n = el('div', 'mini');
      const val = el('div', 'mv');
      n.append(el('div', 'mk', label), val);
      mk[id] = { n, val };
      return n;
    };

    const meters = el('div', 'meters');
    meters.append(meter('m_power', 'PWR'), meter('m_cool', 'COOL'),
      meter('m_water', 'H2O'), meter('m_net', 'NET'));
    const minis = el('div', 'minis');
    minis.append(mini('x_temp', 'Temp'), mini('x_up', 'Uptime'), mini('x_rp', 'R&D'),
      mini('x_rep', 'Rep'), mini('x_con', 'Deals'), mini('x_day', 'Day'));

    const speed = el('button', 'topbtn', '');
    speed.onclick = () => {
      app.state.settings.speed = app.state.settings.speed === 0 ? 1 : 0;
      renderTop(app.state, app.d);
    };
    const guide = el('button', 'topbtn', 'Guide');
    guide.dataset.tip = 'Guide|How the site works, and what everything on screen means.';
    guide.onclick = () => app.openGuide();
    const menu = el('button', 'topbtn', 'Menu');
    menu.dataset.tip = 'Menu|Save, export, import, restart the guide, or wipe and start over.';
    menu.onclick = () => app.openMenu();
    mk._speed = { n: speed };

    fill(bar,
      vital('v_cash', 'Cash'),
      vital('v_compute', 'Compute'),
      el('div', 'divider'),
      meters,
      el('div', 'divider'),
      minis,
      el('div', 'spacer'),
      speed, guide, menu);
    topBuilt = mk;

    mk.v_cash.n.dataset.tip = 'Cash|What you have, and what the site earns or loses every '
      + 'second once every bill is paid.';
    mk.m_power.n.dataset.tip = 'Power|Draw against supply. Short of supply and every rack throttles at once.';
    mk.m_cool.n.dataset.tip = 'Cooling|Heat you are making against heat you can remove. '
      + 'Capacity only counts if it reaches the rack.';
    mk.m_water.n.dataset.tip = 'Water|Cooling drinks water. Run short and cooling capacity falls with it.';
    mk.m_net.n.dataset.tip = 'Network|Switching your fleet needs against switching you have. '
      + 'Compute without bandwidth is idle.';
    mk.x_temp.n.dataset.tip = 'Peak temperature|The hottest rack you own. Over 30 °C it throttles; '
      + 'over 40 °C it wears out fast.';
    mk.x_up.n.dataset.tip = 'Uptime|What your SLAs are measured against. Broken hardware and '
      + 'brownouts both drag it down.';
    mk.x_rp.n.dataset.tip = 'Research|Points earned by the share of compute you allocate to R&D.';
    mk.x_rep.n.dataset.tip = 'Reputation|Earned by finishing contracts cleanly. It unlocks bigger '
      + 'buildings and better customers.';
    mk.x_con.n.dataset.tip = 'Contracts|Signed against slots available.';
    mk.x_day.n.dataset.tip = 'Day|One game day is one real minute. Electricity is cheaper at night.';
  }

  const t = topBuilt;
  const set = (cell, big, sub, cls) => {
    if (cell.big.textContent !== big) cell.big.textContent = big;
    if (cell.sub.textContent !== sub) cell.sub.textContent = sub;
    const c = 'vital' + (cls ? ' ' + cls : '');
    if (cell.n.className !== c) cell.n.className = c;
  };
  const gauge = (cell, used, cap, label) => {
    const frac = cap > 0 ? used / cap : (used > 0 ? 1 : 0);
    const pct = Math.min(100, frac * 100);
    if (cell.fill.style.width !== pct.toFixed(0) + '%') cell.fill.style.width = pct.toFixed(0) + '%';
    if (cell.val.textContent !== label) cell.val.textContent = label;
    const c = 'meter' + (frac > 1.001 ? ' bad' : frac > 0.88 ? ' warn' : '');
    if (cell.n.className !== c) cell.n.className = c;
  };
  const small = (cell, v, cls) => {
    if (cell.val.textContent !== v) cell.val.textContent = v;
    const c = 'mini' + (cls ? ' ' + cls : '');
    if (cell.n.className !== c) cell.n.className = c;
  };

  set(t.v_cash, money(state.money), (d.netIncome >= 0 ? '+' : '') + rate(d.netIncome),
    d.netIncome >= 0 ? 'good' : 'bad');

  const fixTab = FIX_TAB[d.bottleneck];
  set(t.v_compute, fmt(d.computeTotal), d.bottleneck,
    (d.bottleneck === 'running clean' ? '' : 'warn') + (fixTab ? ' jump' : ''));
  t.v_compute.n.onclick = fixTab ? () => goTab(fixTab) : null;
  t.v_compute.n.dataset.tip = 'Compute|Capacity your fleet produces right now, and the one thing '
    + 'holding it back.' + (fixTab ? '\nClick to go straight to the tab that fixes it.' : '');

  gauge(t.m_power, d.actualDraw, d.supplyKW, fmt(d.actualDraw) + '/' + fmt(d.supplyKW));
  gauge(t.m_cool, d.heatLoad, d.coolCap, fmt(d.heatLoad) + '/' + fmt(d.coolCap));
  gauge(t.m_water, d.waterDemand, d.waterSupply, fmt(d.waterDemand) + '/' + fmt(d.waterSupply));
  gauge(t.m_net, d.netNeed, d.netCap, fmt(d.netNeed) + '/' + fmt(d.netCap));

  small(t.x_temp, d.maxTemp.toFixed(0) + ' °C', d.maxTemp > 45 ? 'bad' : d.maxTemp > 34 ? 'warn' : '');
  small(t.x_up, (d.uptime * 100).toFixed(1) + '%', d.uptime > 0.98 ? '' : 'warn');
  small(t.x_rp, fmt(state.rp), 'acc');
  small(t.x_rep, fmt(state.reputation));
  small(t.x_con, state.contracts.active.length + '/' + d.contractSlots,
    state.contracts.active.length < d.contractSlots ? 'acc' : '');
  small(t.x_day, Math.floor(state.day) + ' · ' + clockOf(state));

  const speed = t._speed.n;
  const label = state.settings.speed === 0 ? '\u25B6 Paused' : '\u275A\u275A Pause';
  if (speed.textContent !== label) speed.textContent = label;
  speed.className = 'topbtn' + (state.settings.speed === 0 ? ' on' : '');
  speed.dataset.tip = 'Pause|Space also does it. The simulation stops; nothing decays.';
}

function clockOf(state) {
  const f = state.day % 1;
  const h = Math.floor(f * 24), m = Math.floor((f * 24 - h) * 60);
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
}

// -------------------------------------------------------------------- panel

export function renderUI() {
  const state = app.state, d = app.d;
  const body = document.getElementById('tabbody');
  const scroll = body.scrollTop;
  if (tab === 'build') fill(body, panelBuild(state, d));
  else if (tab === 'racks') fill(body, panelRacks(state, d));
  else if (tab === 'contracts') fill(body, panelContracts(state, d));
  else if (tab === 'research') fill(body, panelResearch(state, d));
  else if (tab === 'upgrades') fill(body, panelUpgrades(state, d));
  else if (tab === 'staff') fill(body, panelStaff(state, d));
  else if (tab === 'utils') fill(body, panelUtilities(state, d));
  else if (tab === 'site') fill(body, panelSite(state, d));
  else if (tab === 'legacy') fill(body, panelLegacy(state, d));
  body.scrollTop = scroll;
  dirty = false;
}

/** Called every frame — cheap refresh of live numbers only. */
const LIVE_TABS = ['contracts', 'utils', 'research'];
let liveClock = 0;

export function refreshLive(state, d, dt) {
  renderTop(state, d);
  renderEvents(state);
  renderObjective(state, d);
  renderInspector(state, d);
  // Panels with live numbers refresh on their own slower clock: rebuilding a
  // list of buttons five times a second makes them feel like they miss clicks.
  liveClock += dt || 0;
  const live = LIVE_TABS.includes(tab) && liveClock > 0.6;
  if (live) liveClock = 0;
  if (dirty || live) renderUI();
  renderTutorial(state);
}

// --------------------------------------------------------------------- build

/**
 * The default shape for anything list-like: an icon chip, a title line with a
 * price, and whatever detail fits underneath. Hairline separated, not boxed.
 */
function listRow(o) {
  const n = el(o.onClick ? 'button' : 'div', 'row' + (o.onClick ? ' click' : '') + (o.cls ? ' ' + o.cls : ''));
  const ico = el('div', 'ico');
  if (o.icon) ico.style.backgroundImage = 'url(' + o.icon + ')';
  if (o.iconText) {
    ico.textContent = o.iconText;
    ico.style.cssText += ';display:flex;align-items:center;justify-content:center;'
      + 'font:600 10px var(--mono);color:' + (o.iconColor || 'var(--dim)');
  }
  if (o.iconColor) ico.style.borderColor = o.iconColor + '55';
  const body = el('div', 'body');
  const head = el('div', 'head');
  head.append(el('b', null, o.name));
  for (const p of o.pills || []) if (p) head.append(el('span', 'pill ' + (p.cls || ''), p.text));
  if (o.price) head.append(el('span', 'price' + (o.priceOk ? ' ok' : ''), o.price));
  body.append(head);
  if (o.desc) body.append(el('div', 'desc', o.desc));
  if (o.meta && o.meta.length) {
    const m = el('div', 'meta');
    for (const [k, v] of o.meta) { const sp = el('span'); sp.append(k + ' ', el('b', null, String(v))); m.append(sp); }
    body.append(m);
  }
  if (o.note) body.append(el('div', 'note', o.note));
  if (o.buttons && o.buttons.length) {
    const r = el('div', 'btnrow');
    r.append(...o.buttons);
    body.append(r);
  }
  n.append(ico, body);
  if (o.onClick) n.onclick = o.onClick;
  if (o.tip) n.dataset.tip = o.tip;
  if (o.data) for (const k in o.data) n.dataset[k] = o.data[k];
  return n;
}

function sec(title, ...kids) {
  const s = el('div', 'sec');
  if (title) s.append(el('h3', null, title));
  s.append(...kids.flat().filter(Boolean));
  return s;
}

function panelBuild(state, d) {
  const catRow = el('div', 'btnrow');
  for (const c of CATEGORIES) {
    const b = el('button', 'btn small' + (c.id === buildCat ? ' primary' : ''), c.name);
    b.onclick = () => { buildCat = c.id; markDirty(); renderUI(); };
    catRow.append(b);
  }

  const list = [];
  for (const b of BUILDINGS.filter((x) => x.cat === buildCat)) {
    const unlocked = !b.req || state.research.done.includes(b.req);
    const cost = A.buildCost(b, d);
    const afford = state.money >= cost;
    const meta = [];
    if (b.slots) meta.push(['slots', rackCapacity(b, d.mods)]);
    if (b.radius) meta.push(['radius', b.radius + ' tiles']);
    if (b.powerCap) meta.push(['distributes', fmt(b.powerCap) + ' kW']);
    if (b.coolCap) meta.push(['removes', fmt(b.coolCap * d.mods.coolMult) + ' kW']);
    if (b.supplyKW) meta.push(['generates', fmt(b.supplyKW) + ' kW']);
    if (b.supplyWater) meta.push(['supplies', fmt(b.supplyWater) + ' L/s']);
    if (b.water) meta.push(['water', (b.water * 1000).toFixed(1) + ' L/s per MW']);
    if (b.net) meta.push(['switching', fmt(b.net) + ' Gbps']);
    if (b.draw) meta.push(['draws', fmt(b.draw) + ' kW']);
    if (b.upkeep) meta.push(['upkeep', money(b.upkeep) + '/day']);
    if (b.fuel) meta.push(['fuel', '$' + b.fuel + '/kWh']);
    if (b.staff) meta.push(['desks', '+' + b.staff]);
    if (b.ride) meta.push(['ride-through', b.ride + ' s']);
    if (b.coolSelf) meta.push(['self-cools', Math.round(b.coolSelf * 100) + '%']);

    list.push(listRow({
      icon: iconFor(b),
      iconColor: b.color,
      name: b.name,
      pills: [app.view.tool === b.id ? { text: 'selected', cls: 'acc' } : null],
      price: money(cost),
      priceOk: afford && unlocked,
      desc: b.desc,
      meta: unlocked ? meta : null,
      note: unlocked ? null : 'Locked — needs ' + (RESEARCH_BY_ID[b.req]?.name || b.req) + '.',
      cls: unlocked ? (afford ? '' : 'cant') : 'locked',
      data: { build: b.id },
      onClick: unlocked ? () => {
        app.view.tool = app.view.tool === b.id ? null : b.id;
        app.sellBtn.classList.remove('on');
        markDirty(); renderUI();
      } : null,
    }));
  }

  const help = el('div', 'hint',
    'Pick a machine, then click the floor to place it. Drag with a tool held to place a row. '
    + 'Right-drag or drag empty space to pan, wheel to zoom.');
  return [sec(null, catRow), sec(null, help), sec(null, list)];
}

// ------------------------------------------------------------------ hardware

function panelRacks(state, d) {
  const out = [];
  const slotsUsed = d.unitsTotal;
  const slotsTotal = slotsUsed + d.freeSlots;

  const summary = el('div', 'card');
  const kv = el('div', 'kv');
  const row = (k, v) => { kv.append(el('div', 'k', k), el('div', 'v', v)); };
  row('Racks', fmtInt(d.counts.rackAll || 0));
  row('Slots used', fmtInt(slotsUsed) + ' / ' + fmtInt(slotsTotal));
  row('Units down', fmtInt(d.brokenTotal));
  row('Repair throughput', fmt(d.repairRate) + ' units/day');
  row('Compute', fmt(d.computeTotal));
  summary.append(kv);
  const barWrap = el('div', 'bar');
  barWrap.append(el('i'));
  barWrap.firstChild.style.width = (slotsTotal ? (slotsUsed / slotsTotal) * 100 : 0) + '%';
  summary.append(barWrap);
  out.push(sec('Fleet', summary));

  const cards = [];
  for (const hw of [...HARDWARE].reverse()) {
    const unlocked = !hw.req || state.research.done.includes(hw.req);
    const cost = A.hwCost(hw, d);
    const owned = d.units[hw.id] || 0;
    if (!unlocked && owned === 0) {
      cards.push(listRow({
        iconText: hw.short, iconColor: '#3f7dd6',
        name: hw.name, price: money(cost), cls: 'locked',
        note: 'Locked — needs ' + (RESEARCH_BY_ID[hw.req]?.name || hw.req) + '.',
      }));
      continue;
    }
    const perUnit = hw.power * d.mods.powerMult;
    const headroom = Math.max(0, (d.firmSupply * 0.95) - d.actualDraw);
    const canFit = Math.min(
      d.freeSlots,
      Math.floor(state.money / cost),
      perUnit > 0 ? Math.floor(headroom / perUnit) : Infinity,
    );
    const buttons = [];
    if (unlocked) {
      const fillBtn = el('button', 'btn primary small',
        canFit > 0 ? 'Fill all racks — ' + fmtInt(canFit) : 'Fill all racks');
      fillBtn.dataset.fill = hw.id;
      fillBtn.dataset.tip = canFit > 0
        ? 'Fill all racks|Buys ' + fmtInt(canFit) + ': what your free slots, your cash and your '
          + 'power headroom allow. It never overfills you into a brownout.'
        : 'Fill all racks|' + (d.freeSlots === 0 ? 'No free rack slots.'
          : headroom < perUnit ? 'No power headroom — buy supply on the Utilities tab first.'
          : 'Not enough cash for even one.');
      fillBtn.onclick = (e) => { e.stopPropagation(); app.act(() => A.fillAll(state, d, hw.id, app.hooks)); };
      buttons.push(fillBtn);

      const sel = app.selectedRack();
      const tenBtn = el('button', 'btn small', '+10 here');
      tenBtn.disabled = !sel;
      tenBtn.onclick = (e) => {
        e.stopPropagation();
        const t = app.selectedRack();
        if (t) app.act(() => A.install(state, d, t, hw.id, 10, app.hooks));
      };
      buttons.push(tenBtn);

      if (hw.tier > 0) {
        const retire = el('button', 'btn small danger', 'Retire older');
        retire.dataset.tip = 'Retire older|Sells every unit less capable than this one for half '
          + 'its value, freeing the slots.';
        retire.onclick = (e) => { e.stopPropagation(); app.act(() => A.retireOlderThan(state, d, hw.id, app.hooks)); };
        buttons.push(retire);
      }
    }
    cards.push(listRow({
      iconText: hw.short,
      iconColor: owned ? '#4fe0ac' : '#3f7dd6',
      name: hw.name,
      pills: [owned ? { text: fmtInt(owned) + ' installed', cls: 'acc' } : null],
      price: money(cost),
      priceOk: state.money >= cost,
      desc: hw.desc,
      meta: [
        ['compute', fmt(hw.compute * d.mods.computeMult)],
        ['power', fmt(perUnit) + ' kW'],
        ['heat', fmt(hw.heat * d.mods.heatMult) + ' kW'],
        ['per kW', fmt(hw.compute * d.mods.computeMult / perUnit)],
      ],
      cls: state.money >= cost ? '' : 'cant',
      buttons,
    }));
  }
  out.push(sec('Hardware', cards));
  return out;
}

// ----------------------------------------------------------------- contracts

function panelContracts(state, d) {
  const out = [];
  const head = el('div', 'card');
  const kv = el('div', 'kv');
  const row = (k, v) => kv.append(el('div', 'k', k), el('div', 'v', v));
  row('Slots', state.contracts.active.length + ' / ' + d.contractSlots);
  row('Committed compute', fmt(d.contractDemand) + ' / ' + fmt(d.computeSellable));
  row('Delivering', (d.deliverRatio * 100).toFixed(1) + '%');
  row('Market rate', '$' + state.market.compute.toFixed(3) + ' per compute·s');
  row('Next offer in', fmtTime(Math.max(0, state.contracts.nextOffer) * DAY_SECONDS));
  head.append(kv);
  const auto = el('button', 'btn small' + (state.settings.autoSign ? ' primary' : ''),
    state.settings.autoSign ? 'Auto-sign: on' : 'Auto-sign: off');
  auto.dataset.tip = 'Auto-sign|Takes the best offer that fits in your spare capacity, '
    + 'whenever a slot is free. Turn it on when placing machines is the part you enjoy.';
  auto.onclick = () => { state.settings.autoSign = !state.settings.autoSign; markDirty(); renderUI(); };
  const autoRow = el('div', 'btnrow'); autoRow.append(auto); head.append(autoRow);
  out.push(sec('Book', head));

  const act = state.contracts.active.map((c) => {
    const t = TEMPLATES_BY_ID[c.tid];
    const breached = c.effUptime < c.uptimeReq;
    const card = el('div', 'card' + (breached ? '' : ' owned'));
    const title = el('div', 'title');
    title.append(el('b', null, c.name));
    title.append(el('span', breached ? 'pill bad' : 'pill acc', breached ? 'SLA breach' : 'on track'));
    title.append(el('span', 'price ok', rate(c.livePay || c.pay)));
    card.append(title, el('div', 'desc', c.client + ' — ' + (t?.blurb || '')));
    const meta = el('div', 'meta');
    const bits = [
      ['needs', fmt(c.demand) + ' compute'],
      ['SLA', (c.uptimeReq * 100).toFixed(1) + '%'],
      ['actual', (c.effUptime * 100).toFixed(1) + '%'],
      ['ends', 'day ' + Math.ceil(c.endDay)],
      ['left', Math.max(0, c.endDay - state.day).toFixed(1) + ' days'],
    ];
    for (const [k, v] of bits) { const s = el('span'); s.append(k + ' ', el('b', null, v)); meta.append(s); }
    card.append(meta);
    const bar = el('div', 'bar' + (breached ? ' bad' : ''));
    bar.append(el('i'));
    bar.firstChild.style.width = clamp((state.day - c.startDay) / (c.endDay - c.startDay), 0, 1) * 100 + '%';
    card.append(bar);
    return card;
  });
  out.push(sec('Active (' + state.contracts.active.length + ')',
    act.length ? act : el('div', 'hint', 'Nothing signed. Take something off the board below.')));

  const committed = state.contracts.active.reduce((a, c) => a + c.demand, 0);
  const free = d.computeSellable - committed;
  const offers = state.contracts.offers.map((o) => {
    const t = TEMPLATES_BY_ID[o.tid];
    const fits = o.demand <= free * 1.02;
    const slot = state.contracts.active.length < d.contractSlots;
    const card = el('div', 'card click' + (fits && slot ? '' : ' cant'));
    const title = el('div', 'title');
    title.append(el('b', null, o.name));
    if (state.day - (o.posted ?? state.day) < 1.2) title.append(el('span', 'pill new', 'new'));
    title.append(el('span', fits ? 'pill acc' : 'pill warn', fits ? 'fits' : 'over capacity'));
    title.append(el('span', 'price ok', rate(o.pay * d.mods.priceMult)));
    card.append(title, el('div', 'desc', o.client + ' — ' + (t?.blurb || '')));
    const useFrac = free > 0 ? o.demand / free : Infinity;
    const meta = el('div', 'meta');
    const bits = [
      ['needs', fmt(o.demand) + ' compute'],
      ['uses', (isFinite(useFrac) ? Math.round(useFrac * 100) : 999) + '% of headroom'],
      ['bandwidth', fmt(o.net) + ' Gbps'],
      ['SLA', (o.uptimeReq * 100).toFixed(1) + '%'],
      ['you hold', (d.uptime * 100).toFixed(1) + '%'],
      ['term', o.days + ' days'],
      ['penalty', '×' + o.penalty + ' on breach'],
      ['expires', Math.max(0, (o.expires ?? state.day) - state.day).toFixed(1) + ' days'],
      ['total', money(o.pay * d.mods.priceMult * o.days * DAY_SECONDS)],
    ];
    for (const [k, v] of bits) { const s = el('span'); s.append(k + ' ', el('b', null, v)); meta.append(s); }
    card.append(meta);
    if (d.uptime < o.uptimeReq) {
      card.append(el('div', 'desc', 'Your uptime is below this SLA right now. '
        + 'Sign it and the penalty starts as soon as the ink dries.'));
    } else if (useFrac > 0.85) {
      card.append(el('div', 'desc', 'This takes almost everything you have spare. '
        + 'One bad event and you are under-delivering.'));
    }
    const btn = el('button', 'btn primary small', slot ? 'Sign' : 'No free slot');
    if (slot && fits) btn.dataset.sign = String(o.cid);
    btn.disabled = !slot;
    btn.onclick = () => app.act(() => signContract(state, d, o, app.hooks));
    const r = el('div', 'btnrow'); r.append(btn); card.append(r);
    return card;
  });
  out.push(sec('Offers', offers.length ? offers : el('div', 'hint', 'The board is empty. Wait for the next round.')));
  return out;
}

// ------------------------------------------------------------------ research

function panelResearch(state, d) {
  const out = [];
  const head = el('div', 'card');
  const kv = el('div', 'kv');
  kv.append(el('div', 'k', 'Points'), el('div', 'v', fmt(state.rp)));
  kv.append(el('div', 'k', 'Rate'), el('div', 'v', fmt(d.rpPerSec) + '/s'));
  kv.append(el('div', 'k', 'Compute on R&D'), el('div', 'v', fmt(d.computeResearch)));
  kv.append(el('div', 'k', 'Completed'), el('div', 'v', state.research.done.length + ' / ' + RESEARCH.length));
  head.append(kv);

  const label = el('div', 'hint', 'Research allocation: ' + Math.round(state.researchAlloc * 100)
    + '% of compute. The rest is what you can sell.');
  const slider = el('input');
  slider.type = 'range'; slider.min = '0'; slider.max = '60'; slider.step = '1';
  slider.value = String(Math.round(state.researchAlloc * 100));
  slider.oninput = () => {
    state.researchAlloc = Number(slider.value) / 100;
    label.textContent = 'Research allocation: ' + slider.value + '% of compute. The rest is what you can sell.';
  };
  head.append(label, slider);
  out.push(sec('Research', head));

  const catRow = el('div', 'btnrow');
  for (const c of RESEARCH_CATS) {
    const left = RESEARCH.filter((r) => r.cat === c.id && !state.research.done.includes(r.id)).length;
    const b = el('button', 'btn small' + (c.id === researchCat ? ' primary' : ''), c.name + (left ? ' ' + left : ' ✓'));
    b.onclick = () => { researchCat = c.id; markDirty(); renderUI(); };
    catRow.append(b);
  }
  out.push(sec(null, catRow));

  const inCat = RESEARCH.filter((r) => r.cat === researchCat);
  const groups = [
    ['Ready to buy', inCat.filter((r) => !state.research.done.includes(r.id) && available(r, state) && state.rp >= r.cost)],
    ['Saving up for', inCat.filter((r) => !state.research.done.includes(r.id) && available(r, state) && state.rp < r.cost)],
    ['Locked', inCat.filter((r) => !state.research.done.includes(r.id) && !available(r, state))],
    ['Completed', inCat.filter((r) => state.research.done.includes(r.id))],
  ];
  const cardFor = ((node) => {
    const done = state.research.done.includes(node.id);
    const ok = available(node, state);
    const afford = state.rp >= node.cost;
    const missing = node.req.filter((r) => !state.research.done.includes(r))
      .map((r) => RESEARCH_BY_ID[r]?.name || r).join(', ');
    return listRow({
      iconText: done ? '✓' : fmt(node.cost),
      iconColor: done ? '#4fe0ac' : afford && ok ? '#4fe0ac' : '#8598ac',
      name: node.name,
      price: done ? '' : fmt(node.cost) + ' RP',
      priceOk: afford && !done,
      desc: node.desc,
      note: !ok && !done ? 'Needs ' + missing : null,
      cls: done ? 'owned' : ok ? (afford ? '' : 'cant') : 'locked',
      onClick: !done && ok ? () => app.act(() => A.buyResearch(state, node.id, app.hooks)) : null,
    });
  });
  for (const [name, list] of groups) {
    if (!list.length) continue;
    out.push(sec(name + ' (' + list.length + ')', list.map(cardFor)));
  }
  return out;
}

// ------------------------------------------------------------------ upgrades

function panelUpgrades(state, d) {
  const order = [...UPGRADES].sort((a, b) => {
    const ao = state.upgrades.includes(a.id) ? 1 : 0;
    const bo = state.upgrades.includes(b.id) ? 1 : 0;
    return ao - bo || a.cost - b.cost;
  });
  const cards = order.map((u) => {
    const owned = state.upgrades.includes(u.id);
    const afford = state.money >= u.cost;
    return listRow({
      iconText: u.cat.slice(0, 3).toUpperCase(),
      iconColor: owned ? '#4fe0ac' : afford ? '#55a0f0' : '#8598ac',
      name: u.name,
      pills: [{ text: u.cat }],
      price: owned ? 'owned' : money(u.cost),
      priceOk: afford && !owned,
      desc: u.desc,
      cls: owned ? 'owned' : afford ? '' : 'cant',
      onClick: owned ? null : () => app.act(() => A.buyUpgrade(state, d, u.id, app.hooks)),
    });
  });
  return [
    sec(null, el('div', 'hint', 'Permanent, one-off purchases. They never expire and survive nothing but a company sale.')),
    sec('Upgrades (' + state.upgrades.length + '/' + UPGRADES.length + ')', cards),
  ];
}

// --------------------------------------------------------------------- staff

function panelStaff(state, d) {
  const out = [];
  const head = el('div', 'card');
  const kv = el('div', 'kv');
  kv.append(el('div', 'k', 'Headcount'), el('div', 'v', d.staffTotal + ' / ' + d.staffCap));
  kv.append(el('div', 'k', 'Salaries'), el('div', 'v', money(d.salaries * d.mods.upkeepMult) + '/day'));
  head.append(kv);
  out.push(sec('Payroll', head));

  const cards = STAFF.map((role) => {
    const unlocked = !role.req || state.research.done.includes(role.req);
    const have = state.staff[role.id];
    const cost = A.staffCost(role.id, have);
    const buttons = [];
    if (unlocked) {
      const hire = el('button', 'btn primary small', 'Hire');
      hire.disabled = d.staffTotal >= d.staffCap || state.money < cost;
      hire.onclick = () => app.act(() => A.hire(state, d, role.id, app.hooks));
      const fireB = el('button', 'btn small danger', 'Let go');
      fireB.disabled = have === 0;
      fireB.onclick = () => app.act(() => A.fire(state, role.id, app.hooks));
      buttons.push(hire, fireB);
    }
    return listRow({
      iconText: role.name.slice(0, 3).toUpperCase(),
      iconColor: role.color,
      name: role.name,
      pills: [{ text: have + ' employed', cls: have ? 'acc' : '' }],
      price: money(cost) + ' to hire',
      priceOk: state.money >= cost,
      desc: role.desc,
      meta: [['salary', money(role.salary) + '/day']],
      note: unlocked ? null : 'Needs ' + (RESEARCH_BY_ID[role.req]?.name || role.req),
      cls: unlocked ? '' : 'locked',
      buttons,
    });
  });
  out.push(sec('Roles', cards));
  return out;
}

// ----------------------------------------------------------------- utilities

function panelUtilities(state, d) {
  const out = [];

  // Power.
  const cap = A.gridCap(state);
  const p = el('div', 'card');
  const kv = el('div', 'kv');
  const row = (k, v) => kv.append(el('div', 'k', k), el('div', 'v', v));
  row('Draw', fmt(d.actualDraw) + ' kW');
  row('Firm supply', fmt(d.firmSupply) + ' kW');
  row('Utility feed', fmt(state.gridPower) + ' / ' + fmt(cap) + ' kW');
  row('On site', fmt(d.ownSupply) + ' kW');
  row('Headroom', fmt(d.supplyKW - d.actualDraw) + ' kW');
  row('Electricity price', '$' + state.market.power.toFixed(3) + ' /kWh');
  row('Power bill', rate(d.powerCost));
  row('Fuel bill', rate(d.fuelCost));
  if ((d.counts.rideSeconds || 0) > 0) row('UPS charge', Math.round(state.upsCharge * 100) + '%');
  p.append(kv);
  const bar = el('div', 'bar' + (d.rawPowerFactor < 1 ? ' bad' : ''));
  bar.append(el('i'));
  bar.firstChild.style.width = clamp(d.actualDraw / Math.max(d.supplyKW, 1e-9), 0, 1) * 100 + '%';
  p.append(bar);

  const buys = el('div', 'btnrow');
  for (const [label, kw] of [['+10%', Math.max(2, state.gridPower * 0.1)],
    ['+50%', Math.max(5, state.gridPower * 0.5)], ['×2', Math.max(10, state.gridPower)]]) {
    const room = Math.max(0, cap - state.gridPower);
    const n = Math.min(kw, room);
    const cost = A.gridUpgradeCost(state, n);
    const b = el('button', 'btn small', label + ' — ' + money(cost));
    b.disabled = n <= 0 || state.money < cost;
    b.onclick = () => app.act(() => A.buyGrid(state, n, app.hooks));
    buys.append(b);
  }
  const maxB = el('button', 'btn small primary', 'Max: +' + fmt(A.maxGrid(state)) + ' kW');
  maxB.disabled = A.maxGrid(state) <= 0;
  maxB.onclick = () => app.act(() => A.buyGrid(state, A.maxGrid(state), app.hooks));
  buys.append(maxB);
  p.append(buys);
  if (state.gridPower >= cap - 0.001) {
    p.append(el('div', 'desc', 'The utility will not sell this site any more capacity. '
      + 'Generate it yourself, or move to a bigger facility.'));
  }
  out.push(sec('Electricity', p));

  // Cooling.
  const cool = el('div', 'card');
  const ck = el('div', 'kv');
  const crow = (k, v) => ck.append(el('div', 'k', k), el('div', 'v', v));
  crow('Heat load', fmt(d.heatLoad) + ' kW');
  crow('Cooling capacity', fmt(d.coolCap) + ' kW');
  crow('Outside air', d.ambient.toFixed(1) + ' °C');
  crow('Hottest rack', d.maxTemp.toFixed(1) + ' °C');
  crow('Average rack', d.avgTemp.toFixed(1) + ' °C');
  cool.append(ck);
  const cbar = el('div', 'bar' + (d.coolCap < d.heatLoad ? ' bad' : d.coolCap < d.heatLoad * 1.15 ? ' warn' : ''));
  cbar.append(el('i'));
  cbar.firstChild.style.width = clamp(d.heatLoad / Math.max(d.coolCap, 1e-9), 0, 1) * 100 + '%';
  cool.append(cbar);
  cool.append(el('div', 'desc', 'Cooling only reaches racks inside its radius. Use the Cooling overlay '
    + 'to find racks nothing is pointed at.'));
  out.push(sec('Heat', cool));

  // Water.
  const w = el('div', 'card');
  const wk = el('div', 'kv');
  const wrow = (k, v) => wk.append(el('div', 'k', k), el('div', 'v', v));
  wrow('Supply', fmt(d.waterSupply) + ' L/s');
  wrow('Demand', fmt(d.waterDemand) + ' L/s');
  wrow('Coverage', Math.round(d.waterFactor * 100) + '%');
  wrow('Water bill', rate(d.waterBill));
  w.append(wk);
  const wbar = el('div', 'bar' + (d.waterFactor < 0.99 ? ' bad' : ''));
  wbar.append(el('i'));
  wbar.firstChild.style.width = clamp(d.waterDemand / Math.max(d.waterSupply, 1e-9), 0, 1) * 100 + '%';
  w.append(wbar);
  w.append(el('div', 'desc', 'Short of water and your cooling loses capacity, whatever the nameplate says.'));
  out.push(sec('Water', w));

  // Network.
  const n = el('div', 'card');
  const nk = el('div', 'kv');
  nk.append(el('div', 'k', 'Switching'), el('div', 'v', fmt(d.netCap) + ' Gbps'));
  nk.append(el('div', 'k', 'Required'), el('div', 'v', fmt(d.netNeed) + ' Gbps'));
  nk.append(el('div', 'k', 'Throughput'), el('div', 'v', Math.round(d.netFactor * 100) + '%'));
  n.append(nk);
  const nbar = el('div', 'bar' + (d.netFactor < 0.999 ? ' warn' : ''));
  nbar.append(el('i'));
  nbar.firstChild.style.width = clamp(d.netNeed / Math.max(d.netCap, 1e-9), 0, 1) * 100 + '%';
  n.append(nbar);
  out.push(sec('Network', n));

  // Ledger.
  const led = el('div', 'card');
  const t = el('table', 'grid');
  const head = el('tr');
  head.append(el('th', null, 'Line'), el('th', null, 'Per second'));
  t.append(head);
  const line = (k, v, cls) => {
    const tr = el('tr');
    const a = el('td', null, k), b = el('td', null, v);
    if (cls) b.style.color = cls;
    tr.append(a, b); t.append(tr);
  };
  line('Contract revenue', '+' + money(d.revenue), '#6fe0a0');
  line('Electricity', '−' + money(d.powerCost), '#e8615f');
  line('Fuel', '−' + money(d.fuelCost), '#e8615f');
  line('Water', '−' + money(d.waterBill), '#e8615f');
  line('Upkeep & salaries', '−' + money(d.upkeepCost), '#e8615f');
  line('SLA penalties', '−' + money(d.penalties), '#e8615f');
  line('Net', (d.netIncome >= 0 ? '+' : '−') + money(Math.abs(d.netIncome)),
    d.netIncome >= 0 ? '#6fe0a0' : '#e8615f');
  led.append(t);
  out.push(sec('Ledger', led));
  return out;
}

// ---------------------------------------------------------------------- site

function panelSite(state, d) {
  const out = [];
  const f = d.fac;
  const next = A.nextFacility(state);

  const c = el('div', 'card');
  const kv = el('div', 'kv');
  kv.append(el('div', 'k', 'Facility'), el('div', 'v', f.name));
  kv.append(el('div', 'k', 'Floor'), el('div', 'v', f.w + ' × ' + f.h + ' tiles'));
  kv.append(el('div', 'k', 'Used'), el('div', 'v', Object.keys(state.tiles).length + ' / ' + (f.w * f.h)));
  kv.append(el('div', 'k', 'Ambient'), el('div', 'v', f.ambient + ' °C'));
  kv.append(el('div', 'k', 'Utility cap'), el('div', 'v', fmt(f.gridCap) + ' kW'));
  c.append(kv, el('div', 'desc', f.desc));
  if (next) {
    const need = [];
    if (state.reputation < (next.rep || 0)) need.push(fmt(next.rep) + ' reputation');
    if (state.money < next.cost) need.push(money(next.cost));
    const b = el('button', 'btn primary', 'Move into ' + next.name + ' — ' + money(next.cost));
    b.disabled = need.length > 0;
    b.onclick = () => app.act(() => A.upgradeFacility(state, app.hooks));
    const r = el('div', 'btnrow'); r.append(b);
    c.append(r);
    c.append(el('div', 'desc', next.w + ' × ' + next.h + ' tiles, ' + fmt(next.gridCap)
      + ' kW utility cap. ' + next.desc + (need.length ? ' Needs ' + need.join(' and ') + '.' : '')));
  } else {
    c.append(el('div', 'desc', 'There is nothing bigger to move into.'));
  }
  out.push(sec('Facility', c));

  const objDone = state.objectives.done.length;
  const objCards = OBJECTIVES.map((o, i) => {
    const done = i < objDone;
    const cur = i === objDone;
    const card = el('div', 'card' + (done ? ' owned' : cur ? '' : ' locked'));
    const title = el('div', 'title');
    title.append(el('b', null, (i + 1) + '. ' + o.name));
    if (cur) title.append(el('span', 'pill acc', 'current'));
    const rw = [];
    if (o.reward?.money) rw.push(money(o.reward.money));
    if (o.reward?.rp) rw.push(fmt(o.reward.rp) + ' RP');
    title.append(el('span', 'price', rw.join(' + ')));
    card.append(title);
    if (done || cur) card.append(el('div', 'desc', o.hint));
    return card;
  });
  out.push(sec('Objectives (' + objDone + '/' + OBJECTIVES.length + ')', objCards));

  const ach = ACHIEVEMENTS.map((a) => {
    const got = state.achievements.includes(a.id);
    const card = el('div', 'card' + (got ? ' owned' : ' locked'));
    const title = el('div', 'title');
    title.append(el('b', null, a.name));
    if (got) title.append(el('span', 'pill acc', 'unlocked'));
    card.append(title, el('div', 'desc', a.desc));
    return card;
  });
  out.push(sec('Achievements (' + state.achievements.length + '/' + ACHIEVEMENTS.length + ')', ach));

  const mods = el('div', 'card');
  const mt = el('table', 'grid');
  const mrow = (k, v, good) => {
    const tr = el('tr');
    const cell = el('td', null, v);
    cell.style.color = good ? '#6fe0a0' : '#e8b44a';
    tr.append(el('td', null, k), cell);
    mt.append(tr);
  };
  const pct = (v) => (v >= 1 ? '+' : '') + Math.round((v - 1) * 100) + '%';
  mrow('Compute per unit', pct(d.mods.computeMult), d.mods.computeMult >= 1);
  mrow('Hardware power', pct(d.mods.powerMult), d.mods.powerMult <= 1);
  mrow('Hardware heat', pct(d.mods.heatMult), d.mods.heatMult <= 1);
  mrow('Cooling capacity', pct(d.mods.coolMult), d.mods.coolMult >= 1);
  mrow('Cooling water use', pct(d.mods.waterMult), d.mods.waterMult <= 1);
  mrow('Hardware wear', pct(d.mods.wearMult), d.mods.wearMult <= 1);
  mrow('Repair speed', pct(d.mods.repairMult), d.mods.repairMult >= 1);
  mrow('Contract pay', pct(d.mods.priceMult), d.mods.priceMult >= 1);
  mrow('Electricity price', pct(d.mods.gridCostMult), d.mods.gridCostMult <= 1);
  mrow('Building cost', pct(d.mods.buildCostMult), d.mods.buildCostMult <= 1);
  mrow('Hardware cost', pct(d.mods.hwCostMult), d.mods.hwCostMult <= 1);
  mrow('Slots per rack', '+' + Math.floor(d.mods.rackSlotBonus), true);
  mods.append(mt);
  out.push(sec('Everything you have bought so far', mods));

  const hist = el('div', 'card');
  const entries = (app.log || []).slice(-40).reverse();
  if (!entries.length) hist.append(el('div', 'desc', 'Nothing has happened yet.'));
  else {
    const ht = el('table', 'grid');
    for (const e of entries) {
      const tr = el('tr');
      const day = el('td', null, 'day ' + e.day);
      day.style.color = '#55677b';
      day.style.width = '58px';
      const txt = el('td', null, e.text);
      txt.style.fontFamily = 'var(--sans)';
      if (e.tone === 'good') txt.style.color = '#6fe0a0';
      if (e.tone === 'bad') txt.style.color = '#e8615f';
      tr.append(day, txt);
      ht.append(tr);
    }
    hist.append(ht);
  }
  out.push(sec('Site log', hist));

  const st = el('div', 'card');
  const t = el('table', 'grid');
  const rows = [
    ['Playtime', fmtTime(state.playtime)],
    ['Days elapsed', Math.floor(state.day)],
    ['Lifetime revenue', money(state.lifetimeEarnings)],
    ['Peak compute', fmt(state.stats.peakCompute)],
    ['Peak net income', rate(state.stats.peakIncome)],
    ['Machines built', fmtInt(state.stats.built)],
    ['Units installed', fmtInt(state.stats.installed)],
    ['Units failed', fmtInt(state.stats.failed)],
    ['Units repaired', fmtInt(state.stats.repaired)],
    ['Contracts completed', fmtInt(state.stats.contractsDone)],
    ['SLA breaches', fmtInt(state.stats.breaches)],
    ['Research points earned', fmt(state.rpLifetime)],
    ['Company sales', state.legacy.resets],
  ];
  for (const [k, v] of rows) {
    const tr = el('tr'); tr.append(el('td', null, k), el('td', null, String(v))); t.append(tr);
  }
  st.append(t);
  out.push(sec('Statistics', st));
  return out;
}

// -------------------------------------------------------------------- legacy

function panelLegacy(state, d) {
  const out = [];
  const gain = legacyGain(state);
  const c = el('div', 'card');
  const kv = el('div', 'kv');
  kv.append(el('div', 'k', 'Legacy points'), el('div', 'v', fmtInt(state.legacy.points)));
  kv.append(el('div', 'k', 'Company sales'), el('div', 'v', String(state.legacy.resets)));
  kv.append(el('div', 'k', 'This run would give'), el('div', 'v', fmtInt(gain)));
  c.append(kv);
  c.append(el('div', 'desc', 'Selling the company resets the floor, your cash, research and contracts. '
    + 'Legacy points and perks stay, and so do achievements. You need Data hall A (tier 4) before anybody will buy.'));
  const b = el('button', 'btn primary', canPrestige(state) ? 'Sell the company for ' + fmtInt(gain) + ' points' : 'Not sellable yet');
  b.disabled = !canPrestige(state);
  b.onclick = () => app.confirmPrestige();
  const r = el('div', 'btnrow'); r.append(b); c.append(r);
  out.push(sec('Exit', c));

  const perks = LEGACY_PERKS.map((p) => {
    const lvl = state.legacy.perks[p.id] || 0;
    const maxed = lvl >= p.max;
    const cost = perkCost(p, lvl);
    const afford = state.legacy.points >= cost;
    const card = el('div', 'card' + (maxed ? ' owned' : afford ? ' click' : ' cant'));
    const title = el('div', 'title');
    title.append(el('b', null, p.name), el('span', 'pill', lvl + ' / ' + p.max));
    title.append(el('span', 'price' + (afford && !maxed ? ' ok' : ''), maxed ? 'maxed' : cost + ' LP'));
    card.append(title, el('div', 'desc', p.desc));
    if (!maxed) card.onclick = () => app.act(() => A.buyPerk(state, p.id, app.hooks));
    return card;
  });
  out.push(sec('Legacy perks', perks));
  return out;
}

// ----------------------------------------------------------------- inspector

export function renderInspector(state, d) {
  const box = document.getElementById('inspector');
  const sel = app.view.sel;
  if (!sel) {
    // With nothing selected, this space is worth more as a to-do list.
    const sig = d.problems.map((p) => p.text).join('|');
    if (box.dataset.sig === sig) return;
    box.dataset.sig = sig;
    box.dataset.mode = 'todo';
    const kids = [];
    kids.push(el('div', 'todohead', d.problems.length
      ? 'Needs attention' : 'Nothing needs attention'));
    if (!d.problems.length) {
      kids.push(el('div', 'empty',
        'The site is balanced and everything is sold. Build more, or push research.'));
    }
    for (const p of d.problems.slice(0, 6)) {
      const row = el('button', 'todo ' + p.tone);
      row.append(el('span', 'dot'), el('span', 'txt', p.text), el('span', 'go', 'fix →'));
      row.onclick = () => {
        if (p.overlay) app.setOverlay(p.overlay);
        if (p.cat) setBuildCat(p.cat);
        goTab(p.tab);
      };
      kids.push(row);
    }
    kids.push(el('div', 'empty', 'Click any tile on the floor to inspect it instead.'));
    fill(box, kids);
    return;
  }
  box.dataset.sig = '';
  const tile = tileAt(state, sel.x, sel.y);
  if (!tile) {
    box.dataset.mode = 'blank';
    fill(box, el('div', 'empty', 'Empty tile at ' + sel.x + ',' + sel.y
      + '. Pick something in the Build tab and click here.'));
    return;
  }
  box.dataset.mode = 'tile';
  const b = BUILDINGS_BY_ID[tile.b];
  const kids = [];
  const head = el('div', 'title');
  head.append(el('b', null, b.name), el('span', 'pill', sel.x + ',' + sel.y));
  const sellBtn = el('button', 'btn small danger', 'Demolish (50% back)');
  sellBtn.onclick = () => app.act(() => A.sell(state, d, sel.x, sel.y, app.hooks));
  kids.push(head);

  const r = d.racks.find((x) => x.x === sel.x && x.y === sel.y);
  if (r) {
    const kv = el('div', 'kv');
    const row = (k, v) => kv.append(el('div', 'k', k), el('div', 'v', v));
    row('Slots', r.used + ' / ' + r.cap);
    row('Temperature', r.temp.toFixed(1) + ' °C');
    row('Cooling cover', Math.round(r.cover * 100) + '%');
    row('Power cover', Math.round(r.pduFactor * 100) + '%');
    row('Throttle', Math.round(r.throttle * 100) + '%');
    row('Compute', fmt(r.output));
    row('Draw', fmt(r.power * r.load) + ' kW');
    row('Heat', fmt(r.liveHeat) + ' kW');
    row('Units down', r.down + (r.broken ? ' (' + r.broken + ' failed)' : ''));
    kids.push(kv);
    if (r.pduFactor < 0.999) kids.push(el('div', 'desc', 'Not enough local power — add a PDU in range or a bigger one.'));
    if (r.cover < 0.999) kids.push(el('div', 'desc', 'Cooling does not reach this rack, or is over capacity.'));

    const t = el('table', 'grid');
    const hr = el('tr');
    hr.append(el('th', null, 'Installed'), el('th', null, 'Qty'), el('th', null, 'Down'),
      el('th', null, 'Condition'), el('th', null, ''));
    t.append(hr);
    for (const g of tile.units || []) {
      const hw = HARDWARE_BY_ID[g.t];
      const tr = el('tr');
      const rm = el('button', 'btn small', 'sell');
      rm.onclick = () => app.act(() => A.uninstall(state, d, tile, g.t, g.n, app.hooks));
      const cell = el('td'); cell.append(rm);
      tr.append(el('td', null, hw?.name || g.t), el('td', null, fmtInt(g.n)),
        el('td', null, String(g.broken)), el('td', null, Math.round(g.cond * 100) + '%'), cell);
      t.append(tr);
    }
    if ((tile.units || []).length) kids.push(t);
  } else {
    const kv = el('div', 'kv');
    const row = (k, v) => kv.append(el('div', 'k', k), el('div', 'v', v));
    if (b.radius) row('Radius', b.radius + ' tiles');
    if (b.powerCap) row('Distributes', fmt(b.powerCap) + ' kW');
    if (b.coolCap) row('Removes', fmt(b.coolCap * d.mods.coolMult) + ' kW');
    if (b.supplyKW) row('Generates', fmt(b.supplyKW) + ' kW');
    if (b.supplyWater) row('Supplies', fmt(b.supplyWater) + ' L/s');
    if (b.net) row('Switching', fmt(b.net) + ' Gbps');
    if (b.draw) row('Draws', fmt(b.draw) + ' kW');
    if (b.upkeep) row('Upkeep', money(b.upkeep) + '/day');
    kids.push(kv, el('div', 'desc', b.desc));
  }
  const btns = el('div', 'btnrow');
  btns.append(sellBtn);
  kids.push(btns);
  fill(box, kids);
}

// -------------------------------------------------------------- live events

/** Chips for whatever is currently distorting the numbers. */
let eventSig = '';

export function renderEvents(state) {
  const box = document.getElementById('events');
  const list = state.events.active;
  // Only rebuild when the set changes, so a chip you are hovering survives.
  const sig = list.map((e) => e.id + ':' + Math.round(e.until * 10)).join('|');
  if (sig === eventSig) {
    const spans = box.querySelectorAll('.ev .t');
    list.forEach((ev, i) => {
      if (spans[i]) spans[i].textContent = Math.max(0, ev.until - state.day).toFixed(1) + 'd left';
    });
    return;
  }
  eventSig = sig;
  if (!list.length) { box.replaceChildren(); return; }
  fill(box, list.map((ev) => {
    const def = EVENTS_BY_ID[ev.id];
    const tone = ev.tone || def?.tone || 'neutral';
    const name = ev.label || def?.name || ev.id;
    const left = Math.max(0, ev.until - state.day);
    const chip = el('div', 'ev ' + (tone === 'good' ? 'good' : tone === 'bad' ? 'bad' : ''));
    chip.append(el('b', null, name), el('span', 't', left.toFixed(1) + 'd left'));
    chip.dataset.tip = name + '|' + (def?.text || 'In effect until day ' + Math.ceil(ev.until))
      + '\n' + describeMods(ev.mods || def?.mods || {});
    return chip;
  }));
}

const MOD_NAMES = {
  coolMult: 'cooling capacity', powerSupplyMult: 'power supply', waterSupplyMult: 'water supply',
  priceMult: 'contract pay', gridCostMult: 'electricity price', wearMult: 'hardware wear',
  computeMult: 'compute', researchMult: 'research rate',
};

function describeMods(mods) {
  const bits = [];
  for (const k in mods) {
    const name = MOD_NAMES[k] || k;
    const pct = Math.round((mods[k] - 1) * 100);
    if (pct) bits.push((pct > 0 ? '+' : '') + pct + '% ' + name);
  }
  return bits.length ? bits.join(', ') : 'no direct effect on the numbers';
}

// ------------------------------------------------------------------ tutorial

let aimed = [];
let builtStep = -1;

function clearAim() {
  for (const n of aimed) n.classList.remove('tut-target');
  aimed = [];
}

function applyAim(state, step) {
  clearAim();
  let sels = [];
  try { sels = step.aim(state, app.view) || []; } catch (err) { sels = []; }
  for (const sel of sels) {
    const n = document.querySelector(sel);
    if (n) { n.classList.add('tut-target'); aimed.push(n); }
  }
}

export function renderTutorial(state) {
  const box = document.getElementById('tutorial');
  const step = tutStep(state);
  if (!step) {
    if (!box.hidden) { box.hidden = true; box.replaceChildren(); }
    builtStep = -1;
    clearAim();
    return;
  }
  const idx = state.tutorial.step;
  if (builtStep !== idx) {
    builtStep = idx;
    // Put the player where the step happens, once, then leave them alone.
    if (step.tab) tab = step.tab;
    if (step.cat) buildCat = step.cat;
    syncTabs();
    markDirty();

    const kids = [];
    kids.push(el('div', 'tk', 'Getting started · step ' + (idx + 1) + ' of ' + STEPS.length));
    kids.push(el('div', 'tt', step.title));
    kids.push(el('div', 'tb', step.body));
    if (step.note) kids.push(el('div', 'tn', step.note));
    const dots = el('div', 'tdots');
    for (let i = 0; i < STEPS.length; i++) dots.append(el('i', i < idx ? 'on' : i === idx ? 'now' : ''));
    const skipBtn = el('button', 'tskip', 'Skip the guide');
    skipBtn.onclick = () => { tutSkip(state); renderTutorial(state); markDirty(); renderUI(); };
    const foot = el('div', 'tfoot');
    foot.append(dots, skipBtn);
    kids.push(foot);
    fill(box, kids);
    box.hidden = false;
  }
  applyAim(state, step);
}

// ----------------------------------------------------------------- objective

export function renderObjective(state) {
  const box = document.getElementById('objective');
  const step = tutStep(state);
  if (step) {
    fill(box, el('div', 'k', 'Getting started ' + (state.tutorial.step + 1) + '/' + STEPS.length),
      el('div', 'n', step.title), el('div', 'h', step.body.split('.')[0] + '.'));
    return;
  }
  const i = state.objectives.done.length;
  const o = OBJECTIVES[i];
  const kids = [el('div', 'k', o ? 'Objective ' + (i + 1) + ' of ' + OBJECTIVES.length : 'All objectives complete')];
  if (o) {
    kids.push(el('div', 'n', o.name));
    kids.push(el('div', 'h', o.hint));
  } else {
    kids.push(el('div', 'n', 'You have built the whole thing.'));
  }
  fill(box, kids);
}

export function pushLog(entries) {
  const feed = document.getElementById('logfeed');
  fill(feed, entries.slice(-4).reverse().map((e) => el('span', 'e ' + (e.tone || ''), e.text)));
}
