/* RIBACOM Web Push Service Worker */
self.addEventListener('push', event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (_) { data = { body: event.data ? event.data.text() : '' }; }
  const title = data.title || 'RIBACOM Update';
  const options = {
    body: data.body || data.message || 'There is a new update from RIBACOM.',
    icon: '/ribacom-official-logo.svg',
    badge: '/ribacom-official-logo.svg',
    data: { url: data.url || '/?view=notifications' },
    tag: data.tag || 'ribacom-update',
    renotify: false
  };
  event.waitUntil(self.registration.showNotification(title, options));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = event.notification.data && event.notification.data.url || '/?view=notifications';
  event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const client of list) {
      if ('focus' in client) {
        if ('navigate' in client) client.navigate(target);
        return client.focus();
      }
    }
    return clients.openWindow(target);
  }));
});