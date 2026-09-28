import { Board, COLS, ROWS, CELL, BX, BY, BW, BH, UI_FONT, EMOJI_FONT, roundRect, setSpriteScale } from "./board.js";
import { play, unlockAudio } from "./sfx.js";
import { updateMusic, setMusicRate } from "./music.js";
import { store, save, testMode } from "./storage.js";
import { THEMES, pickKinds } from "./themes.js";

const W = 540, H = 960;
const TA_TIME = 90;
const ACCENT = "#ffc94a";
const DANGER = "#ff6b6b";
const MODES = ["time_attack", "endless"];
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
  $("over").classList.toggle("show", name === "over");
  $("btnQuit").classList.toggle("show", name === "game");
  if (name === "menu") refreshMenu();
}

// ---------- Menü ----------
function refreshMenu() {
  $("themeName").textContent = THEMES[store.theme].name;
  $("themePreview").textContent = pickKinds(store.theme).join(" ");
  $("bestTA").textContent = `90 Sekunden · Rekord ${store.best.time_attack}`;
  $("bestEndless").textContent = `Ohne Zeitlimit · Rekord ${store.best.endless}`;
  refreshAudioButtons();
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
$("btnMusic").addEventListener("click", toggleMusic);
$("btnSound").addEventListener("click", toggleSound);
$("btnTA").addEventListener("click", () => startGame(0));
$("btnEndless").addEventListener("click", () => startGame(1));
$("btnQuit").addEventListener("click", toMenu);
$("btnAgain").addEventListener("click", () => startGame(game ? game.mode : 0));
$("btnMenu").addEventListener("click", toMenu);

window.addEventListener("keydown", (e) => {
  if (e.repeat) return;
  const k = e.key.toLowerCase();
  if (k === "m") toggleMusic();
  else if (k === "s") toggleSound();
});

// Audio erst nach Nutzeraktion
// (bei Touch zählt erst pointerup/touchend als Nutzeraktion)
for (const ev of ["pointerdown", "pointerup", "touchend", "click", "keydown"]) {
  window.addEventListener(ev, unlockAudio, true);
}

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
    mode, key, score: 0, best0: store.best[key] || 0,
    remaining: TA_TIME, elapsed: 0, running: false, timeUp: false,
    message: "", recordSounded: false,
  };
  const g = game;
  const alive = () => id === roundId;
  board = new Board(pickKinds(store.theme), {
    alive,
    isOver: () => g.timeUp,
    message: (m) => { if (!g.timeUp || m === "Zeit um!") g.message = m; },
    onScore: (points) => {
      g.score += points;
      if (g.mode === 1 && g.best0 > 0 && g.score > g.best0 && !g.recordSounded) {
        g.recordSounded = true;
        play("record", 1, -3);
      }
    },
  });
  const b = board;
  setMusicRate(1);
  showScreen("game");
  b.dropNewBoard();
  play("shuffle");
  await b.waitCalm();
  if (!alive()) return;

  if (testMode && params.get("specials") === "1") b.debugSpecials();
  if (testMode && params.get("timeup") === "1") g.remaining = 0.01;
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
  return ok;
}

async function runAI(id, n) {
  const b = board;
  for (let i = 0; i < n; i++) {
    if (id !== roundId || game.timeUp) return;
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
  g.timeUp = true;
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
  $("overScore").textContent = `${g.score} Punkte`;
  $("overBest").textContent = newRecord ? "🏆 Neuer Rekord!" : `Rekord: ${store.best.time_attack}`;
  showScreen("over");
  if (newRecord) play("record");
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
  if (screen !== "game" || !board || board.locked) return;
  const p = toLogical(e);
  const cell = cellAt(p);
  if (!cell) return;
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
  if (!g.running) return;
  if (g.mode === 0) {
    const prev = g.remaining;
    g.remaining = Math.max(0, g.remaining - dt);
    for (let k = 10; k >= 1; k--) if (prev > k && g.remaining <= k) play("tick");
    setMusicRate(g.remaining <= 10 ? 1.08 : 1);
    if (g.remaining <= 0) timeUp();
  } else {
    g.elapsed += dt;
  }
}

// ---------- Zeichnen ----------
function fmtTime(sec, up) {
  const T = up ? Math.floor(sec * 10) : Math.ceil(sec * 10 - 1e-6);
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
  const t = ta ? fmtTime(g.remaining, false) : fmtTime(g.elapsed, true);
  text(t, W / 2, 26, 36, ta && g.remaining <= 10 ? DANGER : ACCENT);
  text(`${g.score} Punkte`, W / 2, 84, 26, "#fff");
  const rec = g.best0 > 0 && g.score > g.best0 ? "🏆 Neuer Rekord!" : `🏆 Rekord ${g.best0}`;
  text(rec, 525, 40, 16, "rgba(255,255,255,0.6)", "right");

  if (ta) {
    roundRect(ctx, 40, 132, 460, 14, 7);
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.fill();
    const f = Math.max(0, Math.min(1, g.remaining / TA_TIME));
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
  if (board && game && (screen === "game" || screen === "over")) drawGame();
}

let last = performance.now();
function frame(now) {
  tick(Math.min((now - last) / 1000, 0.05));
  last = now;
  render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// ---------- Start ----------
showScreen("menu");
if (testMode && params.has("mode")) startGame(params.get("mode") === "1" ? 1 : 0);

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
