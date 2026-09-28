import { play } from "./sfx.js";

export const COLS = 7;
export const ROWS = 9;
export const CELL = 74;
export const BX = 11;
export const BY = 170;
export const BW = COLS * CELL; // 518
export const BH = ROWS * CELL; // 666

const GRAVITY = 3200;
const BOUNCE_MIN = 350;
const BOUNCE = -0.28;
const STAR = "🌟";
export const EMOJI_FONT = '"Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';
export const UI_FONT = '"Segoe UI", system-ui, Arial, sans-serif';

const easeOutQuad = (t) => 1 - (1 - t) * (1 - t);
const easeOutBack = (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
const linear = (t) => t;

// ---------- Emoji-Sprites (Cache, schneller als fillText pro Frame) ----------
let SPRITE_PX = 128;
const spriteCache = new Map();

/** Sprite-Auflösung an Skalierung × devicePixelRatio anpassen. */
export function setSpriteScale(k) {
  const px = Math.max(64, Math.ceil(64 * k * 1.4));
  if (px !== SPRITE_PX) { SPRITE_PX = px; spriteCache.clear(); }
}
function sprite(emoji) {
  let s = spriteCache.get(emoji);
  if (s) return s;
  s = document.createElement("canvas");
  s.width = s.height = SPRITE_PX;
  const g = s.getContext("2d");
  const k = SPRITE_PX / 64;
  g.scale(k, k);
  g.font = `44px ${EMOJI_FONT}`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(emoji, 32, 34);
  spriteCache.set(emoji, s);
  return s;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
export { roundRect };

function makeTile(kind) {
  return { kind, special: null, x: 0, y: 0, vy: 0, delay: 0, scale: 1, alpha: 1, rot: 0, flash: 0, swapping: false };
}

export class Board {
  /**
   * @param kinds  Array mit 6 Emojis
   * @param hooks  { alive(), onScore(points, level), onBonus(sec), message(text), isOver() }
   * @param opts   { refill }: ohne Nachschub bleiben geleerte Felder leer (Normal-Modus)
   */
  constructor(kinds, hooks, opts = {}) {
    this.kinds = kinds;
    this.hooks = hooks;
    this.refill = opts.refill !== false;
    this.grid = [];
    for (let c = 0; c < COLS; c++) this.grid.push(new Array(ROWS).fill(null));
    this.dying = [];
    this.tweens = [];
    this.timers = [];
    this.calmWaiters = [];
    this.beams = [];
    this.shimmers = [];
    this.popups = [];
    this.selected = null;
    this.locked = true;
    this.busy = false;
    this.time = 0;
  }

  // ---------- Hilfen ----------
  randKind() { return Math.floor(Math.random() * this.kinds.length); }
  tile(c, r) { return c >= 0 && c < COLS && r >= 0 && r < ROWS ? this.grid[c][r] : null; }
  emojiOf(t) { return t.special === "star" ? STAR : this.kinds[t.kind]; }

  wait(sec) { return new Promise((res) => this.timers.push({ t: sec, res })); }
  waitCalm() { return new Promise((res) => this.calmWaiters.push(res)); }

  tween(obj, prop, to, dur, opts = {}) {
    this.tweens.push({ obj, prop, to, dur, delay: opts.delay || 0, ease: opts.ease || linear, from: null, t: 0, done: opts.done });
  }

  /** Anzahl der Emojis auf dem Brett. */
  count() {
    let n = 0;
    for (const col of this.grid) for (const t of col) if (t) n++;
    return n;
  }

  isCalm() {
    for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) {
      const t = this.grid[c][r];
      if (!t) {
        if (this.refill) return false;
        continue;
      }
      if (t.delay > 0 || t.swapping || t.vy !== 0 || t.y !== r * CELL || t.x !== c * CELL) return false;
    }
    return true;
  }

  // ---------- Brett erzeugen ----------
  static generateKinds(kindCount) {
    for (;;) {
      const g = [];
      for (let c = 0; c < COLS; c++) {
        g.push([]);
        for (let r = 0; r < ROWS; r++) {
          let k;
          do {
            k = Math.floor(Math.random() * kindCount);
          } while ((c >= 2 && g[c - 1][r] === k && g[c - 2][r] === k) ||
                   (r >= 2 && g[c][r - 1] === k && g[c][r - 2] === k));
          g[c].push(k);
        }
      }
      if (hasValidMoveKinds(g)) return g;
    }
  }

  /** Neues Brett einfallen lassen (Start und Neu-Mischen). */
  dropNewBoard() {
    const g = Board.generateKinds(this.kinds.length);
    for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) {
      const t = makeTile(g[c][r]);
      t.x = c * CELL;
      t.y = (r - 9) * CELL - 20;
      t.delay = c * 0.04 + (8 - r) * 0.05;
      this.grid[c][r] = t;
    }
  }

  kindGrid() {
    return this.grid.map((col) => col.map((t) => (t ? (t.special === "star" ? -1 : t.kind) : -2)));
  }

  hasValidMove() { return hasValidMoveKinds(this.kindGrid()); }

  /** Erster gültiger Zug (für Test-KI). */
  findMove() {
    const g = this.kindGrid();
    for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) {
      for (const [dc, dr] of [[1, 0], [0, 1]]) {
        const c2 = c + dc, r2 = r + dr;
        if (c2 >= COLS || r2 >= ROWS) continue;
        if (swapMakesMatch(g, c, r, c2, r2)) return [{ c, r }, { c: c2, r: r2 }];
      }
    }
    return null;
  }

  // ---------- Reihen suchen ----------
  findRuns() {
    const runs = [];
    const k = (c, r) => { const t = this.grid[c][r]; return t && t.special !== "star" ? t.kind : -1; };
    for (let r = 0; r < ROWS; r++) {
      let c = 0;
      while (c < COLS) {
        const kk = k(c, r);
        let e = c + 1;
        while (e < COLS && kk >= 0 && k(e, r) === kk) e++;
        if (kk >= 0 && e - c >= 3) {
          const cells = [];
          for (let i = c; i < e; i++) cells.push({ c: i, r });
          runs.push({ cells, dir: "h" });
        }
        c = e;
      }
    }
    for (let c = 0; c < COLS; c++) {
      let r = 0;
      while (r < ROWS) {
        const kk = k(c, r);
        let e = r + 1;
        while (e < ROWS && kk >= 0 && k(c, e) === kk) e++;
        if (kk >= 0 && e - r >= 3) {
          const cells = [];
          for (let i = r; i < e; i++) cells.push({ c, r: i });
          runs.push({ cells, dir: "v" });
        }
        r = e;
      }
    }
    return runs;
  }

  // ---------- Tauschen ----------
  animateSwap(a, b) {
    const ta = this.grid[a.c][a.r], tb = this.grid[b.c][b.r];
    for (const [t, to] of [[ta, b], [tb, a]]) {
      t.swapping = true;
      this.tween(t, "x", to.c * CELL, 0.16, { ease: easeOutQuad });
      this.tween(t, "y", to.r * CELL, 0.16, { ease: easeOutQuad, done: () => { t.swapping = false; } });
    }
    this.grid[a.c][a.r] = tb;
    this.grid[b.c][b.r] = ta;
  }

  shake(t) {
    this.tween(t, "rot", 0.18, 0.05);
    this.tween(t, "rot", -0.18, 0.08, { delay: 0.05 });
    this.tween(t, "rot", 0, 0.05, { delay: 0.13 });
    t.flash = 1;
    this.tween(t, "flash", 0, 0.3);
  }

  /** Führt einen Tausch aus. Gibt true zurück, wenn er gültig war. */
  async trySwap(a, b) {
    if (this.locked || this.busy) return false;
    if (!this.grid[a.c][a.r] || !this.grid[b.c][b.r]) return false;
    this.busy = true;
    this.locked = true;
    this.selected = null;
    this.hooks.message("");
    play("swap");
    this.animateSwap(a, b);
    await this.wait(0.16);
    if (!this.hooks.alive()) return false;

    const ta = this.grid[b.c][b.r]; // ursprünglich bei a
    const tb = this.grid[a.c][a.r];
    const starA = ta.special === "star", starB = tb.special === "star";

    if (starA || starB) {
      const pre = new Set();
      const triggered = new Set();
      if (starA && starB) {
        for (const col of this.grid) for (const t of col) if (t) pre.add(t);
      } else {
        const star = starA ? ta : tb;
        const other = starA ? tb : ta;
        pre.add(star);
        for (const col of this.grid) for (const t of col) if (t && t.special !== "star" && t.kind === other.kind) pre.add(t);
      }
      if (starA) triggered.add(ta);
      if (starB) triggered.add(tb);
      this.starFx();
      await this.resolve([a, b], pre, triggered);
    } else if (this.findRuns().length === 0) {
      play("invalid");
      this.animateSwap(a, b);
      this.shake(ta);
      this.shake(tb);
      await this.wait(0.18);
      if (!this.hooks.alive()) return false;
      this.busy = false;
      if (!this.hooks.isOver()) this.locked = false;
      return false;
    } else {
      await this.resolve([a, b], null, new Set());
    }
    if (!this.hooks.alive()) return true;
    this.busy = false;
    if (!this.hooks.isOver()) this.locked = false;
    return true;
  }

  starFx() {
    this.hooks.onBonus(5);
    this.shimmers.push({ t: 0, dur: 0.4 });
    play("star");
    this.hooks.message("🌟 Super-Stern!");
  }

  lineFx(dir, idx) {
    this.hooks.onBonus(5);
    this.beams.push({ dir, idx, t: 0, dur: 0.35 });
    play("line");
  }

  // ---------- Auflösen (Kaskaden) ----------
  async resolve(swapped, preClear, triggered) {
    let level = 1;
    let first = true;
    for (;;) {
      const runs = this.findRuns();
      if (runs.length === 0 && !(first && preClear)) break;

      const pos = new Map(); // Tile -> {c,r}
      for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) if (this.grid[c][r]) pos.set(this.grid[c][r], { c, r });

      const clear = new Set(first && preClear ? preClear : []);
      for (const run of runs) for (const p of run.cells) clear.add(this.grid[p.c][p.r]);

      // Spezial-Emojis erzeugen
      const creations = new Map(); // Tile -> "h"|"v"|"star"
      for (const run of runs) {
        const len = run.cells.length;
        if (len < 4) continue;
        const type = len >= 5 ? "star" : run.dir;
        let keeper = null;
        if (first) {
          for (const s of swapped) {
            if (run.cells.some((p) => p.c === s.c && p.r === s.r)) {
              const t = this.grid[s.c][s.r];
              if (!t.special) { keeper = t; break; }
            }
          }
        }
        if (!keeper) {
          const mid = run.cells[Math.floor(len / 2)];
          const t = this.grid[mid.c][mid.r];
          if (!t.special) keeper = t;
          else keeper = run.cells.map((p) => this.grid[p.c][p.r]).find((x) => !x.special) || null;
        }
        if (!keeper) continue;
        const prev = creations.get(keeper);
        if (prev === "star") continue;
        if (prev && type !== "star") { creations.set(keeper, "star"); continue; } // zwei Reihen → Stern
        creations.set(keeper, type);
      }

      // Spezial-Emojis im Treffer auslösen (Warteschlange)
      const queue = [];
      for (const t of clear) if (t.special && !triggered.has(t) && !creations.has(t)) queue.push(t);
      while (queue.length) {
        const t = queue.shift();
        if (triggered.has(t)) continue;
        triggered.add(t);
        const p = pos.get(t);
        const added = [];
        if (t.special === "h") {
          this.lineFx("h", p.r);
          for (let c = 0; c < COLS; c++) if (this.grid[c][p.r]) added.push(this.grid[c][p.r]);
        } else if (t.special === "v") {
          this.lineFx("v", p.c);
          for (let r = 0; r < ROWS; r++) if (this.grid[p.c][r]) added.push(this.grid[p.c][r]);
        } else if (t.special === "star") {
          const present = new Set();
          for (const col of this.grid) for (const x of col) if (x && x.special !== "star") present.add(x.kind);
          const list = [...present];
          this.starFx();
          if (list.length) {
            const kind = list[Math.floor(Math.random() * list.length)];
            for (const col of this.grid) for (const x of col) if (x && x.special !== "star" && x.kind === kind) added.push(x);
          }
        }
        for (const x of added) {
          if (!clear.has(x)) {
            clear.add(x);
            if (x.special && !triggered.has(x) && !creations.has(x)) queue.push(x);
          }
        }
      }

      // Punkte
      const points = clear.size * 10 * level;
      let sx = 0, sy = 0;
      for (const t of clear) { const p = pos.get(t); sx += p.c; sy += p.r; }
      const n = clear.size || 1;
      this.popups.push({
        x: BX + (sx / n) * CELL + CELL / 2, y: BY + (sy / n) * CELL + CELL / 2,
        text: level >= 2 ? `+${points}  x${level}` : `+${points}`, level, t: 0,
      });
      this.hooks.onScore(points, level);
      play("match", Math.min(1 + 0.12 * (level - 1), 1.8));
      if (runs.length) this.hooks.onBonus(runs.length);

      // Spezial-Emojis setzen
      if (creations.size) {
        play("special");
        let msg = "";
        for (const [t, type] of creations) {
          clear.delete(t);
          t.special = type;
          if (type === "star") { t.kind = -1; msg = "🌟 Super-Stern!"; }
          else if (!msg) msg = "⚡ Linien-Blitz!";
          t.scale = 1.35;
          this.tween(t, "scale", 1, 0.25, { ease: easeOutBack });
        }
        this.hooks.message(msg);
      }

      // Entfernen
      for (const t of clear) {
        const p = pos.get(t);
        this.grid[p.c][p.r] = null;
        this.killTile(t);
      }

      await this.wait(0.15);
      if (!this.hooks.alive()) return;
      this.collapse();
      await this.waitCalm();
      if (!this.hooks.alive()) return;
      level++;
      first = false;
    }

    if (this.refill && !this.hooks.isOver() && !this.hasValidMove()) {
      this.hooks.message("Keine Züge mehr – neu gemischt!");
      play("shuffle");
      for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) {
        this.killTile(this.grid[c][r]);
        this.grid[c][r] = null;
      }
      await this.wait(0.35);
      if (!this.hooks.alive()) return;
      this.dropNewBoard();
      await this.waitCalm();
    }
  }

  killTile(t) {
    t.swapping = false;
    this.dying.push(t);
    this.tween(t, "scale", 1.4, 0.12);
    this.tween(t, "alpha", 0, 0.18, { done: () => { const i = this.dying.indexOf(t); if (i >= 0) this.dying.splice(i, 1); } });
  }

  collapse() {
    for (let c = 0; c < COLS; c++) {
      let write = ROWS - 1;
      for (let r = ROWS - 1; r >= 0; r--) {
        const t = this.grid[c][r];
        if (t) {
          this.grid[c][r] = null;
          this.grid[c][write--] = t;
        }
      }
      const n = this.refill ? write + 1 : 0;
      for (let i = 0; i < n; i++) {
        const t = makeTile(this.randKind());
        t.x = c * CELL;
        t.y = (i - n) * CELL - 10;
        this.grid[c][i] = t;
      }
    }
  }

  /** Test-Hilfe: Spezial-Emojis setzen. */
  debugSpecials() {
    this.grid[1][2].special = "h";
    this.grid[4][5].special = "v";
    const s = this.grid[2][7];
    s.special = "star";
    s.kind = -1;
  }

  // ---------- Update ----------
  update(dt) {
    this.time += dt;

    for (let i = this.tweens.length - 1; i >= 0; i--) {
      const tw = this.tweens[i];
      if (tw.delay > 0) { tw.delay -= dt; if (tw.delay > 0) continue; }
      if (tw.from === null) tw.from = tw.obj[tw.prop];
      tw.t += dt;
      const k = Math.min(tw.t / tw.dur, 1);
      tw.obj[tw.prop] = tw.from + (tw.to - tw.from) * tw.ease(k);
      if (k >= 1) {
        tw.obj[tw.prop] = tw.to;
        this.tweens.splice(i, 1);
        if (tw.done) tw.done();
      }
    }

    for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) {
      const t = this.grid[c][r];
      if (!t || t.swapping) continue;
      if (t.delay > 0) { t.delay = Math.max(0, t.delay - dt); continue; }
      const target = r * CELL;
      if (t.y < target || t.vy !== 0) {
        t.vy += GRAVITY * dt;
        t.y += t.vy * dt;
        if (t.y >= target) {
          t.y = target;
          t.vy = t.vy > BOUNCE_MIN ? t.vy * BOUNCE : 0;
        }
      } else if (t.y > target) {
        t.y = target;
      }
    }

    for (const list of [this.beams, this.shimmers, this.popups]) {
      for (let i = list.length - 1; i >= 0; i--) {
        list[i].t += dt;
        if (list[i].t >= (list[i].dur || 0.8)) list.splice(i, 1);
      }
    }

    for (let i = this.timers.length - 1; i >= 0; i--) {
      const tm = this.timers[i];
      tm.t -= dt;
      if (tm.t <= 0) { this.timers.splice(i, 1); tm.res(); }
    }

    if (this.calmWaiters.length && this.isCalm()) {
      const w = this.calmWaiters;
      this.calmWaiters = [];
      for (const res of w) res();
    }
  }

  // ---------- Zeichnen ----------
  draw(ctx) {
    ctx.save();
    roundRect(ctx, BX - 4, BY - 4, BW + 8, BH + 8, 18);
    ctx.fillStyle = "rgba(0,0,0,0.22)";
    ctx.fill();

    ctx.beginPath();
    ctx.rect(BX, BY, BW, BH);
    ctx.clip();
    ctx.translate(BX, BY);

    const a = 0.55 + 0.45 * Math.sin(5 * this.time);
    for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) {
      const t = this.grid[c][r];
      if (t) this.drawTile(ctx, t, a, this.selected && this.selected.c === c && this.selected.r === r);
    }
    for (const t of this.dying) this.drawTile(ctx, t, a, false);

    for (const b of this.beams) {
      const al = 0.7 * (1 - b.t / b.dur);
      ctx.fillStyle = `rgba(153,242,255,${al})`;
      const th = CELL * 0.4;
      if (b.dir === "h") ctx.fillRect(0, b.idx * CELL + CELL / 2 - th / 2, BW, th);
      else ctx.fillRect(b.idx * CELL + CELL / 2 - th / 2, 0, th, BH);
    }
    for (const s of this.shimmers) {
      ctx.fillStyle = `rgba(255,230,128,${0.35 * (1 - s.t / s.dur)})`;
      ctx.fillRect(0, 0, BW, BH);
    }
    ctx.restore();

    // Punkte-Popups (ohne Zuschnitt)
    for (const p of this.popups) {
      const k = p.t / 0.8;
      const y = p.y - 60 * easeOutQuad(k);
      const alpha = p.t < 0.3 ? 1 : Math.max(0, 1 - (p.t - 0.3) / 0.5);
      const size = 30 + Math.min(p.level, 4) * 4;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = `700 ${size}px ${UI_FONT}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.lineJoin = "round";
      ctx.lineWidth = 8;
      ctx.strokeStyle = "rgba(0,0,0,0.6)";
      ctx.strokeText(p.text, p.x, y);
      ctx.fillStyle = p.level === 1 ? "#ffc94a" : "#ff8a5c";
      ctx.fillText(p.text, p.x, y);
      ctx.restore();
    }
  }

  drawTile(ctx, t, a, selected) {
    ctx.save();
    ctx.globalAlpha = t.alpha;
    ctx.translate(t.x + CELL / 2, t.y + CELL / 2);
    if (t.rot) ctx.rotate(t.rot);
    if (t.scale !== 1) ctx.scale(t.scale, t.scale);
    const h = CELL / 2 - 3, w = h * 2;
    roundRect(ctx, -h, -h, w, w, 14);

    let fill;
    if (selected) fill = "rgba(255,219,77,0.55)";
    else if (t.special === "star") fill = `rgba(255,204,77,${0.25 + 0.1 * a})`;
    else fill = "rgba(255,255,255,0.14)";
    ctx.fillStyle = fill;
    ctx.fill();
    if (t.flash > 0) {
      ctx.fillStyle = `rgba(255,77,77,${0.6 * t.flash})`;
      ctx.fill();
    }

    if (t.special === "h" || t.special === "v") {
      ctx.strokeStyle = "rgba(140,242,255,0.35)";
      ctx.lineWidth = 5;
      ctx.beginPath();
      for (const f of [0.3, 0.5, 0.7]) {
        const o = -h + w * f;
        if (t.special === "h") { ctx.moveTo(-h + 8, o); ctx.lineTo(h - 8, o); }
        else { ctx.moveTo(o, -h + 8); ctx.lineTo(o, h - 8); }
      }
      ctx.stroke();
    }

    if (selected) {
      roundRect(ctx, -h, -h, w, w, 14);
      ctx.strokeStyle = "rgb(255,242,153)";
      ctx.lineWidth = 4;
      ctx.stroke();
    } else if (t.special === "h" || t.special === "v") {
      roundRect(ctx, -h, -h, w, w, 14);
      ctx.strokeStyle = `rgba(115,230,255,${a})`;
      ctx.lineWidth = 3;
      ctx.stroke();
    } else if (t.special === "star") {
      roundRect(ctx, -h, -h, w, w, 14);
      ctx.strokeStyle = `rgba(255,217,77,${a})`;
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    ctx.drawImage(sprite(this.emojiOf(t)), -32, -32, 64, 64);
    ctx.restore();
  }
}

// ---------- Zugprüfung auf einem Sorten-Raster (-1 = Stern) ----------
function lineLen(g, c, r) {
  const k = g[c][r];
  if (k < 0) return 0;
  let h = 1, v = 1;
  for (let x = c - 1; x >= 0 && g[x][r] === k; x--) h++;
  for (let x = c + 1; x < COLS && g[x][r] === k; x++) h++;
  for (let y = r - 1; y >= 0 && g[c][y] === k; y--) v++;
  for (let y = r + 1; y < ROWS && g[c][y] === k; y++) v++;
  return Math.max(h, v);
}

function swapMakesMatch(g, c1, r1, c2, r2) {
  if (g[c1][r1] === -2 || g[c2][r2] === -2) return false; // leeres Feld
  if (g[c1][r1] === -1 || g[c2][r2] === -1) return true;
  [g[c1][r1], g[c2][r2]] = [g[c2][r2], g[c1][r1]];
  const ok = lineLen(g, c1, r1) >= 3 || lineLen(g, c2, r2) >= 3;
  [g[c1][r1], g[c2][r2]] = [g[c2][r2], g[c1][r1]];
  return ok;
}

function hasValidMoveKinds(g) {
  for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) {
    if (c + 1 < COLS && swapMakesMatch(g, c, r, c + 1, r)) return true;
    if (r + 1 < ROWS && swapMakesMatch(g, c, r, c, r + 1)) return true;
  }
  return false;
}
