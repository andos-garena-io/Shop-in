/* =========================================================
   ANDOS PWA — Service Worker (sw.js)  v3
   Pre-caches core media for instant offline loading.
   SB18 bumps the cache so profile/gallery and support UI updates
   cannot remain trapped behind an older offline shell.
   ========================================================= */

const CACHE_VERSION = 'andos-cache-v3';

const CORE_ASSETS = [
  './',
  './index.html',
  './support.html',
  './manifest.json'
];

// Heavy media — pre-cache for zero data on repeat visits
const MEDIA_ASSETS = [
  'assets/videos/splash-loading.mp4',
  'assets/videos/samurai-hero-loop1.mp4',
  'assets/videos/samurai-hero-loop3.mp4',
  'assets/photos/1000043546.webp'
];

const CACHEABLE_HOSTS = [
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'cdnjs.cloudflare.com'
];

const NETWORK_ONLY_PATTERNS = [
  'firebaseio.com',
  'firebasestorage.googleapis.com',
  'gstatic.com/firebasejs',
  'accounts.google.com',
  'googleapis.com/identitytoolkit'
];

/* ---- INSTALL: precache core + best-effort media ---- */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) =>
      cache.addAll(CORE_ASSETS).then(() =>
        Promise.allSettled(MEDIA_ASSETS.map((u) => cache.add(u).catch(() => {})))
      )
    ).then(() => self.skipWaiting())
  );
});

/* ---- ACTIVATE: purge old caches ---- */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* ---- FETCH ---- */
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Navigations: network first, offline fallback to shell
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put('./index.html', copy));
          return res;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Auth / realtime: always network
  if (NETWORK_ONLY_PATTERNS.some((p) => (url.hostname + url.pathname).includes(p))) return;

  // Same-origin media & statics: cache-first (instant repeat loads)
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(req).then((hit) => {
        if (hit) return hit;
        return fetch(req).then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(req, copy));
          }
          return res;
        });
      })
    );
    return;
  }

  // Whitelisted CDNs: stale-while-revalidate
  if (CACHEABLE_HOSTS.includes(url.hostname)) {
    event.respondWith(
      caches.match(req).then((cached) => {
        const fetched = fetch(req).then((res) => {
          if (res && (res.ok || res.type === 'opaque')) {
            const copy = res.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(req, copy));
          }
          return res;
        }).catch(() => cached);
        return cached || fetched;
      })
    );
  }
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});
