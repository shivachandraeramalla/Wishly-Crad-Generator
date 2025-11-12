const CACHE_NAME = "wishly-v3.2";
const ASSETS = [
  "/",
  "/index.html",
  "/style.css",
  "/script.js",
  "/manifest.json",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((k) => {
          if (k !== CACHE_NAME) return caches.delete(k);
        })
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  e.respondWith(
    caches.match(e.request).then(
      (cached) =>
        cached ||
        fetch(e.request)
          .then((res) => {
            return caches.open(CACHE_NAME).then((cache) => {
              if (
                e.request.method === "GET" &&
                e.request.url.startsWith(self.location.origin)
              )
                cache.put(e.request, res.clone());
              return res;
            });
          })
          .catch(() => caches.match("/index.html"))
    )
  );
});
