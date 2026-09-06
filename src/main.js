// Boot, the game loop, and everything that glues the simulation to the UI.

import { el, fill, fmt, fmtTime, money } from './util.js';
import { newGame, load, save, wipe, exportSave, importSave, tileAt, roomOf, DAY_SECONDS } from './state.js';
import { derive, tick, resolveDecision, fireEvent, legacyGain, rescueTerms } from './sim.js';
import * as SIM from './sim.js';
import { EVENTS_BY_ID } from './data/events.js';
import { OBJECTIVES } from './data/progression.js';
import { BUILDINGS_BY_ID } from './data/buildings.js';
import * as A from './actions.js';
import { FloorView } from './render.js';
import { initUI, renderUI, refreshLive, markDirty, pushLog, goTab, TABS, renderTutorial, tickNumbers } from './ui.js';
import { initTips, hide as hideTip } from './tip.js';
import { startAudio, setEnabled as setSound, isEnabled as soundOn, ambience, sfx } from './audio.js';
import { advance as tutAdvance, active as tutActive, FINISH } from './tutorial.js';
import { BootArt } from './bootart.js';

const TICK = 0.2;          // seconds of simulated time per fixed step
const MAX_CATCHUP = 0.5;   // seconds of simulation per frame at 1x

const app = {
  state: null,
  d: null,
  view: null,
  log: [],
  hooks: null,
  running: false,
};

// ------------------------------------------------------------------- toasts

function toast(text, tone) {
  const box = document.getElementById('toasts');
  const tones = { bad: 'bad', warn: 'warn', good: 'good' };
  const t = el('div', 'toast ' + (tones[tone] || ''), text);
  box.append(t);
  setTimeout(() => {
    // Leave the way it arrived, so the stack settles instead of blinking out.
    t.style.transition = 'opacity .35s ease, transform .35s ease';
    t.style.opacity = '0';
    t.style.transform = 'translateX(14px)';
    setTimeout(() => t.remove(), 400);
  }, 4200);
  while (box.children.length > 3) box.firstChild.remove();
}

let bannerTimer = 0;

/** A brief centred card for the handful of once-a-run moments. */
function showBanner(kicker, title, note) {
  const box = document.getElementById('banner');
  if (!box) return;
  clearTimeout(bannerTimer);
  fill(box, (() => {
    const inner = el('div', 'inner');
    inner.append(
      el('div', 'kicker', kicker),
      el('div', 'title', title),
      el('div', 'note', note || ''),
      el('div', 'rule'),
    );
    return inner;
  })());
  box.hidden = false;
  sfx.upgrade();
  bannerTimer = setTimeout(() => { box.hidden = true; fill(box); }, 3300);
}

function logLine(text, tone) {
  app.log.push({ text, tone, day: app.state ? Math.floor(app.state.day) : 0 });
  if (app.log.length > 200) app.log.shift();
  pushLog(app.log);
  if (tone === 'good' || tone === 'bad') toast(text, tone);
  if (tone === 'bad') sfx.alarm();
  else if (tone === 'good') sfx.good();
}

// -------------------------------------------------------------------- modal

function closeModal() {
  hideTip();
  const m = document.getElementById('modal');
  m.hidden = true;
  m.replaceChildren();
}

function showModal(title, sub, body, buttons, opts) {
  const m = document.getElementById('modal');
  const sheet = el('div', 'sheet');
  sheet.append(el('h2', null, title));
  if (sub) sheet.append(el('div', 'sub', sub));
  for (const node of [].concat(body)) sheet.append(typeof node === 'string' ? el('p', null, node) : node);
  const row = el('div', 'btnrow');
  for (const b of buttons) {
    const btn = el('button', 'btn ' + (b.kind || ''), b.label);
    btn.onclick = () => { closeModal(); b.onClick?.(); };
    row.append(btn);
  }
  sheet.append(row);
  fill(m, sheet);
  m.hidden = false;
  if (!opts?.sticky) {
    m.onclick = (e) => { if (e.target === m) closeModal(); };
  } else {
    m.onclick = null;
  }
}

// ------------------------------------------------------------------ actions

