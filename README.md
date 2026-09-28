# MatchMoji

Ein Match-3-Browserspiel mit Emojis: Tausche benachbarte Emojis und bilde Reihen aus drei oder mehr gleichen.

## ▶ [Jetzt spielen](https://dasistdaniel.github.io/MatchMoji/)

## Spielregeln

- Zwei benachbarte Emojis per Klick oder Wischen tauschen.
- 3 oder mehr gleiche in einer Reihe verschwinden. Neue fallen nach, Kettenreaktionen erhöhen den Multiplikator.
- **4er-Reihe → ⚡ Linien-Blitz:** räumt eine ganze Zeile bzw. Spalte ab.
- **5er-Reihe → 🌟 Super-Stern:** mit einem Nachbarn tauschen, und alle Emojis dieser Sorte verschwinden.

## Modi

- **⏱ Time Attack:** 90 Sekunden, so viele Punkte wie möglich.
- **♾ Endlos:** ohne Zeitlimit.

Neun Themen (Tiere, Früchte, Fahrzeuge, Essen, Gesichter, Sport, Natur, Grusel und Gemischt). Rekorde und Einstellungen werden im Browser gespeichert.

**Tasten:** `M` schaltet die Musik, `S` die Soundeffekte.

## Technik

Vanilla HTML, CSS und JavaScript (ES-Module), ohne Framework und ohne Build-Schritt. Gerendert wird auf einem Canvas (540 × 960). Alle Soundeffekte und die Hintergrundmusik werden per Web Audio API im Code synthetisiert, es gibt keine Audiodateien.

Lokal starten:

```bash
npx serve
```
