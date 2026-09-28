import { Board, COLS, ROWS, CELL, BX, BY, BW, BH, UI_FONT, EMOJI_FONT, roundRect, setSpriteScale } from "./board.js";
import { play, unlockAudio, setAudioSuspended, canVibrate } from "./sfx.js";
import { updateMusic, setMusicRate, setTrack, trackIndex, TRACKS } from "./music.js";
import { store, save, testMode } from "./storage.js";
import { THEMES, pickKinds } from "./themes.js";

export const VERSION = "1.2.0"; // bei jeder Änderung erhöhen

const W = 540, H = 960;
const TA_TIME = 90;
const BONUS_POPUP = 1.0; // Anzeigedauer „+N s“
const ACCENT = "#ffc94a";
const DANGER = "#ff6b6b";
// 0 Time Attack, 1 Endlos, 2 Abräumen, 3 Normal
const MODES = ["time_attack", "endless", "clear", "normal"];
const CLEAR_KINDS = 4; // Abräumen: weniger Sorten, sonst ist das Brett kaum leer zu bekommen
const STAR_LIMITS = [12, 5, 0]; // Reste für ★ / ★★ / ★★★
const NORMAL_GOAL = 50; // Normal: so viele Matches, Score ist die Zeit
const HINT_DELAY = 5; // Sekunden ohne Eingabe bis zum Hinweis
const HUD_FONT = (size) => `700 ${size}px ${UI_FONT.replace("sans-serif", "")}${EMOJI_FONT}`;

const $ = (id) => document.getElementById(id);
const stage = $("stage");
const cv = $("cv");
const ctx = cv.getContext("2d");
let scale = 1;

// ---------- Skalierung ----------
function layout() {
  const vw = window.innerWidth, vh = window.innerHeight;
  scale = Math.min(vw / W, vh / H);
  const ox = (vw - W * scale) / 2, oy = (vh - H * scale) / 2;
  stage.style.transform = `translate(${ox}px, ${oy}px) scale(${scale})`;
  const dpr = window.devicePixelRatio || 1;
  cv.width = Math.round(W * scale * dpr);
  cv.height = Math.round(H * scale * dpr);
  setSpriteScale(scale * dpr);
}
window.addEventListener("resize", layout);
layout();

// ---------- Zustand ----------
let screen = "menu";
let roundId = 0;
let board = null;
let game = null;

const params = new URLSearchParams(location.search);
if (params.has("theme")) {
  const t = parseInt(params.get("theme"), 10);
  if (t >= 0 && t < THEMES.length) store.theme = t;
}
if (!(store.theme >= 0 && store.theme < THEMES.length)) store.theme = 0;

function showScreen(name) {
  screen = name;
  $("menu").classList.toggle("show", name === "menu");
  $("settings").classList.toggle("show", name === "settings");
  $("over").classList.toggle("show", name === "over");
  $("pause").classList.toggle("show", name === "pause");
  $("btnQuit").classList.toggle("show", name === "game");
  $("btnPause").classList.toggle("show", name === "game");
  if (name === "menu" || name === "settings") refreshMenu();
}

// ---------- Menü ----------
function refreshMenu() {
  $("themeName").textContent = THEMES[store.theme].name;
  $("menuTheme").textContent = `Thema: ${THEMES[store.theme].name}`;
  $("trackName").textContent = TRACKS[trackIndex()].name;
  $("themePreview").textContent = pickKinds(store.theme).join(" ");
  $("bestTA").textContent = `90 Sekunden · Rekord ${store.best.time_attack}`;
  $("bestEndless").textContent = `Ohne Zeitlimit · Rekord ${store.best.endless}`;
  $("bestClear").textContent = `Brett leer räumen · Rekord ${fmtLeft(store.best.clear)}`;
  $("bestNormal").textContent = `${NORMAL_GOAL} Matches · Rekord ${fmtBest(store.best.normal)}`;
  refreshAudioButtons();
  refreshToggles();
}

function refreshToggles() {
  $("tglHints").setAttribute("aria-pressed", String(!!store.hints));
  $("tglVibrate").setAttribute("aria-pressed", String(!!store.vibrate));
  // Vibration nur auf Touch-Geräten anbieten, die sie auch können
  $("tglVibrate").hidden = !(canVibrate && matchMedia("(pointer: coarse)").matches);
}

