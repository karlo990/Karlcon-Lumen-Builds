/* KARLCON Lumen Builds — service worker.
   Makes the site installable, opens instantly on repeat visits, and keeps
   concepts a visitor has already opened (images and 3D models) available offline. */
const VERSION = 'kc-v3';
const SHELL = ['/', '/concepts-data.js', '/manifest.webmanifest', '/img/icons/icon-192.png'];
const CACHE_FIRST_HOSTS = ['cdnjs.cloudflare.com', 'cdn.jsdelivr.net', 'fonts.googleapis.com', 'fonts.gstatic.com', 'www.gstatic.com'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).catch(() => {}));
  self.skipWaiting();
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

async function networkFirst(req, fallbackKey) {
  const cache = await caches.open(VERSION);
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(fallbackKey || req, res.clone());
    return res;
  } catch (err) {
    const hit = await cache.match(fallbackKey || req);
    if (hit) return hit;
    throw err;
  }
}
async function cacheFirst(req) {
  const cache = await caches.open(VERSION);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) cache.put(req, res.clone());
  return res;
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === location.origin) {
    if (url.pathname.startsWith('/developer') || url.searchParams.has('admin') || url.searchParams.has('fresh')) return; // admin tools always live
    if (url.pathname === '/api/concepts') return e.respondWith(networkFirst(req, '/api/concepts'));
    if (url.pathname.startsWith('/api/')) return;
    if (req.mode === 'navigate') return e.respondWith(networkFirst(req, '/'));
    if (url.pathname.startsWith('/img/') || url.pathname === '/concepts-data.js') return e.respondWith(cacheFirst(req));
    return;
  }
  if (url.hostname.endsWith('.blob.vercel-storage.com') || CACHE_FIRST_HOSTS.includes(url.hostname)) {
    e.respondWith(cacheFirst(req));
  }
});
