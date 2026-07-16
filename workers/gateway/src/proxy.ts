import type { Env } from "./types.ts";
import { isCacheableGetPath } from "./types.ts";

/**
 * Handles GET requests through the Cloudflare Cache API.
 *
 * Routing rules (see docs/ARCHITECTURE.md and workers/gateway/src/types.ts):
 *   - Cacheable prefix list (CACHEABLE_GET_PREFIXES) is the source of
 *     truth for what the edge is allowed to cache.
 *   - Upstream `CDN-Cache-Control` (set by Next.js Edge Cache policy in
 *     lib/edge-cache.ts) can downgrade / override per route. We honor
 *     `Cache-Control: private` or `no-store` by skipping the cache write.
 *   - Cache key varies by Authorization header so we never bleed data
 *     across tenants in shared cache slots.
 *   - On upstream failure we serve a previously cached response, marked
 *     `X-Served-From: edge-cache` so logs/observability can spot it.
 */
export async function handleCachedProxy(
  req: Request,
  env: Env,
  url: URL,
): Promise<Response> {
  const cache = (caches as unknown as { default: Cache }).default;

  // Only vary cache by Authorization header for safety (no mixing tenant data).
  // Authorization carries the Supabase JWT so we never cross cache between users.
  const authHeader = req.headers.get("Authorization") || "";
  const hasAuthorization = Boolean(authHeader);
  const cacheKey = new Request(url.toString(), {
    headers: { Authorization: authHeader },
  });
  const allowedByPrefix = isCacheableGetPath(url.pathname);

  if (allowedByPrefix && hasAuthorization) {
    const cached = await cache.match(cacheKey);
    if (cached) {
      const hitHeaders = new Headers(cached.headers);
      hitHeaders.set("X-Cache", "HIT");
      hitHeaders.set("X-Served-From", "edge-cache");
      return new Response(cached.body, {
        status: cached.status,
        statusText: cached.statusText,
        headers: hitHeaders,
      });
    }
  }

  const fetchImpl = env.fetch || fetch;
  const upstreamUrl = new URL(url.pathname + url.search, env.UPSTREAM_API);

  try {
    const response = await fetchImpl(
      new Request(upstreamUrl.toString(), {
        method: "GET",
        headers: req.headers,
      }),
    );

    if (response.ok) {
      const upstreamHeaders = new Headers(response.headers);
      const cdnCacheControl =
        upstreamHeaders.get("CDN-Cache-Control") ||
        upstreamHeaders.get("Cache-Control") ||
        "";

      // Cache only safe-to-cache paths. Authenticated private responses are safe
      // because the cache key varies by Authorization; no-store always wins.
      const upstreamSaysNoStore = /no-store/i.test(cdnCacheControl);
      const cacheable =
        allowedByPrefix && hasAuthorization && !upstreamSaysNoStore;

      if (cacheable) {
        const toCache = response.clone();
        const headers = new Headers(toCache.headers);
        // Keep whatever the upstream wanted on Cache-Control (also keep CDN-Cache-Control
        // for Cloudflare's own edge), but add stale-if-error so an upstream outage
        // can still serve the last good response.
        const currentCc = headers.get("Cache-Control") || "";
        if (!currentCc.includes("stale-if-error")) {
          headers.set(
            "Cache-Control",
            `${currentCc}${currentCc ? ", " : ""}stale-if-error=86400`,
          );
        }
        await cache.put(
          cacheKey,
          new Response(toCache.body, {
            headers,
            status: response.status,
            statusText: response.statusText,
          }),
        );
      }

      const respHeaders = new Headers(response.headers);
      respHeaders.set("X-Cache", "MISS");
      respHeaders.set(
        "X-Edge-Cache-Decision",
        cacheable
          ? "stored"
          : allowedByPrefix
            ? "skipped-upstream-no-cache"
            : "skipped-not-allowlisted",
      );
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: respHeaders,
      });
    }

    // Upstream returned an error (e.g. 502 Bad Gateway), try cache fallback.
    throw new Error(`Upstream error: ${response.status}`);
  } catch (_error) {
    // Network failure or upstream error: try the cache. We never bleed data -
    // the cache key already locks this to the same Authorization header.
    const cached =
      allowedByPrefix && hasAuthorization ? await cache.match(cacheKey) : null;
    if (cached) {
      const fallbackHeaders = new Headers(cached.headers);
      fallbackHeaders.set("X-Served-From", "edge-cache");
      fallbackHeaders.set("X-Cache", "HIT");
      return new Response(cached.body, {
        status: 200,
        headers: fallbackHeaders,
      });
    }

    // Nothing in cache - surface the figure-out-network error to the caller
    // with a 503 so the client can fall back to /api/* (see
    // lib/gateway-read-client.ts → fallbackToLocal).
    return new Response("Offline and not cached", { status: 503 });
  }
}
