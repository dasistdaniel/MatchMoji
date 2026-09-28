// Hintergrundmusik: alle Stücke werden per Code synthetisiert (mono, 22050 Hz).
// Jedes build() liefert ein Float32Array, das nahtlos loopt: Klänge, die über
// das Ende hinausragen, werden an den Anfang umgebrochen.

export const RATE = 22050;

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
const rnd = () => Math.random() * 2 - 1;

// ---------- Grundgerüst ----------
function song(bpm, bars) {
  const step = 60 / bpm / 4; // Sechzehntel in Sekunden
  const steps = bars * 16;
  const len = Math.round(steps * step * RATE);
  return {
    step, steps, len,
    at: (s) => Math.round(s * step * RATE),
    drums: new Float32Array(len),
    music: new Float32Array(len),
  };
}

function add(buf, smp, start, vol = 1) {
  const L = buf.length;
  start = ((start % L) + L) % L;
  for (let i = 0; i < smp.length; i++) buf[(start + i) % L] += smp[i] * vol;
}

function addEcho(buf, smp, start, vol, delay, fb, taps) {
  let g = vol;
  for (let k = 0; k <= taps; k++, g *= fb) add(buf, smp, start + k * delay, g);
}

/** Hüllkurve für Sidechain: an jeder Position kurz abducken. */
function duckEnv(len, positions, depth, rate) {
  const env = new Float32Array(len).fill(1);
  const n = Math.round(0.5 * RATE);
  for (const p of positions) {
    for (let j = 0; j < n; j++) {
      const i = (p + j) % len;
      env[i] = Math.min(env[i], 1 - depth * Math.exp(-rate * j / RATE));
    }
  }
  return env;
}

/**
 * Mischen und weich begrenzen, damit es auch auf Laptop-Lautsprechern hörbar ist.
 * Mit rms wird auf eine Ziel-Lautheit normalisiert statt auf die Spitze, damit
 * alle Stücke etwa gleich laut sind.
 */
function master(s, { drive = 2.2, duck = null, lp = 1, rms = 0 } = {}) {
  const mix = new Float32Array(s.len);
  let y = 0, peak = 0, sq = 0;
  for (let i = 0; i < s.len; i++) {
    const x = s.drums[i] + s.music[i] * (duck ? duck[i] : 1);
    y += (x - y) * lp;
    mix[i] = y;
    peak = Math.max(peak, Math.abs(y));
    sq += y * y;
  }
  const gain = rms ? rms / (Math.sqrt(sq / s.len) || 1) : drive / (peak || 1);
  const norm = rms ? 0.95 : 0.95 / Math.tanh(drive);
  for (let i = 0; i < s.len; i++) mix[i] = Math.tanh(mix[i] * gain) * norm;
  return mix;
}

// ---------- Instrumente ----------
const WAVES = {
  saw: (p) => 2 * (p % 1) - 1,
  square: (p, pw) => ((p % 1) < pw ? 1 : -1),
  tri: (p) => 4 * Math.abs((p % 1) - 0.5) - 1,
  sine: (p) => Math.sin(2 * Math.PI * p),
};

const noteCache = new Map();
/**
 * Synthesizer-Stimme. Tiefpass: c = lp + lpAmt·e^(−lpRate·t).
 * Hüllkurve: Attack, optional exponentieller Abfall, lineares Release am Ende.
 */
function synth(o) {
  const key = JSON.stringify(o);
  if (noteCache.has(key)) return noteCache.get(key);
  const {
    midi, dur, wave = "saw", attack = 0.005, decay = 0, release = 0.03,
    lp = 1, lpAmt = 0, lpRate = 0, detune = 0, pw = 0.5,
    vib = 0, vibDelay = 0.15, vibRate = 5.5,
  } = o;
  const f = mtof(midi);
  const w = WAVES[wave];
  const n = Math.floor(dur * RATE);
  const out = new Float32Array(n);
  let p1 = 0, p2 = 0.37, y = 0;
  for (let i = 0; i < n; i++) {
    const t = i / RATE;
    let ff = f;
    if (vib && t > vibDelay) ff *= 1 + vib * Math.sin(2 * Math.PI * vibRate * (t - vibDelay));
    p1 += ff * (1 + detune) / RATE;
    let x = w(p1, pw);
    if (detune) {
      p2 += ff * (1 - detune) / RATE;
      x = (x + w(p2, pw)) / 2;
    }
    y += (x - y) * Math.min(1, lp + lpAmt * Math.exp(-lpRate * t));
    const env = Math.min(t / attack, 1) * (decay ? Math.exp(-decay * t) : 1) * Math.min((dur - t) / release, 1);
    out[i] = y * env;
  }
  noteCache.set(key, out);
  return out;
}

function kick({ dur = 0.32, f0 = 140, f1 = 42, pitchDecay = 28, ampDecay = 9, click = 0.6, drive = 2.6 } = {}) {
  const n = Math.floor(dur * RATE);
  const out = new Float32Array(n);
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / RATE;
    phase += (f1 + f0 * Math.exp(-pitchDecay * t)) / RATE;
    const body = Math.sin(2 * Math.PI * phase) * Math.exp(-ampDecay * t);
    const c = rnd() * Math.exp(-300 * t) * click;
    out[i] = Math.tanh((body + c) * drive);
  }
  return out;
}