app.act = (fn) => {
  const err = fn();
  if (err) toast(err, 'warn');
  app.d = derive(app.state);
  markDirty();
  renderUI();
};

app.selectedRack = () => {
  const s = app.view?.sel;
  if (!s) return null;
  const t = tileAt(app.state, s.x, s.y);
  if (!t) return null;
  const b = BUILDINGS_BY_ID[t.b];
  return b && b.cat === 'compute' ? t : null;
};

app.openMenu = () => {
  const state = app.state;
  const body = [];
  const info = el('div', 'kv');
  info.append(el('div', 'k', 'Playtime'), el('div', 'v', fmtTime(state.playtime)));
  info.append(el('div', 'k', 'Lifetime revenue'), el('div', 'v', money(state.lifetimeEarnings)));
  info.append(el('div', 'k', 'Autosave'), el('div', 'v', 'every 15 s'));
  body.push(info);

  const box = el('textarea');
  box.rows = 4;
  box.placeholder = 'Paste a save here to import it, or press Export to fill this box.';
  body.push(el('div', 'hint', 'Save data lives in this browser only. Export it if you care about it.'));
  body.push(box);

  showModal('Menu', 'Rack & Ruin', body, [
    { label: 'Save now', kind: 'primary', onClick: () => { save(state); toast('Saved.'); } },
    { label: 'Export', onClick: () => {
      const text = exportSave(state);
      navigator.clipboard?.writeText(text).catch(() => {});
      showModalExport(text);
    } },
    { label: 'Import', onClick: () => {
      try {
        const s = importSave(box.value);
        startGame(s, true);
        toast('Save imported.');
      } catch (err) { toast('That is not a valid save.', 'bad'); }
    } },
    { label: 'Run the guide again', onClick: () => {
      state.tutorial = { step: 0, skipped: false };
      markDirty(); renderUI();
      toast('Guide restarted.');
    } },
    { label: 'Delete save', kind: 'danger', onClick: () => confirmWipe() },
    { label: 'Close' },
  ]);
};

function showModalExport(text) {
  const box = el('textarea');
  box.rows = 6;
  box.value = text;
  showModal('Export', 'Copied to the clipboard if the browser allowed it.', [box], [{ label: 'Close' }]);
}

function confirmWipe() {
  showModal('Delete everything?', 'This wipes the save in this browser. Legacy points go too.', [
    'There is no undo. If you want to keep it, export first.',
  ], [
    { label: 'Delete and start over', kind: 'danger', onClick: () => { wipe(); startGame(newGame(), true); } },
    { label: 'Cancel' },
  ]);
}

app.confirmPrestige = () => {
  const gain = legacyGain(app.state);
  showModal('Sell the company?', 'You keep the legacy points, the perks and the achievements.', [
    `A buyer will pay ${gain} legacy points for what you have built.`,
    'Everything else goes: the floor, the cash, the research, the contracts and the staff.',
  ], [
    { label: 'Sell for ' + gain + ' points', kind: 'primary', onClick: () => {
      const fresh = A.prestige(app.state, app.hooks);
      if (typeof fresh === 'string') { toast(fresh, 'warn'); return; }
      startGame(fresh, true);
      goTab('site');
    } },
    { label: 'Keep building' },
  ]);
};

// ------------------------------------------------------------------- events

/**
 * The bank's offer once the overdraft is deep enough: clear it on terms
 * designed to hurt, or put the site down and start again. Deliberately a
 * modal you have to answer — it is the one moment the run can end.
 */
