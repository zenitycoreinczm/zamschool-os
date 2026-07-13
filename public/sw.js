const STATIC_CACHE = "zamschool-static-v2";
const ROUTE_CACHE = "zamschool-routes-v3";
const API_CACHE = "zamschool-api-v3";
const OFFLINE_FALLBACK_URL = "/offline";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(ROUTE_CACHE).then((cache) => cache.addAll([OFFLINE_FALLBACK_URL, "/"]))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== STATIC_CACHE && name !== ROUTE_CACHE && name !== API_CACHE)
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== "GET") {
    return;
  }

  // 1. Navigation requests (full page loads)
  if (request.mode === "navigate") {
    event.respondWith(handleNavigationRequest(request));
    return;
  }

  // 2. Next.js RSC (React Server Components) payload requests
  if (request.headers.get("RSC") === "1" || url.searchParams.has("_rsc")) {
    event.respondWith(networkFirst(request, ROUTE_CACHE));
    return;
  }

  // 3. API Requests (either same-origin or Gateway)
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(networkFirst(request, API_CACHE));
    return;
  }

  // 4. Static Assets (same-origin Next.js static files)
  if (url.origin === self.location.origin && isStaticAssetRequest(url.pathname)) {
    event.respondWith(staleWhileRevalidate(request, STATIC_CACHE));
    return;
  }
});

async function handleNavigationRequest(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(ROUTE_CACHE);
      await cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    const fallback = await caches.match(OFFLINE_FALLBACK_URL);
    return fallback || Response.error();
  }
}

async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      await cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    return Response.error();
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);

  const fetchPromise = fetch(request).then((networkResponse) => {
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  }).catch(() => {
    return Response.error();
  });

  return cachedResponse || await fetchPromise;
}

function isStaticAssetRequest(pathname) {
  return (
    pathname.startsWith("/_next/static/") ||
    pathname.endsWith(".js") ||
    pathname.endsWith(".css") ||
    pathname.endsWith(".png") ||
    pathname.endsWith(".svg") ||
    pathname.endsWith(".jpg") ||
    pathname.endsWith(".woff2") ||
    pathname.endsWith(".ico")
  );
}
