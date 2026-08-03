self.addEventListener("push", (event) => {
  let data = {};

  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }

  const title = data.title || "Casa Forte";
  const options = {
    body: data.body || "Você tem um lugar aqui.",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    tag: data.tag || "casa-forte",
    renotify: false,
    data: { url: data.url || "/familia" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = new URL(
    event.notification.data?.url || "/familia",
    self.location.origin,
  ).href;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(
      (clients) => {
        const existing = clients.find((client) => client.url === targetUrl);
        if (existing && "focus" in existing) return existing.focus();
        return self.clients.openWindow(targetUrl);
      },
    ),
  );
});
