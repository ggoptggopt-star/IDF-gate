// Service Worker for Smart Gate Pass AI - Web Push & Notification Handler
// วิทยาลัยการอาชีพองครักษ์ (OICEC)

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Handle incoming Web Push notifications
self.addEventListener('push', (event) => {
  let data = {
    title: '🔔 แจ้งเตือน: ระบบขออนุญาตออกนอกวิทยาลัย',
    body: 'มีรายการคำร้องใหม่ กรุณาตรวจสอบในระบบ',
    url: '/chat',
    tag: 'smart-gate-notification',
  };

  if (event.data) {
    try {
      const parsed = event.data.json();
      data = { ...data, ...parsed };
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: '/icon.png',
    badge: '/icon.png',
    vibrate: [250, 100, 250, 100, 250],
    tag: data.tag || `req-${Date.now()}`,
    renotify: true,
    data: {
      url: data.url || '/chat',
    },
    actions: [
      { action: 'open', title: 'เปิดดูทันที' },
    ],
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

// Handle clicking on the notification
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/chat';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Focus open window if available
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          if ('navigate' in client && client.url && !client.url.includes(targetUrl)) {
            return client.navigate(targetUrl);
          }
          return;
        }
      }
      // Otherwise open new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
