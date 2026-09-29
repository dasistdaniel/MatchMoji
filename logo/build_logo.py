"""Erzeugt alle MatchMoji-Logodateien in logo/. Aufruf aus dem Projektordner: python logo/build_logo.py"""
import math, os
OUT = os.path.dirname(os.path.abspath(__file__))

def rr(x, y, w, h, r):
    r = min(r, w / 2, h / 2)
    return (f"M{x+r:.2f} {y:.2f}H{x+w-r:.2f}A{r:.2f} {r:.2f} 0 0 1 {x+w:.2f} {y+r:.2f}V{y+h-r:.2f}"
            f"A{r:.2f} {r:.2f} 0 0 1 {x+w-r:.2f} {y+h:.2f}H{x+r:.2f}A{r:.2f} {r:.2f} 0 0 1 {x:.2f} {y+h-r:.2f}"
            f"V{y+r:.2f}A{r:.2f} {r:.2f} 0 0 1 {x+r:.2f} {y:.2f}Z")

def pill(x, y, w, h):
    return rr(x, y, w, h, min(w, h) / 2)

def circ(cx, cy, r):
    return f"M{cx-r:.2f} {cy:.2f}A{r:.2f} {r:.2f} 0 1 1 {cx+r:.2f} {cy:.2f}A{r:.2f} {r:.2f} 0 1 1 {cx-r:.2f} {cy:.2f}Z"

def ring(cx, cy, R, s):
    # Loch gegenläufig -> funktioniert mit nonzero, also ohne evenodd
    ri = R - s
    return (circ(cx, cy, R) +
            f"M{cx-ri:.2f} {cy:.2f}A{ri:.2f} {ri:.2f} 0 1 0 {cx+ri:.2f} {cy:.2f}A{ri:.2f} {ri:.2f} 0 1 0 {cx-ri:.2f} {cy:.2f}Z")

def arc_band(cx, cy, r, t, a0, a1):
    ro, ri, rc = r + t / 2, r - t / 2, t / 2
    P = lambda rad, a: (cx + rad * math.cos(math.radians(a)), cy - rad * math.sin(math.radians(a)))
    so, eo, si, ei = P(ro, a0), P(ro, a1), P(ri, a0), P(ri, a1)
    large = 1 if (a1 - a0) > 180 else 0
    return (f"M{so[0]:.2f} {so[1]:.2f}A{ro:.2f} {ro:.2f} 0 {large} 0 {eo[0]:.2f} {eo[1]:.2f}"
            f"A{rc:.2f} {rc:.2f} 0 0 0 {ei[0]:.2f} {ei[1]:.2f}"
            f"A{ri:.2f} {ri:.2f} 0 {large} 1 {si[0]:.2f} {si[1]:.2f}"
            f"A{rc:.2f} {rc:.2f} 0 0 0 {so[0]:.2f} {so[1]:.2f}Z")

# ---------- Zeichen (B3) ----------
def symbol_paths():
    return [rr(28, 30, 200, 48, 24), pill(28, 30, 54, 196), pill(174, 30, 54, 196), pill(101, 30, 54, 112)]

# ---------- Schriftzug: eigene Buchstaben, monoline, runde Enden ----------
B, XH, CAP, S = 200, 128, 170, 34
TOP = B - CAP
def M(x):
    g = 20
    W = 3 * S + 2 * g
    # Proportionen wie im Zeichen: Mittelsäule endet bei 57 % der Höhe
    return [rr(x, TOP, W, S * 1.0, S / 2), pill(x, TOP, S, CAP), pill(x + 2 * (S + g), TOP, S, CAP),
            pill(x + S + g, TOP, S, CAP * 0.57)], W
def a(x):
    R = 65
    mid = R - S / 2  # Mittellinie des Rings
    return [ring(x + 64, B - 64, R, S), pill(x + 64 + mid - S / 2, B - XH, S, XH)], 64 + mid + S / 2
def t(x):
    return [pill(x + 22, B - 162, S, 162), pill(x, B - XH, 84, S)], 84
def c(x):
    return [arc_band(x + 64, B - 64, 65 - S / 2, S, 42, 318)], 118
def h(x):
    W = 112
    rm = (W - S) / 2
    cy = B - XH + rm + S / 2
    return [pill(x, TOP, S, CAP), arc_band(x + W / 2, cy, rm, S, 0, 180), pill(x + W - S, cy - S / 2, S, B - cy + S / 2)], W
def o(x):
    return [ring(x + 64, B - 64, 65, S)], 128
def j(x):
    rh = 34
    xs = x + rh + 22
    return [pill(xs, B - XH, S, XH + 18 + S / 2), arc_band(xs + S / 2 - rh, B + 18, rh, S, -160, 0),
            circ(xs + S / 2, B - XH - 38, 20)], xs - x + S
def i(x):
    return [pill(x, B - XH, S, XH), circ(x + S / 2, B - XH - 38, 20)], S

GLYPHS = [(M, 16), (a, 12), (t, 8), (c, 12), (h, 18), (M, 14), (o, -2), (j, 16), (i, 0)]
def wordmark():
    x, paths = 0, []
    for fn, gap in GLYPHS:
        p, w = fn(x)
        paths += p
        x += w + gap
    return paths, x
WM, WM_W = wordmark()
WM_BOX = (0, 17, WM_W, 271)   # x0, y0 (i-Punkt), x1, y1 (j-Unterlänge)

GOLD, VIOLET, DARK, TOPC = "#ffc94a", "#3b2a6b", "#1a1333", "#3b2a6b"

