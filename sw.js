// Installable + works offline with the last briefing. Network-first for everything, so a new
// day's data or a new build shows as soon as there's signal. Bump CACHE when shipping a new shell.
const CACHE = "brief-v7";   // v7: savings saved in the panel, no emergency buffer
const SHELL = ["./", "./index.html", "./app.css", "./tokens.css", "./app.js", "./manifest.json", "./push-config.js", "./sizing.js", "./lock.js",
               "./icon.svg", "./icon-180.png", "./icon-192.png", "./icon-512.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin) return;
  e.respondWith(
    fetch(new Request(req, { cache: "no-store" }))
      .then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
        return res;
      })
      .catch(() => caches.match(req).then((hit) => hit || caches.match("./index.html")))
  );
});

// ---------- push notifications ----------
// iOS subscribes with userVisibleOnly:true — every push MUST show a notification, or iOS revokes the
// subscription. So even a malformed payload gets a fallback card.
self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) { d = { body: e.data ? e.data.text() : "" }; }
  e.waitUntil(self.registration.showNotification(d.title || "Market briefing", {
    body: d.body || "",
    tag: d.tag || "briefing",
    icon: "./icon-192.png",
    badge: "./icon-192.png",
    data: { url: d.url || "./" },
  }));
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const target = new URL((e.notification.data && e.notification.data.url) || "./", self.location.href).href;
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
    for (const c of list) {
      if (c.url.startsWith(self.registration.scope) && "focus" in c) { c.navigate(target); return c.focus(); }
    }
    return self.clients.openWindow(target);
  }));
});
