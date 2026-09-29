<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="logo/matchmoji-horizontal-tile-dark.svg">
    <img src="logo/matchmoji-horizontal-tile-light.svg" alt="MatchMoji" width="480">
  </picture>
</p>

Ein Match-3-Browserspiel mit Emojis: Tausche benachbarte Emojis und bilde Reihen aus drei oder mehr gleichen.

## ▶ [Jetzt spielen](https://dasistdaniel.github.io/MatchMoji/)

## Spielregeln

- Zwei benachbarte Emojis per Klick oder Wischen tauschen.
- 3 oder mehr gleiche in einer Reihe verschwinden. Neue fallen nach, Kettenreaktionen erhöhen den Multiplikator.
- **4er-Reihe → ⚡ Linien-Blitz:** räumt eine ganze Zeile bzw. Spalte ab.
- **5er-Reihe → 🌟 Super-Stern:** mit einem Nachbarn tauschen, und alle Emojis dieser Sorte verschwinden.
- **Kombis:** zwei Spezial-Emojis miteinander tauschen:
  - ⚡ + ⚡ **Blitz-Kreuz:** räumt Zeile und Spalte ab.
  - 🌟 + ⚡ **Blitz-Regen:** alle Emojis der Blitz-Sorte werden zu Blitzen und lösen aus.
  - 🌟 + 🌟 räumt das ganze Brett ab.
- Wer 5 Sekunden nicht weiterweiß, bekommt einen **Hinweis**: zwei Emojis wackeln.

## Modi

- **🎯 Normal:** Schaffe 50 Matches so schnell wie möglich, die benötigte Zeit ist dein Score. Jede aufgelöste Reihe zählt als ein Match, auch in Kettenreaktionen.
- **⏱ Time Attack:** 90 Sekunden, so viele Punkte wie möglich. Jede gelöste Reihe gibt **+1 Sekunde**, jedes ausgelöste Power-up (⚡ oder 🌟) **+5 Sekunden**.
- **♾ Endlos:** ohne Zeitlimit.
- **🧹 Abräumen:** Es kommen keine neuen Emojis nach, Ziel ist es, das Brett komplett abzuräumen. Wird eine Spalte leer, rutscht die schmalere Seite zur breiteren zusammen. Gibt es keinen Zug mehr, ist die Runde vorbei. Bewertet wird nach den Resten: ⭐⭐⭐ alles abgeräumt, ⭐⭐ höchstens 5 übrig, ⭐ höchstens 12 übrig, sonst verloren. Gespielt wird mit 4 Sorten, der Rekord zählt die wenigsten Reste.

Neun Themen (Tiere, Früchte, Fahrzeuge, Essen, Gesichter, Sport, Natur, Grusel und Gemischt). Rekorde und Einstellungen werden im Browser gespeichert.

Thema, Musik, Soundeffekte, Hinweise und Vibration (am Handy) stellst du unter **⚙️ Einstellungen** ein. Zur Wahl stehen acht Musikstücke: Techno, Chiptune, Lo-Fi, Synthwave, Disco, Korobeiniki (gemeinfreies russisches Volkslied, bekannt aus Tetris), Blocksprung (eigene Komposition im Stil flotter Game-Boy-Musik) und Menuett (Bach, Französische Suite Nr. 3, BWV 814). Korobeiniki und Menuett sind eigene Chiptune-Arrangements gemeinfreier Werke.

**Pause:** mit ⏸️ oben links, mit `P`/`Esc`, oder automatisch beim Wechsel in einen anderen Tab.

**Tasten:** `M` schaltet die Musik, `S` die Soundeffekte, `P`/`Esc` pausiert, `Esc` führt aus den Einstellungen zurück.

## Als App installieren

MatchMoji lässt sich wie eine App installieren und läuft dann auch offline:

- **Android / Chrome / Edge:** ⚙️ Einstellungen → **📲 Als App installieren** (oder über das Browser-Menü).
- **iPhone / iPad:** in Safari **Teilen** → **„Zum Home-Bildschirm“**.

## Technik

Vanilla HTML, CSS und JavaScript (ES-Module), ohne Framework und ohne Build-Schritt. Gerendert wird auf einem Canvas (540 × 960). Alle Soundeffekte und die Hintergrundmusik werden per Web Audio API im Code synthetisiert, es gibt keine Audiodateien.

Lokal starten:

```bash
npx serve
```
