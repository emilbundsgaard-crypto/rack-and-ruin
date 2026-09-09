/**
 * How many people are playing right now.
 *
 * The page asks the server every so often; the server answers with one number
 * and remembers that we were here. If there is no server behind the files —
 * opened from disk, or hosted somewhere without PHP — the first ask fails and
 * the counter removes itself and never asks again. A number that might be
 * wrong is worse than no number, so it does not guess and it does not retry
 * forever.
 */

const ENDPOINT = 'api/track.php';
const EVERY = 45_000;      // between heartbeats while the tab is in front
const GIVE_UP = 3;         // consecutive failures before we stop for good

let timer = 0;
let fails = 0;
let stopped = false;
let last = 0;

/**
 * The chip is built by the top bar, which is built on the first render — after
 * this module starts. So it is looked up every time rather than cached once,
 * which is what previously left the counter permanently hidden: init ran
 * first, found nothing, and gave up.
 */
function chip() { return document.getElementById('livecount'); }

let pending = -1;

function paint(n) {
  const node = chip();
  if (!node) {
    // The first answer often arrives before the first frame has drawn. Hold on
    // to it and put it up as soon as there is somewhere to put it, rather than
    // dropping it and leaving the bar blank until the next heartbeat.
    if (pending < 0) requestAnimationFrame(function again() {
      if (chip()) { const n2 = pending; pending = -1; paint(n2); }
      else requestAnimationFrame(again);
    });
    pending = n;
    return;
  }
  // The count sits in its own fixed-width span so the top bar's width does not
  // change when the number does. The bar re-fits itself when its width moves,
  // and a counter that ticked 9 -> 10 must not be able to set that off.
  node.innerHTML = '';
  const dot = document.createElement('i');
  const num = document.createElement('b');
  num.textContent = String(n);
  const lbl = document.createElement('span');
  lbl.textContent = 'playing';
  node.append(dot, num, lbl);
  node.hidden = false;
  node.classList.toggle('alone', n <= 1);
}

function retire() {
  stopped = true;
  if (timer) { clearInterval(timer); timer = 0; }
  const node = chip();
  if (node) node.hidden = true;
}

async function beat() {
  if (stopped) return;
  last = Date.now();
  try {
    const res = await fetch(ENDPOINT, { cache: 'no-store' });
    if (!res.ok) throw new Error('http ' + res.status);
    // A host without PHP serves the script as text and still says 200, so the
    // body has to be checked, not just the status.
    const data = await res.json();
    if (typeof data.live !== 'number') throw new Error('not a count');
    fails = 0;
    paint(data.live);
  } catch {
    if (++fails >= GIVE_UP) retire();
    else { const node = chip(); if (node) node.hidden = true; }
  }
}

/** Called once at start-up; it does not need the top bar to exist yet. */
export function initPresence() {
  beat();
  timer = setInterval(() => { if (!document.hidden) beat(); }, EVERY);
  // Coming back to a tab that sat in the background for an hour should show a
  // fresh number straight away rather than up to 45 seconds of a stale one.
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && !stopped && Date.now() - last > EVERY) beat();
  });
}
