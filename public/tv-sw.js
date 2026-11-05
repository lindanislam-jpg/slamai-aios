/* SlamAI TV service worker.
 *
 * Small on purpose. It exists to make the app installable and to keep the shell
 * reachable on a flaky connection. It deliberately never caches playlists,
 * manifests or video segments: live TV cached is live TV broken, and a cached
 * 10 MB playlist would fill the quota in a day.
 */

const CACHE = "slamai-tv-v1";
const SHELL = ["/tv", "/tv-icon.svg", "/tv-manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL).catch(() => undefined))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  /* Never touch streams or playlist data. */
  if (url.pathname.startsWith("/api/tv/")) return;

  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok && req.mode === "navigate") {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => undefined);
        }
        return res;
      })
      .catch(() => caches.match(req).then((hit) => hit || caches.match("/tv"))),
  );
});