/** Gefiltertes Rauschen: lp glättet, hp zieht einen Tiefpass ab (Hochpass). */
function noiseHit({ dur, decay, lp = 1, hp = 0, gate = Infinity, body = 0, bodyF = 190 }) {
  const n = Math.floor(dur * RATE);
  const out = new Float32Array(n);
  let a = 0, b = 0;
  for (let i = 0; i < n; i++) {
    const t = i / RATE;
    a += (rnd() - a) * lp;
    let x = a;
    if (hp) { b += (x - b) * hp; x -= b; }
    if (body) x += body * Math.sin(2 * Math.PI * bodyF * t) * Math.exp(-25 * t);
    const g = t < gate ? 1 : Math.max(0, 1 - (t - gate) / 0.01);
    out[i] = x * Math.exp(-decay * t) * g;
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
  return noiseHit({ dur, decay, hp: 0.35 });
}

/** E-Piano per FM-Synthese. */
const epCache = new Map();
function epiano(midi, dur = 2) {
  const key = midi + ":" + dur;
  if (epCache.has(key)) return epCache.get(key);
  const f = mtof(midi);
  const n = Math.floor(dur * RATE);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / RATE;
    const idx = 1.6 * Math.exp(-4 * t);
    const x = Math.sin(2 * Math.PI * f * t + idx * Math.sin(2 * Math.PI * f * t));
    const trem = 1 + 0.12 * Math.sin(2 * Math.PI * 4.5 * t);
    out[i] = x * trem * Math.min(t / 0.004, 1) * Math.exp(-1.3 * t) * Math.min((dur - t) / 0.05, 1);
  }
  epCache.set(key, out);
  return out;
}

// ---------- Stücke ----------

/** Techno: 150 BPM, Am – F – C – G, Kick mit Sidechain. */
function buildTechno() {
  const s = song(150, 16);
  const CH = [
    { bass: 33, lead: [69, 72, 76] }, // Am
    { bass: 29, lead: [65, 69, 72] }, // F
    { bass: 36, lead: [67, 72, 76] }, // C
    { bass: 31, lead: [67, 71, 74] }, // G
  ];
  const K = kick(), C = clap();
  const HC = hat(0.045, 70), HO = hat(0.16, 18), CR = hat(1.4, 2.5);
  const R = riser(s.at(16));
  const bass = (m) => {
    const key = "tb" + m;
    if (noteCache.has(key)) return noteCache.get(key);
    const n = Math.floor(0.095 * RATE), out = new Float32Array(n), f = mtof(m);
    let phase = 0, lp = 0;
    for (let i = 0; i < n; i++) {
      const t = i / RATE;
      phase += f / RATE;
      const saw = 2 * (phase % 1) - 1, sawUp = 2 * ((2 * phase) % 1) - 1, sub = Math.sin(2 * Math.PI * phase);
      lp += (saw + 0.6 * sawUp - lp) * (0.09 + 0.45 * Math.exp(-30 * t));
      out[i] = Math.tanh((1.1 * lp + 0.55 * sub) * 2.4) * Math.min(t / 0.003, 1) * (1 - i / n);
    }
    noteCache.set(key, out);
    return out;
  };
  const lead = (m) => synth({ midi: m, dur: 0.16, wave: "square", lp: 0.25, decay: 18, attack: 0.003, release: 0.005 });

  for (let st = 0; st < s.steps; st++) {
    const bar = Math.floor(st / 16), pos = st % 16, at = s.at(st);
    const ch = CH[Math.floor(bar / 2) % 4];
    const second = bar >= 8;
    if (pos % 4 === 0) add(s.drums, K, at, 1.0);
    if (pos === 4 || pos === 12) add(s.music, C, at, 0.85);
    if (pos % 4 === 2) add(s.music, HO, at, 0.34);
    else add(s.music, HC, at, pos % 2 === 1 ? 0.26 : 0.16);
    if (pos % 4 !== 0) add(s.music, bass(ch.bass + (pos % 4 === 3 ? 12 : 0)), at, 0.55);
    if (second || pos % 2 === 0) {
      const i = (second ? st : Math.floor(st / 2)) % 4;
      add(s.music, lead(i < 3 ? ch.lead[i] : ch.lead[0] + 12), at, second ? 0.34 : 0.28);
    }
    if (pos === 0 && (bar === 0 || bar === 8)) add(s.music, CR, at, 0.28);
    if (pos === 0 && (bar === 7 || bar === 15)) add(s.music, R, at, 0.4);
  }
  // Sidechain: innerhalb jedes Viertels abducken
  const quarter = s.at(4);
  const duck = new Float32Array(s.len);
  for (let i = 0; i < s.len; i++) duck[i] = 1 - 0.65 * Math.exp(-11 * (i % quarter) / RATE);
  return master(s, { drive: 2.2, duck });
}

function riser(n) {
  const out = new Float32Array(n);
  let lp = 0;
  for (let i = 0; i < n; i++) {
    const p = i / n;
    lp += (rnd() - lp) * (0.02 + 0.5 * p * p);
    out[i] = lp * p * p * 1.5;
  }
  return out;
}

