// Asbuilt service worker — keeps the app usable on site with weak or no signal.
// - Built assets (/_next/static, icons, fonts): cache first (they are content-hashed)
// - Pages: network first, fall back to the last cached copy, then to /offline
// - Supabase and other cross-origin requests are never cached (data sync is handled
//   by the outbox in src/lib/collection.ts)
const VERSION = "asbuilt-v1";
const STATIC = `${VERSION}-static`;
const PAGES = `${VERSION}-pages`;
const PRECACHE = ["/offline", "/m", "/icon.svg", "/icon-192.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(PAGES)
      .then((c) => c.addAll(PRECACHE))
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

const isStatic = (url) => url.pathname.startsWith("/_next/static/") || /\.(?:png|svg|ico|woff2?|webp|jpg)$/.test(url.pathname);

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/auth/")) return;

  if (isStatic(url)) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) caches.open(STATIC).then((c) => c.put(req, res.clone()));
            return res;
          }),
      ),
    );
    return;
  }

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) caches.open(PAGES).then((c) => c.put(req, res.clone()));
          return res;
        })
        .catch(() => caches.match(req).then((hit) => hit || caches.match("/offline"))),
    );
  }
});
