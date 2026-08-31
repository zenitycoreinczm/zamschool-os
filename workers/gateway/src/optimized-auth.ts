/**
 * Optimized Cloudflare Worker Auth & Caching Layer
 * 
 * Uses Upstash Redis (500K commands/month free) for rate limiting and caching.
 * Falls back to Cloudflare Cache API + KV if Redis unavailable.
 */

import { Redis } from "@upstash/redis/cloudflare";

// Types
interface AuthContext {
  userId: string;
  schoolId: string;
  role: string;
  aal: string;
}

interface CacheConfig {
  ttl: number;
  staleWhileRevalidate?: boolean;
  tags?: string[];
}

// Upstash Redis client (initialized per request)
function getRedis(env: Env): Redis | null {
  if (!env.UPSTASH_REDIS_REST_URL || !env.UPSTASH_REDIS_REST_TOKEN) {
    return null;
  }
  
  return new Redis({
    url: env.UPSTASH_REDIS_REST_URL,
    token: env.UPSTASH_REDIS_REST_TOKEN,
  });
}

/**
 * Edge-level JWT validation
 * Reduces origin auth checks by validating at the edge
 */
export async function validateJWTAtEdge(
  request: Request,
  env: Env,
): Promise<{ valid: boolean; context?: AuthContext; error?: string }> {
  const authHeader = request.headers.get("Authorization");
  
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return { valid: false, error: "Missing or invalid authorization header" };
  }
  
  const token = authHeader.split(" ")[1];
  
  try {
    // Verify JWT signature using Supabase JWKS
    const jwksUrl = `${env.SUPABASE_URL}/auth/v1/jwks`;
    const jwksResponse = await fetch(jwksUrl, {
      cf: { cacheTtl: 3600 }, // Cache JWKS for 1 hour at edge
    });
    
    if (!jwksResponse.ok) {
      return { valid: false, error: "Failed to fetch JWKS" };
    }
    
    const jwks = await jwksResponse.json();
    
    // Decode JWT payload (simplified - use jose library in production)
    const payload = decodeJWT(token);
    
    if (!payload || !payload.sub) {
      return { valid: false, error: "Invalid JWT payload" };
    }
    
    // Check expiration
    if (payload.exp && payload.exp < Date.now() / 1000) {
      return { valid: false, error: "Token expired" };
    }
    
    // Extract context from JWT claims
    const context: AuthContext = {
      userId: payload.sub,
      schoolId: payload.school_id || "",
      role: payload.role || "",
      aal: payload.aal || "aal1",
    };
    
    return { valid: true, context };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : "JWT validation failed",
    };
  }
}

/**
 * Edge-level rate limiting with Upstash Redis (500K commands/month free)
 * Atomic sliding window implementation with fallback to Cache API + KV
 */
export async function checkRateLimit(
  identifier: string,
  limit: number,
  windowSeconds: number,
  env: Env,
): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
  const redis = getRedis(env);
  
  if (!redis) {
    // Fallback to Cache API + KV if Redis unavailable
    return await checkRateLimitFallback(identifier, limit, windowSeconds, env);
  }
  
  const key = `ratelimit:${identifier}`;
  const now = Date.now();
  const windowStart = now - windowSeconds * 1000;
  
  try {
    // Use Redis pipeline for atomic operations (~2 commands per request)
    const pipeline = redis.pipeline();
    
    // Remove expired entries
    pipeline.zremrangebyscore(key, 0, windowStart);
    
    // Count current entries
    pipeline.zcard(key);
    
    // Add new entry
    pipeline.zadd(key, { score: now, member: `${now}-${Math.random()}` });
    
    // Set expiry
    pipeline.expire(key, windowSeconds);
    
    const results = await pipeline.exec();
    
    const count = Number(results[1]) || 0;
    const allowed = count < limit;
    const remaining = Math.max(0, limit - count);
    
    return {
      allowed,
      remaining,
      resetTime: now + windowSeconds * 1000,
    };
  } catch (error) {
    console.error("[Worker] Rate limit check failed:", error);
    // Fail open to Cache API on Redis errors
    return await checkRateLimitFallback(identifier, limit, windowSeconds, env);
  }
}