/** Chiptune: 140 BPM, C – Am – F – G, Rechteck-Melodie im 8-Bit-Stil. */
function buildChiptune() {
  const s = song(140, 16);
  const CH = [
    { root: 48, tones: [60, 64, 67] }, // C
    { root: 45, tones: [57, 60, 64] }, // Am
    { root: 41, tones: [53, 57, 60] }, // F
    { root: 43, tones: [55, 59, 62] }, // G
  ];
  // Melodie über 8 Takte: [Schritt, MIDI, Länge in Schritten]
  const MEL = [
    [[0, 72, 2], [2, 76, 2], [4, 79, 4], [8, 76, 2], [10, 72, 2], [12, 74, 2], [14, 76, 2]],
    [[0, 72, 6], [8, 67, 2], [10, 69, 2], [12, 71, 2], [14, 72, 2]],
    [[0, 72, 2], [2, 76, 2], [4, 81, 4], [8, 79, 2], [10, 76, 2], [12, 72, 4]],
    [[0, 76, 6], [8, 74, 2], [10, 72, 2], [12, 71, 2], [14, 69, 2]],
    [[0, 69, 2], [2, 72, 2], [4, 77, 4], [8, 76, 2], [10, 74, 2], [12, 72, 4]],
    [[0, 77, 4], [4, 76, 2], [6, 74, 2], [8, 72, 8]],
    [[0, 71, 2], [2, 74, 2], [4, 79, 4], [8, 77, 2], [10, 76, 2], [12, 74, 4]],
    [[0, 74, 4], [4, 76, 2], [6, 77, 2], [8, 79, 6], [14, 71, 2]],
  ];
  const K = kick({ dur: 0.12, f0: 160, f1: 45, pitchDecay: 45, ampDecay: 22, click: 0, drive: 1.6 });
  const SN = noiseHit({ dur: 0.13, decay: 22, lp: 0.7 });
  const HH = noiseHit({ dur: 0.03, decay: 120, hp: 0.5 });

  for (let st = 0; st < s.steps; st++) {
    const bar = Math.floor(st / 16), pos = st % 16, at = s.at(st);
    const ch = CH[Math.floor(bar / 2) % 4];
    const second = bar >= 8;
    if (pos === 0 || pos === 8 || (pos === 10 && bar % 2 === 1)) add(s.drums, K, at, 0.9);
    if (pos === 4 || pos === 12) add(s.music, SN, at, 0.45);
    if (pos % 2 === 0) add(s.music, HH, at, 0.12);
    if (pos % 2 === 0) {
      const m = ch.root + (pos % 4 === 2 ? 12 : 0);
      add(s.music, synth({ midi: m, dur: 0.2, wave: "tri", decay: 6 }), at, 0.55);
    }
    const tones = [...ch.tones, ch.tones[0] + 12];
    add(s.music, synth({ midi: tones[st % 4] + 12, dur: 0.09, wave: "square", pw: 0.25, decay: 20, lp: 0.6 }), at, second ? 0.1 : 0.07);
  }
  for (let bar = 0; bar < 16; bar++) {
    for (const [st, m, l] of MEL[bar % 8]) {
      const dur = l * s.step * 0.92;
      const n = synth({ midi: m, dur, wave: "square", pw: 0.5, lp: 0.5, decay: 1.2, vib: 0.005, vibDelay: 0.15 });
      add(s.music, n, s.at(bar * 16 + st), 0.26);
      if (bar >= 8) add(s.music, synth({ midi: m + 12, dur, wave: "square", pw: 0.125, lp: 0.4, decay: 2 }), s.at(bar * 16 + st), 0.06);
    }
  }
  return master(s, { rms: 0.55 });
}

/** Lo-Fi: 84 BPM, Dm7 – G7 – Cmaj7 – Am7, E-Piano, Swing, Vinyl-Knistern. */
function buildLofi() {
  const s = song(84, 8);
  const CH = [
    { root: 38, notes: [62, 65, 69, 72] }, // Dm7
    { root: 43, notes: [59, 62, 65, 69] }, // G7
    { root: 36, notes: [60, 64, 67, 71] }, // Cmaj7
    { root: 45, notes: [60, 64, 67, 69] }, // Am7
  ];
  const swing = (st) => s.at(st) + (st % 2 === 1 ? Math.round(0.28 * s.step * RATE) : 0);
  const K = kick({ dur: 0.35, f0: 90, f1: 45, pitchDecay: 30, ampDecay: 9, click: 0.15, drive: 1.3 });
  const SN = noiseHit({ dur: 0.28, decay: 13, lp: 0.45, body: 0.5, bodyF: 185 });
  const HH = noiseHit({ dur: 0.04, decay: 90, hp: 0.4, lp: 0.8 });

  for (let st = 0; st < s.steps; st++) {
    const bar = Math.floor(st / 16), pos = st % 16, at = swing(st);
    const ch = CH[Math.floor(bar / 2) % 4];
    const firstBar = bar % 2 === 0;
    if (pos === 0 || pos === 10 || (!firstBar && pos === 7)) add(s.drums, K, at, 0.7);
    if (pos === 4 || pos === 12) add(s.music, SN, at, 0.4);
    if (pos % 2 === 0) add(s.music, HH, at, 0.13);
    else if (pos % 4 === 3) add(s.music, HH, at, 0.06);

    // E-Piano-Akkorde
    const hits = firstBar ? [0, 7] : [0, 10];
    if (hits.includes(pos)) {
      const v = pos === 0 ? 0.2 : 0.13;
      ch.notes.forEach((m, k) => add(s.music, epiano(m, 2), at + k * 40, v));
    }
    // Bass
    if (pos === 0) add(s.music, synth({ midi: ch.root, dur: 1.0, wave: "sine", decay: 1.8, release: 0.1 }), at, 0.7);
    if (pos === 10) add(s.music, synth({ midi: ch.root + 7, dur: 0.6, wave: "sine", decay: 2.5, release: 0.1 }), at, 0.55);
    // leise Glocken-Melodie im zweiten Takt jedes Akkords
    if (!firstBar && [0, 3, 6, 10].includes(pos)) {
      const m = ch.notes[[3, 2, 1, 2][[0, 3, 6, 10].indexOf(pos)]] + 12;
      addEcho(s.music, synth({ midi: m, dur: 0.6, wave: "sine", decay: 5, release: 0.05 }), at, 0.12, s.at(3), 0.4, 3);
    }
  }
  // ganz leises, weiches Bandrauschen (kein Knistern, das klang nach Kratzen)
  let hiss = 0;
  for (let i = 0; i < s.len; i++) {
    hiss += (rnd() - hiss) * 0.02;
    s.music[i] += hiss * 0.004;
  }
  // bewusst leiser als die anderen Stücke: höhere Lautheit bringt den Limiter zum Zerren
  return master(s, { lp: 0.45, rms: 0.38 });
}

