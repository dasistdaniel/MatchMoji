const KEY = "memoji";

const params = new URLSearchParams(location.search);
export const testMode = ["mode", "theme", "moves", "specials", "timeup", "goal"].some((k) => params.has(k));

const defaults = () => ({
  theme: 0,
  music: true,
  sound: true,
  musicVolume: 1,
  sfxVolume: 1,
  track: 0, // Hintergrundmusik (Index in TRACKS)
  // clear: wenigste Reste (Abräumen), normal: schnellste Zeit in Sekunden
  best: { time_attack: 0, endless: 0, clear: null, normal: null },
});

function load() {
  const data = defaults();
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw);
      if (s && typeof s === "object") {
        Object.assign(data, s);
        const best = Object.assign({}, s.best || {});
        // Früher hieß „Abräumen“ „normal“ und speicherte dort die Reste
        if (!("clear" in best) && "normal" in best) {
          best.clear = best.normal;
          delete best.normal;
        }
        data.best = Object.assign(defaults().best, best);
      }
    }
  } catch (e) { /* kein Speicher verfügbar */ }
  return data;
}

export const store = load();

export function save() {
  if (testMode) return;
  try {
    localStorage.setItem(KEY, JSON.stringify(store));
  } catch (e) { /* ignorieren */ }
}
