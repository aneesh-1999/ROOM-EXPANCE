importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

const CACHE_NAME = 'roommate-expense-engine-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon.svg'
];

// Initialize Firebase inside Service Worker
firebase.initializeApp({
  apiKey: "AIzaSyBvkho7Qq_rmR5KUT-fH_g6zMtFaJxmoT0",
  authDomain: "ai-studio-applet-webapp-de5cb.firebaseapp.com",
  projectId: "ai-studio-applet-webapp-de5cb",
  storageBucket: "ai-studio-applet-webapp-de5cb.firebasestorage.app",
  messagingSenderId: "466782740690",
  appId: "1:466782740690:web:e92852494f27b74b978d0b"
});

const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('[Service Worker] Received background message: ', payload);
  
  const notificationTitle = payload.notification?.title || payload.data?.title || '🏠 Roommate Wallet';
  const notificationOptions = {
    body: payload.notification?.body || payload.data?.body || 'New update in your roommate wallet.',
    icon: '/icon.svg',
    badge: '/icon.svg',
    tag: payload.data?.tag || payload.notification?.tag || 'fcm-bg-notification',
    data: payload.data || {}
  };

  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Install service worker and cache base assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Precaching app shell...');
      return cache.addAll(ASSETS_TO_CACHE);
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
