/* Offline support: cache the app shell so the app works without a connection. */
const CACHE = 'lamp-and-path-v2';
const ASSETS = [
  './', './index.html', './css/styles.css', './manifest.webmanifest', './icons/icon.svg',
  './js/data/journey.js', './js/data/library.js', './js/core.js', './js/bible.js', './js/game.js',
  './js/reader.js', './js/praylist.js', './js/app.js'
];
// Bible books (js/kjv/NN.js) are cached the first time each one is opened.

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  // Network first for our own files (so updates arrive), falling back to cache when offline.
  e.respondWith(
    fetch(e.request).then(res => {
      if (res.ok && (new URL(e.request.url).origin === location.origin || e.request.url.includes('fonts.g'))) {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
      }
      return res;
    }).catch(() => caches.match(e.request).then(r => r || caches.match('./index.html')))
  );
});

// Tapping a prayer reminder notification opens (or focuses) the app on the Prayer page.
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || './index.html#prayer';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const c of list) { if ('focus' in c) { c.navigate && c.navigate(url).catch(() => {}); return c.focus(); } }
    return self.clients.openWindow(url);
  }));
});
