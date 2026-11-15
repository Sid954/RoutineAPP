/**
 * Service Worker — Handles caching, offline support, and notification events.
 */
const CACHE_VERSION = 'routine-cache-1787997513212';
const IMAGE_CACHE = 'routine-images-v1';
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
  self.skipWaiting();
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
        keys.filter(key => key !== CACHE_VERSION && key !== IMAGE_CACHE).map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

/* ── Fetch: Cache-first for images, Network-first for app data ── */
self.addEventListener('fetch', event => {
  const url = event.request.url;

  // 1. Intercept image requests (same-origin and external faculty photos)
  if (
    event.request.destination === 'image' ||
    /\.(jpe?g|png|webp|gif|svg)(\?.*)?$/i.test(url) ||
    url.includes('admin.puc.ac.bd')
  ) {
    event.respondWith(cacheFirstImage(event.request));
    return;
  }

  // Only handle same-origin requests for non-image assets
  if (!url.startsWith(self.location.origin)) return;

  // Network-first for JSON data (schedule updates must be fresh)
  if (url.endsWith('.json')) {
    event.respondWith(networkFirst(event.request));
    return;
  }

  // Network-first for all assets (ensures fresh content after updates)
  event.respondWith(networkFirst(event.request));
});

// The image cache survives app updates on purpose (offline faculty photos), so it needs
// its own bound. Opaque cross-origin responses are padded to ~7MB each toward quota in
// Chromium, so an unbounded cache can exhaust storage. Oldest entries are evicted first.
const MAX_IMAGE_ENTRIES = 120;

async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length <= maxEntries) return;
  await Promise.all(keys.slice(0, keys.length - maxEntries).map(k => cache.delete(k)));
}

/**
 * Cache-first strategy for images: serve instantly from cache, fetch & cache in background.
 */
async function cacheFirstImage(request) {
  const cache = await caches.open(IMAGE_CACHE);
  const cached = await cache.match(request);
  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(request);
    if (response && (response.ok || response.type === 'opaque')) {
      cache.put(request, response.clone()).then(() => trimCache(IMAGE_CACHE, MAX_IMAGE_ENTRIES)).catch(() => {});
    }
    return response;
  } catch (err) {
    return cached || new Response('', { status: 408, statusText: 'Image Request Timeout' });
  }
}

/**
 * Cache key without the `t` cache-busting param. The app appends `?t=Date.now()` to
 * config/routine fetches; keyed raw, every launch added a new never-matching entry
 * (unbounded growth) and offline lookups always missed.
 */
function cacheKeyFor(request) {
  const url = new URL(request.url);
  if (!url.searchParams.has('t')) return request;
  url.searchParams.delete('t');
  return url.toString();
}

/**
 * Network-first strategy: try network, fallback to cache.
 */
async function networkFirst(request) {
  const key = cacheKeyFor(request);
  try {
    const response = await fetch(request);
    if (response && response.status === 200 && request.method === 'GET') {
      try {
        const cache = await caches.open(CACHE_VERSION);
        await cache.put(key, response.clone());
      } catch (cacheErr) {
        // Caching errors must not break response delivery
      }
    }
    return response;
  } catch (err) {
    const cached = await caches.match(key);
    if (cached) {
      return cached;
    }
    return new Response('Network error and no cache match', {
      status: 503,
      statusText: 'Service Unavailable',
      headers: { 'Content-Type': 'text/plain' }
    });
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