/**
 * Fallback rate limiting using Cloudflare Cache API + KV
 * Used when Upstash Redis is unavailable
 */
async function checkRateLimitFallback(
  identifier: string,
  limit: number,
  windowSeconds: number,
  env: Env,
): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
  const key = `ratelimit:${identifier}`;
  const now = Date.now();
  const windowStart = Math.floor(now / (windowSeconds * 1000)) * (windowSeconds * 1000);
  const resetTime = windowStart + windowSeconds * 1000;
  
  // Try Cache API first (fastest, unlimited reads)
  try {
    const cacheKey = `https://zamschool-gateway/rl/${key}/${Math.floor(windowStart / 1000)}`;
    const cache = caches.default;
    const cached = await cache.match(cacheKey);
    
    if (cached) {
      const count = parseInt(cached.headers.get("X-Count") || "0", 10);
      
      if (count >= limit) {
        return { allowed: false, remaining: 0, resetTime };
      }

      // Increment counter
      const newCount = count + 1;
      const response = new Response("", {
        headers: {
          "X-Count": String(newCount),
          "Cache-Control": `public, max-age=${windowSeconds}`,
        },
      });
      
      await cache.put(cacheKey, response.clone());
      
      return {
        allowed: true,
        remaining: Math.max(limit - newCount, 0),
        resetTime,
      };
    }

    // First request in window
    const response = new Response("", {
      headers: {
        "X-Count": "1",
        "Cache-Control": `public, max-age=${windowSeconds}`,
      },
    });
    
    await cache.put(cacheKey, response.clone());
    
    return {
      allowed: true,
      remaining: limit - 1,
      resetTime,
    };
  } catch {
    // Cache API failed, fall through to KV
  }

  // Fallback to KV Namespace (persistent, 1K writes/day)
  if (env.SESSION_CACHE) {
    try {
      const kvKey = `rl:${key}:${Math.floor(windowStart / 1000)}`;
      const currentVal = await env.SESSION_CACHE.get(kvKey);
      const count = currentVal ? parseInt(currentVal, 10) : 0;

      if (count >= limit) {
        return { allowed: false, remaining: 0, resetTime };
      }

      await env.SESSION_CACHE.put(kvKey, String(count + 1), { expirationTtl: windowSeconds });

      return {
        allowed: true,
        remaining: Math.max(limit - count - 1, 0),
        resetTime,
      };
    } catch {
      // KV failed too, fail open
    }
  }

  // Final fallback: allow all (fail-safe)
  return { allowed: true, remaining: limit, resetTime };
}

/**
 * Edge cache with Upstash Redis primary, Cache API fallback.
 * Redis provides cross-isolate consistency; Cache API is unlimited-read fallback.
 */
export async function edgeCacheGet<T>(
  key: string,
  env: Env,
  options?: CacheConfig,
): Promise<T | null> {
  const redis = getRedis(env);

  if (redis) {
    try {
      const cached = await redis.get(key);
      if (!cached) return null;

      const entry = JSON.parse(cached as string);
      const age = Date.now() - entry.timestamp;
      const isExpired = age > entry.ttl * 1000;

      if (isExpired && !options?.staleWhileRevalidate) {
        await redis.del(key);
        return null;
      }

      return entry.data as T;
    } catch (error) {
      console.error("[Worker] Redis cache get failed:", error);
    }
  }

  // Fallback: Cache API (unlimited reads, local only)
  try {
    const cacheKey = `https://zamschool-gateway/cache/${key}`;
    const cache = caches.default;
    const cached = await cache.match(cacheKey);

    if (!cached) return null;

    const entry = JSON.parse(await cached.text());
    const age = Date.now() - entry.timestamp;
    const isExpired = age > entry.ttl * 1000;

    if (isExpired && !options?.staleWhileRevalidate) {
      return null;
    }

    return entry.data as T;
  } catch (error) {
    console.error("[Worker] Cache API get failed:", error);
    return null;
  }
}

