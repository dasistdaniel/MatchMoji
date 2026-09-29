// Service Worker: macht MatchMoji installierbar und offline spielbar.
// Strategie „erst Netzwerk, sonst Cache“: online kommt immer die neueste Version,
// offline die zuletzt geladene. Die Version steht im Aufruf (sw.js?v=…).

const VERSION = new URL(self.location).searchParams.get("v") || "dev";
const CACHE = `matchmoji-${VERSION}`;
const FILES = [
  "./",
  "index.html",
  "style.css",
  "manifest.json",
  "favicon.ico",
  "logo/matchmoji-wordmark-gold.svg",
  "js/main.js",
  "js/board.js",
  "js/sfx.js",
  "js/music.js",
  "js/tracks.js",
  "js/storage.js",
  "js/themes.js",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/maskable-512.png",
  "icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(FILES.map((f) => new Request(f, { cache: "no-cache" }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("matchmoji-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(
    // no-cache: am HTTP-Cache von GitHub Pages vorbei immer frisch nachfragen
    fetch(req, { cache: "no-cache" })
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true })
        .then((hit) => hit || (req.mode === "navigate" ? caches.match("index.html") : undefined))
        .then((hit) => hit || Response.error())),
  );
});
