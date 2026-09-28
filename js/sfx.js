import { store } from "./storage.js";

const RATE = 22050;

// ---------- gemeinsamer AudioContext ----------
let ctx = null;
const unlockListeners = [];

export function audioCtx() { return ctx; }
export function onAudioUnlock(fn) { unlockListeners.push(fn); if (ctx) fn(ctx); }

/** Beim ersten Klick/Tastendruck aufrufen. */
export function unlockAudio() {
  try {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      for (const fn of unlockListeners) fn(ctx);
    }
    if (ctx.state === "suspended") ctx.resume();
  } catch (e) { /* ohne Audio weiterspielen */ }
}

// ---------- Synthese-Bausteine ----------
function tone(f0, f1, dur, wave, vol, decay = 2) {
  const n = Math.floor(dur * RATE);
  const out = new Float32Array(n);
  let phase = 0;
  const att = 0.004 * RATE;
  for (let i = 0; i < n; i++) {
    const f = f0 + (f1 - f0) * (i / n);
    phase += f / RATE;
    const p = phase % 1;
    let v;
    if (wave === "square") v = p < 0.5 ? 1 : -1;
    else if (wave === "triangle") v = 4 * Math.abs(p - 0.5) - 1;
    else v = Math.sin(2 * Math.PI * phase);
    const env = Math.min(i / att, 1) * Math.pow(1 - i / n, decay);
    out[i] = v * env * vol;
  }
  return out;
}

function noise(dur, vol, smooth, attack = 0.005) {
  const n = Math.floor(dur * RATE);
  const out = new Float32Array(n);
  const att = Math.max(1, attack * RATE);
  let y = 0;
  for (let i = 0; i < n; i++) {
    y += (Math.random() * 2 - 1 - y) * smooth;
    out[i] = y * Math.min(i / att, 1) * Math.pow(1 - i / n, 2) * vol;
  }
  return out;
}

function render(parts) {
  let len = 0;
  for (const [t, s] of parts) len = Math.max(len, Math.floor(t * RATE) + s.length);
  const out = new Float32Array(len);
  for (const [t, s] of parts) {
    const o = Math.floor(t * RATE);
    for (let i = 0; i < s.length; i++) out[o + i] += s[i];
  }
  for (let i = 0; i < len; i++) out[i] = Math.max(-1, Math.min(1, out[i] * 1.8));
  return out;
}

// ---------- Effekte ----------
const DATA = {
  click: render([[0, tone(1000, 900, 0.035, "sine", 0.25)]]),
  select: render([[0, tone(660, 900, 0.06, "sine", 0.35)]]),
  swap: render([[0, tone(320, 520, 0.09, "triangle", 0.3)], [0, noise(0.08, 0.06, 0.3)]]),
  invalid: render([
    [0, tone(170, 140, 0.09, "square", 0.14)],
    [0.1, tone(150, 110, 0.12, "square", 0.14)],
  ]),
  match: render([
    [0, tone(784, 784, 0.28, "sine", 0.35, 3)],
    [0, tone(1568, 1568, 0.2, "sine", 0.1, 4)],
    [0.03, tone(1175, 1175, 0.25, "sine", 0.2, 3)],
  ]),
  special: render([
    [0, tone(523, 523, 0.09, "triangle", 0.3)],
    [0.06, tone(659, 659, 0.09, "triangle", 0.3)],
    [0.12, tone(784, 784, 0.09, "triangle", 0.3)],
    [0.18, tone(1047, 1047, 0.22, "triangle", 0.32, 2)],
  ]),
  line: render([[0, tone(1600, 180, 0.3, "square", 0.1, 1.5)], [0, noise(0.3, 0.2, 0.5)]]),
  star: render([
    ...[1047, 1319, 1568, 2093, 2637, 3136].map((f, i) => [i * 0.045, tone(f, f, 0.18, "sine", 0.22, 3)]),
    [0, noise(0.35, 0.05, 0.9)],
  ]),
  shuffle: render([[0, noise(0.4, 0.8, 0.15, 0.2)]]),
  tick: render([[0, tone(1400, 1400, 0.035, "square", 0.2)]]),
  time_up: render([
    [0, tone(659, 659, 0.16, "triangle", 0.35)],
    [0.17, tone(523, 523, 0.16, "triangle", 0.36)],
    [0.34, tone(392, 380, 0.45, "triangle", 0.38, 1.5)],
  ]),
  record: render([
    [0, tone(523, 523, 0.1, "triangle", 0.3)],
    [0.11, tone(659, 659, 0.1, "triangle", 0.3)],
    [0.22, tone(784, 784, 0.1, "triangle", 0.3)],
    [0.33, tone(1047, 1047, 0.5, "triangle", 0.34, 1.5)],
    [0.33, tone(1319, 1319, 0.5, "sine", 0.14)],
  ]),
};

const buffers = {};
onAudioUnlock((c) => {
  for (const [name, d] of Object.entries(DATA)) {
    const b = c.createBuffer(1, d.length, RATE);
    b.getChannelData(0).set(d);
    buffers[name] = b;
  }
});

/** Audio anhalten/fortsetzen, z. B. wenn der Tab im Hintergrund ist. */
export function setAudioSuspended(suspended) {
  try {
    if (!ctx) return;
    if (suspended && ctx.state === "running") ctx.suspend();
    else if (!suspended && ctx.state === "suspended") ctx.resume();
  } catch (e) { /* ignorieren */ }
}

// ---------- Vibration (Handy) ----------
// Nur für spürbare Ereignisse; Klick, Auswahl und Tausch bleiben still.
const VIB = {
  special: 35,
  line: 30,
  star: [30, 40, 60],
  invalid: [15, 40, 15],
  shuffle: 25,
  time_up: 200,
  record: [40, 60, 40, 60, 120],
};

export const canVibrate = typeof navigator !== "undefined" && typeof navigator.vibrate === "function";

function vibrate(name, pitch) {
  if (!canVibrate || !store.vibrate) return;
  // ohne vorherige Nutzeraktion blockiert der Browser (mit Konsolen-Warnung)
  if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return;
  const pattern = name === "match" ? (pitch > 1 ? 15 : 0) : VIB[name];
  if (!pattern) return;
  try { navigator.vibrate(pattern); } catch (e) { /* ignorieren */ }
}

export function play(name, pitch = 1, gainDb = 0) {
  vibrate(name, pitch);
  try {
    if (!ctx || !store.sound || store.sfxVolume <= 0) return;
    const buf = buffers[name];
    if (!buf) return;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = pitch;
    const g = ctx.createGain();
    g.gain.value = Math.pow(10, gainDb / 20) * store.sfxVolume;
    src.connect(g).connect(ctx.destination);
    src.start();
  } catch (e) { /* ignorieren */ }
}
