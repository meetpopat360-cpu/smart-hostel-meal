// Service Worker — handles background push notifications
self.addEventListener("push", event => {
  const data = event.data ? event.data.json() : {};
  event.waitUntil(
    self.registration.showNotification(data.title || "Hostel Meals", {
      body:  data.body  || "Don't forget to vote!",
      icon:  "/icon.png",
      badge: "/icon.png",
      tag:   "meal-reminder",
      renotify: true,
      vibrate: [200, 100, 200],
      actions: [{ action: "vote", title: "Vote Now →" }],
      data:  { url: data.url || "/" }
    })
  );
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
      for (const client of list) {
        if (client.url.includes(self.location.origin)) {
          client.focus(); return;
        }
      }
      clients.openWindow(url);
    })
  );
});

self.addEventListener("install",  () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(clients.claim()));
