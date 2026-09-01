/* Elite Life OS service worker.
 *
 * Deliberately small. It exists to make the app installable, to keep the shell
 * available offline, and to own alarm notifications so they can be shown on
 * Android (where `new Notification()` from a page is not allowed).
 *
 * It does NOT promise background alarm scheduling. No cross-browser API can
 * wake a stopped service worker at a wall-clock time, so the app is honest
 * about that in Settings → Alarms instead of pretending here.
 */

const CACHE = "life-os-v1";
const SHELL = ["/life", "/life-icon.svg", "/life-manifest.webmanifest"];

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

/* Network first: the app is data-light and must never boot a stale build.
   The cache is only a fallback for a dead connection. */
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;

  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok && req.mode === "navigate") {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => undefined);
        }
        return res;
      })
      .catch(() => caches.match(req).then((hit) => hit || caches.match("/life"))),
  );
});

self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type === "LIFE_NOTIFY") {
    self.registration.showNotification(data.title || "Elite Life OS", {
      body: data.body || "",
      tag: data.tag || "life-alarm",
      icon: "/life-icon.svg",
      badge: "/life-icon.svg",
      requireInteraction: true,
      data: { url: data.url || "/life" },
    });
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/life";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes("/life") && "focus" in client) return client.focus();
      }
      return self.clients.openWindow(url);
    }),
  );
});