function onRescue(pending) {
  const t = rescueTerms(app.state, app.d);
  if (!SIM.canBorrowOut(app.state)) {
    // Three rescues is all there is. Past that the offer is only the exit.
    showModal('The bank is done', 'They will not lend you any more.', [
      `You are ${money(t.short)} overdrawn and the bank has already bailed you out `
      + `${app.state.bank.rescues} times. There is no fourth.`,
      'Sell everything you cannot run and trade your way back above zero, or put the site down '
      + 'and start again with what you have learned.',
    ], [
      { label: 'Keep trying', onClick: () => { SIM.declineRescue(app.state); markDirty(); renderUI(); } },
      { label: 'Put it down and start again', kind: 'danger', onClick: () => confirmRestart() },
    ], { sticky: true });
    return;
  }
  const body = [
    `You are ${money(t.short)} overdrawn. Nothing can be bought, the hole grows `
    + `${Math.round(SIM.OVERDRAFT_RATE * 100)}% a day, and your name is going with it.`,
    'The bank will clear it today and leave you enough to trade your way out. '
    + 'They are not being kind about it.',
  ];
  const terms = el('div', 'kv');
  terms.append(el('div', 'k', 'They clear'), el('div', 'v', money(t.short)));
  terms.append(el('div', 'k', 'And leave you'),
    el('div', 'v', money(t.float) + '  (three days of costs)'));
  terms.append(el('div', 'k', 'You owe them'),
    el('div', 'v bad', money(t.owed) + '  (' + t.multiple.toFixed(2) + '×)'));
  terms.append(el('div', 'k', 'Interest'),
    el('div', 'v', Math.round(SIM.LOAN_RATE * 100) + '% a day until it is paid'));
  terms.append(el('div', 'k', 'Contracts pay'),
    el('div', 'v bad', Math.round(t.payCut * 100) + '% less for ' + t.days + ' days'));
  terms.append(el('div', 'k', 'Your name'), el('div', 'v bad', '−' + Math.round(t.repCost)));
  body.push(terms);
  if (t.level > 0) {
    body.push(el('div', 'hint', 'This is offer ' + (t.level + 1)
      + '. Each one is worse than the last.'));
  }

  const lendable = SIM.canBorrowOut(app.state);
  const buttons = [];
  if (lendable) {
    buttons.push({
      label: 'Take the terms',
      kind: 'primary',
      onClick: () => {
        const err = SIM.takeRescue(app.state, app.d, app.hooks);
        if (err) { toast(err, 'warn'); return; }
        app.d = derive(app.state);
        markDirty(); renderUI();
      },
    });
  }
  showModal(
    lendable ? 'The bank is on the phone' : 'The bank is done',
    lendable ? 'There are two ways out of this.' : 'They will not lend you any more.',
    body, [
    ...buttons,
    {
      label: 'Put it down and start again',
      kind: 'danger',
      onClick: () => confirmRestart(),
    },
    {
      label: 'Neither, keep sinking',
      onClick: () => {
        SIM.declineRescue(app.state);
        app.d = derive(app.state);
        markDirty(); renderUI();
        toast('The bank will call again when it gets worse.', 'warn');
      },
    },
  ], { sticky: true });
}

/** Second confirmation before a rescue modal ends the run. */
function confirmRestart() {
  showModal('Start again?', 'This ends the run.', [
    'The site is sold for scrap and you begin in the cupboard again. '
    + 'Anything you have earned towards a legacy is kept.',
  ], [
    {
      label: 'Yes, start again',
      kind: 'danger',
      onClick: () => {
        const legacy = app.state.legacy;
        wipe();
        startGame(newGame(legacy), true);
        toast('Sold for scrap. Back to the cupboard.', 'warn');
      },
    },
    { label: 'Go back', onClick: () => onRescue(app.state.rescue) },
  ], { sticky: true });
}

function onDecision(ev) {
  const body = [ev.text];
  const buttons = ev.options.map((o) => ({
    label: o.label,
    kind: 'primary',
    onClick: () => {
      const result = resolveDecision(app.state, app.d, o.effect, app.hooks);
      app.state.events.pending = null;
      app.d = derive(app.state);
      markDirty(); renderUI();
      toast(result, ev.tone === 'bad' ? 'warn' : undefined);
    },
  }));
  buttons.forEach((b, i) => { b.kind = i === 0 ? 'primary' : ''; });
  const hints = el('div', 'kv');
  for (const o of ev.options) hints.append(el('div', 'k', o.label), el('div', 'v', o.hint));
  body.push(hints);
  showModal(ev.name, 'Somebody needs an answer.', body, buttons, { sticky: true });
}

// ------------------------------------------------------------------- offline

