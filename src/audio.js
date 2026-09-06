// Everything you hear, synthesised on the spot. No files, no downloads.
//
// A datacentre is mostly a noise floor, so that is what the room is: filtered
// noise and a low tone whose loudness follows the draw. On top of that, short
// cues for the handful of things worth hearing. All of it is wrapped, because
// a browser refusing to make a sound must never cost anybody a save.

let ctx = null;
let master = null;
let hum = null;
let humGain = null;
let noiseGain = null;
let started = false;
let enabled = true;
let lastAlarm = 0;

function ok() {
  return enabled && ctx && ctx.state === 'running';
}

/** Called from a user gesture, which is the only time this is allowed to work. */
export function startAudio(on) {
  enabled = on !== false;
  if (started) { resume(); return; }
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = enabled ? 0.5 : 0;
    master.connect(ctx.destination);

    // The room tone: a low hum plus a hiss of moving air.
    hum = ctx.createOscillator();
    hum.type = 'sawtooth';
    hum.frequency.value = 54;
    humGain = ctx.createGain();
    humGain.gain.value = 0;
    const humFilter = ctx.createBiquadFilter();
    humFilter.type = 'lowpass';
    humFilter.frequency.value = 180;
    hum.connect(humFilter).connect(humGain).connect(master);
    hum.start();

    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * 0.5;
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    noise.loop = true;
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.value = 620;
    noiseFilter.Q.value = 0.7;
    noiseGain = ctx.createGain();
    noiseGain.gain.value = 0;
    noise.connect(noiseFilter).connect(noiseGain).connect(master);
    noise.start();

    started = true;
  } catch (err) {
    ctx = null;
  }
}

function resume() {
  try { if (ctx && ctx.state === 'suspended') ctx.resume(); } catch (err) { /* ignore */ }
}

export function setEnabled(on) {
  enabled = !!on;
  if (!started && on) return;          // it will start on the next gesture
  try { if (master) master.gain.value = on ? 0.5 : 0; } catch (err) { /* ignore */ }
  if (on) resume();
}

export function isEnabled() { return enabled; }

/**
 * The room gets louder as the site does, and sours when it is in trouble.
 * Called every frame; everything is a smoothed set, never a re-allocation.
 */
export function ambience(d, paused) {
  if (!ok() || !humGain) return;
  try {
    const size = Math.min(1, Math.log10(1 + d.actualDraw) / 6.4);
    const strain = d.rawPowerFactor < 0.99 || d.maxTemp > 44 ? 1 : 0;
    const target = paused ? 0 : size * 0.05;
    const now = ctx.currentTime;
    humGain.gain.setTargetAtTime(target, now, 0.6);
    noiseGain.gain.setTargetAtTime(paused ? 0 : size * 0.018, now, 0.6);
    hum.frequency.setTargetAtTime(strain ? 47 : 54, now, 1.2);
  } catch (err) { /* ignore */ }
}

function blip(freq, dur, type, vol, slideTo) {
  if (!ok()) return;
  try {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type || 'triangle';
    o.frequency.value = freq;
    const now = ctx.currentTime;
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, now + dur);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(vol, now + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    o.connect(g).connect(master);
    o.start(now);
    o.stop(now + dur + 0.02);
  } catch (err) { /* ignore */ }
}

function thud(vol) {
  if (!ok()) return;
  try {
    const now = ctx.currentTime;
    const len = Math.floor(ctx.sampleRate * 0.18);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 900;
    const g = ctx.createGain();
    g.gain.value = vol;
    src.connect(f).connect(g).connect(master);
    src.start(now);
  } catch (err) { /* ignore */ }
}

export const sfx = {
  place() { blip(180, 0.09, 'square', 0.07, 90); thud(0.09); },
  demolish() { thud(0.16); blip(120, 0.16, 'sawtooth', 0.05, 60); },
  sign() { blip(523, 0.1, 'triangle', 0.06); setTimeout(() => blip(784, 0.16, 'triangle', 0.055), 90); },
  upgrade() { blip(660, 0.07, 'triangle', 0.05); setTimeout(() => blip(990, 0.1, 'triangle', 0.045), 70); },
  good() { blip(440, 0.08, 'sine', 0.05); setTimeout(() => blip(660, 0.14, 'sine', 0.05), 80); },
  alarm() {
    const now = Date.now();
    if (now - lastAlarm < 12_000) return;
    lastAlarm = now;
    blip(320, 0.16, 'square', 0.05);
    setTimeout(() => blip(240, 0.22, 'square', 0.05), 170);
  },
};
