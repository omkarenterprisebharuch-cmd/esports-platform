// Service Worker for Push Notifications
// This file must be in the public folder to be accessible

const SW_VERSION = '1.0.0';

// Install event - cache resources if needed
self.addEventListener('install', (event) => {
  console.log('[SW] Service Worker installed, version:', SW_VERSION);
  // Skip waiting to activate immediately
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Service Worker activated');
  // Take control of all pages immediately
  event.waitUntil(self.clients.claim());
});

// Push event - handle incoming push notifications
self.addEventListener('push', (event) => {
  console.log('[SW] Push notification received');

  if (!event.data) {
    console.log('[SW] No data in push notification');
    return;
  }

  let data;
  try {
    data = event.data.json();
  } catch (e) {
    console.error('[SW] Failed to parse push data:', e);
    data = {
      title: 'Notification',
      body: event.data.text(),
    };
  }

  const options = {
    body: data.body || '',
    icon: data.icon || '/favicon.ico',
    badge: data.badge || '/favicon.ico',
    image: data.image,
    tag: data.tag || 'default',
    renotify: data.renotify || false,
    requireInteraction: data.requireInteraction || false,
    silent: data.silent || false,
    vibrate: data.vibrate || [200, 100, 200],
    data: {
      url: data.url || '/',
      tournamentId: data.tournamentId,
      type: data.type,
      ...(data.data || {}),
    },
    actions: data.actions || [],
  };

  const title = data.title || 'Esports Platform';

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Notification click event - handle user clicking on notification
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event.notification.tag);

  event.notification.close();

  const urlToOpen = event.notification.data?.url || '/';

  // Handle action button clicks
  if (event.action) {
    console.log('[SW] Action clicked:', event.action);
    switch (event.action) {
      case 'view':
        break;
      case 'dismiss':
        return;
      default:
        break;
    }
  }

  // Open or focus the app window
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(urlToOpen);
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(urlToOpen);
      }
    })
  );
});

// Notification close event
self.addEventListener('notificationclose', (event) => {
  console.log('[SW] Notification closed:', event.notification.tag);
});

// Helper function to convert VAPID key
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