function offlineProgress(state) {
  const now = Date.now();
  const elapsed = Math.max(0, (now - (state.lastTick || now)) / 1000);
  state.lastTick = now;
  if (elapsed < 45) return null;

  let d = derive(state);
  const hours = d.mods.offlineHours;
  const rateMult = d.mods.offlineRate;
  const used = Math.min(elapsed, hours * 3600);
  const steps = 48;
  const step = used / steps;
  const before = state.money;
  const beforeRp = state.rp;
  const quiet = { log: () => {}, onDecision: () => {} };
  for (let i = 0; i < steps; i++) {
    d = derive(state);
    // Offline runs at a reduced rate and never breaks hardware.
    const saved = d.netIncome;
    d.netIncome = saved * rateMult;
    d.rpPerSec *= rateMult;
    const wear = d.mods.wearMult;
    d.mods.wearMult = 0;
    tick(state, step, d, quiet);
    d.mods.wearMult = wear;
  }
  return {
    seconds: used, capped: elapsed > hours * 3600,
    money: state.money - before, rp: state.rp - beforeRp, hours,
  };
}

// ---------------------------------------------------------------- game loop

let acc = 0;
let last = performance.now();
let uiClock = 0;
let saveClock = 0;

let frameErrors = 0;

function frame(now) {
  try {
    step(now);
  } catch (err) {
    // A single bad frame should cost a frame, not the session. The player's
    // save is worth more than a clean stack trace.
    frameErrors++;
    if (frameErrors <= 3) console.error('frame failed', err);
    if (frameErrors === 3) toast('Something went wrong drawing the site. Your save is fine.', 'bad');
  }
  requestAnimationFrame(frame);
}

function step(now) {
  const real = Math.min(0.25, (now - last) / 1000);
  last = now;
  if (!app.running) return;

  const state = app.state;
  const speed = state.settings.speed;
  // A pending decision or the bank's rescue offer both hold the clock: the
  // player is being asked a question and the site should not sink while they
  // read it.
  if (speed > 0 && !state.events.pending && !state.rescue) {
    acc += real * speed;
    const cap = MAX_CATCHUP * Math.max(1, speed);
    if (acc > cap) acc = cap;
    let guard = 0;
    while (acc >= TICK && guard++ < 40) {
      app.d = derive(state);
      tick(state, TICK, app.d, app.hooks);
      acc -= TICK;
    }
    if (tutActive(state)) {
      const finished = tutAdvance(state, app.d);
      if (finished) {
        toast('Step done — ' + finished.title + '.', 'good');
        markDirty();
        renderTutorial(state);
        if (!tutActive(state)) {
          showModal(FINISH.title, 'Five steps in, and you have already run the whole loop once.',
            [FINISH.body,
             `The Site tab keeps a chain of ${OBJECTIVES.length} objectives if you want somewhere to aim. `
             + 'The overlay buttons above the floor are the fastest way to see what is wrong.'],
            [{ label: 'Get on with it', kind: 'primary' }]);
        }
      }
    }
  }
  if (!app.d) app.d = derive(state);

  app.view.draw(state, app.d, real);

  tickNumbers(state, app.d, real);
  ambience(app.d, speed === 0);

  uiClock += real;
  if (uiClock > 0.2) { refreshLive(state, app.d, uiClock); uiClock = 0; }

  saveClock += real;
  if (saveClock > 15) { saveClock = 0; save(state); }
}

// ------------------------------------------------------------------ startup

function startGame(state, fresh) {
  startAudio(state.settings.sound !== false);
  app.state = state;
  app.d = derive(state);
  app.running = true;
  app.log = [];
  if (app.bootart) { app.bootart.stop(); app.bootart = null; }
  document.getElementById('boot').hidden = true;
  document.getElementById('app').hidden = false;

  if (!app.view) {
    const canvas = document.getElementById('view');
    app.view = new FloorView(canvas, {
      onClick: (x, y, shift) => handleClick(x, y, shift),
      onPaint: (x, y) => { if (app.view.tool) handleClick(x, y, false, true); },
      onHover: (t) => updateGhost(t),
    });
    initUI(app);
    window.addEventListener('resize', () => app.view.resize());
    app.view.resize();
    app.view.observe();
  } else {
    app.view.sel = null;
    app.view.tool = null;
    app.view.resize();
  }
  app.view.centred = false;
  markDirty();
  renderUI();
  refreshLive(state, app.d, 0);
  if (fresh) logLine('A cupboard, a socket and an idea.', 'info');
}

