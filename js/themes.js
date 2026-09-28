export const THEMES = [
  { name: "Gemischt", colors: {} },
  { name: "Tiere", colors: {
    orange: ["🦊","🐯","🦁","🐱","🐙"], gelb: ["🐥","🐝"], grün: ["🐸","🐢","🦖"],
    rosa: ["🐷","🦩"], rot: ["🦀","🐞"], blau: ["🐳","🐬","🐠","🦋"],
    weiß: ["🐰","🦄","🐔","🐮"], dunkel: ["🐼","🐧","🦓"],
    braun: ["🐵","🐻","🐶","🦉","🐌"], grau: ["🐨","🐭","🐺"] } },
  { name: "Früchte", colors: {
    rot: ["🍎","🍒","🍓","🍅","🌶"], grün: ["🍏","🥝","🥑","🍈"], gelb: ["🍋","🍌","🍐","🌽"],
    orange: ["🍊","🥭","🥕","🍑"], lila: ["🍇","🍆","🫐"], braun: ["🥥","🌰"], bunt: ["🍉","🍍"] } },
  { name: "Fahrzeuge", colors: {
    rot: ["🚗","🚒","🛻","🛵"], gelb: ["🚕","🚌","🛺"], blau: ["🚙","🚤"], grün: ["🚜","🚎"],
    weiß: ["🚑","🚐","🛳","🚀"], dunkel: ["🚓","🚂"], orange: ["🚁"], braun: ["🛶"],
    grau: ["🛸"], bunt: ["⛵"] } },
  { name: "Essen", colors: {
    gelb: ["🍕","🧀","🌮"], braun: ["🍔","🥐","🥨","🍪"], rot: ["🍟","🌭","🍿","🍣"],
    grün: ["🥗"], rosa: ["🍩","🧁","🍡"], weiß: ["🍦","🍙"], dunkel: ["🍫"], blau: ["🍧"],
    bunt: ["🍭","🍬"], orange: ["🍤"] } },
  { name: "Gesichter", colors: {
    gelb: ["😀","😂","🤪","🥳","😴","😍","😘","😎","🤓"], rot: ["😡","🥵"],
    grün: ["🤢","👽","🤑"], lila: ["😈","👿","🥶","😱"], orange: ["🎃"], braun: ["💩"],
    weiß: ["💀","👻","🤡"], grau: ["🤖"] } },
  { name: "Sport", colors: {
    weiß: ["⚽","⚾","🏐"], orange: ["🏀","🏉"], braun: ["🏈"], gelb: ["🎾","🥎","🏆","🥇"],
    dunkel: ["🎱"], rot: ["🥊","🏓","🎯"], blau: ["🥏"], lila: ["🛹","🛼"], grün: ["⛳"] } },
  { name: "Natur", colors: {
    gelb: ["🌻","🌙","⭐","🌞"], grün: ["🌵","🍀","🌲","🌳","🌴"], rot: ["🌹","🍄","🍁"],
    rosa: ["🌸","🌷","🪷"], blau: ["🌊","💧","🌍","❄️"], orange: ["🔥","🍂"],
    grau: ["🐚","🪨","🌪️"], bunt: ["🌈"] } },
  { name: "Grusel", colors: {
    weiß: ["👻","💀","🦴"], grün: ["👽","🧟","🧪","🐍"], orange: ["🎃"], lila: ["🔮","👿"],
    braun: ["🦇","🦉"], rot: ["👹","🧛"], bunt: ["🐉"], dunkel: ["🕷️"], grau: ["🪦","🕸️"],
    gelb: ["🌕"], blau: ["🧙"] } },
];

export const KIND_COUNT = 6;

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function colorGroups(themeIdx) {
  if (themeIdx !== 0) return THEMES[themeIdx].colors;
  const merged = {};
  for (const t of THEMES) {
    for (const [color, list] of Object.entries(t.colors)) {
      merged[color] = merged[color] || [];
      for (const e of list) if (!merged[color].includes(e)) merged[color].push(e);
    }
  }
  return merged;
}

/** Zieht 6 Sorten: 6 zufällige Farbgruppen, je ein zufälliges Emoji. */
export function pickKinds(themeIdx) {
  const groups = colorGroups(themeIdx);
  const names = shuffle(Object.keys(groups)).slice(0, KIND_COUNT);
  return names.map((n) => {
    const list = groups[n];
    return list[Math.floor(Math.random() * list.length)];
  });
}
