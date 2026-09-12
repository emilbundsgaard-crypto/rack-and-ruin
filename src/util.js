// Small helpers shared by every module. No dependencies.

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const sum = (arr, f) => arr.reduce((a, x) => a + f(x), 0);

const SUFFIX = [
  '', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No',
  'Dc', 'UDc', 'DDc', 'TDc', 'QaDc', 'QiDc', 'SxDc', 'SpDc', 'OcDc', 'NoDc', 'Vg'
];

/** 12345.6 -> "12.35K". Keeps three significant digits for readability. */
export function fmt(n, digits = 2) {
  if (!isFinite(n)) return '∞';
  if (n === 0) return '0';
  const neg = n < 0;
  n = Math.abs(n);
  if (n < 1) {
    // Small rates still need to read as something other than "0.01".
    return (neg ? '-' : '') + Number(n.toPrecision(2)).toString();
  }
  if (n < 999.5) {
    const d = n < 10 ? digits : n < 100 ? Math.max(1, digits - 1) : 0;
    // Trim trailing zeros in the fraction only — 400 must not become 4.
    return (neg ? '-' : '') + n.toFixed(d).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
  }
  let tier = Math.min(SUFFIX.length - 1, Math.floor(Math.log10(n) / 3));
  let scaled = n / Math.pow(10, tier * 3);
  // Rounding can push a value up into the next tier — 999.7K must read as
  // 1.00M, never as "1000K". Log rounding can also land a tier low.
  if (scaled >= 999.5 && tier < SUFFIX.length - 1) { tier++; scaled = n / Math.pow(10, tier * 3); }
  const d = scaled < 10 ? 2 : scaled < 100 ? 1 : 0;
  return (neg ? '-' : '') + scaled.toFixed(d) + SUFFIX[tier];
}

export const money = (n) => '$' + fmt(n);
export const rate = (n) => '$' + fmt(n) + '/s';

/** Whole numbers below 10000, abbreviated above. */
export function fmtInt(n) {
  if (Math.abs(n) < 10000) return Math.floor(n).toLocaleString('en-US');
  return fmt(n);
}

export function fmtTime(seconds) {
  if (!isFinite(seconds) || seconds < 0) return '—';
  if (seconds < 60) return Math.ceil(seconds) + 's';
  const m = Math.floor(seconds / 60);
  if (m < 60) return m + 'm ' + Math.floor(seconds % 60) + 's';
  const h = Math.floor(m / 60);
  if (h < 24) return h + 'h ' + (m % 60) + 'm';
  return Math.floor(h / 24) + 'd ' + (h % 24) + 'h';
}

/** Deterministic-ish pseudo random with a seed, used for market noise. */
export function noise(seed) {
  const x = Math.sin(seed * 127.1) * 43758.5453;
  return x - Math.floor(x);
}

export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

export function weightedPick(arr, weightFn) {
  const total = sum(arr, weightFn);
  if (total <= 0) return arr[0];
  let r = Math.random() * total;
  for (const item of arr) {
    r -= weightFn(item);
    if (r <= 0) return item;
  }
  return arr[arr.length - 1];
}

export function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Roman-ish level tags for upgrade tiers. */
export function roman(n) {
  const map = [[10,'X'],[9,'IX'],[5,'V'],[4,'IV'],[1,'I']];
  let out = '';
  for (const [v, s] of map) while (n >= v) { out += s; n -= v; }
  return out || 'I';
}

export function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** Replace a node's children with the supplied nodes. */
export function fill(parent, ...nodes) {
  parent.replaceChildren(...nodes.flat().filter(Boolean));
  return parent;
}

/**
 * A balance number that a sweep can override, and that a browser never reads
 * from the environment.
 *
 * There is a scar behind the `typeof` here. An earlier pass wrote
 * `process.env.RR_RESEARCH_SCALE` straight into a data module. `process` does
 * not exist in a browser and the reference throws before the optional chain
 * can save it, so the game did not boot at all — while every measurement
 * taken in Node stayed perfectly valid, which is the worst possible
 * combination. Every environment read in this codebase goes through here.
 */
export function tune(name, fallback) {
  const env = (typeof process !== 'undefined' && process && process.env) ? process.env : null;
  if (!env) return fallback;
  const raw = env['RR_' + name];
  if (raw === undefined || raw === '') return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}
