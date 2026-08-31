# Cloudflare Worker Gateway - Production Deployment

## Deployment Details

**Date:** 2026-08-31  
**Worker Name:** `zamschool-gateway`  
**Deployment URL:** https://zamschool-gateway.twister23rd1.workers.dev  
**Version ID:** `4fbaa9e5-f68b-421d-9982-7052a4dd395b`

## Architecture Overview

The Cloudflare Worker acts as an edge compute layer between clients and the origin API (`https://www.zamschoolos.site`), providing:

### Core Capabilities

1. **Edge Authentication** - JWT validation at the edge using ES256 JWKS from Supabase
2. **Rate Limiting** - Sliding window rate limiting via Upstash Redis (REST API)
3. **Multi-level Caching** - Read-through caching with smart TTL presets to reduce Supabase load by 70-80%
4. **Request Deduplication** - Prevents thundering herd problems for hot endpoints
5. **R2 Object Storage** - CDN delivery of assets via Cloudflare R2 buckets
6. **Durable Objects** - Per-school offline mutation queue for sync resilience

## Resource Bindings

### R2 Buckets
- **ASSETS_BUCKET**: `zamschool-assets` - Static assets, images, public files
- **UPLOADS_BUCKET**: `zamschool-uploads` - User uploads, avatars, documents

### KV Namespaces
- **SESSION_CACHE** (`61a36e9b580640dd95de1924bcb9ef3d`) - Session token cache
- **RATE_LIMITS** (`4dcb6b91d420436b8d6df323ba46553a`) - Legacy binding (unused, safe to remove after cutover)

### Durable Objects
- **SYNC_QUEUE** → `SchoolSyncQueue` class - Offline-first mutation queue per school

### Environment Variables
| Variable | Value | Purpose |
|----------|-------|---------|
| UPSTREAM_API | `https://www.zamschoolos.site` | Origin API endpoint |
| CORS_ALLOWED_ORIGINS | `https://www.zamschoolos.site,https://zamschoolos.site,http://localhost:3000` | CORS policy |
| JWT_VERIFY_MODE | `signature` | ES256 JWKS verification |
| SUPABASE_URL | `https://jnnroitaftfmclegbeac.supabase.co` | Supabase project URL |
| SUPABASE_JWT_ISSUER | `https://jnnroitaftfmclegbeac.supabase.co/auth/v1` | JWT issuer validation |
| SUPABASE_JWT_AUDIENCE | `authenticated` | JWT audience claim |
| RATE_LIMIT_ENABLED | `true` | Enable rate limiting |
| FREE_TIER | `true` | Apply free-tier ceilings |
| NODE_ENV | `production` | Production mode |

## Performance Targets

Based on optimization work in `docs/OPTIMIZATION_20K_USERS.md`:

- **Supabase Load Reduction:** 70-80% via aggressive caching
- **Origin Load Reduction:** 50-60% via edge auth and rate limiting
- **Daily User Capacity:** 20,000+ users
- **Cost Projection:** $30-60/month (Upstash + Cloudflare + Supabase)

## Key Source Files

- `src/index.ts` - Main Worker entry point with request routing
- `src/optimized-auth.ts` - Edge JWT validation and rate limiting logic
- `src/proxy.ts` - Request proxying to upstream API
- `src/rate-limit.ts` - Sliding window rate limiter with Upstash Redis
- `src/queue.ts` - Durable Object implementation for offline sync
- `src/auth.ts` - Authentication helpers and token validation
- `src/d1.ts` - D1 database stub (offline replica, currently disabled)

## Security Features

1. **JWT Validation at Edge** - Validates ES256 signatures before reaching origin
2. **Tenant Isolation** - All requests scoped by `school_id` from JWT claims
3. **Rate Limiting** - Per-user, per-endpoint sliding window limits
4. **CORS Protection** - Whitelisted origins only
5. **AAL2 Enforcement** - Sensitive operations require MFA (integrated with origin)

## Deployment Commands

```bash
# Navigate to worker directory
cd workers/gateway

# Login to Cloudflare (OAuth)
npx wrangler login

# Deploy to production
npx wrangler deploy

# Test deployment
curl -I https://zamschool-gateway.twister23rd1.workers.dev
```

## Secrets Configuration

Required secrets (set via Wrangler CLI):

```bash
# Upstash Redis credentials (for rate limiting)
npx wrangler secret put UPSTASH_REDIS_REST_URL
npx wrangler secret put UPSTASH_REDIS_REST_TOKEN

# Optional: HS256 legacy secret (project uses ES256 by default)
# npx wrangler secret put SUPABASE_JWT_SECRET
```

## Monitoring & Observability

- **Cloudflare Dashboard:** View Worker analytics, error rates, and invocation counts
- **Wrangler Tail:** `npx wrangler tail zamschool-gateway` for real-time logs
- **Upstash Dashboard:** Monitor Redis command usage (current: 18K/500K monthly limit)
- **Supabase Dashboard:** Track query volume reduction post-deployment

## Next Steps

1. **Configure Custom Domain** - Point `gateway.zamschoolos.site` to the Worker
2. **Enable Analytics** - Set up Cloudflare Analytics Engine for detailed metrics
3. **Cache Warming** - Pre-populate cache for high-traffic endpoints
4. **Load Testing** - Validate 20K user capacity with synthetic traffic
5. **Rollout Strategy** - Gradually shift traffic from origin to Worker via DNS weighting

## Rollback Procedure

If issues arise:

```bash
# List previous deployments
npx wrangler versions list

# Rollback to specific version
npx wrangler versions rollback <version-id>
```

## Related Documentation

- `docs/OPTIMIZATION_20K_USERS.md` - Complete optimization guide
- `docs/CLOUD_SERVICES_ARCHITECTURE.md` - Cloud service integration details
- `workers/gateway/wrangler.toml` - Worker configuration
- `workers/gateway/src/optimized-auth.ts` - Edge authentication implementation