def svg(w, h, body, title, vb=None):
    vb = vb or f"0 0 {w} {h}"
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}" width="{w}" height="{h}" role="img" '
            f'aria-label="{title}"><title>{title}</title>{body}</svg>\n')

def group(paths, fill, transform=""):
    tr = f' transform="{transform}"' if transform else ""
    return f'<g fill="{fill}"{tr}>' + "".join(f'<path d="{p}"/>' for p in paths) + "</g>"

GRAD = (f'<defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{TOPC}"/>'
        f'<stop offset="1" stop-color="{DARK}"/></linearGradient></defs>')

def write(name, content):
    open(os.path.join(OUT, name), "w", encoding="utf-8").write(content)

os.makedirs(OUT, exist_ok=True)
SYM = symbol_paths()
# Zeichen in allen Farbstellungen
for suffix, fill in [("black", "#000"), ("white", "#fff"), ("gold", GOLD), ("violet", VIOLET)]:
    write(f"matchmoji-symbol-{suffix}.svg", svg(256, 256, group(SYM, fill), "MatchMoji"))
# App-Icon-Kachel (gerundet) und vollflächig (maskable / Apple)
icon_body = lambda k: group(SYM, GOLD, f"translate(128 128) scale({k}) translate(-128 -128)")
write("matchmoji-icon.svg", svg(256, 256, GRAD + '<rect width="256" height="256" rx="56" fill="url(#bg)"/>' + icon_body(0.72), "MatchMoji"))
write("matchmoji-icon-fullbleed.svg", svg(256, 256, GRAD + '<rect width="256" height="256" fill="url(#bg)"/>' + icon_body(0.72), "MatchMoji"))
write("matchmoji-icon-maskable.svg", svg(256, 256, GRAD + '<rect width="256" height="256" fill="url(#bg)"/>' + icon_body(0.6), "MatchMoji"))

# Schriftzug
x0, y0, x1, y1 = WM_BOX
PAD = 8
vb = f"{x0-PAD} {y0-PAD} {x1-x0+2*PAD} {y1-y0+2*PAD}"
ww, wh = x1 - x0 + 2 * PAD, y1 - y0 + 2 * PAD
for suffix, fill in [("black", "#000"), ("white", "#fff"), ("gold", GOLD), ("violet", VIOLET)]:
    write(f"matchmoji-wordmark-{suffix}.svg", svg(ww, wh, group(WM, fill), "MatchMoji", vb))

# Quer-Lockup: Zeichen + Schriftzug; Versalhöhe des Schriftzugs = 60 % der Zeichenhöhe
sym_h = 196
k = sym_h * 0.6 / CAP
gap = 44
wm_x = 228 + gap
wm_y = 30 + (sym_h - CAP * k) / 2 - TOP * k   # Versalhöhe mittig zum Zeichen
H_W = wm_x + WM_W * k + 28
def horiz(sym_fill, wm_fill):
    return group(SYM, sym_fill) + group(WM, wm_fill, f"translate({wm_x:.2f} {wm_y:.2f}) scale({k:.4f})")
for suffix, sf, wf in [("color-dark", GOLD, "#fff"), ("color-light", GOLD, VIOLET), ("black", "#000", "#000"), ("white", "#fff", "#fff")]:
    write(f"matchmoji-horizontal-{suffix}.svg", svg(round(H_W), 256, horiz(sf, wf), "MatchMoji"))

# Gestapelt: Zeichen oben, Schriftzug darunter
ks = 0.42
st_w = max(256, WM_W * ks + 40)
sx = (st_w - 256) / 2
wm_w = WM_W * ks
st_body = lambda sf, wf: (group(SYM, sf, f"translate({sx:.2f} 0)") +
                          group(WM, wf, f"translate({(st_w - wm_w)/2:.2f} {256 + 10 - y0*ks:.2f}) scale({ks})"))
st_h = 256 + 10 + (y1 - y0) * ks + 20
for suffix, sf, wf in [("color-dark", GOLD, "#fff"), ("color-light", GOLD, VIOLET), ("black", "#000", "#000"), ("white", "#fff", "#fff")]:
    write(f"matchmoji-stacked-{suffix}.svg", svg(round(st_w), round(st_h), st_body(sf, wf), "MatchMoji"))
print("Schriftzug-Breite", WM_W, "Lockup quer", round(H_W), "gestapelt", round(st_w), "x", round(st_h))

# Quer-Lockup mit App-Kachel (für helle UND dunkle Flächen gut lesbar, z. B. README)
tile_sym = ('<rect width="256" height="256" rx="56" fill="url(#bg)"/>' + icon_body(0.72))
for suffix, wf in [("light", VIOLET), ("dark", "#fff")]:
    body = GRAD + tile_sym + group(WM, wf, f"translate({wm_x:.2f} {wm_y:.2f}) scale({k:.4f})")
    write(f"matchmoji-horizontal-tile-{suffix}.svg", svg(round(H_W), 256, body, "MatchMoji"))
print("Kachel-Lockups ok")

# Kleingrößen-Schnitt (Favicon 16/32 px): größeres M, breitere Schlitze, weniger runde Kachel
SMALL = [rr(24, 30, 208, 50, 25), pill(24, 30, 54, 196), pill(178, 30, 54, 196), pill(101, 30, 54, 116)]
write("matchmoji-icon-small.svg", svg(256, 256, GRAD + '<rect width="256" height="256" rx="40" fill="url(#bg)"/>' +
      group(SMALL, GOLD, "translate(128 128) scale(0.86) translate(-128 -128)"), "MatchMoji"))
print("Kleingröße ok")
