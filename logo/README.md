# MatchMoji – Logo

![MatchMoji](matchmoji-horizontal-tile-light.png)

## Idee

Ein **M aus drei Säulen**: Die drei Säulen stehen zugleich für drei Kacheln einer Reihe, den Dreier-Treffer. Die runden Enden nehmen die weichen Kacheln des Spiels auf.

Der Schriftzug „MatchMoji“ ist aus denselben Bausteinen gezeichnet: gleich dicke Striche, runde Enden, beide M als Logo-M. Er ist komplett als Pfade gebaut, braucht also keine Schrift und sieht überall gleich aus.

## Farben

| | HEX | RGB | Einsatz |
|---|---|---|---|
| Gold | `#ffc94a` | 255 201 74 | Zeichen, Akzent |
| Violett | `#3b2a6b` | 59 42 107 | Schriftzug auf Hell, Verlauf oben |
| Nachtviolett | `#1a1333` | 26 19 51 | Verlauf unten, dunkle Flächen |
| Weiß | `#ffffff` | 255 255 255 | Schriftzug auf Dunkel |

Die App-Kachel hat einen senkrechten Verlauf von Violett nach Nachtviolett.

## Dateien

| Datei | Wofür |
|---|---|
| `matchmoji-symbol-*.svg` | Nur das M (gold, violett, schwarz, weiß) |
| `matchmoji-wordmark-*.svg` | Nur der Schriftzug (gold, violett, schwarz, weiß) |
| `matchmoji-horizontal-color-dark.svg` | Zeichen + Schriftzug quer, für dunkle Flächen |
| `matchmoji-horizontal-color-light.svg` | Quer für helle Flächen (goldenes M nur bei großem Einsatz, s. u.) |
| `matchmoji-horizontal-tile-light.svg` / `-dark.svg` | Quer mit App-Kachel, für helle bzw. dunkle Flächen (z. B. README) |
| `matchmoji-stacked-*.svg` | Zeichen über Schriftzug |
| `matchmoji-*-black.svg` / `-white.svg` | Einfarbig, z. B. für Druck oder Stempel |
| `matchmoji-icon.svg` | App-Icon mit runden Ecken |
| `matchmoji-icon-fullbleed.svg` / `-maskable.svg` | App-Icon randlos (iOS) bzw. mit Sicherheitsabstand (Android) |
| `matchmoji-icon-small.svg` | Kleingrößen-Schnitt für das Favicon (16–48 px) |
| `social-preview.png` | Vorschaubild für GitHub und Social Media (1280 × 640 px) |
| `build_logo.py` | Erzeugt alle Dateien neu: `python logo/build_logo.py` |

## Regeln

- **Schutzraum:** rund um das Logo mindestens die Breite einer M-Säule frei lassen.
- **Mindestgrößen:** Zeichen ab 16 px (darunter `icon-small`), Schriftzug ab 90 px Breite, Quer-Lockup ab 160 px Breite.
- **Kontrast:** Das goldene M auf Weiß ist zu blass für kleine Größen. Auf hellen Flächen die Kachel-Variante oder das violette Zeichen nehmen.
- **Nicht:** verzerren, drehen, Schatten oder Verläufe auf das M legen, andere Farben nehmen, den Schriftzug mit einer anderen Schrift nachsetzen.