function handleClick(x, y, shift, painting) {
  const state = app.state;
  const view = app.view;
  if (!state) return;
  if (view.tool === 'sell') {
    if (!tileAt(state, x, y)) return;
    const quiet = painting ? { log: () => {} } : app.hooks;
    view.pop(x, y, 'dust');
    sfx.demolish();
    A.sell(state, app.d, x, y, quiet);
    app.d = derive(state);
    markDirty();
    renderUI();
    return;
  }
  if (view.tool) {
    const err = A.place(state, app.d, x, y, view.tool, painting ? { log: () => {} } : app.hooks);
    if (err && !painting) toast(err, 'warn');
    if (!err) { view.pop(x, y, 'place'); sfx.place(); }
    app.d = derive(state);
    if (!painting) { view.sel = { x, y }; }
    markDirty(); renderUI();
    return;
  }
  const same = view.sel && view.sel.x === x && view.sel.y === y;
  view.sel = same ? null : { x, y };
  markDirty();
  renderUI();
}

function updateGhost(t) {
  const g = document.getElementById('ghost');
  const state = app.state;
  if (!t || !state) { g.textContent = 'Wheel to zoom, drag to pan.'; return; }
  const tile = tileAt(state, t.x, t.y);
  const view = app.view;
  if (view.tool && view.tool !== 'sell') {
    const b = BUILDINGS_BY_ID[view.tool];
    g.textContent = `Place ${b.name} at ${t.x},${t.y} — ${money(A.buildCost(b, app.d))}`
      + (tile ? ' (tile taken)' : '');
  } else if (view.tool === 'sell') {
    g.textContent = tile ? `Demolish ${BUILDINGS_BY_ID[tile.b].name} at ${t.x},${t.y}` : 'Nothing to demolish here';
  } else if (tile) {
    const r = app.d.racks.find((x) => x.x === t.x && x.y === t.y);
    g.textContent = r
      ? `${BUILDINGS_BY_ID[tile.b].name} — ${r.used}/${r.cap} slots, ${r.temp.toFixed(1)} °C`
      : BUILDINGS_BY_ID[tile.b].name;
  } else {
    g.textContent = `Empty tile ${t.x},${t.y}`;
  }
}

const clampIdx = (i, n) => (i < 0 ? 0 : i >= n ? n - 1 : i);

function bindKeys() {
  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') return;
    if (e.key === 'Escape') {
      if (!document.getElementById('modal').hidden) return;
      app.view.tool = null;
      app.view.sel = null;
      app.sellBtn?.classList.remove('on');
      markDirty(); renderUI();
    } else if (e.key === ' ') {
      e.preventDefault();
      const st = app.state.settings;
      st.speed = st.speed === 0 ? (st.lastSpeed || 1) : 0;
    } else if (e.key === '+' || e.key === '=' || e.key === '-' || e.key === '_') {
      // Step through the speed ladder without reaching for the mouse.
      const ladder = [0, 1, 2, 5, 10];
      const at = Math.max(0, ladder.indexOf(app.state.settings.speed));
      const next = clampIdx(at + (e.key === '-' || e.key === '_' ? -1 : 1), ladder.length);
      app.state.settings.speed = ladder[next];
      if (ladder[next] > 0) app.state.settings.lastSpeed = ladder[next];
    } else if (e.key >= '1' && e.key <= '9') {
      const t = TABS[Number(e.key) - 1];
      if (t) goTab(t.id);
    } else if (e.key === 'm' || e.key === 'M') {
      app.toggleSound();
    } else if (e.key === 'r' || e.key === 'R') {
      app.view.turn(e.shiftKey ? -1 : 1);
    } else if (e.key === 'o' || e.key === 'O') {
      const modes = ['none', 'power', 'cool', 'heat', 'net'];
      const i = modes.indexOf(app.view.overlay);
      app.view.overlay = modes[(i + 1) % modes.length];
      for (const b of document.querySelectorAll('#floortools .tool')) {
        b.classList.toggle('on', b.textContent.toLowerCase().startsWith(
          app.view.overlay === 'none' ? 'no overlay' : app.view.overlay === 'cool' ? 'cooling' : app.view.overlay));
      }
    }
  });
}