function refreshAudioButtons() {
  $("btnMusic").classList.toggle("off", !store.music);
  $("btnSound").textContent = store.sound ? "🔊" : "🔇";
  sliders.music.set(store.musicVolume, false);
  sliders.sfx.set(store.sfxVolume, false);
}

function changeTheme(d) {
  store.theme = (store.theme + d + THEMES.length) % THEMES.length;
  save();
  refreshMenu();
}

function changeTrack(d) {
  store.track = (trackIndex() + d + TRACKS.length) % TRACKS.length;
  save();
  setTrack(store.track);
  // Beim Durchhören soll die Musik auch zu hören sein
  if (!store.music || store.musicVolume <= 0) {
    store.music = true;
    if (store.musicVolume <= 0) store.musicVolume = 0.5;
    save();
    updateMusic();
    refreshAudioButtons();
  }
  refreshMenu();
}

function toggleMusic() {
  store.music = !store.music;
  save();
  updateMusic();
  refreshAudioButtons();
}

function toggleSound() {
  store.sound = !store.sound;
  save();
  refreshAudioButtons();
}

function makeSlider(el, key, onChange) {
  const fill = el.querySelector(".fill");
  const knob = el.querySelector(".knob");
  const pct = el.parentElement.querySelector(".pct");
  let value = -1;
  const api = {
    set(v, notify) {
      v = Math.round(Math.max(0, Math.min(1, v)) / 0.05) * 0.05;
      v = Math.round(v * 100) / 100;
      const changed = v !== value;
      value = v;
      fill.style.width = `${v * 100}%`;
      knob.style.left = `${v * 100}%`;
      pct.textContent = `${Math.round(v * 100)} %`;
      if (notify && changed) {
        store[key] = v;
        onChange(v);
        save();
      }
    },
  };
  const fromEvent = (e) => {
    const r = el.getBoundingClientRect();
    api.set((e.clientX - r.left) / r.width, true);
  };
  el.addEventListener("pointerdown", (e) => {
    el.setPointerCapture(e.pointerId);
    fromEvent(e);
    el.onpointermove = fromEvent;
  });
  const end = () => { el.onpointermove = null; };
  el.addEventListener("pointerup", end);
  el.addEventListener("pointercancel", end);
  return api;
}

const sliders = {
  music: makeSlider($("volMusic"), "musicVolume", (v) => {
    if (v > 0 && !store.music) { store.music = true; refreshAudioButtons(); }
    updateMusic();
  }),
  sfx: makeSlider($("volSfx"), "sfxVolume", (v) => {
    if (v > 0 && !store.sound) { store.sound = true; refreshAudioButtons(); }
    play("select");
  }),
};

// Klick-Sound für alle Buttons
for (const b of document.querySelectorAll("button")) b.addEventListener("click", () => play("click"));

$("themePrev").addEventListener("click", () => changeTheme(-1));
$("themeNext").addEventListener("click", () => changeTheme(1));
$("trackPrev").addEventListener("click", () => changeTrack(-1));
$("trackNext").addEventListener("click", () => changeTrack(1));
$("btnMusic").addEventListener("click", toggleMusic);
$("btnSound").addEventListener("click", toggleSound);
$("btnTA").addEventListener("click", () => startGame(0));
$("btnEndless").addEventListener("click", () => startGame(1));
$("btnClear").addEventListener("click", () => startGame(2));
$("btnNormal").addEventListener("click", () => startGame(3));
$("btnQuit").addEventListener("click", toMenu);
$("btnSettings").addEventListener("click", () => showScreen("settings"));
$("btnBack").addEventListener("click", () => showScreen("menu"));
$("btnAgain").addEventListener("click", () => startGame(game ? game.mode : 0));
$("btnMenu").addEventListener("click", toMenu);
$("btnPause").addEventListener("click", pauseGame);
$("btnResume").addEventListener("click", resumeGame);
$("btnPauseMenu").addEventListener("click", toMenu);
$("tglHints").addEventListener("click", () => {
  store.hints = !store.hints;
  save();
  refreshToggles();
});
$("tglVibrate").addEventListener("click", () => {
  store.vibrate = !store.vibrate;
  save();
  refreshToggles();
  if (store.vibrate) play("special"); // zum Ausprobieren
});

window.addEventListener("keydown", (e) => {
  if (e.repeat) return;
  const k = e.key.toLowerCase();
  if (k === "escape" && screen === "settings") showScreen("menu");
  else if ((k === "escape" || k === "p") && screen === "game") pauseGame();
  else if ((k === "escape" || k === "p") && screen === "pause") resumeGame();
  else if (k === "m") toggleMusic();
  else if (k === "s") toggleSound();
});

