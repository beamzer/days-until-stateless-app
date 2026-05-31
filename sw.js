const VERSION = 'v11';
const CACHE = `days-until-${VERSION}`;
const ASSETS = [
  './',
  './index.html',
  './app.js',
  './style.css',
  './favicon.ico',
  './apple-touch-icon.png',
  './apple-touch-icon-precomposed.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon-180.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;
  const isNav = e.request.mode === 'navigate';
  e.respondWith(
    caches.match(e.request, { ignoreSearch: isNav }).then((cached) => {
      if (cached) return cached;
      return fetch(e.request).then((res) => {
        // Don't cache navigation responses — each ?d=... is a unique URL but
        // serves identical HTML; caching them all would bloat storage.
        if (!isNav && res.ok && e.request.method === 'GET') {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return res;
      }).catch(() => cached);
    })
  );
});
