// Service worker mínimo — habilita a instalabilidade PWA no Android/Chrome
// (Chrome só mostra o banner se houver um SW ativo + manifest + ícones).
// Estratégia: network-first com fallback pro shell HTML offline.

const CACHE = "parket-tracking-v3-20260901";
const SHELL = [
  "/",
  "/tracking",
  "/icon-192.png",
  "/icon-512.png",
  "/apple-touch-icon.png",
  "/manifest.webmanifest",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL).catch(() => {})));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  // Só processa GET de mesma origem (deixa Supabase e fontes passarem direto)
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // SPA: HTML sempre fresh (network-first), shell como fallback
  if (req.mode === "navigate" || req.destination === "document") {
    e.respondWith(
      fetch(req)
        .then((r) => {
          caches.open(CACHE).then((c) => c.put(req, r.clone())).catch(() => {});
          return r;
        })
        // Fallback: rota cacheada → shell "/" → resposta 503 sintética.
        // respondWith NUNCA pode receber undefined (vira TypeError "Failed to
        // convert value to 'Response'" e a página não abre — bug 01/09 no
        // /social-selling durante restart do deploy).
        .catch(() =>
          caches.match(req).then((r) =>
            r || caches.match("/").then((shell) =>
              shell || new Response("Offline", { status: 503, headers: { "Content-Type": "text/plain" } })
            )
          )
        )
    );
    return;
  }

  // Assets estáticos: cache-first
  e.respondWith(
    caches.match(req).then((cached) =>
      cached ||
      fetch(req)
        .then((r) => {
          if (r.ok) {
            const copy = r.clone();
            caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          }
          return r;
        })
        // Mesmo motivo do navigate: nunca devolver undefined pro respondWith.
        .catch(() => new Response("Offline", { status: 503, headers: { "Content-Type": "text/plain" } }))
    )
  );
});
