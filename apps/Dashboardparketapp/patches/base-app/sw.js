// Service worker mínimo — torna a PWA installable.
// Cache de shell pequeno e network-first pra index.html (sempre versão fresca).
const CACHE = "parket-base-v1";
const SHELL = ["/leitor/", "/leitor/index.html", "/leitor/manifest.json"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).catch(()=>{}));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  // Só intercepta GETs dentro do /leitor/
  if (event.request.method !== "GET" || !url.pathname.startsWith("/leitor/")) return;
  // Network-first com fallback ao cache (mantém o app sempre fresco quando online)
  event.respondWith(
    fetch(event.request).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(event.request, copy)).catch(()=>{});
      return res;
    }).catch(() => caches.match(event.request).then(r => r || caches.match("/leitor/index.html")))
  );
});