function boot() {
  const sky = document.getElementById('bootsky');
  if (sky) {
    try {
      app.bootart = new BootArt(sky);
      app.bootart.start();
    } catch (e) {
      // The backdrop is decoration; the title card stands on its own without it.
      sky.hidden = true;
    }
  }

  app.hooks = {
    log: logLine,
    onDecision,
    onMilestone: showBanner,
    onRescue,
    onObjective: () => markDirty(),
    onAchievement: () => markDirty(),
  };

  const saved = load();
  const body = document.getElementById('bootbody');
  const buttons = el('div', 'row');

  if (saved) {
    const info = offlineProgress(saved);
    const cont = el('button', 'btn primary', 'Continue — day ' + Math.floor(saved.day)
      + ', ' + money(saved.money));
    cont.onclick = () => {
      startGame(saved, false);
      if (info && info.money > 0) {
        showModal('While you were away', fmtTime(info.seconds) + ' of offline running'
          + (info.capped ? ` (capped at ${info.hours} hours)` : ''), [
          `Your site earned ${money(info.money)} and banked ${fmt(info.rp)} research points.`,
          'Nothing broke while you were gone — offline running is deliberately gentle.',
        ], [{ label: 'Back to work', kind: 'primary' }]);
      }
    };
    const fresh = el('button', 'btn danger', 'Start over');
    fresh.onclick = () => confirmWipe();
    buttons.append(cont, fresh);
  } else {
    const start = el('button', 'btn primary', 'Start in the cupboard');
    start.onclick = () => startGame(newGame(), true);
    buttons.append(start);
  }

  const help = el('button', 'btn', 'How it works');
  help.onclick = () => showHelp();
  buttons.append(help);

  fill(body, buttons, el('div', 'note',
    'Saves live in this browser. Nothing is uploaded anywhere.'));

  bindKeys();
  initTips();
  requestAnimationFrame((t) => { last = t; requestAnimationFrame(frame); });
}

function guideSection(title, rows) {
  const wrap = el('div', 'gsec');
  wrap.append(el('h4', null, title));
  const list = el('div', 'kv');
  for (const [k, v] of rows) list.append(el('div', 'k', k), el('div', 'v', v));
  wrap.append(list);
  return wrap;
}

