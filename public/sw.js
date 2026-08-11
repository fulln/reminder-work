self.addEventListener("push", (event) => {
  let notification = {
    title: "Reminder due",
    body: "Open Reminders.work to view and manage it.",
    url: "/",
    tag: "reminders-work",
  };
  try {
    if (event.data) notification = { ...notification, ...event.data.json() };
  } catch {
    // A generic notification is safer than exposing or dropping malformed data.
  }
  event.waitUntil(
    self.registration.showNotification(notification.title, {
      body: notification.body,
      icon: "/favicon.svg",
      badge: "/favicon.svg",
      tag: notification.tag,
      data: { url: notification.url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/", self.location.origin);
  if (target.origin !== self.location.origin) return;
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      const existing = windows.find((client) => client.url === target.href);
      return existing ? existing.focus() : clients.openWindow(target.href);
    }),
  );
});
