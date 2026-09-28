import { store } from "./storage.js";
import { onAudioUnlock } from "./sfx.js";

const RATE = 22050;
const STEP = 0.1; // Sechzehntel bei 150 BPM
const STEP_N = Math.round(STEP * RATE);
const STEPS = 16 * 16;
const LEN = STEPS * STEP_N; // 25,6 s
const BASE_DB = -4;

const CHORDS = [
  { bass: 33, lead: [69, 72, 76] }, // Am
  { bass: 29, lead: [65, 69, 72] }, // F
  { bass: 36, lead: [67, 72, 76] }, // C
  { bass: 31, lead: [67, 71, 74] }, // G
];

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
const rnd = () => Math.random() * 2 - 1;

// ---------- Klänge ----------
function kick() {
  const n = Math.floor(0.32 * RATE);
  const out = new Float32Array(n);
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / RATE;
    phase += (42 + 140 * Math.exp(-28 * t)) / RATE;
    const body = Math.sin(2 * Math.PI * phase) * Math.exp(-9 * t);
    const click = rnd() * Math.exp(-300 * t) * 0.6;
    out[i] = Math.tanh((body + click) * 2.6);
  }
  return out;
}

function clap() {
  const n = Math.floor(0.22 * RATE);
  const out = new Float32Array(n);
  let a = 0, b = 0;
  for (let i = 0; i < n; i++) {
    const t = i / RATE;
    const w = rnd();
    a += (w - a) * 0.5;
    b += (w - b) * 0.08;
    const env = t < 0.033 ? Math.exp(-(t % 0.011) * 200) : Math.exp(-(t - 0.033) * 22);
    out[i] = (a - b) * env * 1.6;
  }
  return out;
}

function hat(dur, decay) {
  const n = Math.floor(dur * RATE);
  const out = new Float32Array(n);
  let lp = 0;
  for (let i = 0; i < n; i++) {
    const w = rnd();
    lp += (w - lp) * 0.35;
    out[i] = (w - lp) * Math.exp(-(i / RATE) * decay);
  }
  return out;
}

const bassCache = new Map();
function bass(midi) {
  if (bassCache.has(midi)) return bassCache.get(midi);
  const n = Math.floor(0.095 * RATE);
  const out = new Float32Array(n);
  const f = mtof(midi);
  let phase = 0, lp = 0;
  for (let i = 0; i < n; i++) {
    const t = i / RATE;
    phase += f / RATE;
    const saw = 2 * (phase % 1) - 1;
    const sawUp = 2 * ((2 * phase) % 1) - 1;
    const sub = Math.sin(2 * Math.PI * phase);
    lp += (saw + 0.6 * sawUp - lp) * (0.09 + 0.45 * Math.exp(-30 * t));
    out[i] = Math.tanh((1.1 * lp + 0.55 * sub) * 2.4) * Math.min(t / 0.003, 1) * (1 - i / n);
  }
  bassCache.set(midi, out);
  return out;
}

const leadCache = new Map();
function lead(midi) {
  if (leadCache.has(midi)) return leadCache.get(midi);
  const n = Math.floor(0.16 * RATE);
  const out = new Float32Array(n);
  const f = mtof(midi);
  let phase = 0, lp = 0;
  for (let i = 0; i < n; i++) {
    const t = i / RATE;
    phase += f / RATE;
    const sq = phase % 1 < 0.5 ? 1 : -1;
    lp += (sq - lp) * 0.25;
    out[i] = lp * Math.min(t / 0.003, 1) * Math.exp(-18 * t);
  }
  leadCache.set(midi, out);
  return out;
}

function riser() {
  const n = 16 * STEP_N;
  const out = new Float32Array(n);
  let lp = 0;
  for (let i = 0; i < n; i++) {
    const p = i / n;
    lp += (rnd() - lp) * (0.02 + 0.5 * p * p);
    out[i] = lp * p * p * 1.5;
  }
  return out;
}

// ---------- Track ----------
function add(track, sample, start, vol) {
  for (let i = 0; i < sample.length; i++) track[(start + i) % LEN] += sample[i] * vol;
}

function buildTrack() {
  const drums = new Float32Array(LEN);
  const music = new Float32Array(LEN);
  const K = kick(), C = clap();
  const HC = hat(0.045, 70), HO = hat(0.16, 18), CR = hat(1.4, 2.5);
  const R = riser();

  for (let s = 0; s < STEPS; s++) {
    const bar = Math.floor(s / 16);
    const pos = s % 16;
    const at = s * STEP_N;
    const chord = CHORDS[Math.floor(bar / 2) % 4];
    const second = bar >= 8;

    if (pos % 4 === 0) add(drums, K, at, 1.0);
    if (pos === 4 || pos === 12) add(music, C, at, 0.85);
    if (pos % 4 === 2) add(music, HO, at, 0.34);
    else add(music, HC, at, pos % 2 === 1 ? 0.26 : 0.16);
    if (pos % 4 !== 0) add(music, bass(chord.bass + (pos % 4 === 3 ? 12 : 0)), at, 0.55);
    if (second || pos % 2 === 0) {
      const i = (second ? s : Math.floor(s / 2)) % 4;
      const note = i < 3 ? chord.lead[i] : chord.lead[0] + 12;
      add(music, lead(note), at, second ? 0.34 : 0.28);
    }
    if (pos === 0 && (bar === 0 || bar === 8)) add(music, CR, at, 0.28);
    if (pos === 0 && (bar === 7 || bar === 15)) add(music, R, at, 0.4);
  }

  const mix = new Float32Array(LEN);
  const quarter = 4 * STEP_N;
  let peak = 0;
  for (let i = 0; i < LEN; i++) {
    const t = (i % quarter) / RATE;
    const duck = 1 - 0.65 * Math.exp(-11 * t);
    mix[i] = drums[i] + music[i] * duck;
    peak = Math.max(peak, Math.abs(mix[i]));
  }
  const gain = 2.2 / (peak || 1);
  const norm = 0.95 / Math.tanh(2.2);
  for (let i = 0; i < LEN; i++) mix[i] = Math.tanh(mix[i] * gain) * norm;
  return mix;
}

const TRACK = buildTrack();

// ---------- Wiedergabe ----------
let src = null, gainNode = null, ctxRef = null;
let rate = 1;

function level() {
  if (!store.music || store.musicVolume <= 0) return 0;
  return Math.pow(10, BASE_DB / 20) * store.musicVolume;
}

onAudioUnlock((c) => {
  try {
    ctxRef = c;
    const buf = c.createBuffer(1, LEN, RATE);
    buf.getChannelData(0).set(TRACK);
    gainNode = c.createGain();
    gainNode.gain.value = level();
    gainNode.connect(c.destination);
    src = c.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    src.playbackRate.value = rate;
    src.connect(gainNode);
    src.start();
  } catch (e) { /* ohne Musik weiter */ }
});

export function updateMusic() {
  if (gainNode && ctxRef) gainNode.gain.setTargetAtTime(level(), ctxRef.currentTime, 0.02);
}

export function setMusicRate(r) {
  rate = r;
  if (src) src.playbackRate.value = r;
}