// Audio erst nach Nutzeraktion
// (bei Touch zählt erst pointerup/touchend als Nutzeraktion)
for (const ev of ["pointerdown", "pointerup", "touchend", "click", "keydown"]) {
  window.addEventListener(ev, unlockAudio, true);
}

function fmtBest(sec) {
  return sec == null ? "–" : fmtTime(sec, true).slice(2);
}

function fmtLeft(n) {
  return n == null ? "–" : `${n} übrig`;
}

function starsFor(left) {
  return STAR_LIMITS.filter((lim) => left <= lim).length;
}

// ---------- Pause ----------
function pauseGame() {
  if (screen !== "game" || !board) return;
  drag = null;
  setMusicRate(1);
  showScreen("pause");
}

function resumeGame() {
  if (screen !== "pause") return;
  last = performance.now();
  showScreen("game");
}

// Tab im Hintergrund: Spiel pausieren und Ton anhalten
document.addEventListener("visibilitychange", () => {
  const hidden = document.visibilityState === "hidden";
  if (hidden) pauseGame();
  setAudioSuspended(hidden);
});

// ---------- Runde ----------
function toMenu() {
  roundId++;
  board = null;
  setMusicRate(1);
  showScreen("menu");
}

async function startGame(mode) {
  const id = ++roundId;
  const key = MODES[mode];
  game = {
    mode, key, score: 0, best0: mode >= 2 ? store.best[key] : store.best[key] || 0,
    elapsed: 0, matches: 0, goal: NORMAL_GOAL,
    remaining: TA_TIME, running: false, ended: false,
    message: "", recordSounded: false, bonus: null, idle: 0,
  };
  const g = game;
  const alive = () => id === roundId;
  const kinds = pickKinds(store.theme);
  if (mode === 2) kinds.length = CLEAR_KINDS;
  board = new Board(kinds, {
    alive,
    isOver: () => g.ended,
    message: (m) => { if (!g.ended || m === "Zeit um!") g.message = m; },
    onBonus: (sec) => {
      // Time Attack: +1 s pro Reihe, +5 s pro ausgelöstem Power-up
      if (g.mode !== 0 || !g.running || g.ended) return;
      g.remaining += sec;
      if (g.bonus && g.bonus.t < 0.3) g.bonus.sec += sec;
      else g.bonus = { sec, t: 0 };
    },
    onMatches: (n) => {
      if (g.mode !== 3 || !g.running || g.ended) return;
      g.matches = Math.min(g.goal, g.matches + n);
      if (g.matches >= g.goal) normalDone();
    },
    onScore: (points) => {
      g.score += points;
      if (g.mode === 1 && g.best0 > 0 && g.score > g.best0 && !g.recordSounded) {
        g.recordSounded = true;
        play("record", 1, -3);
      }
    },
  }, { refill: mode !== 2 });
  const b = board;
  setMusicRate(1);
  showScreen("game");
  b.dropNewBoard();
  play("shuffle");
  await b.waitCalm();
  if (!alive()) return;

  if (testMode && params.get("specials") === "1") b.debugSpecials();
  if (testMode && params.get("timeup") === "1") g.remaining = 0.01;
  if (testMode && params.has("goal")) g.goal = Math.max(1, parseInt(params.get("goal"), 10) || NORMAL_GOAL);
  g.running = true;
  b.locked = false;

  const moves = testMode ? parseInt(params.get("moves") || "0", 10) : 0;
  if (moves > 0) runAI(id, moves);
}

async function doSwap(a, b) {
  const id = roundId;
  const g = game, bd = board;
  const ok = await bd.trySwap(a, b);
  if (id !== roundId) return ok;
  if (g.mode === 1 && g.score > (store.best.endless || 0)) {
    store.best.endless = g.score;
    save();
  }
  if (g.mode === 2 && !g.ended && (bd.count() === 0 || !bd.hasValidMove())) clearOver();
  return ok;
}

async function runAI(id, n) {
  const b = board;
  for (let i = 0; i < n; i++) {
    if (id !== roundId || game.ended) return;
    const mv = b.findMove();
    if (!mv) return;
    await doSwap(mv[0], mv[1]);
    if (id !== roundId) return;
    await b.waitCalm();
    await b.wait(0.05);
  }
  window.__aiDone = true;
}

