const CACHE = "tea-leaf-pos-v6";
const ASSETS = ["./", "./index.html", "./styles.css", "./manifest.json", "./app.js", "./nexora-logo.png", "./logo-header.png", "./favicon.png", "./icon-192.png", "./icon-512.png", "./apple-touch-icon.png"];
// Third-party libraries (pinned versions) kept locally so the app can start with no signal.
const CDN_ASSETS = [
  "https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js",
  "https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js",
  "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js",
  "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js",
  "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js"
];
const isCdn = url =>
  (url.hostname === "www.gstatic.com" && url.pathname.startsWith("/firebasejs/")) ||
  url.hostname === "cdnjs.cloudflare.com" || url.hostname === "unpkg.com";

self.addEventListener("install", event => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then(async cache => {
    await cache.addAll(ASSETS);
    await Promise.allSettled(CDN_ASSETS.map(u => fetch(u, { mode: "cors" }).then(r => r.ok ? cache.put(u, r) : null)));
  }));
});

self.addEventListener("activate", event => event.waitUntil(
  caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())
));

// The page sends the CDN files it loaded (including Firebase's internal modules) so they are stored too.
self.addEventListener("message", event => {
  if (event.data && event.data.type === "CACHE_URLS") {
    const urls = (event.data.urls || []).filter(u => { try { return isCdn(new URL(u)); } catch { return false; } });
    event.waitUntil(caches.open(CACHE).then(cache => Promise.all(urls.map(async u => {
      if (await cache.match(u, { ignoreVary: true })) return;
      try { const r = await fetch(u, { mode: "cors" }); if (r.ok) await cache.put(u, r); } catch {}
    }))));
  }
});

self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // App files: show the saved copy immediately (works with no/weak signal), refresh it in the background.
  if (url.origin === self.location.origin) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const cached = await cache.match(req, { ignoreSearch: true, ignoreVary: true });
      const network = fetch(req).then(res => {
        if (res.ok && !res.redirected) cache.put(req, res.clone());
        return res;
      }).catch(() => null);
      if (cached) { event.waitUntil(network); return cached; }
      const res = await network;
      if (res) return res;
      if (req.mode === "navigate") { const shell = await cache.match("./index.html"); if (shell) return shell; }
      return Response.error();
    })());
    return;
  }

  // Pinned CDN libraries: cache first.
  if (isCdn(url)) {
    event.respondWith(caches.open(CACHE).then(async cache => {
      const hit = await cache.match(req, { ignoreVary: true });
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok || res.type === "opaque") cache.put(req, res.clone());
      return res;
    }));
  }
  // Firestore / Auth API calls are NOT intercepted: business data is never stored by this service worker
  // (Firestore keeps its own local copy for offline use).
});
