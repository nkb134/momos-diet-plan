/* Offline support: precache the shell, cache visited pages and assets.
   HTML is network-first with cache fallback; hashed assets and images are
   cache-first. Scope-relative so it works under the GitHub Pages base path. */
const VERSION = 'v1';
const SHELL = ['./', './library/', './search.json', './manifest.webmanifest', './favicon.svg'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL).catch(() => {})).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return; // never cache YouTube or fonts from elsewhere
  const isHTML = req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html');
  if (isHTML) {
    e.respondWith(fetch(req).then((res) => { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); return res; })
      .catch(() => caches.match(req).then((r) => r || caches.match('./'))));
    return;
  }
  e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => {
    if (res.ok && (url.pathname.includes('/_astro/') || /\.(json|svg|webmanifest)$/.test(url.pathname))) {
      const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy));
    }
    return res;
  })));
});