async function timeUp() {
  const id = roundId;
  const g = game, b = board;
  g.ended = true;
  g.running = false;
  g.remaining = 0;
  b.locked = true;
  b.selected = null;
  drag = null;
  g.message = "Zeit um!";
  setMusicRate(1);
  while (b.busy) {
    await b.wait(0.05);
    if (id !== roundId) return;
  }
  g.message = "Zeit um!";
  const newRecord = g.score > g.best0 && g.score > 0;
  if (newRecord) {
    store.best.time_attack = g.score;
    save();
  }
  play("time_up");
  await b.wait(0.6);
  if (id !== roundId) return;
  showOver("⏰", "Zeit um!", -1, `${g.score} Punkte`,
    newRecord ? "🏆 Neuer Rekord!" : `Rekord: ${store.best.time_attack}`);
  if (newRecord) play("record");
}

/** Abräumen: Brett leer oder keine Züge mehr. */
async function clearOver() {
  const id = roundId;
  const g = game, b = board;
  g.ended = true;
  g.running = false;
  b.locked = true;
  b.selected = null;
  drag = null;
  const left = b.count();
  const stars = starsFor(left);
  g.message = left === 0 ? "Alles abgeräumt!" : "Keine Züge mehr!";
  const prev = store.best.clear;
  const improved = prev == null || left < prev;
  if (improved) {
    store.best.clear = left;
    save();
  }
  const newRecord = improved && stars > 0;
  play(stars > 0 ? "special" : "time_up");
  await b.wait(0.6);
  if (id !== roundId) return;
  const title = left === 0 ? "Geschafft!" : stars > 0 ? "Gut gemacht!" : "Verloren!";
  showOver(left === 0 ? "🎉" : stars > 0 ? "🙂" : "😵", title, stars,
    left === 0 ? `${g.score} Punkte` : `${left} übrig · ${g.score} Punkte`,
    newRecord ? "🏆 Neuer Rekord!" : `Rekord: ${fmtLeft(store.best.clear)}`);
  if (newRecord) play("record");
}

/** Normal: Ziel erreicht. Die Uhr steht sofort, eine laufende Kette darf auslaufen. */
async function normalDone() {
  const id = roundId;
  const g = game, b = board;
  g.ended = true;
  g.running = false;
  b.locked = true;
  b.selected = null;
  drag = null;
  g.message = "Ziel erreicht!";
  while (b.busy) {
    await b.wait(0.05);
    if (id !== roundId) return;
  }
  g.message = "Ziel erreicht!";
  const time = Math.floor(g.elapsed * 10) / 10;
  const prev = store.best.normal;
  const newRecord = prev == null || time < prev;
  if (newRecord) {
    store.best.normal = time;
    save();
  }
  play("special");
  await b.wait(0.6);
  if (id !== roundId) return;
  showOver("🎯", "Geschafft!", -1, fmtTime(time, true),
    newRecord ? "🏆 Neuer Rekord!" : `Rekord: ${fmtBest(store.best.normal)}`);
  if (newRecord) play("record");
}

/** Endbildschirm füllen und zeigen. stars < 0: keine Sterne-Zeile. */
function showOver(emoji, title, stars, scoreText, bestText) {
  $("overEmoji").textContent = emoji;
  $("overTitle").textContent = title;
  const el = $("overStars");
  el.style.display = stars < 0 ? "none" : "";
  el.innerHTML = [0, 1, 2].map((i) => `<span class="${i < stars ? "" : "dim"}">⭐</span>`).join("");
  $("overScore").textContent = scoreText;
  $("overBest").textContent = bestText;
  showScreen("over");
}

// ---------- Eingabe auf dem Spielfeld ----------
let drag = null;

function toLogical(e) {
  const r = cv.getBoundingClientRect();
  return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
}

function cellAt(p) {
  const c = Math.floor((p.x - BX) / CELL), r = Math.floor((p.y - BY) / CELL);
  return c >= 0 && c < COLS && r >= 0 && r < ROWS ? { c, r } : null;
}

cv.addEventListener("pointerdown", (e) => {
  if (screen === "game" && board && game) {
    game.idle = 0;
    board.hint = null;
  }
  if (screen !== "game" || !board || board.locked) return;
  const p = toLogical(e);
  const cell = cellAt(p);
  if (!cell || !board.grid[cell.c][cell.r]) return;
  try { cv.setPointerCapture(e.pointerId); } catch (err) { /* egal */ }
  drag = { cell, x: p.x, y: p.y, done: false };
});