function showHelp() {
  const intro = el('div', 'gintro');
  intro.append(
    el('p', null, 'You buy compute. Compute earns nothing until it is under contract. '
      + 'Running it needs power, cooling, water, switching and maintenance — and every one of '
      + 'those is a thing you place on the floor, inside a radius, out of a budget.'),
    el('p', null, 'That is the whole game. The machines get bigger; the five problems do not change.'),
  );

  const legend = el('div', 'glegend');
  const chip = (colour, label, note) => {
    const row = el('div', 'grow');
    const sw = el('span', 'gsw');
    sw.style.background = colour;
    row.append(sw, el('b', null, label), el('span', 'gnote', note));
    return row;
  };
  legend.append(
    chip('#4fdca8', 'Green lights', 'slots running and earning'),
    chip('#e8615f', 'Red lights or red border', 'too hot, throttling, or failed'),
    chip('#5a6e84', 'Grey lights', 'empty slots you have paid for and are not using'),
    chip('#e8b44a', 'Amber triangle', 'no PDU reaches this rack'),
    chip('#e8615f', 'Red triangle', 'no cooling reaches this rack, or it is over 40 °C'),
  );

  showModal('How it works', 'Five minutes to learn. Rather longer to finish.', [
    intro,
    guideSection('The five constraints', [
      ['Power', 'A rack needs a PDU within its radius, and the site needs supply. Utilities tab.'],
      ['Cooling', 'A cooler only serves racks inside its radius. Over 30 °C throttles, over 40 °C kills.'],
      ['Water', 'Cooling drinks it. Short of water, cooling capacity falls with it.'],
      ['Switching', 'Compute without bandwidth may as well be switched off. Build → Support.'],
      ['Maintenance', 'Condition decays with heat. Repair effort is split across every rack you own.'],
    ]),
    guideSection('The floor', [
      ['Space', 'Buy extra rows and columns on the Site tab, or move to a bigger facility.'],
      ['Turning', 'R turns the room a quarter, so tall machines stop hiding what is behind them.'],
    ]),
    guideSection('Money', [
      ['Contracts', 'The only income. Offers arrive a couple a day and go stale after about a week.'],
      ['Capacity', 'Sign what fits inside your spare capacity, not all of it.'],
      ['SLA', 'Fall below the promised uptime and penalties start and reputation drops.'],
      ['Reputation', 'Earned by finishing contracts cleanly. Unlocks bigger sites and better customers.'],
      ['R&D', 'The slider on the R&D tab trades sellable compute for research points.'],
      ['What you sell', 'Compute, not machines. The Contracts tab breaks your output into '
        + 'sold, unsold and diverted to research.'],
    ]),
    guideSection('Starting again', [
      ['Selling up', 'Once you reach Data hall A you can sell the company for legacy points.'],
      ['What carries', 'The points, the perks you buy with them, and your achievements.'],
      ['Why', 'Perks are permanent. Every run after the first one starts easier and goes further.'],
    ]),
    guideSection('Ashbrook', [
      ['The town', 'The village next door. It does nothing to you; it is simply the bill.'],
      ['The dial', 'Follows your footprint — megawatts, litres, acres — and only goes one way.'],
      ['The goal', 'Ruin it completely. There is an objective and an achievement waiting.'],
    ]),
    el('h4', 'gh', 'Reading the floor'),
    legend,
    guideSection('Controls', [
      ['To-do list', 'With no tile selected, the strip under the floor lists what needs attention. Click a row to jump to the fix.'],
      ['Overlays', 'The buttons above the floor. Power and Cooling shade what each machine reaches.'],
      ['Placing', 'Pick a machine, click a tile. Drag with one held to lay a whole row.'],
      ['Moving about', 'Wheel zooms, dragging empty space pans, R turns the room a quarter.'],
      ['Speed', 'The 1× to 10× control in the top bar, or +/− on the keyboard.'],
      ['Sound', 'A room tone that follows the site, and a cue for the things worth hearing. '
        + 'The speaker in the top bar turns it off.'],
      ['Keys', '1–9 tabs · O overlays · R turns the room · +/− speed · M mutes · Space pauses · Esc clears the tool'],
    ]),
  ], [{ label: 'Got it', kind: 'primary' }]);
}

app.toggleSound = () => {
  const on = !(app.state.settings.sound !== false);
  app.state.settings.sound = on;
  setSound(on);
  startAudio(on);
  markDirty();
  renderUI();
  return on;
};

app.openGuide = () => showHelp();

/** Pan the view so a given tile sits in the middle, and select it. */
app.focusTile = (x, y) => {
  const v = app.view;
  const p = v.iso(x, y, roomOf(app.state));
  v.ox = v.w / 2 - p.x * v.zoom;
  v.oy = v.h / 2 - p.y * v.zoom;
  v.sel = { x, y };
  markDirty();
};

app.setOverlay = (id) => {
  app.view.overlay = id;
  for (const b of document.querySelectorAll('#floortools .tool')) {
    const name = b.textContent.trim().toLowerCase();
    const match = id === 'none' ? 'no overlay' : id === 'cool' ? 'cooling' : id;
    if (['no overlay', 'power', 'cooling', 'heat', 'network'].includes(name)) {
      b.classList.toggle('on', name === match);
    }
  }
};

boot();

// Exposed for debugging and for the automated smoke test.
app.refreshLive = () => refreshLive(app.state, app.d, 0.2);
window.__rr = app;