/** Synthwave: 104 BPM, Em – C – G – D, Flächen, Echo-Arpeggio, Gated Snare. */
function buildSynthwave() {
  const s = song(104, 16);
  const CH = [
    { root: 40, pad: [64, 67, 71] }, // Em
    { root: 36, pad: [64, 67, 72] }, // C
    { root: 43, pad: [62, 67, 71] }, // G
    { root: 38, pad: [62, 66, 69] }, // D
  ];
  const LEAD = [ // Melodie für die zweite Hälfte, je Akkord (2 Takte)
    [[0, 71, 8], [8, 74, 8], [16, 76, 16]],
    [[0, 76, 8], [8, 74, 8], [16, 72, 16]],
    [[0, 74, 8], [8, 71, 8], [16, 67, 16]],
    [[0, 69, 8], [8, 71, 8], [16, 74, 16]],
  ];
  const K = kick({ dur: 0.4, f0: 120, f1: 48, pitchDecay: 25, ampDecay: 7, click: 0.3, drive: 1.8 });
  const SN = noiseHit({ dur: 0.34, decay: 4, lp: 0.6, body: 0.6, bodyF: 200, gate: 0.3 });
  const HH = hat(0.05, 60);
  const echo = s.at(3);
  const kicks = [];

  for (let st = 0; st < s.steps; st++) {
    const bar = Math.floor(st / 16), pos = st % 16, at = s.at(st);
    const ci = Math.floor(bar / 2) % 4, ch = CH[ci];
    const second = bar >= 8;
    if (pos === 0 || pos === 8) { add(s.drums, K, at, 0.95); kicks.push(at); }
    if (pos === 4 || pos === 12) add(s.music, SN, at, 0.5);
    if (pos % 2 === 0) add(s.music, HH, at, pos % 4 === 2 ? 0.14 : 0.08);
    // Bass in Achteln
    if (pos % 2 === 0) {
      const m = ch.root + (pos % 4 === 2 ? 12 : 0);
      add(s.music, synth({ midi: m, dur: 0.26, wave: "saw", lp: 0.05, lpAmt: 0.3, lpRate: 20, release: 0.04 }), at, 0.45);
    }
    // Arpeggio mit Echo
    const tones = [ch.pad[0], ch.pad[1], ch.pad[2], ch.pad[1]];
    const arp = synth({ midi: tones[st % 4] + 12, dur: 0.12, wave: "square", lp: 0.3, decay: 14 });
    addEcho(s.music, arp, at, second ? 0.11 : 0.08, echo, 0.35, 3);
    // Flächen: pro Akkord eine lange Note je Ton
    if (pos === 0 && bar % 2 === 0) {
      const dur = 32 * s.step + 0.6;
      for (const m of [...ch.pad, ch.root + 12]) {
        add(s.music, synth({ midi: m, dur, wave: "saw", detune: 0.0025, lp: 0.05, attack: 0.4, release: 0.6 }), at, 0.14);
      }
      if (second) {
        for (const [o, m, l] of LEAD[ci]) {
          const n = synth({ midi: m, dur: l * s.step, wave: "saw", lp: 0.3, attack: 0.02, release: 0.15, vib: 0.006, vibDelay: 0.2 });
          addEcho(s.music, n, s.at(bar * 16 + o), 0.22, echo * 2, 0.3, 2);
        }
      }
    }
  }
  return master(s, { duck: duckEnv(s.len, kicks, 0.35, 8), rms: 0.55 });
}