cv.addEventListener("pointermove", (e) => {
  if (!drag || drag.done || !board || board.locked) return;
  const p = toLogical(e);
  const dx = p.x - drag.x, dy = p.y - drag.y;
  if (Math.max(Math.abs(dx), Math.abs(dy)) <= CELL * 0.35) return;
  drag.done = true;
  const t = Math.abs(dx) > Math.abs(dy)
    ? { c: drag.cell.c + Math.sign(dx), r: drag.cell.r }
    : { c: drag.cell.c, r: drag.cell.r + Math.sign(dy) };
  if (t.c < 0 || t.c >= COLS || t.r < 0 || t.r >= ROWS) return;
  board.selected = null;
  doSwap(drag.cell, t);
});

function endDrag() {
  if (drag && !drag.done && board && !board.locked) clickCell(drag.cell);
  drag = null;
}
cv.addEventListener("pointerup", endDrag);
cv.addEventListener("pointercancel", () => { drag = null; });

function clickCell(cell) {
  const sel = board.selected;
  if (!sel) {
    board.selected = cell;
    play("select");
  } else if (sel.c === cell.c && sel.r === cell.r) {
    board.selected = null;
    play("select", 0.75);
  } else if (Math.abs(sel.c - cell.c) + Math.abs(sel.r - cell.r) === 1) {
    doSwap(sel, cell);
  } else {
    board.selected = cell;
    play("select");
  }
}

// ---------- Spiel-Update ----------
function updateGame(dt) {
  const g = game;
  if (!board) return;
  board.update(dt);
  if (g.bonus && (g.bonus.t += dt) >= BONUS_POPUP) g.bonus = null;
  updateHint(g, dt);
  if (!g.running) return;
  if (g.mode === 3) { g.elapsed += dt; return; } // Normal: Uhr zählt hoch
  if (g.mode !== 0) return; // Endlos, Abräumen: keine Uhr
  const prev = g.remaining;
  g.remaining = Math.max(0, g.remaining - dt);
  for (let k = 10; k >= 1; k--) if (prev > k && g.remaining <= k) play("tick");
  setMusicRate(g.remaining <= 10 ? 1.08 : 1);
  if (g.remaining <= 0) timeUp();
}

/** Nach HINT_DELAY Sekunden ruhigen Bretts ohne Eingabe einen Zug zeigen. */
function updateHint(g, dt) {
  const b = board;
  const quiet = store.hints && screen === "game" && g.running && !g.ended &&
    !b.locked && !b.busy && !b.selected && b.isCalm();
  if (!quiet) {
    g.idle = 0;
    return;
  }
  if (b.hint) return;
  g.idle += dt;
  if (g.idle >= HINT_DELAY) {
    const moves = b.findMoves();
    if (moves.length) b.showHint(moves[Math.floor(Math.random() * moves.length)]);
  }
}

// ---------- Zeichnen ----------
function fmtTime(sec, up = false) {
  const T = up ? Math.floor(sec * 10 + 1e-6) : Math.ceil(sec * 10 - 1e-6);
  const mm = Math.floor(T / 600), rest = T % 600;
  const ss = Math.floor(rest / 10), d = rest % 10;
  return `⏱ ${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}.${d}`;
}

function text(str, x, yTop, size, color, align = "center") {
  ctx.font = HUD_FONT(size);
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.fillText(str, x, yTop + size * 0.68);
}

let bgGrad = null;
function drawBackground() {
  if (!bgGrad) {
    bgGrad = ctx.createLinearGradient(0, 0, 0, H);
    bgGrad.addColorStop(0, "#3b2a6b");
    bgGrad.addColorStop(1, "#1a1333");
  }
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);
}

