const CACHE_NAME = 'roommate-expense-engine-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon.svg'
];

// Handle standard Push API push events (even when app is closed)
self.addEventListener('push', (event) => {
  console.log('[Service Worker] Push event received.');
  let data = {};
  
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      console.warn('[Service Worker] Parsing push event text payload:', e);
      data = { title: '🏠 Roommate Wallet', body: event.data.text() };
    }
  }

  const notificationTitle = data.title || '🏠 Roommate Wallet';
  const notificationOptions = {
    body: data.body || 'New roommate wallet update.',
    icon: '/icon.svg',
    badge: '/icon.svg',
    tag: data.tag || 'webpush-bg-notification',
    data: data.data || {},
    vibrate: [100, 50, 100]
  };

  event.waitUntil(
    self.registration.showNotification(notificationTitle, notificationOptions)
  );
});

// Install service worker and cache base assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Precaching app shell...');
      // Safe individual caching so that a single missing resource doesn't abort service worker installation
      const cachePromises = ASSETS_TO_CACHE.map((url) => {
        return cache.add(url).catch((err) => {
          console.warn(`[Service Worker] Failed to cache asset during install: ${url}`, err);
        });
      });
      return Promise.all(cachePromises);
    }).then(() => self.skipWaiting())
  );
});

// Activate service worker and clear old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('[Service Worker] Clearing old cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Handle browser push subscription rotation
self.addEventListener('pushsubscriptionchange', (event) => {
  console.log('[Service Worker] Push subscription expired or changed. Sync will happen next time client is active.');
});

// Fetch network first, fallback to offline cache for assets
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  // Do not intercept Firebase or Firestore calls
  if (url.origin.includes('firestore.googleapis.com') || url.origin.includes('firebase') || url.pathname.includes('fcm')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.status === 200 && response.type === 'basic') {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => {
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          if (event.request.headers.get('accept')?.includes('text/html')) {
            return caches.match('/');
          }
        });
      })
  );
});

// Handle notification tap to open app and route to actions
self.addEventListener('notificationclick', (event) => {
  console.log('[Service Worker] Notification click Received.', event.notification.data);
  event.notification.close();

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Find if any window is already open
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if ('focus' in client) {
          // Post message to client to handle dynamic screen routing
          if (event.notification.data) {
            client.postMessage({
              type: 'ROUTE_TO_ACTION',
              data: event.notification.data
            });
          }
          return client.focus();
        }
      }
      
      // If no window is open, open a new window at root
      if (clients.openWindow) {
        // Encode deep link route parameters if available
        let url = '/';
        if (event.notification.data && event.notification.data.actionType) {
          url = `/?actionType=${encodeURIComponent(event.notification.data.actionType)}`;
        }
        return clients.openWindow(url);
      }
    })
  );
});