/** Disco: 120 BPM, Dm7 – Gm7 – B♭maj7 – A7, Oktav-Bass und Akkord-Stabs. */
function buildDisco() {
  const s = song(120, 16);
  const CH = [
    { root: 38, notes: [62, 65, 69, 72] }, // Dm7
    { root: 43, notes: [62, 65, 67, 70] }, // Gm7
    { root: 46, notes: [58, 62, 65, 69] }, // B♭maj7
    { root: 45, notes: [57, 61, 64, 67] }, // A7
  ];
  const HOOK = [[0, 74, 2], [3, 77, 1], [4, 79, 2], [7, 77, 1], [8, 74, 2], [11, 72, 1], [12, 74, 4]];
  const K = kick({ dur: 0.3, f0: 130, f1: 50, pitchDecay: 30, ampDecay: 10, click: 0.3, drive: 2 });
  const C = clap();
  const HO = hat(0.16, 18), HC = hat(0.04, 80);
  const kicks = [];

  for (let st = 0; st < s.steps; st++) {
    const bar = Math.floor(st / 16), pos = st % 16, at = s.at(st);
    const ci = Math.floor(bar / 2) % 4, ch = CH[ci];
    const second = bar >= 8;
    if (pos % 4 === 0) { add(s.drums, K, at, 0.95); kicks.push(at); }
    if (pos === 4 || pos === 12) add(s.music, C, at, 0.6);
    if (pos % 4 === 2) add(s.music, HO, at, 0.26);
    else add(s.music, HC, at, 0.08);
    // Oktav-Bass
    if (pos % 2 === 0 || pos % 4 === 3) {
      const m = ch.root + (pos % 4 === 0 ? 0 : 12);
      const v = pos % 4 === 3 ? 0.3 : 0.5;
      add(s.music, synth({ midi: m, dur: 0.12, wave: "saw", lp: 0.08, lpAmt: 0.4, lpRate: 25, release: 0.02 }), at, v);
    }
    // Akkord-Stabs
    if ([3, 6, 10, 14].includes(pos)) {
      for (const m of ch.notes) add(s.music, synth({ midi: m, dur: 0.14, wave: "saw", lp: 0.35, decay: 12 }), at, 0.075);
    }
    // Streicher-Fläche in der zweiten Hälfte
    if (second && pos === 0 && bar % 2 === 0) {
      for (const m of ch.notes) {
        add(s.music, synth({ midi: m + 12, dur: 32 * s.step + 0.5, wave: "saw", detune: 0.003, lp: 0.07, attack: 0.5, release: 0.5 }), at, 0.06);
      }
    }
    // Hook in der zweiten Hälfte, über A7 an die Harmonie angepasst
    if (second && pos === 0) {
      for (const [o, m0, l] of HOOK) {
        const m = ci === 3 ? ({ 72: 73, 77: 76 }[m0] || m0) : m0;
        add(s.music, synth({ midi: m, dur: l * s.step * 0.9, wave: "square", pw: 0.3, lp: 0.4, decay: 6 }), s.at(bar * 16 + o), 0.16);
      }
    }
  }
  return master(s, { duck: duckEnv(s.len, kicks, 0.4, 10), rms: 0.6 });
}

/**
 * Korobeiniki: russisches Volkslied (1861, gemeinfrei), eigenes Chiptune-
 * Arrangement. Aufbau A – A' – B, 150 BPM, A-Moll.
 */
