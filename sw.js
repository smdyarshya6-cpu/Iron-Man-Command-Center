// Iron Man service worker — v13
// Strategy: network-first for the app's own files (so updates always show up),
// with a cache fallback so the app still opens offline.

const CACHE_NAME = 'ironman-pwa-v13';

const CORE_ASSETS = [
  './',
  './index.html',
  './styles.css?v=10',
  './app.js?v=10',
  './manifest.webmanifest'
];

const OPTIONAL_ASSETS = [
  './icons/icon-192.png?v=10',
  './icons/icon-512.png?v=10',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png?v=10',
  './icons/favicon-64.png?v=10'
];

const NETWORK_TIMEOUT_MS = 5000;

// We own every notification click (including Firebase ones) so that a click
// never opens duplicate windows. Registered before Firebase is imported.
self.addEventListener('notificationclick', event => {
  event.stopImmediatePropagation();
  event.notification.close();

  const data = event.notification.data || {};
  const fcm = data.FCM_MSG || {};

  const requestedTarget =
    data.url ||
    (fcm.fcmOptions && fcm.fcmOptions.link) ||
    (fcm.notification && fcm.notification.click_action) ||
    './';

  event.waitUntil((async () => {
    let targetUrl;

    try {
      targetUrl = new URL(requestedTarget, self.registration.scope);
    } catch (error) {
      targetUrl = new URL(self.registration.scope);
    }

    // Notifications must never navigate the user to an external origin.
    if (targetUrl.origin !== self.location.origin) {
      targetUrl = new URL(self.registration.scope);
    }

    const windows = await clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    });

    for (const client of windows) {
      if (new URL(client.url).origin !== self.location.origin) continue;

      // Avoid reloading the app (and losing state) if it is already there.
      if ('navigate' in client && client.url !== targetUrl.href) {
        try {
          await client.navigate(targetUrl.href);
        } catch (error) {
          console.warn('Iron Man could not navigate the existing window:', error);
        }
      }

      if ('focus' in client) {
        try {
          return await client.focus();
        } catch (error) {
          console.warn('Iron Man could not focus the existing window:', error);
        }
      }
    }

    if (clients.openWindow) {
      return clients.openWindow(targetUrl.href);
    }
  })());
});

// Firebase is optional for the core Service Worker. If its CDN is unavailable
// (or blocked), the PWA shell and local notifications still work.
try {
  importScripts('https://www.gstatic.com/firebasejs/13.0.0/firebase-app-compat.js');
  importScripts('https://www.gstatic.com/firebasejs/13.0.0/firebase-messaging-compat.js');

  if (self.firebase && typeof firebase.messaging === 'function') {
    if (!firebase.apps.length) {
      firebase.initializeApp({
        apiKey: 'AIzaSyBXfTGg2JB6hLCy78WEC0aNOAuXMqg7CV4',
        authDomain: 'loki-2d9d9.firebaseapp.com',
        projectId: 'loki-2d9d9',
        storageBucket: 'loki-2d9d9.firebasestorage.app',
        messagingSenderId: '890801691330',
        appId: '1:890801691330:web:56ecdcbf0138cd851bb95b',
        measurementId: 'G-GGTVKG9CNP'
      });
    }

    const lokiMessaging = firebase.messaging();

    lokiMessaging.onBackgroundMessage(payload => {
      // FCM automatically displays notification payloads.
      // Display only data-only messages here to avoid duplicates.
      if (payload && payload.notification) return;

      const title = (payload && payload.data && payload.data.title) || 'Iron Man';
      const body =
        (payload && payload.data && payload.data.body) ||
        'You have a new notification.';

      self.registration.showNotification(title, {
        body,
        icon: './icons/icon-192.png',
        badge: './icons/icon-192.png',
        data: { url: './' }
      });
    });
  }
} catch (error) {
  console.error('Iron Man Firebase messaging is unavailable in this Service Worker:', error);
}

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(CORE_ASSETS);

    await Promise.allSettled(
      OPTIONAL_ASSETS.map(asset => cache.add(asset))
    );

    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys
        .filter(key => (key.startsWith('loki-pwa-') || key.startsWith('ironman-pwa-')) && key !== CACHE_NAME)
        .map(key => caches.delete(key))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;

  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Let the browser handle Firebase, fonts and any other cross-origin request.
  if (url.origin !== self.location.origin) return;

  event.respondWith((async () => {
    const network = fetch(request).then(response => {
      if (response && response.ok) {
        const copy = response.clone();
        caches.open(CACHE_NAME)
          .then(cache => cache.put(request, copy))
          .catch(() => {});
      }

      return response;
    });

    network.catch(() => {});

    try {
      return await Promise.race([
        network,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), NETWORK_TIMEOUT_MS)
        )
      ]);
    } catch (error) {
      const cached = await caches.match(request);
      if (cached) return cached;

      if (request.mode === 'navigate') {
        const shell =
          (await caches.match('./index.html')) || (await caches.match('./'));
        if (shell) return shell;
      }

      return network;
    }
  })());
});
