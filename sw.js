// Bump VERSION when changing the precache list, icons/images or caching behavior.
// Updates activate after existing app windows close; never reload unsaved edits.
const VERSION = 'v2';
const CACHE_PREFIX = 'westbound-pwa:' + encodeURIComponent(self.registration.scope) + ':';
const CACHE_NAME = CACHE_PREFIX + VERSION;
const localURL = path => new URL(path, self.registration.scope).href;
const INDEX_URL = localURL('./index.html');
const SHELL_PATHS = [
  './index.html', './trip-config.js', './pwa.js', './manifest.webmanifest',
  './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png',
  './assets/airbnb.webp', './assets/map-airbnb.9f74cd61fac3.webp',
  './assets/map-alexis-park.bb487c54e63d.webp', './assets/map-waldorf-astoria.40158ebf193c.webp'
];
const LOCAL_URLS = new Set(SHELL_PATHS.map(localURL));
const SDK_URL = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.112.4';
const SDK_INTEGRITY = 'sha384-yiVMs0R/Jyz7OhoXa/DsEMUSBLjEhr/QJta2ONO+zB6I8/GmNg/7AUFrZmAJV7KV';

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(SHELL_PATHS.map(path => new Request(localURL(path), { cache: 'reload' })));
    // CDN failure must not prevent basic offline reading via IndexedDB.
    try {
      await cache.add(new Request(SDK_URL, { mode: 'cors', credentials: 'omit', integrity: SDK_INTEGRITY, cache: 'reload' }));
    } catch (error) { console.warn('SDK offline cache unavailable', error); }
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME).map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

async function networkFirst(request, key, canStore = true) {
  const cache = await caches.open(CACHE_NAME);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4000);
  try {
    const response = await fetch(request, { cache: 'no-cache', signal: controller.signal });
    if (!response.ok) throw new Error('HTTP ' + response.status);
    // Never let storage quota failures discard a successful online response.
    if (canStore && !response.redirected) {
      try { await cache.put(key, response.clone()); } catch (error) { console.warn(error); }
    }
    return response;
  } catch (error) {
    return await cache.match(key) || Response.error();
  } finally { clearTimeout(timeout); }
}

async function staticAsset(request) {
  const cache = await caches.open(CACHE_NAME);
  return await cache.match(request) || networkFirst(request, request);
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  const isAppPage = url.origin === self.location.origin &&
    (url.pathname === new URL(self.registration.scope).pathname || url.pathname === new URL(INDEX_URL).pathname);
  if (request.mode === 'navigate' && isAppPage) {
    // Preview/query pages may fall back to the shell but never replace its cache.
    event.respondWith(networkFirst(request, INDEX_URL, !url.search));
  } else if (request.url === SDK_URL || (LOCAL_URLS.has(request.url) && /\.(?:webp|png|svg)$/.test(url.pathname))) {
    event.respondWith(staticAsset(request));
  } else if (LOCAL_URLS.has(request.url)) {
    event.respondWith(networkFirst(request, request));
  }
  // Auth, Supabase data/storage, POSTs, other pages and external URLs pass through.
});
