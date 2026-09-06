// One floating tooltip for the whole page. Anything with a data-tip attribute
// gets it; nothing uses the browser's own title tooltip, which is slow, styled
// by the operating system and impossible to keep on brand.
//
// A tip may carry a heading by putting it before a pipe: "Cooling|What it does".

let box = null;
let target = null;
let timer = 0;
let mx = 0;
let my = 0;

const DELAY = 220;
const GAP = 16;

export function initTips() {
  box = document.getElementById('tip');
  if (!box) return;

  document.addEventListener('pointermove', (e) => {
    mx = e.clientX;
    my = e.clientY;
    const found = e.target instanceof Element ? e.target.closest('[data-tip]') : null;
    if (found === target) {
      if (box.hidden === false) place();
      return;
    }
    target = found;
    clearTimeout(timer);
    if (!found || e.pointerType === 'touch') { hide(); return; }
    timer = setTimeout(show, DELAY);
  }, { passive: true });

  document.addEventListener('pointerdown', hide, { passive: true });
  document.addEventListener('pointerleave', hide, { passive: true });
  window.addEventListener('blur', hide);
  document.addEventListener('scroll', hide, true);
}

function show() {
  if (!target || !target.isConnected) return;
  const raw = target.dataset.tip || '';
  const [head, body] = raw.includes('|') ? raw.split('|') : [null, raw];
  box.replaceChildren();
  if (head) {
    const h = document.createElement('div');
    h.className = 'tiph';
    h.textContent = head;
    box.append(h);
  }
  for (const line of body.split('\n')) {
    if (!line.trim()) continue;
    const p = document.createElement('div');
    p.className = 'tipb';
    p.textContent = line;
    box.append(p);
  }
  box.hidden = false;
  place();
}

function place() {
  const r = box.getBoundingClientRect();
  let x = mx + GAP;
  let y = my + GAP;
  if (x + r.width > window.innerWidth - 8) x = mx - r.width - GAP;
  if (y + r.height > window.innerHeight - 8) y = my - r.height - GAP;
  box.style.left = Math.max(8, x) + 'px';
  box.style.top = Math.max(8, y) + 'px';
}

export function hide() {
  clearTimeout(timer);
  target = null;
  if (box) box.hidden = true;
}
