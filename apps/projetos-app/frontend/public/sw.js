/* Service Worker do projetos.parket.works — só web push notifications.
   Sem cache offline (o app tá sempre online). */
self.addEventListener("install",  (e) => { self.skipWaiting(); });
self.addEventListener("activate", (e) => { e.waitUntil(self.clients.claim()); });

self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { body: event.data && event.data.text() }; }
  const title = data.title || "Parket Projetos";
  const opts = {
    body: data.body || "",
    tag:  data.tag  || "projetos",
    renotify: true,
    icon: "/favicon.svg",
    badge: "/favicon.svg",
    data: { url: data.url || "/" },
  };
  event.waitUntil(self.registration.showNotification(title, opts));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil((async () => {
    const clientsArr = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of clientsArr) {
      if (c.url.includes(self.location.origin)) {
        c.focus();
        c.navigate && c.navigate(url);
        return;
      }
    }
    await self.clients.openWindow(url);
  })());
});
