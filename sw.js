// Network-first for the app's own pages/scripts (updates arrive on the next visit),
// cache fallback when offline or the network is slow. Icons and the vendored library are cache-first.
const CACHE_NAME = "shell-savings-v21-slim-titles";
const APP_FILES = [
  "./",
  "./index.html",
  "./config.js",
  "./vendor/supabase-js-2.45.4.umd.js",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-512-maskable.png"
];
const NETWORK_TIMEOUT_MS = 4000;

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache =>
    Promise.allSettled(APP_FILES.map(file => cache.add(file)))));
  self.skipWaiting();
});
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

function cacheFirst(request) {
  return caches.match(request).then(cached => cached || fetch(request).then(response => {
    if (response && response.ok) { const copy = response.clone(); caches.open(CACHE_NAME).then(c => c.put(request, copy)); }
    return response;
  }));
}
function networkFirst(request) {
  return new Promise(resolve => {
    let settled = false;
    const finish = response => { if (!settled && response) { settled = true; resolve(response); } };
    const timer = setTimeout(() => caches.match(request, {ignoreSearch: true}).then(finish), NETWORK_TIMEOUT_MS);
    fetch(request.url, {cache: "no-cache"}).then(response => {
      clearTimeout(timer);
      if (response && response.ok) { const copy = response.clone(); caches.open(CACHE_NAME).then(c => c.put(request, copy)); }
      finish(response);
    }).catch(async () => {
      clearTimeout(timer);
      const cached = await caches.match(request, {ignoreSearch: true}) ||
        (request.mode === "navigate" ? await caches.match("./index.html") : undefined);
      if (!settled) { settled = true; resolve(cached || Response.error()); }
    });
  });
}
self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // never touch Supabase API calls
  const isStatic = url.pathname.includes("/icons/") || url.pathname.includes("/vendor/");
  event.respondWith(isStatic ? cacheFirst(request) : networkFirst(request));
});
