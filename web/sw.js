/* Keeps the worker app usable with no internet: the screens load from the phone,
   and SOS messages wait in the app until the connection returns. */
const CACHE = "thc-v4";
const FILES = ["./", "index.html", "centre.html", "styles.css", "config.js", "api.js", "demo-data.js", "manifest.json", "manifest-centre.json", "icon-192.png", "icon-512.png", "icon-centre-192.png", "icon-centre-512.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) {
    // fonts: cache after first use; everything else (database, maps) goes to the network
    if (url.hostname.endsWith("fonts.googleapis.com") || url.hostname.endsWith("fonts.gstatic.com")) {
      e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); return res; })));
    }
    return;
  }
  // own files: network first so updates arrive, cache when offline
  e.respondWith(fetch(req).then(res => { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); return res; })
    .catch(() => caches.match(req).then(hit => hit || caches.match("index.html"))));
});
