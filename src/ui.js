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
import { BUILDINGS as ALL_BUILDINGS } from './data/buildings.js';
import { legacyGain, canPrestige, rackCapacity, signContract } from './sim.js';
import * as SIM from './sim.js';
import { tileAt, DAY_SECONDS } from './state.js';
import { iconFor } from './render.js';
import { STAGES, stageOf, drawTown, townStrands, population } from './town.js';
import { roomOf, EXPAND_CAP } from './state.js';
import { STEPS, current as tutStep, skip as tutSkip } from './tutorial.js';

let app = null;
let tab = 'build';
let buildCat = 'compute';
let researchCat = 'hardware';
let dirty = true;

/** Which tab actually fixes each bottleneck the simulation can report. */
const FIX_TAB = {
  'no servers installed': 'racks',
  'not enough electricity': 'ops',
  'a rack has no power nearby': 'build',
  'not enough network': 'build',
  'not enough water': 'build',
  'not enough cooling': 'build',
  'compute going to waste': 'deals',
  'empty space in your racks': 'racks',
};

export const TABS = [
  { id: 'build', name: 'Build' },
  { id: 'racks', name: 'Servers' },
  { id: 'deals', name: 'Deals' },
  { id: 'upgrade', name: 'Upgrade' },
  { id: 'ops', name: 'Utilities' },
  { id: 'site', name: 'Site' },
  { id: 'town', name: 'Town' },
];

