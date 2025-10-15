self.addEventListener('push', function(event) {
  event.waitUntil((async () => {
    try {
      const data = event.data ? event.data.json() : {};
      const title = data.title || 'Notificação';

      // Tentar usar ícones dedicados; se não existirem, cair no fallback
      async function pickIcon(path, fallback) {
        try { const resp = await fetch(path, { method: 'HEAD' }); return resp.ok ? path : fallback; } catch { return fallback; }
      }
      const iconPath = data.icon || await pickIcon('/icons/icon-192.png', '/images/LC1_Azul.png');
      const badgePath = data.badge || await pickIcon('/icons/badge-72.png', '/images/LC1_Azul.png');

      const options = {
        body: data.body || '',
        icon: iconPath,
        badge: badgePath,
        data: { url: data.url || '/' },
        vibrate: [100, 50, 100]
      };
      await self.registration.showNotification(title, options);
    } catch (e) {
      // Fallback: se não for JSON
      await self.registration.showNotification('Notificação', { body: event.data && event.data.text() });
    }
  })());
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  const url = (event.notification && event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(windowClients => {
      for (const client of windowClients) {
        if (client.url.includes(url) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});

