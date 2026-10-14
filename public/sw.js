const CACHE = "competitionos-v2";
const PUBLIC_PAGES = ["/", "/how-to", "/offline"];
const PRECACHE_URLS = [...PUBLIC_PAGES, "/manifest.json", "/icon-192.png", "/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE_URLS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))));
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(fetch(request).then((response) => {
      if (response.ok && PUBLIC_PAGES.includes(url.pathname)) {
        caches.open(CACHE).then((cache) => cache.put(request, response.clone()));
      }
      return response;
    }).catch(() => caches.match(request).then((cached) => cached || caches.match("/offline"))));
    return;
  }

  if (url.pathname.startsWith("/_next/static/") || /\.(?:png|svg|jpg|jpeg|webp|woff2)$/.test(url.pathname)) {
    event.respondWith(caches.match(request).then((cached) => cached || fetch(request).then((response) => {
      if (response.ok) caches.open(CACHE).then((cache) => cache.put(request, response.clone()));
      return response;
    })));
  }
});