export function initUI(a) {
  app = a;
  const tabs = document.getElementById('tabs');
  fill(tabs, TABS.map((t) => {
    const b = el('button', 'tab' + (t.id === tab ? ' on' : ''), t.name);
    b.dataset.tab = t.id;
    b.onclick = () => {
      tab = t.id;
      // The guide's last step asks you to go and look at the town; this is how
      // it knows you did.
      if (t.id === 'town' && app.state?.tutorial) app.state.tutorial.sawTown = true;
      markDirty(); syncTabs(); renderUI();
    };
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
  sellBtn.dataset.tip = 'Demolish|Click anything on the floor to remove it. You get half the money back. Drag to clear a row.';
  sellBtn.onclick = () => {
    app.view.tool = app.view.tool === 'sell' ? null : 'sell';
    sellBtn.classList.toggle('on', app.view.tool === 'sell');
    markDirty(); renderUI();
  };
  const turnBtn = el('button', 'tool', '\u21BB Turn');
  turnBtn.dataset.tip = 'Turn the room|A quarter turn anticlockwise, so you can see behind the '
    + 'tall buildings. R does the same.';
  turnBtn.onclick = () => { app.view.turn(1); };
  const centreBtn = el('button', 'tool', 'Recentre');
  centreBtn.dataset.tip = 'Recentre|Fit the whole floor back on screen.';
  centreBtn.onclick = () => app.view.centre(app.state);
  // Holding a machine is a mode, and a mode you cannot see is a mode you put
  // down by accident. This floats over the floor rather than living in the
  // toolbar, because the toolbar scrolls sideways on a phone and a button you
  // have to go looking for is no use. Escape does the same on a keyboard.
  const dropBtn = el('button', 'dropbtn', '');
  dropBtn.hidden = true;
  dropBtn.dataset.tip = 'Put it down|Stops placing, so clicking the floor does nothing. Escape works too.';
  dropBtn.onclick = () => app.clearTool();
  document.getElementById('canvaswrap').append(dropBtn);

  fill(tools, [...overlayBtns, sellBtn, turnBtn, centreBtn]);
  app.sellBtn = sellBtn;
  app.dropBtn = dropBtn;
}

/** Keep the "put it down" button in step with whatever is held. */
export function syncTool() {
  const b = app.dropBtn;
  if (!b) return;
  const t = app.view?.tool;
  const name = t === 'sell' ? 'Demolish'
    : t ? (ALL_BUILDINGS.find((x) => x.id === t)?.name || 'building') : null;
  if (b._name !== name) {
    b._name = name;
    if (name) {
      b.textContent = '\u2715';
      // The name lives in the label and the tooltip rather than on the button,
      // which only has to be findable — the list row already says "selected".
      b.setAttribute('aria-label', 'Put down ' + name.toLowerCase());
      b.dataset.tip = 'Put down ' + name.toLowerCase()
        + '|Stops placing, so clicking the floor does nothing. Escape works too.';
    }
  }
  if (b.hidden === !!name) b.hidden = !name;
}

function syncTabs() {
  for (const b of document.querySelectorAll('#tabs .tab')) {
    b.classList.toggle('on', b.dataset.tab === tab);
  }
}

export function markDirty() { dirty = true; }
export function setBuildCat(c) { buildCat = c; }
export function currentTab() { return tab; }
export function goTab(id) {
  tab = id;
  if (id === 'town' && app.state?.tutorial) app.state.tutorial.sawTown = true;
  syncTabs(); markDirty(); renderUI();
}

// ------------------------------------------------------------------ top bar

let topBuilt = null;

/**
 * Built once and written into. Grouped rather than gridded: money and compute
 * read as headlines, the four utilities as meters, everything else as small
 * pairs. Eleven identical boxes was a spreadsheet, not a control room.
 */
const SPK = '<svg viewBox="0 0 20 16" aria-hidden="true"><path d="M2 6h3l4-3.5v11L5 10H2z"/>';
const WAVE = '<path class="w1" d="M12 5.6a4.4 4.4 0 0 1 0 4.8"/><path class="w2" d="M14.6 3.4a7.6 7.6 0 0 1 0 9.2"/>';
const MUTE = '<path class="x" d="M12.4 5.4l4.4 5.2M16.8 5.4l-4.4 5.2"/>';
/** Line-art speaker, on or muted. */
function speaker(on) { return SPK + (on ? WAVE : MUTE) + '</svg>'; }

/**
 * Fit the top bar by measuring it, not by guessing breakpoints in pixels.
 *
 * The bar never wraps and never changes height, so anything that does not fit
 * spills over its neighbour — which is how TEMP ended up printed on top of
 * COOL on a machine whose system font is wider than the one the breakpoints
 * were tuned against. Widths depend on the viewer's fonts, so they have to be
 * measured on the viewer's machine. The readouts duplicated inside the panels
 * are dropped, widest first, until the row fits.
 */
/**
 * What the bar sheds, in the order it sheds it. Each level is only reached if
 * the one before it was not enough.
 */
const FIT_LEVELS = ['hide-minis', 'hide-meters', 'tight'];

let fitSig = -1;
export function fitTopBar(force) {
  const bar = document.getElementById('topbar');
  if (!bar || bar.offsetParent === null) return;
  // Only the window width can change the answer. The readouts have fixed
  // widths, so a rolling number cannot.
  //
  // This used to include the cash and compute text in its signature, which
  // meant it re-ran on every frame the counters ticked — and every run took
  // the blocks out, measured, and put them back. That is what made the
  // temperature and uptime readouts flash in and out while you played.
  const width = bar.clientWidth;
  // Re-measure when the window changed, or when the bar is overflowing right
  // now — the latter catches content that grew after the first measurement,
  // for instance because a webfont finished loading. Reading scrollWidth is
  // cheap; it is the remove-and-re-add below that must not run every frame.
  //
  // The guard stops at the last level rather than the first: once everything
  // has been shed there is nothing further to do, and re-measuring forever
  // would be the flicker all over again. Until then, content that grows after
  // the fit settled — a live count arriving from the server, say — still gets
  // a fresh measurement.
  const spilling = bar.scrollWidth > bar.clientWidth + 1
    && !bar.classList.contains(FIT_LEVELS[FIT_LEVELS.length - 1]);
  if (!force && width === fitSig && !spilling) return;
  fitSig = width;
  bar.classList.remove(...FIT_LEVELS);
  for (const level of FIT_LEVELS) {
    if (bar.scrollWidth <= bar.clientWidth + 1) break;
    bar.classList.add(level);
  }
}

export function renderTop(state, d) {
  const bar = document.getElementById('topbar');
  if (!topBuilt) {
    const mk = {};
    const vital = (id, label) => {
      const n = el('div', 'vital');
      n.id = id;
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
    minis.append(mini('x_temp', 'Temp'), mini('x_up', 'Uptime'), mini('x_rp', 'Points'),
      mini('x_rep', 'Name'), mini('x_con', 'Deals'), mini('x_owed', 'Owed'));

    // Speed is a labelled segmented control. It is one of the two things a new
    // player looks for, so it is not allowed to be subtle.
    const speed = el('div', 'speeds');
    speed.append(el('div', 'speedlbl', 'Speed'));
    const speedBtns = [];
    for (const [v, label, tip] of SPEEDS) {
      const btn = el('button', 'sp', label);
      btn.dataset.tip = (v === 0 ? 'Pause' : label + ' speed') + '|' + tip;
      btn.onclick = () => {
        app.state.settings.speed = v;
        if (v > 0) app.state.settings.lastSpeed = v;
        renderTop(app.state, app.d);
      };
      speedBtns.push({ v, btn });
      speed.append(btn);
    }
    mk._speeds = speedBtns;
    const soundBtn = el('button', 'topbtn icon', '');
    soundBtn.type = 'button';
    soundBtn.innerHTML = speaker(true);
    soundBtn.onclick = () => { app.toggleSound(); renderTop(app.state, app.d); };
    mk._sound = { n: soundBtn };
    const guide = el('button', 'topbtn', 'Guide');
    guide.dataset.short = '?';
    guide.dataset.tip = 'Guide|How the site works, and what everything on screen means.';
    guide.onclick = () => app.openGuide();
    const menu = el('button', 'topbtn', 'Menu');
    menu.dataset.short = '\u2630';
    menu.dataset.tip = 'Menu|Save, export, import, restart the guide, or wipe and start over.';
    menu.onclick = () => app.openMenu();

    // Filled in by src/presence.js, and hidden until the server answers. It
    // is built here so the bar is measured with it in place.
    const live = el('div', 'livecount');
    live.id = 'livecount';
    live.hidden = true;
    live.dataset.tip = 'Playing now|How many people have been on ClouterX in the '
      + 'last three minutes. Counted on the server; nothing is stored on your device.';

    const right = el('div', 'topright');
    right.append(live, speed, soundBtn, guide, menu);
    fill(bar,
      vital('v_cash', 'Cash'),
      vital('v_compute', 'Compute'),
      el('div', 'divider'),
      meters,
      el('div', 'divider'),
      minis,
      right);
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
    mk.x_rp.n.dataset.tip = 'Upgrade points|Earned by the share of your compute set aside for '
      + 'research. Spend them on the Upgrade tab.';
    mk.x_rep.n.dataset.tip = 'Your name|Earned by finishing deals without letting customers down. '
      + 'It unlocks bigger sites and better customers.';
    mk.x_con.n.dataset.tip = 'Deals|How many jobs you are running. There is no limit on the '
      + 'number — the only thing stopping you is spare compute.';
    mk.x_owed.n.dataset.tip = 'The bank|What you owe. Interest runs every day, and part of your '
      + 'income goes to paying it off before it reaches you. Click to open the bank.';
    mk.x_owed.n.style.cursor = 'pointer';
    mk.x_owed.n.onclick = () => goTab('site');
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

  set(t.v_cash, t.v_cash.big.textContent, (d.netIncome >= 0 ? '+' : '') + rate(d.netIncome),
    d.netIncome >= 0 ? 'good' : 'bad');

  const fixTab = FIX_TAB[d.bottleneck];
  set(t.v_compute, t.v_compute.big.textContent, d.bottleneck,
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
  small(t.x_con, String(state.contracts.active.length),
    d.freeCompute > d.computeSellable * 0.15 ? 'acc' : '');
  small(t.x_owed, d.debt > 0 ? fmt(d.debt) : '—', d.overdrawn ? 'bad' : d.debt > 0 ? 'warn' : '');

  const snd = state.settings.sound !== false;
  const sb = t._sound.n;
  if (sb._on !== snd) { sb._on = snd; sb.innerHTML = speaker(snd); }
  sb.className = 'topbtn icon' + (snd ? '' : ' off');
  sb.setAttribute('aria-label', snd ? 'Sound on' : 'Sound off');
  sb.setAttribute('aria-pressed', snd ? 'true' : 'false');
  sb.dataset.tip = (snd ? 'Sound on' : 'Sound off') + '|A room tone that follows the site, and a '
    + 'cue for the things worth hearing. M toggles it.';

  const pausedBox = document.getElementById('paused');
  if (pausedBox) pausedBox.hidden = state.settings.speed !== 0;

  for (const { v, btn } of t._speeds) {
    const on = state.settings.speed === v;
    const cls = 'sp' + (on ? ' on' : '') + (v === 0 && on ? ' paused' : '');
    if (btn.className !== cls) btn.className = cls;
  }
}

export const SPEEDS = [
  [0, 'Pause', 'Stop the clock. Nothing decays, nothing earns. Space toggles it.'],
  [1, '1\u00D7', 'Real time: one game day per minute.'],
  [2, '2\u00D7', 'Twice as fast. Everything scales — earnings, wear, events.'],
  [5, '5\u00D7', 'Five times as fast. Good for waiting out a contract.'],
  [10, '10\u00D7', 'Ten times as fast. A game day every six seconds.'],
];

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
  else if (tab === 'deals') fill(body, panelContracts(state, d));
  else if (tab === 'upgrade') fill(body, [...panelResearch(state, d), ...panelUpgrades(state, d)]);
  else if (tab === 'ops') fill(body, [...panelUtilities(state, d), ...panelStaff(state, d)]);
  else if (tab === 'site') fill(body, [...panelSite(state, d), ...panelLegacy(state, d)]);
  else if (tab === 'town') fill(body, panelTown(state, d));
  body.scrollTop = scroll;
  dirty = false;
}

/** Called every frame — cheap refresh of live numbers only. */
const LIVE_TABS = ['deals', 'ops', 'upgrade', 'town'];

// Big figures ease toward their target rather than snapping five times a
// second. It costs two text writes a frame and makes the whole thing feel
// like it is running rather than refreshing.
const roll = { cash: null, compute: null };

export function tickNumbers(state, d, dt) {
  if (!topBuilt) return;
  const ease = Math.min(1, dt * 9);
  const step = (key, target, cell, fmtFn) => {
    if (roll[key] === null || !isFinite(roll[key])) roll[key] = target;
    const gap = Math.abs(target - roll[key]);
    // A prestige or a big purchase should land, not crawl.
    roll[key] = gap > Math.max(1, Math.abs(target)) * 4 ? target
      : roll[key] + (target - roll[key]) * ease;
    if (Math.abs(target - roll[key]) < Math.max(0.01, Math.abs(target) * 1e-4)) roll[key] = target;
    const text = fmtFn(roll[key]);
    if (cell.big.textContent !== text) cell.big.textContent = text;
  };
  step('cash', state.money, topBuilt.v_cash, money);
  step('compute', d.computeTotal, topBuilt.v_compute, fmt);
}
let liveClock = 0;

export function refreshLive(state, d, dt) {
  renderTop(state, d);
  fitTopBar(false);
  syncTool();
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

/**
 * A small SVG plot of one series. Money and compute span too many orders of
 * magnitude for a linear axis, so those are drawn on a log scale.
 */
function sparkline(values, opts) {
  const o = opts || {};
  const w = 300, h = 46, pad = 3;
  const wrap = el('div', 'spark');
  if (!values || values.length < 2) {
    wrap.append(el('div', 'sparkempty', 'Not enough history yet.'));
    return wrap;
  }
  const map = o.log ? (v) => Math.log10(Math.max(0, v) + 1) : (v) => v;
  const pts = values.map(map);
  const lo = Math.min(...pts), hi = Math.max(...pts);
  const span = hi - lo || 1;
  const step = (w - pad * 2) / (pts.length - 1);
  let d = '';
  pts.forEach((v, i) => {
    const x = pad + i * step;
    const y = h - pad - ((v - lo) / span) * (h - pad * 2);
    d += (i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1);
  });
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  svg.setAttribute('preserveAspectRatio', 'none');
  const area = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  area.setAttribute('d', d + `L${(pad + (pts.length - 1) * step).toFixed(1)} ${h} L${pad} ${h} Z`);
  area.setAttribute('fill', (o.colour || '#4fe0ac') + '22');
  const line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  line.setAttribute('d', d);
  line.setAttribute('fill', 'none');
  line.setAttribute('stroke', o.colour || '#4fe0ac');
  line.setAttribute('stroke-width', '1.6');
  line.setAttribute('vector-effect', 'non-scaling-stroke');
  svg.append(area, line);
  wrap.append(svg);
  const ends = el('div', 'sparkends');
  ends.append(el('span', null, (o.fmt || fmt)(values[0])),
    el('span', null, (o.fmt || fmt)(values[values.length - 1])));
  wrap.append(ends);
  return wrap;
}

function sec(title, ...kids) {
  const s = el('div', 'sec');
  if (title) s.append(el('h3', null, title));
  s.append(...kids.flat().filter(Boolean));
  return s;
}

/**
 * Everything locked in this game is locked behind one thing — research — and
 * the old note ("Locked — needs Enclosed racks.") never said so, never said
 * where to go, and never said whether it was affordable. This does all three.
 */
function lockNote(state, reqId) {
  const r = RESEARCH_BY_ID[reqId];
  if (!r) return 'Locked.';
  const affordable = state.rp >= r.cost;
  return 'Research needed — "' + r.name + '", ' + fmt(r.cost) + ' points'
    + (affordable ? ' (you can afford it now).' : '. You have ' + fmt(state.rp) + '.');
}

/** Takes you straight to the node that unlocks it. */
function lockButton(state, reqId) {
  const r = RESEARCH_BY_ID[reqId];
  if (!r) return null;
  const b = el('button', 'btn small' + (state.rp >= r.cost ? ' primary' : ''), 'Go to research');
  b.dataset.tip = 'Research it|Opens the Upgrade tab at "' + r.name + '". '
    + 'Points come from the share of your compute set aside for R&D.';
  b.onclick = () => { goTab('upgrade'); highlightResearch(r.id); };
  return b;
}

/** Ring the node for a moment so it is obvious which one to buy. */
let flashResearch = null;
function highlightResearch(id) {
  flashResearch = id;
  // The research panel shows one category at a time, so jumping to the tab is
  // not enough — switch to the category the node actually lives in, or the
  // player lands on a list that does not contain the thing they asked for.
  const node = RESEARCH_BY_ID[id];
  if (node) researchCat = node.cat;
  // Render now rather than waiting for the panel's own slower clock, or the
  // ring appears a beat after the tab has already changed under you.
  markDirty(); renderUI();
  setTimeout(() => { flashResearch = null; markDirty(); renderUI(); }, 2600);
}

function panelBuild(state, d) {
  const catRow = el('div', 'btnrow');
  for (const c of CATEGORIES) {
    const b = el('button', 'btn small' + (c.id === buildCat ? ' primary' : ''), c.name);
    b.onclick = () => { buildCat = c.id; markDirty(); renderUI(); };
    catRow.append(b);
  }

  // Sort so the top of the list is what you can act on. Before this, a player
  // with $2,000 opened Build and read three screens of billion-pound buildings
  // they could not research, let alone buy.
  const rank = (unlocked, afford) => (unlocked && afford ? 0 : unlocked ? 1 : 2);
  const inCat = BUILDINGS.filter((x) => x.cat === buildCat)
    .map((b) => {
      const unlocked = !b.req || state.research.done.includes(b.req);
      const cost = A.buildCost(b, d);
      return { b, unlocked, cost, band: rank(unlocked, state.money >= cost) };
    })
    .sort((x, y) => x.band - y.band || y.cost - x.cost);

  const list = [];
  for (const { b } of inCat) {
    const unlocked = !b.req || state.research.done.includes(b.req);
    const cost = A.buildCost(b, d);
    const afford = state.money >= cost;
    // Headline facts on the row; everything else waits in the tooltip.
    const meta = [];
    if (b.slots) meta.push(['holds', rackCapacity(b, d.mods) + ' servers']);
    if (b.powerCap) meta.push(['powers', fmt(b.powerCap) + ' kW']);
    if (b.coolCap) meta.push(['cools', fmt(b.coolCap * d.mods.coolMult) + ' kW']);
    if (b.supplyKW) meta.push(['makes', fmt(b.supplyKW) + ' kW']);
    if (b.supplyWater) meta.push(['gives', fmt(b.supplyWater) + ' L/s water']);
    if (b.net) meta.push(['carries', fmt(b.net) + ' Gbps']);
    if (b.staff) meta.push(['desks', '+' + b.staff]);
    if (b.radius) meta.push(['reaches', b.radius + ' tiles']);
    meta.length = Math.min(meta.length, 3);

    const detail = [];
    if (b.radius) detail.push('Serves anything within ' + b.radius + ' tiles.');
    if (b.draw) detail.push('Uses ' + fmt(b.draw) + ' kW itself.');
    if (b.water) detail.push('Drinks ' + (b.water * 1000).toFixed(1) + ' L/s for every MW it removes.');
    if (b.upkeep) detail.push('Costs ' + money(b.upkeep) + ' a day to run.');
    if (b.fuel) detail.push('Burns $' + b.fuel + ' of fuel per kWh.');
    if (b.ride) detail.push('Rides through ' + b.ride + ' seconds of grid loss.');
    if (b.coolSelf) detail.push('Removes ' + Math.round(b.coolSelf * 100) + '% of its own heat.');

    list.push(listRow({
      icon: iconFor(b),
      iconColor: b.color,
      name: b.name,
      pills: [app.view.tool === b.id ? { text: 'selected', cls: 'acc' } : null],
      price: money(cost),
      priceOk: afford && unlocked,
      desc: b.desc,
      meta: unlocked ? meta : null,
      note: unlocked ? null : lockNote(state, b.req),
      cls: unlocked ? (afford ? '' : 'cant') : 'locked',
      buttons: !unlocked ? [lockButton(state, b.req)].filter(Boolean)
        : b.cat === 'compute' && (d.counts.rackAll || 0) > 1 ? [(() => {
          const up = el('button', 'btn small', 'Upgrade every rack');
          up.dataset.tip = 'Upgrade every rack|Swaps every smaller cabinet on the floor for this '
            + 'one, keeping the hardware inside. You pay the difference.';
          up.onclick = (e) => { e.stopPropagation(); app.act(() => A.upgradeRacks(state, d, b.id, app.hooks)); };
          return up;
        })()] : null,
      tip: b.name + '|' + b.desc + (detail.length ? '\n' + detail.join(' ') : ''),
      data: { build: b.id },
      onClick: unlocked ? () => {
        app.view.tool = app.view.tool === b.id ? null : b.id;
        app.sellBtn.classList.remove('on');
        markDirty(); renderUI();
      } : null,
    }));
  }

  // Say it in the verbs of the device in front of them.
  const touch = matchMedia('(hover: none)').matches;
  const help = el('div', 'hint', touch
    ? 'Tap a building below, then tap the floor to put it down. Drag anywhere to move the floor '
      + 'around, pinch to zoom, and use Turn above it to rotate. The ✕ button in the corner of '
      + 'the floor puts it down again.'
    : 'Click a building below, then click the floor to put it down. Hold and drag to lay a whole row. '
      + 'Drag empty floor to move around, scroll to zoom, and press R to turn the room. '
      + 'Escape, or the ✕ in the corner of the floor, puts it down again.');
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

  // Same rule as the build list: what you can install now, first.
  const hwRank = (unlocked, afford) => (unlocked && afford ? 0 : unlocked ? 1 : 2);
  const hwSorted = HARDWARE
    .map((hw) => {
      const unlocked = !hw.req || state.research.done.includes(hw.req);
      const cost = A.hwCost(hw, d);
      return { hw, cost, band: hwRank(unlocked, state.money >= cost) };
    })
    .sort((x, y) => x.band - y.band || y.cost - x.cost);

  const cards = [];
  for (const { hw } of hwSorted) {
    const unlocked = !hw.req || state.research.done.includes(hw.req);
    const cost = A.hwCost(hw, d);
    const owned = d.units[hw.id] || 0;
    if (!unlocked && owned === 0) {
      cards.push(listRow({
        iconText: hw.short, iconColor: '#3f7dd6',
        name: hw.name, price: money(cost), cls: 'locked',
        note: lockNote(state, hw.req),
        buttons: [lockButton(state, hw.req)].filter(Boolean),
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
        ['makes', fmt(hw.compute * d.mods.computeMult) + ' compute'],
        ['uses', fmt(perUnit) + ' kW'],
      ],
      tip: hw.name + '|' + hw.desc + '\nMakes ' + fmt(hw.compute * d.mods.computeMult)
        + ' compute, uses ' + fmt(perUnit) + ' kW and puts out '
        + fmt(hw.heat * d.mods.heatMult) + ' kW of heat. That is '
        + fmt(hw.compute * d.mods.computeMult / perUnit) + ' compute per kW.',
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

  // What you actually sell. Contracts buy capacity, not servers.
  const booked = d.contractDemand;
  const unsold = Math.max(0, d.computeSellable - booked);
  const total = Math.max(1e-9, d.computeTotal);
  const flow = el('div', 'card');
  const stack = el('div', 'stack');
  const seg = (frac, cls, label) => {
    const n = el('div', 'seg ' + cls);
    n.style.width = (frac * 100).toFixed(2) + '%';
    n.dataset.tip = label;
    return n;
  };
  stack.append(
    seg(booked / total, 'sold', 'Under contract|Capacity a customer is paying for right now.'),
    seg(unsold / total, 'free', 'Unsold|Capacity you produce and nobody is buying. Sign more contracts.'),
    seg(d.computeResearch / total, 'rnd', 'On R&D|Diverted to research by the slider on the R&D tab.'),
  );
  flow.append(el('div', 'sparklabel', 'Compute output'));
  flow.append(el('div', 'bignum', fmt(d.computeTotal)));
  flow.append(stack);
  const legend = el('div', 'stacklegend');
  const item = (cls, k, v) => {
    const n = el('div', 'sl');
    n.append(el('i', cls), el('span', 'k', k), el('span', 'v', v));
    return n;
  };
  legend.append(
    item('sold', 'Under contract', fmt(booked)),
    item('free', 'Unsold', fmt(unsold)),
    item('rnd', 'On R&D', fmt(d.computeResearch)),
  );
  flow.append(legend);
  flow.append(el('div', 'desc',
    'Contracts buy compute, not racks. The servers stay on your floor; what you sell is the '
    + 'capacity they produce. Promise more than you can deliver and you start paying a fine.'));
  out.push(sec(null, flow));

  const head = el('div', 'card');
  const kv = el('div', 'kv');
  const row = (k, v) => kv.append(el('div', 'k', k), el('div', 'v', v));
  row('Deals running', String(state.contracts.active.length));
  row('Compute promised', fmt(d.contractDemand) + ' of ' + fmt(d.computeSellable));
  row('Spare compute', fmt(Math.max(0, d.freeCompute)));
  row('Delivering', (d.deliverRatio * 100).toFixed(1) + '%');
  row('Market rate', '$' + state.market.compute.toFixed(3) + ' per compute·s');
  row('Next offer in', fmtTime(Math.max(0, state.contracts.nextOffer) * DAY_SECONDS));
  head.append(kv);
  const auto = el('button', 'btn small' + (state.settings.autoSign ? ' primary' : ''),
    state.settings.autoSign ? 'Auto-sign: on' : 'Auto-sign: off');
  auto.dataset.tip = 'Auto-sign|Takes the best offer that fits in your spare capacity, '
    + 'whenever a slot is free. Turn it on when placing servers is the part you enjoy.';
  auto.onclick = () => { state.settings.autoSign = !state.settings.autoSign; markDirty(); renderUI(); };
  const autoRow = el('div', 'btnrow'); autoRow.append(auto); head.append(autoRow);
  out.push(sec('Book', head));

  const act = state.contracts.active.map((c) => {
    const t = TEMPLATES_BY_ID[c.tid];
    const breached = c.effUptime < c.uptimeReq;
    const card = el('div', 'card' + (breached ? '' : ' owned'));
    const title = el('div', 'title');
    title.append(el('b', null, c.name));
    title.append(el('span', breached ? 'pill bad' : 'pill acc', breached ? 'missing the promise' : 'on track'));
    title.append(el('span', 'price ok', rate(c.livePay || c.pay)));
    card.append(title, el('div', 'desc', c.client + ' — ' + (t?.blurb || '')));
    const meta = el('div', 'meta');
    const bits = [
      ['needs', fmt(c.demand) + ' compute'],
      ['promised', (c.uptimeReq * 100).toFixed(1) + '%'],
      ['delivering', (c.effUptime * 100).toFixed(1) + '%'],
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
    const fits = o.demand <= free;
    const card = el('div', 'card click' + (fits ? '' : ' cant'));
    const title = el('div', 'title');
    title.append(el('b', null, o.name));
    if (state.day - (o.posted ?? state.day) < 1.2) title.append(el('span', 'pill new', 'new'));
    title.append(el('span', fits ? 'pill acc' : 'pill warn',
      fits ? 'you can take this' : 'needs ' + fmt(o.demand - free) + ' more compute'));
    title.append(el('span', 'price ok', rate(o.pay * d.mods.priceMult)));
    card.append(title, el('div', 'desc', o.client + ' — ' + (t?.blurb || '')));
    const useFrac = free > 0 ? o.demand / free : Infinity;
    const meta = el('div', 'meta');
    const bits = [
      ['needs', fmt(o.demand) + ' compute'],
      ['uses', (isFinite(useFrac) ? Math.round(useFrac * 100) : 999) + '% of your spare'],
      ['bandwidth', fmt(o.net) + ' Gbps'],
      ['must stay up', (o.uptimeReq * 100).toFixed(1) + '%'],
      ['you manage', (d.uptime * 100).toFixed(1) + '%'],
      ['term', o.days + ' days'],
      ['fine if you miss it', '×' + o.penalty + ' a day'],
      ['expires', Math.max(0, (o.expires ?? state.day) - state.day).toFixed(1) + ' days'],
      ['total', money(o.pay * d.mods.priceMult * o.days * DAY_SECONDS)],
    ];
    for (const [k, v] of bits) { const s = el('span'); s.append(k + ' ', el('b', null, v)); meta.append(s); }
    card.append(meta);
    if (fits && d.uptime < o.uptimeReq) {
      card.append(el('div', 'desc', 'You cannot stay up as much as this deal asks. '
        + 'Sign it and you start paying a fine straight away.'));
    } else if (fits && useFrac > 0.85) {
      card.append(el('div', 'desc', 'This uses almost all your spare compute. '
        + 'One bad day and you will not be able to deliver it.'));
    }
    const btn = el('button', 'btn primary small', fits ? 'Sign' : 'Not enough spare compute');
    if (fits) btn.dataset.sign = String(o.cid);
    btn.disabled = !fits;
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
      cls: (done ? 'owned' : ok ? (afford ? '' : 'cant') : 'locked')
        + (flashResearch === node.id ? ' flash' : ''),
      onClick: !done && ok ? () => app.act(() => A.buyResearch(state, node.id, app.hooks)) : null,
      data: !done && ok && afford ? { research: node.id } : null,
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
  kv.append(el('div', 'k', 'Wage bill'),
    el('div', 'v', money(d.salaries * d.mods.upkeepMult) + '/day'));
  kv.append(el('div', 'k', 'Per second'), el('div', 'v', money(d.salaryCost) + '/s'));
  // Wages are usually the first cost to get out of hand, so say plainly how
  // much of the money coming in is going straight back out as pay.
  const share = d.revenue > 0 ? d.salaryCost / d.revenue : null;
  kv.append(el('div', 'k', 'Share of income'),
    el('div', 'v' + (share !== null && share > 0.5 ? ' bad' : share !== null && share > 0.3 ? ' warn' : ''),
      share === null ? 'No income yet' : Math.round(share * 100) + '% of what you earn'));
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
      hire.dataset.hire = role.id;
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
    b.dataset.grid = String(n);
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
  // Wages are the cost the player actually chooses, so they get their own line
  // rather than hiding inside upkeep.
  line('Wages', '−' + money(d.salaryCost), '#e8615f');
  line('Machine upkeep', '−' + money(d.machineUpkeep), '#e8615f');
  line('SLA penalties', '−' + money(d.penalties), '#e8615f');
  if (d.debt > 0) line('Loan interest', '−' + money(d.interestCost), '#e8615f');
  line('Net', (d.netIncome >= 0 ? '+' : '−') + money(Math.abs(d.netIncome)),
    d.netIncome >= 0 ? '#6fe0a0' : '#e8615f');
  led.append(t);
  out.push(sec('Ledger', led));
  return out;
}

// ---------------------------------------------------------------------- site

/**
 * Borrowing, what it costs, and what is left of the credit line. The bank is
 * deliberately a poor deal: it exists to get a stuck site moving again, not to
 * skip a tier.
 */
function bankCard(state, d) {
  const c = el('div', 'card');

  // Being overdrawn is the loudest thing on this card, so it goes first and
  // says exactly what it costs and what it stops.
  if (d.overdrawn) {
    const warn = el('div', 'card overdrawn');
    warn.append(el('div', 'eyebrow', 'Overdrawn'));
    warn.append(el('div', 'odbig', money(state.money)));
    warn.append(el('div', 'desc',
      'Nothing can be bought while the balance is below zero. The hole grows '
      + Math.round(SIM.OVERDRAFT_RATE * 100) + '% a day and your name goes with it. Sell servers '
      + 'you cannot run, or let go of staff you cannot pay.'));
    // Borrowing is not buying, so it stays open — and taking a loan now at 5%
    // is far cheaper than what the bank will want if you let it get worse.
    if (d.creditFree > -state.money) {
      warn.append(el('div', 'desc acc',
        'You can still borrow. ' + money(-state.money) + ' would clear it, at '
        + Math.round(SIM.LOAN_RATE * 100) + '% a day — much cheaper than waiting for the call.'));
    }
    const next = SIM.rescueThreshold(state.bank?.rescueLevel || 0);
    warn.append(el('div', 'desc', -state.money >= next
      ? 'The bank is waiting for an answer.'
      : 'At ' + money(next) + ' overdrawn the bank will offer a way out, on terms you will not '
        + 'like.'));
    c.append(warn);
  }

  const kv = el('div', 'kv');
  kv.append(el('div', 'k', 'Balance'),
    el('div', 'v' + (state.money < 0 ? ' bad' : ''), money(state.money)));
  kv.append(el('div', 'k', 'Owed'),
    el('div', 'v' + (d.debt > 0 ? ' bad' : ''), d.debt > 0 ? money(d.debt) : 'Nothing'));
  kv.append(el('div', 'k', 'Credit line'), el('div', 'v', money(d.creditLimit)));
  kv.append(el('div', 'k', 'Left to draw'), el('div', 'v', money(d.creditFree)));
  if (d.debt > 0) {
    kv.append(el('div', 'k', 'Interest'), el('div', 'v bad', money(d.interestCost) + '/s'));
    kv.append(el('div', 'k', 'Repaying'),
      el('div', 'v', Math.round(SIM.REPAY_SHARE * 100) + '% of income'));
  }
  c.append(kv);

  // Debt is never good news, so the meter is amber at best and red when the
  // line is nearly used up — never the green a normal bar would paint.
  const used = d.debt / Math.max(d.creditLimit, 1e-9);
  const bar = el('div', 'bar ' + (used > 0.7 ? 'bad' : 'warn'));
  bar.append(el('i'));
  bar.firstChild.style.width = clamp(d.debt / Math.max(d.creditLimit, 1e-9), 0, 1) * 100 + '%';
  c.append(bar);

  c.append(el('div', 'desc', 'Interest runs at ' + Math.round(SIM.LOAN_RATE * 100) + '% a day on whatever you owe, and '
      + Math.round(SIM.REPAY_SHARE * 100) + '% of your income goes straight back to the bank until '
      + 'it is clear. Borrowing is a way out of a hole, not a way to grow.'));
  if (state.bank?.rescues) {
    c.append(el('div', 'desc', 'The bank has bailed you out '
      + state.bank.rescues + (state.bank.rescues === 1 ? ' time' : ' times') + '. '
      + 'Each rescue is dearer than the last.'));
  }

  const row = el('div', 'btnrow');
  if (state.money < 0 && d.creditFree > -state.money) {
    const need = -state.money;
    const clear = el('button', 'btn small primary', 'Clear the overdraft — ' + money(need));
    clear.dataset.tip = 'Borrow your way out|Puts ' + money(need) + ' in the account, which brings '
      + 'you back to zero. Interest is ' + Math.round(SIM.LOAN_RATE * 100) + '% a day, against '
      + Math.round(SIM.OVERDRAFT_RATE * 100) + '% for staying overdrawn.';
    clear.onclick = () => app.act(() => SIM.borrow(state, d, need, app.hooks));
    row.append(clear);
  }
  for (const frac of [0.25, 0.5, 1]) {
    const amount = d.creditFree * frac;
    const b = el('button', 'btn small' + (frac === 1 ? '' : ''), 'Borrow ' + money(amount));
    b.disabled = amount < 1;
    b.dataset.tip = 'Take a loan|' + money(amount) + ' in your account now, added to what you owe. '
      + 'Interest starts immediately.';
    b.onclick = () => app.act(() => SIM.borrow(state, d, amount, app.hooks));
    row.append(b);
  }
  c.append(row);

  if (d.debt > 0) {
    const pay = el('div', 'btnrow');
    const all = Math.min(d.debt, state.money);
    const b = el('button', 'btn small primary', 'Repay ' + money(all));
    b.disabled = all < 1;
    b.dataset.tip = 'Pay it off|Clears what you can from cash on hand. Every day you wait costs '
      + Math.round(SIM.LOAN_RATE * 100) + '% more.';
    b.onclick = () => app.act(() => SIM.repay(state, all, app.hooks));
    pay.append(b);
    c.append(pay);
  }
  return c;
}

function panelSite(state, d) {
  const out = [];
  const f = d.fac;
  const next = A.nextFacility(state);

  out.push(sec('Bank', bankCard(state, d)));

  const c = el('div', 'card');
  const kv = el('div', 'kv');
  kv.append(el('div', 'k', 'Facility'), el('div', 'v', f.name));
  kv.append(el('div', 'k', 'Floor'), el('div', 'v', d.fac.w + ' × ' + d.fac.h + ' tiles'));
  kv.append(el('div', 'k', 'Used'), el('div', 'v', Object.keys(state.tiles).length + ' / ' + (d.fac.w * d.fac.h)));
  kv.append(el('div', 'k', 'Ambient'), el('div', 'v', f.ambient + ' °C'));
  kv.append(el('div', 'k', 'Utility cap'), el('div', 'v', fmt(f.gridCap) + ' kW'));
  c.append(kv, el('div', 'desc', f.desc));
  const room = roomOf(state);
  const exCost = A.expandCost(state, d);
  const exRow = el('div', 'btnrow');
  for (const [axis, label] of [['w', '+1 column'], ['h', '+1 row']]) {
    const btn = el('button', 'btn small', label + ' — ' + money(exCost));
    btn.disabled = !A.canExpand(state, axis) || state.money < exCost;
    btn.dataset.tip = 'Buy floor|Knocks through into the next ' + (axis === 'w' ? 'bay' : 'aisle')
      + '. You keep it when you move to a bigger site. '
      + (state.expand[axis] || 0) + ' of ' + EXPAND_CAP + ' bought on this axis.';
    btn.onclick = () => app.act(() => A.expand(state, d, axis, app.hooks));
    exRow.append(btn);
  }
  c.append(el('div', 'desc', 'Floor bought: +' + (state.expand.w || 0) + ' columns, +'
    + (state.expand.h || 0) + ' rows, out of ' + EXPAND_CAP + ' each.'), exRow);

  if (next) {
    const need = [];
    if (state.reputation < (next.rep || 0)) need.push(fmt(next.rep) + ' reputation');
    if (state.money < next.cost) need.push(money(next.cost));
    const b = el('button', 'btn primary', 'Move into ' + next.name + ' — ' + money(next.cost));
    b.disabled = need.length > 0;
    b.dataset.facility = 'next';
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
    // Show what it will actually pay, not the ceiling in the table.
    const cash = SIM.objectiveReward(o, d, i);
    if (cash > 0) rw.push(money(cash));
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

  const runHist = el('div', 'card');
  const hs = state.history || { income: [], compute: [], temp: [] };
  runHist.append(el('div', 'sparklabel', 'Net income'),
    sparkline(hs.income, { log: true, colour: '#6fe6ab', fmt: (v) => money(v) + '/s' }));
  runHist.append(el('div', 'sparklabel', 'Compute'),
    sparkline(hs.compute, { log: true, colour: '#55a0f0' }));
  runHist.append(el('div', 'sparklabel', 'Hottest rack'),
    sparkline(hs.temp, { colour: '#f0b950', fmt: (v) => v.toFixed(0) + ' °C' }));
  out.push(sec('The run so far', runHist));

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
    ['Buildings placed', fmtInt(state.stats.built)],
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

// ---------------------------------------------------------------------- town

let townCanvas = null;

function panelTown(state, d) {
  const out = [];
  const town = state.town || { damage: 0, seen: [], sinceDay: {} };
  const dmg = town.damage;
  const stage = STAGES[stageOf(dmg)];

  if (!townCanvas) townCanvas = document.createElement('canvas');
  const c = townCanvas;
  const cssW = 340, cssH = 190;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  c.width = cssW * dpr; c.height = cssH * dpr;
  c.style.width = '100%';
  c.style.height = 'auto';
  c.style.borderRadius = '10px';
  c.style.display = 'block';
  const ctx = c.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawTown(ctx, cssW, cssH, dmg, performance.now() / 1000);

  const head = el('div', 'card');
  head.append(c);
  head.append(el('div', 'townstage', stage.title));
  head.append(el('div', 'desc', stage.line));
  const bar = el('div', 'bar bad');
  bar.append(el('i'));
  bar.firstChild.style.width = (dmg * 100).toFixed(1) + '%';
  head.append(bar);
  const kv = el('div', 'kv');
  const pop = population(dmg);
  kv.append(el('div', 'k', 'Population'),
    el('div', 'v' + (pop === 0 ? ' bad' : ''), pop === 0 ? 'Nobody' : fmtInt(pop) + ' left'));
  kv.append(el('div', 'k', 'Ruined'), el('div', 'v bad', (dmg * 100).toFixed(1) + '%'));
  const nextStage = STAGES[stageOf(dmg) + 1];
  kv.append(el('div', 'k', 'Next'), el('div', 'v', nextStage
    ? nextStage.title + ' at ' + Math.round(nextStage.at * 100) + '%'
    : 'Nothing left to take'));
  head.append(kv);
  out.push(sec('Ashbrook', head));

  // What is actually driving the dial, so the player knows what to build more
  // of rather than guessing at it.
  const drivers = el('div', 'card');
  for (const st of townStrands(state, d)) {
    const row = el('div', 'meter townmeter');
    row.append(el('div', 'mk', st.label));
    const b = el('div', 'mbar');
    const i = el('i');
    i.style.width = clamp(st.at, 0, 1) * 100 + '%';
    i.style.background = st.at >= 0.999 ? 'var(--bad)' : 'var(--warn)';
    b.append(i);
    row.append(b, el('div', 'mv', fmt(st.now) + ' ' + st.unit));
    drivers.append(row);
  }
  drivers.append(el('div', 'desc',
    'Ashbrook was here first. The dial follows what your site takes from it, and it only ever '
    + 'goes one way. Power counts for most, then water, then the land you cover and the heat you '
    + 'dump. Take enough and the town starts pushing back — noise complaints, a challenge to your '
    + 'abstraction licence, a reporter at the fence.'));
  out.push(sec('What is taking it', drivers));

  const list = STAGES.map((st, i) => {
    const reached = dmg >= st.at;
    const row = el('div', 'row' + (reached ? '' : ' locked'));
    const ico = el('div', 'ico');
    ico.textContent = Math.round(st.at * 100) + '%';
    ico.style.cssText += ';display:flex;align-items:center;justify-content:center;'
      + 'font:600 10px var(--mono);color:' + (reached ? 'var(--bad)' : 'var(--dimmer)');
    const body = el('div', 'body');
    const h = el('div', 'head');
    h.append(el('b', null, st.title));
    if (reached && town.sinceDay && town.sinceDay[i] !== undefined) {
      h.append(el('span', 'price', 'day ' + town.sinceDay[i]));
    }
    body.append(h, el('div', 'desc', st.line));
    row.append(ico, body);
    return row;
  });
  out.push(sec('How it went', list));
  return out;
}

// -------------------------------------------------------------------- legacy

function panelLegacy(state, d) {
  const out = [];
  const gain = legacyGain(state);
  const can = canPrestige(state);
  const next = FACILITIES[4];

  const c = el('div', 'card');
  c.append(el('div', 'sparklabel', 'Selling the company'));
  c.append(el('div', 'bignum', fmtInt(gain) + (gain === 1 ? ' point' : ' points')));
  c.append(el('div', 'desc',
    'When a run has gone as far as you want it to, you can sell up. You start again in the '
    + 'broom cupboard with nothing — but you keep the points, and points buy permanent perks '
    + 'that make every run after this one easier.'));

  const kv = el('div', 'kv');
  kv.append(el('div', 'k', 'Points banked'), el('div', 'v', fmtInt(state.legacy.points)));
  kv.append(el('div', 'k', 'Companies sold'), el('div', 'v', String(state.legacy.resets)));
  kv.append(el('div', 'k', 'Earned this run'), el('div', 'v', money(state.lifetimeEarnings)));
  kv.append(el('div', 'k', 'This run is worth'), el('div', 'v', fmtInt(gain)));
  c.append(kv);

  const keep = el('div', 'keeps');
  const col = (title, items, cls) => {
    const n = el('div', 'keep ' + cls);
    n.append(el('div', 'kh', title));
    for (const i of items) n.append(el('div', 'ki', i));
    return n;
  };
  keep.append(
    col('You keep', ['Legacy points and perks', 'Every achievement', 'What you learned'], 'good'),
    col('You lose', ['The floor and everything on it', 'Your cash and your name',
      'All research and every deal'], 'bad'),
  );
  c.append(keep);

  const b = el('button', 'btn primary',
    can ? 'Sell the company for ' + fmtInt(gain) + ' points'
      : state.facility < 4 ? 'Nobody will buy a site this small yet'
      : 'Earn more before anybody will pay for it');
  b.disabled = !can;
  b.dataset.tip = can
    ? 'Sell up|Bank ' + fmtInt(gain) + ' points and start again from the cupboard.'
    : 'Not yet|You need to reach ' + next.name + ' (tier 4) and earn enough for the sale to be '
      + 'worth at least one point.';
  b.onclick = () => app.confirmPrestige();
  const r = el('div', 'btnrow');
  r.append(b);
  c.append(r);
  out.push(sec('Prestige', c));

  const perks = LEGACY_PERKS.map((p) => {
    const lvl = state.legacy.perks[p.id] || 0;
    const maxed = lvl >= p.max;
    const cost = perkCost(p, lvl);
    const afford = state.legacy.points >= cost;
    const bar = el('div', 'lvlbar');
    for (let i = 0; i < p.max; i++) bar.append(el('i', i < lvl ? 'on' : ''));
    const row = listRow({
      iconText: maxed ? 'MAX' : String(cost),
      iconColor: maxed ? '#93cc6d' : afford ? '#f2a83c' : '#6e6458',
      name: p.name,
      pills: [{ text: lvl + ' / ' + p.max, cls: lvl ? 'acc' : '' }],
      price: maxed ? 'maxed' : cost + (cost === 1 ? ' point' : ' points'),
      priceOk: afford && !maxed,
      desc: p.desc,
      cls: maxed ? 'owned' : afford ? '' : 'cant',
      data: { perk: p.id },
      onClick: maxed ? null : () => app.act(() => A.buyPerk(state, p.id, app.hooks)),
    });
    row.querySelector('.body').append(bar);
    return row;
  });
  out.push(sec('Permanent perks (' + fmtInt(state.legacy.points) + ' points to spend)', perks));
  return out;
}

// ----------------------------------------------------------------- inspector

export function renderInspector(state, d) {
  const box = document.getElementById('inspector');
  const sel = app.view.sel;
  if (!sel) {
    // With nothing selected, this space is worth more as a to-do list.
    //
    // The signature is prefixed so it can never collide with the value the
    // other two branches leave behind. It used to be the bare problem list,
    // which on a site with nothing wrong is the empty string — the same empty
    // string tile mode wrote — so deselecting left the tile panel on screen
    // and the phone's close button did nothing at all.
    const sig = 'todo:' + d.problems.map((p) => p.text).join('|');
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
      row.append(el('span', 'dot'), el('span', 'txt', p.text));
      row.append(el('span', 'go', 'fix →'));
      if (p.focus) row.append(el('span', 'go', 'show me'));
      row.onclick = () => {
        if (p.focus) app.focusTile(p.focus.x, p.focus.y);
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
  box.dataset.sig = 'sel:' + sel.x + ',' + sel.y;
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

  // On a phone this panel is a sheet laid over the floor, so it needs a way
  // out. It sits in the title row rather than floating above the panel: an
  // absolutely positioned one overlapped the first value on the right, and
  // would have gone on finding new things to sit on as the contents changed.
  // On a desktop the panel is a fixed row that never covers anything, and CSS
  // hides the button.
  const close = el('button', 'inspclose', '\u2715');
  close.type = 'button';
  close.setAttribute('aria-label', 'Close');
  close.onclick = () => { app.view.sel = null; markDirty(); renderUI(); };
  head.append(close);
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
  // Four "Rescue terms" chips in a row is a wall, not information. Show the
  // few that are ending soonest and count the rest.
  const MAX = 3;
  const sorted = [...list].sort((a, b) => a.until - b.until);
  const shown = sorted.slice(0, MAX);
  const extra = sorted.length - shown.length;
  fill(box, shown.map((ev) => {
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
  if (extra > 0) {
    const more = el('div', 'ev more', '+' + extra + ' more');
    more.dataset.tip = 'Also running|' + sorted.slice(MAX).map((ev) => {
      const def = EVENTS_BY_ID[ev.id];
      return (ev.label || def?.name || ev.id)
        + ' — ' + Math.max(0, ev.until - state.day).toFixed(1) + 'd left';
    }).join('\n');
    box.append(more);
  }
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

/**
 * The guide is written in mouse verbs. On a touch screen there is no clicking,
 * so swap the handful of words rather than keeping two copies of every step.
 */
function forTouch(text) {
  if (!text || !matchMedia('(hover: none)').matches) return text;
  return text
    .replace(/\bClick\b/g, 'Tap')
    .replace(/\bclick\b/g, 'tap')
    .replace(/\bclicking\b/g, 'tapping');
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
    kids.push(el('div', 'tb', forTouch(step.body)));
    if (step.note) kids.push(el('div', 'tn', forTouch(step.note)));
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
