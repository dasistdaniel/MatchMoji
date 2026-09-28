const KEY = "memoji";

const params = new URLSearchParams(location.search);
export const testMode = ["mode", "theme", "moves", "specials", "timeup"].some((k) => params.has(k));

const defaults = () => ({
  theme: 0,
  music: true,
  sound: true,
  musicVolume: 1,
  sfxVolume: 1,
  best: { time_attack: 0, endless: 0 },
});

function load() {
  const data = defaults();
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw);
      if (s && typeof s === "object") {
        Object.assign(data, s);
        data.best = Object.assign(defaults().best, s.best || {});
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
