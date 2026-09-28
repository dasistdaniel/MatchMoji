# MatchMoji

Ein Match-3-Browserspiel mit Emojis: Tausche benachbarte Emojis und bilde Reihen aus drei oder mehr gleichen.

## ▶ [Jetzt spielen](https://dasistdaniel.github.io/MatchMoji/)

## Spielregeln

- Zwei benachbarte Emojis per Klick oder Wischen tauschen.
- 3 oder mehr gleiche in einer Reihe verschwinden. Neue fallen nach, Kettenreaktionen erhöhen den Multiplikator.
- **4er-Reihe → ⚡ Linien-Blitz:** räumt eine ganze Zeile bzw. Spalte ab.
- **5er-Reihe → 🌟 Super-Stern:** mit einem Nachbarn tauschen, und alle Emojis dieser Sorte verschwinden.

## Modi

- **🎯 Normal:** Schaffe 50 Matches so schnell wie möglich, die benötigte Zeit ist dein Score. Jede aufgelöste Reihe zählt als ein Match, auch in Kettenreaktionen.
- **⏱ Time Attack:** 90 Sekunden, so viele Punkte wie möglich. Jede gelöste Reihe gibt **+1 Sekunde**, jedes ausgelöste Power-up (⚡ oder 🌟) **+5 Sekunden**.
- **♾ Endlos:** ohne Zeitlimit.
- **🧹 Abräumen:** Es kommen keine neuen Emojis nach, Ziel ist es, das Brett komplett abzuräumen. Wird eine Spalte leer, rutscht die schmalere Seite zur breiteren zusammen. Gibt es keinen Zug mehr, ist die Runde vorbei. Bewertet wird nach den Resten: ⭐⭐⭐ alles abgeräumt, ⭐⭐ höchstens 5 übrig, ⭐ höchstens 12 übrig, sonst verloren. Gespielt wird mit 4 Sorten, der Rekord zählt die wenigsten Reste.

Neun Themen (Tiere, Früchte, Fahrzeuge, Essen, Gesichter, Sport, Natur, Grusel und Gemischt). Rekorde und Einstellungen werden im Browser gespeichert.

Thema, Musik und Soundeffekte stellst du unter **⚙️ Einstellungen** ein.

**Tasten:** `M` schaltet die Musik, `S` die Soundeffekte, `Esc` führt aus den Einstellungen zurück.

## Technik

Vanilla HTML, CSS und JavaScript (ES-Module), ohne Framework und ohne Build-Schritt. Gerendert wird auf einem Canvas (540 × 960). Alle Soundeffekte und die Hintergrundmusik werden per Web Audio API im Code synthetisiert, es gibt keine Audiodateien.

Lokal starten:

```bash
npx serve
```
