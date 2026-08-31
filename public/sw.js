/**
 * ZamSchool OS service worker — public + app offline core.
 *
 * Goals:
 * - Landing (/), app shells, and offline shell always available offline (styled).
 * - /_next/static CSS/JS cached so phones don't get "HTML without CSS".
 * - Data APIs cached network-first so teachers/admins/parents can view cached
 *   data when school networks drop.
 * - Credentials/auth endpoints (/api/auth/*) bypass cache for security.
 */
const STATIC_CACHE = "zamschool-static-v8";
const ROUTE_CACHE = "zamschool-routes-v8";
const API_CACHE = "zamschool-api-v8";

/** Self-contained HTML — no Tailwind / Next CSS dependency. */
const OFFLINE_SHELL = "/offline.html";
const PRECACHE_URLS = [
  "/",
  OFFLINE_SHELL,
  "/icon.png",
  "/login",
  "/register",
  "/offline",
  "/app/teacher",
  "/app/principal",
  "/app/student",
  "/app/parent",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(ROUTE_CACHE);
      // addAll fails entirely if one URL 404s — add one-by-one safely.
      await Promise.all(
        PRECACHE_URLS.map(async (url) => {
          try {
            const res = await fetch(url, { credentials: "same-origin" });
            if (res.ok) {
              await cache.put(url, res.clone());
              if (isHtmlResponse(res)) {
                await warmDocumentAssets(res);
              }
            }
          } catch {
            /* ignore install-time network gaps */
          }
        }),
      );
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([STATIC_CACHE, ROUTE_CACHE, API_CACHE]);
      const names = await caches.keys();
      await Promise.all(
        names.filter((name) => !keep.has(name)).map((name) => caches.delete(name)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // 1. Full page navigations
  if (request.mode === "navigate") {
    event.respondWith(handleNavigationRequest(request));
    return;
  }

  // 2. Next.js RSC payloads
  if (request.headers.get("RSC") === "1" || url.searchParams.has("_rsc")) {
    event.respondWith(networkFirst(request, ROUTE_CACHE));
    return;
  }

  // 3. API endpoints (Network First with offline API Cache)
  if (url.pathname.startsWith("/api/")) {
    if (isAuthSensitiveApi(url.pathname)) {
      event.respondWith(fetch(request));
      return;
    }
    event.respondWith(networkFirst(request, API_CACHE));
    return;
  }

  // 4. Same-origin static assets (CSS/JS critical for styled offline)
  if (url.origin === self.location.origin && isStaticAssetRequest(url.pathname)) {
    event.respondWith(cacheFirstStatic(request));
    return;
  }
});

// Background Sync — replay queued mutations when network returns
self.addEventListener("sync", (event) => {
  if (event.tag === "zamschool-sync-queue") {
    event.waitUntil(syncOfflineQueue());
  }
});

async function handleNavigationRequest(request) {
  const url = new URL(request.url);

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(ROUTE_CACHE);
      // Cache by pathname for stable offline hits (ignore query noise).
      await cache.put(url.pathname, response.clone());
      await cache.put(request, response.clone());
      // Warm CSS/JS linked from this HTML so the next offline load is styled.
      void warmDocumentAssets(response.clone());
    }
    return response;
  } catch {
    // Offline path
    const cache = await caches.open(ROUTE_CACHE);
    const exact =
      (await cache.match(request)) ||
      (await cache.match(url.pathname)) ||
      (await caches.match(request)) ||
      (await caches.match(url.pathname));

    if (exact) {
      return exact;
    }

    // Role app fallback before generic shell
    if (url.pathname.startsWith("/app/teacher")) {
      const teacherCache = await cache.match("/app/teacher");
      if (teacherCache) return teacherCache;
    } else if (url.pathname.startsWith("/app/principal")) {
      const principalCache = await cache.match("/app/principal");
      if (principalCache) return principalCache;
    } else if (url.pathname.startsWith("/app/student")) {
      const studentCache = await cache.match("/app/student");
      if (studentCache) return studentCache;
    } else if (url.pathname.startsWith("/app/parent")) {
      const parentCache = await cache.match("/app/parent");
      if (parentCache) return parentCache;
    }

    // Branded offline shell (always styled — inline CSS).
    const shell =
      (await caches.match(OFFLINE_SHELL)) ||
      (await caches.match("/offline")) ||
      (await caches.match("/"));
    if (shell) return shell;

    return new Response(minimalOfflineHtml(), {
      status: 503,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  }
}

async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      try {
        await cache.put(request, response.clone());
      } catch {
        /* ignore cache put errors for non-cacheable headers */
      }
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    return Response.error();
  }
}

