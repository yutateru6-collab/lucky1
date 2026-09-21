/* 4.0.10: keep a usable shell even if optional 3D downloads fail. Never cache notes. */
const CACHE_NAME = 'lucky-shell-v4.0.10';
const CORE = ['./', './index.html', './styles.css', './quick-mode.css', './quick-choice.css', './reveal/cinematic.css', './app.mjs', './quick-mode.mjs', './reveal-runtime.mjs', './quick-draw.mjs', './quick-motion.mjs', './decision.mjs', './games.mjs', './journal.mjs', './words.mjs', './visuals.mjs', './vendor/anime.esm.min.js', './art/lucky-reference.webp', './manifest.webmanifest', './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png'];
const OPTIONAL = ['./reveal/cinematic.mjs', './reveal/lucky-coin.glb', './reveal/THIRD_PARTY_LICENSES.txt', './vendor/anime.LICENSE.md'];
const FILES = [...CORE, ...OPTIONAL];
const allowed = new Set(FILES.map(path => new URL(path, self.registration.scope).pathname));
async function requestWithDeadline(request, timeout = 5000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try { return await fetch(request, { signal: controller.signal, cache: 'no-cache' }); }
  finally { clearTimeout(timer); }
}
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(CORE.map(p => new Request(new URL(p, self.registration.scope), {cache: 'reload'})));
    // One failed/slow model must NOT prevent the new shell from replacing the broken one.
    await Promise.allSettled(OPTIONAL.map(async path => {
      const url = new URL(path, self.registration.scope).href;
      let timer;
      try { await Promise.race([(async () => {
        const response = await requestWithDeadline(url);
        if (response.ok) await cache.put(url, response);
      })(), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Optional cache timeout')), 5500); })]); }
      finally { clearTimeout(timer); }
    }));
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(n => n.startsWith('lucky-shell-') && n !== CACHE_NAME).map(n => caches.delete(n)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const request = event.request, url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || (!allowed.has(url.pathname) && request.mode !== 'navigate')) return;
  // Return the response without waiting for cache.put to read an entire GLB stream.
  let persist = Promise.resolve();
  const responseTask = (async () => {
    const cache = await caches.open(CACHE_NAME);
    try {
      const response = await requestWithDeadline(request);
      if (response.ok) {
        if (allowed.has(url.pathname)) persist = cache.put(url.origin + url.pathname, response.clone()).catch(() => {});
        return response;
      }
      const stored = await cache.match(request, {ignoreSearch:true});
      if (stored) return stored;
      return response;
    } catch {
      const stored = await cache.match(request, {ignoreSearch:true});
      if (stored) return stored;
      if (request.mode === 'navigate') {
        const home = await cache.match(new URL('./index.html', self.registration.scope).href);
        if (home) return home;
      }
      return new Response('Offline', {status:503, headers:{'Content-Type':'text/plain; charset=utf-8'}});
    }
  })();
  event.respondWith(responseTask);
  event.waitUntil(responseTask.then(() => persist));
});
