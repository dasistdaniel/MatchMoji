import { store } from "./storage.js";
import { onAudioUnlock } from "./sfx.js";
import { TRACKS, RATE } from "./tracks.js";

export { TRACKS };

const BASE_DB = -4;

// Synthetisierte Stücke (Float32Array) und daraus erzeugte AudioBuffer, je Index
const data = new Map();
const buffers = new Map();

function trackData(i) {
  if (!data.has(i)) data.set(i, TRACKS[i].build());
  return data.get(i);
}

export function trackIndex() {
  const i = store.track | 0;
  return i >= 0 && i < TRACKS.length ? i : 0;
}

// Das gewählte Stück schon beim Laden bauen, damit der erste Klick nicht hakt
trackData(trackIndex());

// ---------- Wiedergabe ----------
let ctxRef = null, gainNode = null, current = null;
let rate = 1;

function level() {
  if (!store.music || store.musicVolume <= 0) return 0;
  return Math.pow(10, BASE_DB / 20) * store.musicVolume;
}

function bufferFor(i) {
  if (!buffers.has(i)) {
    const d = trackData(i);
    const b = ctxRef.createBuffer(1, d.length, RATE);
    b.getChannelData(0).set(d);
    buffers.set(i, b);
  }
  return buffers.get(i);
}

/** Stück starten; ein laufendes wird kurz ausgeblendet. */
function startTrack(i) {
  if (!ctxRef) return;
  try {
    const now = ctxRef.currentTime;
    if (current) {
      const old = current;
      old.fade.gain.setTargetAtTime(0, now, 0.06);
      old.src.stop(now + 0.4);
    }
    const src = ctxRef.createBufferSource();
    src.buffer = bufferFor(i);
    src.loop = true;
    src.playbackRate.value = rate;
    const fade = ctxRef.createGain();
    src.connect(fade).connect(gainNode);
    src.start();
    current = { src, fade, index: i };
  } catch (e) { /* ohne Musik weiter */ }
}

onAudioUnlock((c) => {
  try {
    ctxRef = c;
    gainNode = c.createGain();
    gainNode.gain.value = level();
    gainNode.connect(c.destination);
    startTrack(trackIndex());
  } catch (e) { /* ohne Musik weiter */ }
});

/** Anderes Stück wählen (Index in TRACKS). */
export function setTrack(i) {
  if (current && current.index === i) return;
  startTrack(i);
}

export function updateMusic() {
  if (gainNode && ctxRef) gainNode.gain.setTargetAtTime(level(), ctxRef.currentTime, 0.02);
}

export function setMusicRate(r) {
  rate = r;
  if (current) current.src.playbackRate.value = r;
}