/** Prefer cache for fingerprinted Next assets; fall back to network. */
async function cacheFirstStatic(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);
  if (cached) {
    // Revalidate in background
    void fetch(request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.ok) {
          void cache.put(request, networkResponse.clone());
        }
      })
      .catch(() => {});
    return cached;
  }

  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      await cache.put(request, networkResponse.clone());
    } else if (networkResponse.status === 404 && request.url.includes("/_next/static/css/")) {
      // If a fingerprinted Next CSS asset returns 404 (due to a fresh deployment),
      // purge stale route cache so visitors fetch updated HTML matching current CSS hashes.
      void caches.delete(ROUTE_CACHE);
    }
    return networkResponse;
  } catch {
    return Response.error();
  }
}

/**
 * Parse HTML for /_next/static asset URLs and cache them.
 * Fixes "page HTML loads offline but CSS does not".
 */
async function warmDocumentAssets(response) {
  try {
    if (!isHtmlResponse(response)) return;
    const html = await response.text();
    const found = new Set();
    const patterns = [
      /href="(\/_next\/static\/[^"]+\.css[^"]*)"/g,
      /src="(\/_next\/static\/[^"]+\.js[^"]*)"/g,
      /href="(\/_next\/static\/[^"]+\.woff2[^"]*)"/g,
    ];
    for (const re of patterns) {
      let match;
      while ((match = re.exec(html)) !== null) {
        found.add(match[1]);
      }
    }

    if (found.size === 0) return;

    const cache = await caches.open(STATIC_CACHE);
    const list = Array.from(found).slice(0, 48);
    await Promise.all(
      list.map(async (path) => {
        try {
          const abs = new URL(path, self.location.origin).toString();
          const existing = await cache.match(abs);
          if (existing) return;
          const res = await fetch(abs, { credentials: "same-origin" });
          if (res.ok) await cache.put(abs, res.clone());
        } catch {
          /* ignore single asset failure */
        }
      }),
    );
  } catch {
    /* ignore parse/warm failures */
  }
}

function isHtmlResponse(response) {
  const type = response.headers.get("content-type") || "";
  return type.includes("text/html");
}

function isStaticAssetRequest(pathname) {
  return (
    pathname.startsWith("/_next/static/") ||
    pathname.startsWith("/_next/image") ||
    pathname.endsWith(".js") ||
    pathname.endsWith(".css") ||
    pathname.endsWith(".png") ||
    pathname.endsWith(".svg") ||
    pathname.endsWith(".jpg") ||
    pathname.endsWith(".jpeg") ||
    pathname.endsWith(".webp") ||
    pathname.endsWith(".woff2") ||
    pathname.endsWith(".woff") ||
    pathname.endsWith(".ico") ||
    pathname === "/offline.html" ||
    pathname === "/icon.png"
  );
}

function isAuthSensitiveApi(pathname) {
  const sensitivePrefixes = [
    "/api/auth/",
    "/api/account/session",
  ];
  return sensitivePrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix),
  );
}

/** Last-resort response if even offline.html failed to precache. */
function minimalOfflineHtml() {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>ZamSchool OS offline</title><style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;font-family:system-ui,sans-serif;background:#0f172a;color:#f8fafc;padding:1.5rem;text-align:center}a{color:#38bdf8}</style></head><body><div><h1>ZamSchool OS is live</h1><p>You're offline. Reconnect and <a href="/">open the site</a>.</p><p><button onclick="location.reload()" style="margin-top:1rem;padding:.75rem 1.25rem;border:0;border-radius:999px;background:#0ea5e9;color:#fff;font-weight:700">Try again</button></p></div></body></html>`;
}

/**
 * Background Sync handler — replay queued mutations from localStorage.
 * Reads the offline-sync-queue and attempts to flush pending items.
 */
async function syncOfflineQueue() {
  try {
    // Notify all clients that background sync is running
    const clients = await self.clients.matchAll();
    clients.forEach((client) => {
      client.postMessage({ type: "SYNC_STARTED" });
    });

    // Trigger the app's sync logic via broadcast channel or direct call
    // The app will read from localStorage and attempt to flush
    clients.forEach((client) => {
      client.postMessage({ type: "FLUSH_OFFLINE_QUEUE" });
    });
  } catch (error) {
    console.error("[SW] Background sync failed:", error);
  }
}