function drawGame() {
  const g = game;
  const ta = g.mode === 0;
  if (ta) text(fmtTime(g.remaining), W / 2, 26, 36, g.remaining <= 10 ? DANGER : ACCENT);
  if (g.mode === 2) text(`🧹 ${board.count()} übrig`, W / 2, 26, 36, ACCENT);
  if (g.mode === 3) {
    text(fmtTime(g.elapsed, true), W / 2, 26, 36, ACCENT);
    text(`🎯 ${g.matches} / ${g.goal} Matches`, W / 2, 84, 26, "#fff");
  } else if (g.mode === 1) {
    text(`${g.score} Punkte`, W / 2, 26, 36, ACCENT); // Endlos: keine Uhr, Punkte oben
  } else {
    text(`${g.score} Punkte`, W / 2, 84, 26, "#fff");
  }
  const rec = g.mode === 2 ? `🏆 Rekord ${fmtLeft(g.best0)}`
    : g.mode === 3 ? `🏆 Rekord ${fmtBest(g.best0)}`
    : g.best0 > 0 && g.score > g.best0 ? "🏆 Neuer Rekord!" : `🏆 Rekord ${g.best0}`;
  text(rec, 525, 40, 16, "rgba(255,255,255,0.6)", "right");

  if (ta && g.bonus) {
    const k = g.bonus.t / BONUS_POPUP;
    ctx.save();
    ctx.globalAlpha = k < 0.5 ? 1 : 1 - (k - 0.5) / 0.5;
    text(`+${g.bonus.sec} s`, 440, 80 - 16 * k, 24, "#7dffa0");
    ctx.restore();
  }

  if (ta || g.mode === 3) {
    roundRect(ctx, 40, 132, 460, 14, 7);
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.fill();
    const f = Math.max(0, Math.min(1, ta ? g.remaining / TA_TIME : g.matches / g.goal));
    if (f > 0) {
      ctx.save();
      roundRect(ctx, 40, 132, 460, 14, 7);
      ctx.clip();
      ctx.fillStyle = ACCENT;
      ctx.fillRect(40, 132, 460 * f, 14);
      ctx.restore();
    }
  }

  board.draw(ctx);
  if (g.message) text(g.message, W / 2, BY + BH + 30, 26, "rgba(255,255,255,0.85)");
}

function tick(dt) {
  if (board && (screen === "game" || screen === "over")) updateGame(dt);
}

function render() {
  const k = cv.width / W;
  ctx.setTransform(k, 0, 0, k, 0, 0);
  drawBackground();
  if (board && game && (screen === "game" || screen === "over" || screen === "pause")) drawGame();
}

let last = performance.now();
function frame(now) {
  tick(Math.min((now - last) / 1000, 0.05));
  last = now;
  render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// ---------- Als App (PWA) ----------
if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
  // Version im Namen: jede neue Version installiert einen neuen Service Worker
  navigator.serviceWorker.register(`sw.js?v=${VERSION}`).catch(() => { /* ohne Offline-Modus weiter */ });
}

let installPrompt = null;
const standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  installPrompt = e;
  $("btnInstall").hidden = false;
});
window.addEventListener("appinstalled", () => {
  installPrompt = null;
  $("btnInstall").hidden = true;
});
$("btnInstall").addEventListener("click", async () => {
  if (!installPrompt) return;
  installPrompt.prompt();
  try { await installPrompt.userChoice; } catch (e) { /* egal */ }
  installPrompt = null;
  $("btnInstall").hidden = true;
});
// iPhone/iPad kennen kein Installations-Ereignis: Hinweis auf das Teilen-Menü.
// iPads melden sich seit iPadOS 13 als „Macintosh“, erkennbar am Touchscreen.
const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) ||
  (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
$("installHint").hidden = standalone || !ios;

// ---------- Start ----------
$("version").textContent = `v${VERSION}`;
showScreen("menu");
if (testMode && params.has("mode")) startGame([0, 1, 2, 3][parseInt(params.get("mode"), 10)] ?? 0);

// Test-Zugriff
window.__game = {
  get board() { return board; },
  get game() { return game; },
  get screen() { return screen; },
  get store() { return store; },
  /** Test-Hilfe: Simulation um sec Sekunden weiterschalten (auch ohne rAF). */
  async advance(sec) {
    for (let t = 0; t < sec; t += 1 / 60) {
      tick(1 / 60);
      for (let i = 0; i < 8; i++) await null;
    }
    render();
  },
  check() {
    if (!board) return null;
    const gaps = [], offGrid = [];
    for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) {
      const t = board.grid[c][r];
      if (!t) gaps.push([c, r]);
      else if (t.x !== c * CELL || t.y !== r * CELL || t.vy !== 0) offGrid.push([c, r]);
    }
    return { gaps: gaps.length, offGrid: offGrid.length, runs: board.findRuns().length, validMove: board.hasValidMove(), calm: board.isCalm(), BW };
  },
};