function buildKorobeiniki() {
  const s = song(150, 24);
  // [Schritt, MIDI, Länge in Sechzehnteln]; ein Takt = 16 Schritte
  const A = [
    [[0, 76, 4], [4, 71, 2], [6, 72, 2], [8, 74, 4], [12, 72, 2], [14, 71, 2]],
    [[0, 69, 4], [4, 69, 2], [6, 72, 2], [8, 76, 4], [12, 74, 2], [14, 72, 2]],
    [[0, 71, 6], [6, 72, 2], [8, 74, 4], [12, 76, 4]],
    [[0, 72, 4], [4, 69, 4], [8, 69, 4]],
    [[2, 74, 4], [6, 77, 2], [8, 81, 4], [12, 79, 2], [14, 77, 2]],
    [[0, 76, 6], [6, 72, 2], [8, 76, 4], [12, 74, 2], [14, 72, 2]],
    [[0, 71, 4], [4, 71, 2], [6, 72, 2], [8, 74, 4], [12, 76, 4]],
    [[0, 72, 4], [4, 69, 4], [8, 69, 4]],
  ];
  const B = [
    [[0, 76, 8], [8, 72, 8]],
    [[0, 74, 8], [8, 71, 8]],
    [[0, 72, 8], [8, 69, 8]],
    [[0, 68, 8], [8, 71, 4]],
    [[0, 76, 8], [8, 72, 8]],
    [[0, 74, 8], [8, 71, 8]],
    [[0, 72, 4], [4, 76, 4], [8, 81, 8]],
    [[0, 80, 16]],
  ];
  const BASS_A = [40, 45, 40, 45, 38, 36, 40, 45]; // E A E A D C E A
  const BASS_B = [45, 40, 45, 40, 45, 40, 45, 40]; // Am E Am E …
  const CHORD = { 45: [57, 60, 64], 40: [56, 59, 64] }; // Am, E (für Teil B)

  const K = kick({ dur: 0.12, f0: 160, f1: 45, pitchDecay: 45, ampDecay: 22, click: 0, drive: 1.6 });
  const SN = noiseHit({ dur: 0.13, decay: 22, lp: 0.7 });
  const HH = noiseHit({ dur: 0.03, decay: 120, hp: 0.5 });

  for (let bar = 0; bar < 24; bar++) {
    const part = bar < 16 ? "A" : "B";
    const i = bar % 8;
    const mel = part === "A" ? A[i] : B[i];
    const root = part === "A" ? BASS_A[i] : BASS_B[i];
    const base = bar * 16;

    for (let pos = 0; pos < 16; pos++) {
      const at = s.at(base + pos);
      // Drums (in Teil B etwas zurückgenommen)
      if (pos === 0 || pos === 8) add(s.drums, K, at, part === "A" ? 0.9 : 0.7);
      if ((pos === 4 || pos === 12) && (part === "A" || pos === 12)) add(s.music, SN, at, 0.4);
      if (pos % 2 === 0) add(s.music, HH, at, pos % 4 === 2 ? 0.13 : 0.08);
      // Oktav-Bass in Achteln
      if (pos % 2 === 0) {
        const m = root + (pos % 4 === 2 ? 12 : 0);
        add(s.music, synth({ midi: m, dur: 0.19, wave: "tri", decay: 5 }), at, 0.6);
      }
      // Teil B: leises Akkord-Arpeggio füllt die langen Melodietöne
      if (part === "B") {
        const ch = CHORD[root];
        const m = [...ch, ch[1]][pos % 4] + 12;
        add(s.music, synth({ midi: m, dur: 0.09, wave: "square", pw: 0.25, decay: 20, lp: 0.6 }), at, 0.07);
      }
    }
    // Melodie
    for (const [st, m, l] of mel) {
      const dur = l * s.step * 0.9;
      const at = s.at(base + st);
      add(s.music, synth({ midi: m, dur, wave: "square", pw: 0.5, lp: 0.5, decay: 1.2, vib: 0.005, vibDelay: 0.18 }), at, 0.26);
      // zweites A: Oktav-Stimme darunter
      if (bar >= 8 && bar < 16) add(s.music, synth({ midi: m - 12, dur, wave: "square", pw: 0.125, lp: 0.45, decay: 1.5 }), at, 0.1);
    }
  }
  return master(s, { rms: 0.55 });
}

