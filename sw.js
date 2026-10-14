const CACHE_NAME = 'slink-shell-v11';
const APP_SHELL = ['./', './index.html', './styles.css', './app.js', './register-sw.js', './manifest.webmanifest', './assets/slink-icon.svg', './assets/slink-icon-180.png', './assets/slink-icon-192.png', './assets/slink-icon-512.png', './assets/slink-icon-maskable-512.png'];

self.addEventListener('install', function (event) {
  event.waitUntil(caches.open(CACHE_NAME).then(function (cache) { return cache.addAll(APP_SHELL); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (event) {
  event.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (key) { return key !== CACHE_NAME; }).map(function (key) { return caches.delete(key); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (event) {
  const requestUrl = new URL(event.request.url);
  if (event.request.method !== 'GET' || requestUrl.origin !== self.location.origin || requestUrl.pathname.startsWith('/api/') || requestUrl.pathname === '/verify' || requestUrl.searchParams.has('token')) return;
  event.respondWith(caches.match(event.request).then(function (cached) {
    const fresh = fetch(event.request).then(function (response) {
      if (response && response.ok) {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(function (cache) { cache.put(event.request, copy); });
      }
      return response;
    }).catch(function () { return cached; });
    return fresh;
  }));
});
