// Parket Fiscal — Service Worker mínimo.
// Estratégia: network-first pra HTML/JS (sempre versão fresca quando online),
// cache-first pra ícones. Permite PWA instalável.
const CACHE = "parket-fiscal-v2";
const SHELL = ["/", "/index.html", "/manifest.json"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE).map(k => caches.delete(k))
    ))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Network-first pra HTML; fallback ao cache se offline.
  if (req.mode === "navigate" || url.pathname.endsWith(".html") || url.pathname === "/") {
    event.respondWith(
      fetch(req).then(r => {
        const copy = r.clone();
        caches.open(CACHE).then(c => c.put(req, copy)).catch(()=>{});
        return r;
      }).catch(() => caches.match(req).then(r => r || caches.match("/")))
    );
    return;
  }

  // Cache-first pra assets (icones)
  if (/\.(png|jpg|jpeg|gif|ico|svg|woff|woff2)$/i.test(url.pathname)) {
    event.respondWith(
      caches.match(req).then(r => r || fetch(req).then(rr => {
        const copy = rr.clone();
        caches.open(CACHE).then(c => c.put(req, copy)).catch(()=>{});
        return rr;
      }))
    );
  }
});