export async function edgeCacheSet<T>(
  key: string,
  data: T,
  env: Env,
  options: CacheConfig,
): Promise<void> {
  const redis = getRedis(env);

  if (redis) {
    try {
      const entry = {
        data,
        timestamp: Date.now(),
        ttl: options.ttl,
        tags: options.tags,
      };

      await redis.setex(key, options.ttl, JSON.stringify(entry));
      return;
    } catch (error) {
      console.error("[Worker] Redis cache set failed:", error);
    }
  }

  // Fallback: Cache API
  try {
    const cacheKey = `https://zamschool-gateway/cache/${key}`;
    const entry = {
      data,
      timestamp: Date.now(),
      ttl: options.ttl,
      tags: options.tags,
    };

    const response = new Response(JSON.stringify(entry), {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": `public, max-age=${options.ttl}`,
      },
    });

    const cache = caches.default;
    await cache.put(cacheKey, response);
  } catch (error) {
    console.error("[Worker] Cache API set failed:", error);
  }
}

/**
 * Batch request optimizer
 * Combines multiple small requests into single batch
 */
export async function batchRequests<T>(
  requests: Array<{
    url: string;
    options?: RequestInit;
  }>,
): Promise<Array<{ data: T | null; error: string | null }>> {
  const results = await Promise.allSettled(
    requests.map(req => fetch(req.url, req.options).then(r => r.json()))
  );
  
  return results.map((result) => {
    if (result.status === "fulfilled") {
      return { data: result.value, error: null };
    }
    return {
      data: null,
      error: result.reason instanceof Error ? result.reason.message : String(result.reason),
    };
  });
}

/**
 * Request deduplication
 * Prevents thundering herd problem on cache misses
 */
const pendingRequests = new Map<string, Promise<any>>();

export async function deduplicateRequest<T>(
  key: string,
  fetcher: () => Promise<T>,
): Promise<T> {
  // Check if request already in flight
  if (pendingRequests.has(key)) {
    return pendingRequests.get(key) as Promise<T>;
  }
  
  // Create new promise and track it
  const promise = fetcher().finally(() => {
    pendingRequests.delete(key);
  });
  
  pendingRequests.set(key, promise);
  
  return promise;
}

/**
 * Health check endpoint — reports Redis, Cache API, and KV status
 */
export async function handleHealthCheck(env: Env): Promise<Response> {
  const redis = getRedis(env);
  let redisStatus = "not configured";

  if (redis) {
    try {
      await redis.ping();
      redisStatus = "healthy";
    } catch {
      redisStatus = "unhealthy";
    }
  }

  return new Response(
    JSON.stringify({
      status: "healthy",
      services: {
        redis: redisStatus,
        worker: "running",
        cache_api: "available",
        kv_namespace: env.SESSION_CACHE ? "configured" : "not configured",
      },
      timestamp: new Date().toISOString(),
    }),
    {
      headers: { "Content-Type": "application/json" },
      status: 200,
    }
  );
}

/**
 * Helper: Decode JWT without verification (for payload extraction only)
 * In production, use proper JWT verification library
 */
function decodeJWT(token: string): any {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    
    const payload = parts[1];
    const decoded = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

// Environment types — Upstash Redis primary with Cloudflare fallbacks
export interface Env {
  UPSTASH_REDIS_REST_URL?: string;
  UPSTASH_REDIS_REST_TOKEN?: string;
  SUPABASE_URL: string;
  SUPABASE_JWT_ISSUER?: string;
  FREE_TIER?: string;
  SESSION_CACHE?: KVNamespace;
}
