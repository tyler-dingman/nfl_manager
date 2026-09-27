/* Push-only worker: deliberately does not intercept or cache application requests. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    /* Display a safe fallback. */
  }
  event.waitUntil(
    self.registration.showNotification(payload.title || 'Down & Distance', {
      body: payload.body || 'You have a new update.',
      data: { destination: payload.destination || '/' },
    }),
  );
});
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    (async () => {
      let destination = new URL('/', self.location.origin);
      try {
        const candidate = new URL(
          event.notification.data?.destination || '/',
          self.location.origin,
        );
        if (candidate.origin === self.location.origin) destination = candidate;
      } catch {
        /* Fall back to the homepage. */
      }
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of windows) {
        if (new URL(client.url).origin === destination.origin) {
          const navigated = await client.navigate(destination.href);
          if (navigated) return navigated.focus();
        }
      }
      return self.clients.openWindow(destination.href);
    })(),
  );
});
