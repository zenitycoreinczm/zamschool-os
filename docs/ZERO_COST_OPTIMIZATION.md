# Cloudflare Worker Gateway — Upstash-Primary Optimization

## Overview

The ZamSchool Gateway Worker uses **Upstash Redis** as the primary rate limiter and cache, with Cloudflare-native services as automatic fallbacks. This leverages Upstash's generous free tier (500K commands/month) while maintaining resilience through multi-tier fallbacks.

**Deployment URL:** https://zamschool-gateway.twister23rd1.workers.dev  
**Current Version:** `cf8b9674-0d19-4ee9-a7e8-ecbb18e42448`  
**Monthly Cost:** $0 (within free tiers)

## Why Upstash Redis?

Current usage: **18K / 500K commands/month** (3.6% utilization). Massive headroom for aggressive caching and rate limiting without any cost.

| Metric | Value |
|--------|-------|
| Commands used | 18,030 / month |
| Commands available | 500,000 / month |
| Writes | 10,187 / month |
| Reads | 8,030 / month |
| Utilization | 3.6% |

## Architecture: Four-Tier Fallback

```
Primary: Upstash Redis REST API (atomic INCR, cross-isolate, 500K cmds/month free)
    ↓ (if unavailable)
L1: Cloudflare Cache API (unlimited reads, fastest local cache)
    ↓ (if fails)
L2: KV Namespace SESSION_CACHE (1K writes/day free, persistent)
    ↓ (if fails)
L3: Isolate Memory (unlimited, per-location only)
```

### Rate Limiting Flow

```typescript
checkGatewayRateLimit(env, identifier, config)
  → hasUpstash(env)?  → checkUpstashRateLimit()   // Pipeline: INCR + EXPIRE (~2 cmds)
  → Cache API?        → checkCacheRateLimit()      // HTTP cache with X-Count header
  → KV available?     → checkKVRateLimit()         // Read + conditional write
  → Memory fallback   → checkMemoryRateLimit()     // Per-isolate counter
```

### Caching Flow

```typescript
edgeCacheGet(key, env, options)
  → Redis available?  → redis.get(key)             // Cross-isolate consistent
  → Fallback          → caches.default.match()      // Local Cache API

edgeCacheSet(key, data, env, options)
  → Redis available?  → redis.setex(key, ttl, data) // Atomic set with TTL
  → Fallback          → caches.default.put()         // Cache API with max-age
```

## Rate Limit Presets

| Preset | Window | Max Requests | Use Case |
|--------|--------|-------------|----------|
| default | 60s | 60 | General API calls |
| upload | 60s | 10 | File uploads |
| read | 60s | 60 | Read operations |
| mutation | 60s | 30 | Write/update/delete |
| anonymous | 60s | 12 | Unauthenticated requests |

## Upstash Redis Integration

### Rate Limiting (Pipeline — ~2 commands/request)

Uses Redis pipeline for atomic INCR + EXPIRE in a single HTTP round-trip:

```
POST /pipeline
[["INCR", "gw:rl:default:user123:1725100800"],
 ["EXPIRE", "gw:rl:default:user123:1725100800", "65"]]
```

### Auth Caching (Redis ZSET sliding window)

For `optimized-auth.ts`, uses sorted sets for precise sliding window rate limiting:

```
ZREMRANGEBYSCORE key 0 <windowStart>  // Remove expired
ZCARD key                              // Count current
ZADD key <now> "<now>-<random>"       // Add entry
EXPIRE key <windowSeconds>            // Set TTL
```

### Health Check

The `/health` endpoint pings Redis and reports status:

```json
{
  "status": "healthy",
  "services": {
    "redis": "healthy",
    "worker": "running",
    "cache_api": "available",
    "kv_namespace": "configured"
  }
}
```

## Free-Tier Budget

| Service | Free Tier | Current Usage | Headroom |
|---------|-----------|---------------|----------|
| Upstash Redis | 500K cmds/mo | 18K (3.6%) | 482K cmds |
| CF Workers | 100K req/day | ~20K users | 80K req/day |
| KV Namespace | 1K writes/day | Minimal (fallback only) | ~1K writes |
| Cache API | Unlimited | Active | Unlimited |
| R2 Storage | 10GB + 1M reads | 2 buckets | Plenty |
| Durable Objects | 1M req/month | Queue ops | ~1M req |

## Secrets Configuration

Upstash credentials are set via Wrangler secrets (not in wrangler.toml):

```bash
cd workers/gateway
npx wrangler secret put UPSTASH_REDIS_REST_URL
npx wrangler secret put UPSTASH_REDIS_REST_TOKEN
```

## Deployment

```bash
cd workers/gateway
npm install
npx wrangler deploy
```

## Monitoring

```bash
# Real-time logs
npx wrangler tail zamschool-gateway

# Version history
npx wrangler versions list
```

Monitor Upstash usage at https://console.upstash.com to track command consumption against the 500K/month free tier.

## Rollback

```bash
npx wrangler versions list
npx wrangler versions rollback <version-id>
```

## Related Documentation

- `docs/CLOUDFLARE_WORKER_DEPLOYMENT.md` — Original deployment details
- `workers/gateway/src/rate-limit.ts` — Rate limiting implementation
- `workers/gateway/src/optimized-auth.ts` — Auth and caching layer
