/**
 * Personal Finance Tracker PWA - Service Worker
 * Implements StaleWhileRevalidate for app shell, CacheFirst for static assets,
 * and Background Sync queue for offline expense logging.
 */

const CACHE_NAME = 'sbafa-v1.9.0';
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/design-tokens.css',
  './css/base.css',
  './css/components.css',
  './css/views.css',
  './js/app.js',
  './js/db.js',
  './js/auth.js',
  './js/pwa.js',
  './js/parsers/bank-parser.js',
  './js/parsers/categorizer.js',
  './js/parsers/pdf-parser.js',
  './js/services/setu-aa.js',
  './js/views/landing.js',
  './js/views/dashboard.js',
  './js/views/transactions.js',
  './js/views/add-expense.js',
  './js/views/accounts.js',
  './js/views/budgets.js',
  './js/views/login.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './icons/add-icon.png',
  './icons/icon.svg'
];

// External vendor libraries (Dexie.js, PapaParse, Chart.js, PDF.js, Google GSI) cached with CacheFirst
const VENDOR_URLS = [
  'https://cdn.jsdelivr.net/npm/dexie@3.2.4/dist/dexie.min.js',
  'https://cdn.jsdelivr.net/npm/papaparse@5.4.1/papaparse.min.js',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.2/dist/chart.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js',
  'https://accounts.google.com/gsi/client'
];

// Install Event: Pre-cache app shell and core assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Add local assets
      await cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('Some local assets failed to pre-cache during install:', err);
      });
      // Try pre-caching vendor assets if network available
      for (const url of VENDOR_URLS) {
        try {
          const response = await fetch(url, { mode: 'cors' });
          if (response.ok) {
            await cache.put(url, response);
          }
        } catch (e) {
          console.warn('Vendor asset pre-cache deferred:', url);
        }
      }
    })
  );
  self.skipWaiting();
});

// Activate Event: Cleanup stale caches and claim clients
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch Event: Implement StaleWhileRevalidate and CacheFirst
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Ignore non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Handle Chrome extension schemes or other unsupported protocols
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // 1. Vendor CDNs, Fonts & Versioned Assets -> CacheFirst
  if (
    url.hostname.includes('cdn.jsdelivr.net') ||
    url.hostname.includes('fonts.googleapis.com') ||
    url.hostname.includes('fonts.gstatic.com') ||
    request.destination === 'font' ||
    request.destination === 'image'
  ) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return networkResponse;
        }).catch(() => {
          // Fallback if offline
          return caches.match('./icons/icon-192.png');
        });
      })
    );
    return;
  }

  // 2. Financial API Data -> NetworkFirst
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return networkResponse;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // 3. HTML Shell / App Navigation & Core Local Assets -> StaleWhileRevalidate
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});

// Background Sync Listener
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-transactions') {
    event.waitUntil(
      // Broadcast to active clients to drain the Dexie offline queue
      self.clients.matchAll({ includeUncontrolled: true, type: 'window' }).then((clients) => {
        clients.forEach((client) => {
          client.postMessage({
            type: 'TRIGGER_OFFLINE_SYNC',
            timestamp: Date.now()
          });
        });
      })
    );
  }
});