// Noten des Menuetts aus BWV 814, übertragen aus der LilyPond-Quelle des Mutopia
// Project (gemeinfrei). Je Stimme [Start, MIDI, Länge], in Sechzehnteln.
const MENUET = {
  hi1: [[0,74,2],[2,78,2],[4,83,2],[6,78,2],[8,73,2],[10,78,2],[12,74,2],[14,78,2],[16,71,2],[18,78,2],[20,70,2],[22,78,2],[24,71,2],[26,78,2],[28,83,2],[30,78,2],[32,73,2],[34,78,2],[36,74,2],[38,78,2],[40,71,2],[42,78,2],[44,70,2],[46,78,2],[48,74,2],[50,78,2],[52,74,2],[54,71,2],[56,79,2],[58,76,2],[60,73,2],[62,76,2],[64,73,2],[66,69,2],[68,78,2],[70,74,2],[72,71,2],[74,78,2],[76,76,2],[78,74,2],[80,73,2],[82,71,2],[84,70,2],[86,66,2],[88,70,2],[90,73,2],[92,78,2],[94,76,2],[96,74,2],[98,78,2],[100,83,2],[102,78,2],[104,73,2],[106,78,2],[108,74,2],[110,78,2],[112,71,2],[114,78,2],[116,70,2],[118,78,2],[120,71,2],[122,78,2],[124,83,2],[126,78,2],[128,73,2],[130,78,2],[132,74,2],[134,78,2],[136,71,2],[138,78,2],[140,70,2],[142,78,2],[144,74,2],[146,78,2],[148,74,2],[150,71,2],[152,79,2],[154,76,2],[156,73,2],[158,76,2],[160,73,2],[162,69,2],[164,81,2],[166,76,2],[168,78,2],[170,81,2],[172,78,2],[174,74,2],[176,69,2],[178,73,2],[180,74,12]],
  lo1: [[0,59,4],[4,47,4],[8,58,4],[12,59,4],[16,62,4],[20,66,4],[24,62,4],[28,59,4],[32,58,4],[36,59,4],[40,50,4],[44,54,4],[48,47,4],[52,59,4],[56,52,4],[60,45,4],[64,57,4],[68,50,4],[72,43,4],[76,55,4],[80,52,4],[84,54,2],[86,55,2],[88,54,2],[90,52,2],[92,50,2],[94,49,2],[96,47,4],[100,59,4],[104,58,4],[108,59,4],[112,62,4],[116,66,4],[120,62,4],[124,59,4],[128,58,4],[132,59,4],[136,50,4],[140,54,4],[144,47,4],[148,59,4],[152,52,4],[156,45,4],[160,57,4],[164,49,4],[168,50,4],[172,54,4],[176,57,4],[180,50,4],[184,45,4],[188,38,4]],
  hi2: [[0,81,2],[2,79,2],[4,78,2],[6,76,2],[8,74,2],[10,73,2],[12,74,2],[14,76,2],[16,78,2],[18,74,2],[20,76,2],[22,79,2],[24,78,2],[26,79,2],[28,81,4],[32,73,4],[36,74,4],[40,78,4],[44,76,4],[48,78,4],[52,83,4],[56,80,4],[60,71,2],[62,73,2],[64,74,4],[68,73,4],[72,71,2],[74,69,2],[76,68,2],[78,66,2],[80,68,2],[82,65,2],[84,66,12],[96,69,6],[102,71,1],[103,72,1],[104,71,4],[108,69,2],[110,67,2],[112,69,2],[114,66,2],[116,67,2],[118,64,2],[120,71,6],[126,73,1],[127,74,1],[128,73,4],[132,71,2],[134,70,2],[136,71,2],[138,68,2],[140,70,2],[142,66,2],[144,76,2],[146,73,2],[148,66,2],[150,73,2],[152,76,2],[154,78,2],[156,79,2],[158,73,2],[160,78,2],[162,73,2],[164,76,2],[166,73,2],[168,74,2],[170,71,2],[172,66,2],[174,71,2],[176,74,2],[178,71,2],[180,78,2],[182,71,2],[184,76,2],[186,71,2],[188,74,2],[190,71,2],[192,73,2],[194,71,2],[196,74,2],[198,71,2],[200,76,2],[202,71,2],[204,78,2],[206,71,2],[208,79,2],[210,71,2],[212,76,2],[214,71,2],[216,78,4],[220,76,2],[222,74,2],[224,73,2],[226,74,2],[228,71,12]],
  lo2: [[0,54,2],[2,57,2],[4,62,2],[6,57,2],[8,61,2],[10,57,2],[12,54,2],[14,57,2],[16,50,2],[18,57,2],[20,49,2],[22,57,2],[24,50,2],[26,57,2],[28,62,2],[30,57,2],[32,61,2],[34,57,2],[36,54,2],[38,57,2],[40,50,2],[42,57,2],[44,49,2],[46,57,2],[48,50,2],[50,54,2],[52,50,2],[54,47,2],[56,59,2],[58,56,2],[60,53,2],[62,56,2],[64,53,2],[66,49,2],[68,56,2],[70,53,2],[72,54,4],[76,61,4],[80,49,4],[84,54,2],[86,57,2],[88,61,2],[90,57,2],[92,52,2],[94,57,2],[96,51,2],[98,54,2],[100,47,2],[102,54,2],[104,51,2],[106,54,2],[108,52,4],[112,47,4],[116,40,4],[120,53,2],[122,56,2],[124,49,2],[126,56,2],[128,53,2],[130,56,2],[132,54,4],[136,49,4],[140,42,4],[144,46,4],[148,49,4],[152,54,4],[156,58,4],[160,54,4],[164,58,4],[168,47,4],[172,50,4],[176,54,4],[180,59,4],[184,61,4],[188,62,4],[192,64,4],[196,66,4],[200,67,4],[204,62,4],[208,64,4],[212,61,4],[216,62,4],[220,64,4],[224,66,4],[228,59,4],[232,54,4],[236,47,4]],
};

/**
 * Menuett: J. S. Bach, Französische Suite Nr. 3 h-Moll, BWV 814 (gemeinfrei),
 * eigenes Chiptune-Arrangement. 3/4-Takt, beide Teile wiederholt.
 */
function buildMenuet() {
  const BAR = 12; // Sechzehntel pro 3/4-Takt
  const parts = [
    { hi: MENUET.hi1, lo: MENUET.lo1, bars: 16 },
    { hi: MENUET.hi1, lo: MENUET.lo1, bars: 16, rep: true },
    { hi: MENUET.hi2, lo: MENUET.lo2, bars: 20 },
    { hi: MENUET.hi2, lo: MENUET.lo2, bars: 20, rep: true },
  ];
  const totalBars = parts.reduce((n, p) => n + p.bars, 0);
  const s = song(160, (totalBars * BAR) / 16);
  const HH = noiseHit({ dur: 0.03, decay: 120, hp: 0.5 });
  const K = kick({ dur: 0.1, f0: 150, f1: 45, pitchDecay: 45, ampDecay: 25, click: 0, drive: 1.4 });

  let off = 0;
  for (const p of parts) {
    for (const [st, m, l] of p.hi) {
      const dur = l * s.step * 0.85;
      add(s.music, synth({ midi: m, dur, wave: "square", pw: 0.25, lp: 0.55, decay: 3 }), s.at(off + st), 0.26);
      // Wiederholung: leise Oktave darüber
      if (p.rep) add(s.music, synth({ midi: m + 12, dur, wave: "square", pw: 0.125, lp: 0.4, decay: 4 }), s.at(off + st), 0.06);
    }
    for (const [st, m, l] of p.lo) {
      add(s.music, synth({ midi: m, dur: l * s.step * 0.9, wave: "tri", decay: 2.5 }), s.at(off + st), 0.55);
    }
    // leichter Puls: Kick auf der Eins, Hi-Hat auf den Zählzeiten (in der Wiederholung)
    for (let b = 0; b < p.bars; b++) {
      const at = off + b * BAR;
      if (p.rep) add(s.drums, K, s.at(at), 0.6);
      for (let q = 0; q < 3; q++) add(s.music, HH, s.at(at + q * 4), q === 0 ? 0.1 : 0.06);
    }
    off += p.bars * BAR;
  }
  return master(s, { rms: 0.5 });
}

