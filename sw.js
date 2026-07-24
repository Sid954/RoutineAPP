/**
 * Service Worker — Handles caching, offline support, and notification events.
 */
const CACHE_VERSION = 'routine-cache-1784952452426';
const STATIC_ASSETS = [
  './',
  './index.html',
  './src/main.css',
  './src/main.js',
  './manifest.json',
  './schedule.json',
  './icon-192.png',
  './icon-512.png'
];

/* ── Install: Pre-cache static assets ── */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then(cache => cache.addAll(STATIC_ASSETS).catch(err => {
        console.warn('Cache pre-load skipped for some files:', err);
      }))
  );
});

/* ── Activate: Clean up old cache versions ── */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(key => key !== CACHE_VERSION).map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

/* ── Fetch: Stale-while-revalidate for static, network-first for JSON ── */
self.addEventListener('fetch', event => {
  const url = event.request.url;

  // Only handle same-origin requests
  if (!url.startsWith(self.location.origin)) return;

  // Network-first for JSON data (schedule updates must be fresh)
  if (url.endsWith('.json')) {
    event.respondWith(networkFirst(event.request));
    return;
  }

  // Network-first for all assets (ensures fresh content after updates)
  event.respondWith(networkFirst(event.request));
});

/**
 * Network-first strategy: try network, fallback to cache.
 */
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      const cache = await caches.open(CACHE_VERSION);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return caches.match(request);
  }
}

/**
 * Stale-while-revalidate: serve from cache immediately, update cache in background.
 */
async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_VERSION);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request).then(response => {
    if (response && response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  }).catch(() => null);

  return cached || fetchPromise;
}

/* ── Notification Click: Focus or open the app ── */
self.addEventListener('notificationclick', event => {
  event.notification.close();

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(clients => {
        const appClient = clients.find(c => c.url.includes('index.html') || c.url.endsWith('/'));
        if (appClient) {
          return appClient.focus();
        }
        return self.clients.openWindow('./');
      })
  );
});

/* ── Message: Force activation of waiting service worker ── */
self.addEventListener('message', event => {
  if (event.data && event.data.action === 'skipWaiting') {
    self.skipWaiting();
  }
});