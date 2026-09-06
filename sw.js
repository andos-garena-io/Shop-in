/* ANDOS service worker — required for install prompt + standalone launch. Network-first for HTML, cache-first for static assets. */
const VER = 'andos-v3';
const APP_SHELL = ['./', './index.html', './manifest.json'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(VER).then((c) => c.addAll(APP_SHELL)).catch(() => {})); self.skipWaiting(); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VER).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // never cache Firebase / Google auth / Telegram / APIs
  if (/googleapis\.com|firebaseapp\.com|firebaseio\.com|gstatic\.com\/firebasejs|google\.com|api\.telegram\.org|vercel\.app/.test(url.host + url.pathname)) return;
  if (req.mode === 'navigate' || url.pathname.endsWith('.html')) {
    e.respondWith(fetch(req).then((r) => { const cp = r.clone(); caches.open(VER).then((c) => c.put(req, cp)); return r; }).catch(() => caches.match(req).then((m) => m || caches.match('./index.html'))));
    return;
  }
  if (/\.(png|jpe?g|webp|gif|svg|ico|woff2?|ttf|css|js|mp4)$/i.test(url.pathname) || /raw\.githubusercontent\.com|cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com|fonts\./.test(url.host)) {
    e.respondWith(caches.match(req).then((m) => m || fetch(req).then((r) => { if (r && (r.ok || r.type === 'opaque')) { const cp = r.clone(); caches.open(VER).then((c) => c.put(req, cp)); } return r; })));
  }
});