/**
 * Blocksprung: eigene Komposition im Stil flotter Game-Boy-Musik.
 * 168 BPM, e-Moll, Aufbau A – B – A' – B'.
 */
function buildBlocksprung() {
  const s = song(168, 32);
  // Melodie in Achteln je Takt; 0 = Pause, -1 = Ton halten
  const A = [
    [76, 79, 78, 76, 75, 76, 71, -1],
    [71, 75, 78, 81, 79, 78, 76, 75],
    [76, 79, 83, 81, 79, 78, 79, 76],
    [72, 76, 81, 79, 78, 74, 78, 81],
    [79, 74, 71, 74, 79, 83, 81, 79],
    [76, 72, 79, 76, 84, 83, 81, 79],
    [81, 79, 78, 76, 75, 78, 71, 75],
    [76, -1, 71, -1, 76, 0, 0, 0],
  ];
  const B = [
    [76, -1, 72, 76, 79, -1, 84, -1],
    [83, -1, 79, 74, 79, -1, 71, -1],
    [72, -1, 76, 81, 84, 83, 81, 79],
    [79, -1, 76, 71, 76, -1, 79, -1],
    [76, -1, 72, 76, 79, 81, 79, 76],
    [78, -1, 74, 78, 81, -1, 78, 74],
    [75, 78, 81, 78, 75, 71, 75, 78],
    [81, -1, 78, -1, 75, -1, 71, -1],
  ];
  // Akkorde je Takt: [Grundton Bass, Quinte, Akkordtöne für Begleitung]
  const EM = [40, 47, [64, 67, 71]], B7 = [35, 42, [63, 66, 69]], AM = [45, 52, [64, 69, 72]];
  const D = [38, 45, [66, 69, 74]], G = [43, 50, [67, 71, 74]], C = [36, 43, [64, 67, 72]];
  const CH_A = [EM, B7, EM, [AM, D], G, C, [AM, B7], EM];
  const CH_B = [C, G, AM, EM, C, D, B7, B7];

  const K = kick({ dur: 0.12, f0: 160, f1: 45, pitchDecay: 45, ampDecay: 22, click: 0, drive: 1.6 });
  const SN = noiseHit({ dur: 0.12, decay: 24, lp: 0.7 });
  const HH = noiseHit({ dur: 0.03, decay: 120, hp: 0.5 });

  for (let bar = 0; bar < 32; bar++) {
    const sec = Math.floor(bar / 8); // 0 A, 1 B, 2 A', 3 B'
    const isA = sec % 2 === 0;
    const again = sec >= 2;
    const mel = (isA ? A : B)[bar % 8];
    const chs = (isA ? CH_A : CH_B)[bar % 8];
    const base = bar * 16;

    // Melodie (Staccato, gehaltene Töne verlängern)
    for (let e = 0; e < 8; e++) {
      const m = mel[e];
      if (m <= 0) continue;
      let len = 1;
      while (e + len < 8 && mel[e + len] === -1) len++;
      const dur = len * 2 * s.step * (len > 1 ? 0.9 : 0.6);
      const at = s.at(base + e * 2);
      add(s.music, synth({ midi: m, dur, wave: "square", pw: 0.5, lp: 0.5, decay: 2.5, vib: len > 1 ? 0.005 : 0 }), at, 0.25);
      if (again) add(s.music, synth({ midi: m - 12, dur, wave: "square", pw: 0.25, lp: 0.45, decay: 3 }), at, 0.09);
    }

    for (let pos = 0; pos < 16; pos++) {
      const at = s.at(base + pos);
      const ch = Array.isArray(chs[0]) ? chs[pos < 8 ? 0 : 1] : chs;
      // Drums
      if (pos === 0 || pos === 8) add(s.drums, K, at, 0.85);
      if (pos === 4 || pos === 12) add(s.music, SN, at, 0.35);
      if (pos % 2 === 0) add(s.music, HH, at, pos % 4 === 2 ? 0.12 : 0.07);
      // Bass im Wechselschritt: Grundton – Quinte
      if (pos % 4 === 0) {
        const m = pos % 8 === 0 ? ch[0] : ch[1];
        add(s.music, synth({ midi: m, dur: 0.3, wave: "tri", decay: 6 }), at, 0.6);
      }
      // Begleitung: kurze Akkord-Tupfer auf den Offbeats
      if (pos % 4 === 2) {
        for (const m of ch[2]) add(s.music, synth({ midi: m, dur: 0.08, wave: "square", pw: 0.125, lp: 0.5, decay: 25 }), at, 0.045);
      }
    }
  }
  return master(s, { rms: 0.55 });
}

export const TRACKS = [
  { name: "Techno", build: buildTechno },
  { name: "Chiptune", build: buildChiptune },
  { name: "Lo-Fi", build: buildLofi },
  { name: "Synthwave", build: buildSynthwave },
  { name: "Disco", build: buildDisco },
  { name: "Korobeiniki", build: buildKorobeiniki },
  { name: "Blocksprung", build: buildBlocksprung },
  { name: "Menuett", build: buildMenuet },
];
