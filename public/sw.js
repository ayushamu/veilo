const CACHE_NAME = "veilo-cache-v1";
const ASSETS_TO_CACHE = [
  "/",
  "/icon-192.png",
  "/icon-512.png",
  "/favicon.ico"
];

// Install Event
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// Activate Event
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch Event
self.addEventListener("fetch", (event) => {
  // Only intercept GET requests
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  
  // Do not intercept Supabase Auth/API, real-time sync endpoints, or Hot Module Reloading files
  if (
    url.pathname.startsWith("/api") || 
    url.pathname.includes("/_next/webpack-hmr") ||
    url.hostname.includes("supabase.co")
  ) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cache valid local static/assets responses
        if (
          response && 
          response.status === 200 && 
          response.type === "basic" &&
          !url.pathname.startsWith("/_next/static/webpack")
        ) {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => {
        // Offline fallback
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // For page navigations, return root / as a fallback
          if (event.request.mode === "navigate") {
            return caches.match("/");
          }
        });
      })
  );
});
