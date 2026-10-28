// Service worker de Tareas del equipo: recibe los avisos push y los muestra.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) { d = { title: "Nueva tarea", body: e.data ? e.data.text() : "" }; }
  const title = d.title || "Nueva tarea";
  const opts = {
    body: d.body || "",
    icon: "icon-192.png",
    badge: "badge-96.png",
    tag: d.tag || "tarea",
    renotify: true,
    vibrate: [200, 100, 200],
    data: { fecha: d.fecha || "" },
  };
  e.waitUntil((async () => {
    await self.registration.showNotification(title, opts);
    const cs = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    cs.forEach((c) => c.postMessage({ tipo: "tarea-nueva" }));
  })());
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const fecha = (e.notification.data && e.notification.data.fecha) || "";
  const url = new URL("./" + (fecha ? "?dia=" + fecha : ""), self.registration.scope).href;
  e.waitUntil((async () => {
    const cs = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of cs) {
      if ("focus" in c) {
        c.postMessage({ tipo: "abrir-dia", fecha });
        return c.focus();
      }
    }
    return self.clients.openWindow(url);
  })());
});
