/*
 * Offline support. On install, everything the app needs is saved on the device:
 * the app itself, its fonts, and all 66 books of the Bible in the KJV and in modern English (about 9 MB).
 * After that the app opens and runs with no connection at all.
 */
const VERSION = 'v9';
const SHELL = 'lamp-shell-' + VERSION;
const BIBLE = 'lamp-bible-v1';   // the KJV text never changes, so it keeps its own long-lived cache

const SHELL_FILES = [
  './', './index.html', './css/styles.css', './manifest.webmanifest', './icons/icon.svg', './fonts/fonts.css',
  './fonts/Cinzel-latin-63551c.woff2', './fonts/Cinzel-latin-ext-53a6c3.woff2',
  './fonts/EBGaramond-latin-143e88.woff2', './fonts/EBGaramond-latin-75a73b.woff2',
  './fonts/EBGaramond-latin-ext-1a53db.woff2', './fonts/EBGaramond-latin-ext-9cc06b.woff2',
  './fonts/Inter-latin-567244.woff2', './fonts/Inter-latin-ext-395290.woff2', './fonts/GreatVibes-latin.woff2',
  './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png', './icons/apple-touch-icon.png',
  './js/data/journey.js', './js/data/library.js', './js/data/grow.js', './js/core.js', './js/bible.js',
  './js/reader.js', './js/alarm.js', './js/requests.js', './js/praylist.js', './js/personal.js',
  './js/cards.js', './js/fast.js', './js/grow.js', './js/app.js'
];
const BOOK = i => String(i + 1).padStart(2, '0');
const KJV_FILES = Array.from({ length: 66 }, (_, i) => `./js/kjv/${BOOK(i)}.js`);
const WEB_FILES = Array.from({ length: 66 }, (_, i) => `./js/web/${BOOK(i)}.js`);   // modern English, side by side
const BIBLE_FILES = [...KJV_FILES, ...WEB_FILES];

async function tell(msg) {
  const clients = await self.clients.matchAll({ includeUncontrolled: true });
  clients.forEach(c => c.postMessage(msg));
}

async function cacheBible() {
  const cache = await caches.open(BIBLE);
  let done = 0;
  for (const url of BIBLE_FILES) {
    if (!(await cache.match(url))) {
      for (let attempt = 0; attempt < 3; attempt++) {
        try { const res = await fetch(url, { cache: 'reload' }); if (res.ok) { await cache.put(url, res); break; } } catch (e) { /* retry */ }
      }
    }
    done++;
    if (done % 6 === 0 || done === BIBLE_FILES.length) tell({ type: 'offline-progress', done: Math.min(done, 66), total: 66, web: Math.max(0, done - 66) });
  }
  const have = (await Promise.all(KJV_FILES.map(u => cache.match(u)))).filter(Boolean).length;
  const web = (await Promise.all(WEB_FILES.map(u => cache.match(u)))).filter(Boolean).length;
  tell({ type: 'offline-ready', bible: have, total: KJV_FILES.length, web });
  return have;
}

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const shell = await caches.open(SHELL);
    await shell.addAll(SHELL_FILES.map(u => new Request(u, { cache: 'reload' })));
    await cacheBible();
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== SHELL && k !== BIBLE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

// The page can ask for a status check or to finish downloading anything missing.
self.addEventListener('message', e => {
  if (e.data === 'offline-check') e.waitUntil(cacheBible());
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  // Bible text: from the device first; it never changes.
  if (url.pathname.includes('/js/kjv/') || url.pathname.includes('/js/web/')) {
    e.respondWith(caches.open(BIBLE).then(async c => {
      const hit = await c.match(req, { ignoreSearch: true });
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) c.put(req, res.clone());
      return res;
    }));
    return;
  }

  // App files: open instantly from the device, then refresh the saved copy in the background.
  e.respondWith(caches.open(SHELL).then(async c => {
    const hit = await c.match(req, { ignoreSearch: true }) || (req.mode === 'navigate' ? await c.match('./index.html') : null);
    const refresh = fetch(req).then(res => { if (res.ok) c.put(req, res.clone()); return res; }).catch(() => null);
    if (hit) { e.waitUntil(refresh); return hit; }
    const res = await refresh;
    return res || c.match('./index.html');
  }));
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
