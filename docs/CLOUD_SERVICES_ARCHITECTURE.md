# Cloud Services Architecture: Upstash, Cloudflare & Supabase

This document provides a detailed technical breakdown of how ZamSchool uses three core cloud services: **Supabase** (primary backend), **Upstash Redis** (distributed state), and **Cloudflare** (edge compute + storage).

---

## 1. Supabase — Primary Backend & Auth

### Role
Supabase serves as the **single source of truth** for all persistent data, authentication, and real-time subscriptions. It replaces traditional PostgreSQL + Auth0 combinations with a unified platform.

### Client Architecture

#### Browser Client (`lib/supabase-browser-client.ts`)
- Uses `@supabase/ssr` cookie-backed auth for Next.js App Router compatibility
- Auto-refreshes tokens via middleware, not client-side polling
- Persists session in encrypted HTTP-only cookies (`sb-*-auth-token`)

#### Admin Client (`lib/supabase/admin.ts`)
- Uses **service role key** (bypasses RLS) for server-side operations
- Singleton pattern with 20s fetch timeout to prevent cascading failures
- Proxy wrapper prevents premature initialization during build time
- **Critical**: Never exposed to browser; only used in API routes and server components

#### Public Client (`lib/supabase.ts`)
- Anon-key client for public-facing operations
- Falls back gracefully during Next.js build phase
- Used by health checks and unauthenticated endpoints

### Security Model

#### Row-Level Security (RLS)
- All tables enforce tenant isolation via `school_id` column
- Service role bypasses RLS — **route-level scoping is mandatory**
- Example: Teacher discipline records scoped to assigned classes via `loadTeacherAssignmentScope()`

#### Auth Integration
- JWT verification via ES256 JWKS (preferred) or HS256 legacy secret
- MFA enforcement at AAL2 level for sensitive mutations (password change, MFA unenroll)
- Session metadata stored in Upstash Redis (no PII, no JWT tokens)

### Key Usage Patterns

| Use Case | Client | RLS Bypass | Rate Limiting |
|----------|--------|------------|---------------|
| User login/signup | Browser anon | No | Auth API limits |
| Profile reads | Admin service role | Yes | Platform rate limit |
| Data mutations | Admin service role | Yes | Domain-specific limits |
| Public assets | Anon + R2 CDN | No | Redis sliding window |

---

## 2. Upstash Redis — Distributed State Management

### Role
Upstash Redis provides **serverless-compatible distributed state** for rate limiting, session caching, and ephemeral data that must survive Vercel's stateless function invocations.

### Why Upstash?
- **REST API over TCP**: Safe on Vercel serverless (no connection pooling issues)
- **Global low latency**: Edge-located instances reduce round-trip time
- **Auto-pipelining**: Built-in request batching reduces network overhead
- **5 retries with exponential backoff**: Resilient against transient failures

### Circuit Breaker Pattern (`lib/redis/client.ts`)

The Redis client implements a sophisticated circuit breaker to prevent cascading failures:

```typescript
States: CLOSED → OPEN → HALF_OPEN → CLOSED

Thresholds:
- 5 consecutive failures → OPEN
- DNS/host unreachable: 5-minute cooldown
- Normal failures: 30-second cooldown
- Log throttling: 60-second intervals
```

### Approved Use Cases (Key Whitelist)

All Redis keys must be whitelisted in `lib/redis/keys.ts`. Approved categories:

#### Rate Limiting
- `rate_limit:api:{schoolId}:{userId}` — API call limits
- `rate_limit:auth:{ip}` — Login brute-force protection
- `rate_limit:mfaFactorsDelete:{userId}` — Sensitive operation limits

#### Session & Cache
- `session:active:{userId}` — Active session metadata (no JWT, no email)
- `actor:snapshot:{userId}` — Role/school actor snapshots (TTL: 5min)
- `shell:bootstrap:{userId}` — Shell component cache (TTL: 2min)

#### Feature Quotas
- `daily:ai_tips:{schoolId}` — AI feature daily limits
- `daily:image_uploads:{userId}` — Upload quotas

### Sliding Window Rate Limiter

Uses Lua script for atomic sorted-set operations:

```lua
-- Single round-trip, safe under concurrent serverless invocations
redis.call('ZREMRANGEBYSCORE', key, 0, now - window)
local count = redis.call('ZCARD', key)
if count >= max then return {0, 0, reset} end
redis.call('ZADD', key, now, member)
redis.call('PEXPIRE', key, window)
return {1, max - count - 1, now + window}
```

### TTL Policy

**Every write must include TTL** (enforced by `clampRedisTtl`):
- Session data: 5-15 minutes
- Rate limits: 1-60 seconds (window-based)
- Bootstrap cache: 2-5 minutes
- Daily quotas: 24 hours

### Fallback Strategy

When Redis is unavailable:
1. Circuit breaker opens → returns `null/false` immediately
2. Rate limiters fall back to in-memory (per-isolate) counters
3. Cache misses proceed to database queries
4. Health checks report degraded but functional status

---

## 3. Cloudflare — Edge Compute & Storage

### Components

#### Cloudflare Workers Gateway (`workers/gateway/`)

A standalone Worker that acts as an **API gateway and edge cache** for high-traffic endpoints.

**Architecture:**
```
Client → Cloudflare Worker → Vercel API Route → Supabase
         (auth, rate limit, cache)
```

**Key Features:**
- OAuth-based auth (not API token) for deployment security
- R2 bucket bindings for asset storage
- KV namespace for session cache (legacy, migrating to Upstash)
- Durable Objects for offline mutation queue (`SchoolSyncQueue`)

**Wrangler Config:**
```toml
[[r2_buckets]]
binding = "ASSETS_BUCKET"
bucket_name = "zamschool-assets"

[[kv_namespaces]]
binding = "SESSION_CACHE"
id = "61a36e9b580640dd95de1924bcb9ef3d"

[durable_objects]
bindings = [
  { name = "SYNC_QUEUE", class_name = "SchoolSyncQueue" }
]
```

#### Cloudflare R2 (Object Storage)

**Purpose:** Stores user-uploaded assets (avatars, documents, images) with CDN delivery.

**Configuration (`lib/r2-config.ts`):**
- `R2_PUBLIC_URL`: Server-side bucket URL (e.g., `https://pub-xxxx.r2.dev`)
- `NEXT_PUBLIC_R2_PUBLIC_URL`: Client-side URL for `next/image` integration
- Validates against S3 endpoint patterns to prevent misconfiguration

**Security:**
- Asset keys validated via regex: `/^[a-zA-Z0-9][a-zA-Z0-9/_-]*\.[a-zA-Z0-9]{2,8}$/`
- Path traversal prevention: blocks `..` segments
- Length limit: 512 characters max

**Delivery Modes:**
1. **CDN mode**: Direct R2 public URL (production)
2. **Proxy mode**: App serves assets via `/api/assets/*` (dev/fallback)

#### Cloudflare KV (Key-Value Store)

**Current Status:** Legacy fallback, migrating to Upstash Redis.

**Use Cases:**
- Rate limiting when Redis unavailable (lower ceilings)
- Burst control for concurrent operations
- Temporary token storage

**Detection Logic (`lib/kv-client.ts`):**
- Validates endpoint format: must be `https://api.cloudflare.com/client/v4/accounts/<acc>/storage/kv/<namespace>`
- Rejects R2 S3-style endpoints (prevents 404 errors)
- Auth failure cooldown: 10-minute disable on 401/403 responses

**Free Tier Limits:**
- API rate limit: 60 req/min (vs 100 on paid)
- Auth rate limit: 8 req/min (vs 10 on paid)
- Image uploads: 10/min (vs 20 on paid)

---

## 4. Integration Patterns

### Multi-Layer Caching Strategy

```
Browser Cache (SW, HTTP) 
    ↓
Cloudflare CDN (R2 public assets)
    ↓
Vercel Edge Cache (applyEdgeCacheHeaders)
    ↓
Upstash Redis (short-TTL bootstrap cache)
    ↓
Supabase Database (source of truth)
```

### Rate Limiting Hierarchy

```
1. Cloudflare WAF (platform-level DDoS protection)
    ↓
2. Upstash Redis (distributed sliding window)
    ↓
3. Cloudflare KV (fallback, lower limits)
    ↓
4. In-memory isolate counter (last resort)
```

### Authentication Flow

```
1. Browser: Cookie-backed Supabase client (@supabase/ssr)
2. Middleware: JWT verification + profile lookup
3. API Route: Admin client (service role) for data access
4. Gateway Worker: Optional edge auth for high-traffic routes
```

### Offline-First Architecture

**Durable Objects (`SchoolSyncQueue`):**
- Queues mutations when device is offline
- Replays on reconnection with idempotency keys
- Per-school isolation prevents cross-tenant leakage

**Local Sync Queue (`lib/offline-sync-queue.ts`):**
- localStorage-backed queue in browser
- Batch uploads with exponential backoff
- Conflict resolution via last-write-wins + audit log

---

## 5. Security Considerations

### Secret Management

**Environment Variables:**
- `SUPABASE_SERVICE_ROLE_KEY`: Never exposed to browser, only server-side
- `UPSTASH_REDIS_REST_TOKEN`: Scoped to read/write specific key patterns
- `CLOUDFLARE_API_TOKEN`: OAuth-based, not used in runtime code

**Deployment Scripts:**
- `scripts/put-gateway-upstash-secrets.mjs`: Pushes secrets to Worker via Wrangler
- `scripts/provision-cloudflare.mjs`: Creates KV namespaces and R2 buckets
- Secrets never committed to git; managed via `.env.local`

### Tenant Isolation

**Database Level:**
- Every table has `school_id` column
- RLS policies enforce isolation for anon-key queries
- Service role bypasses RLS → route-level scoping mandatory

**Cache Level:**
- Redis keys always include `schoolId` prefix
- KV keys scoped by school + user
- Durable Objects partitioned by school ID

### Failure Modes

**Supabase Down:**
- Auth fails → users cannot login
- Existing sessions continue until JWT expiry
- Health checks report degraded status

**Upstash Down:**
- Circuit breaker opens → falls back to in-memory
- Rate limits become per-isolate (less accurate)
- Cache misses increase database load

**Cloudflare Down:**
- R2 assets unavailable → proxy mode fallback
- Worker gateway bypassed → direct Vercel routing
- KV rate limits unavailable → Redis/in-memory fallback

---

## 6. Cost Optimization

### Free Tier Guards

**Supabase:**
- Connection pooling via singleton admin client
- 20s fetch timeout prevents wasted compute
- Batch queries where possible (`lib/batch-query.ts`)

**Upstash:**
- Key whitelist prevents accidental expensive operations
- TTL enforcement prevents unbounded growth
- Circuit breaker prevents retry storms

**Cloudflare:**
- Workers free tier: 100k requests/day
- R2: $0.015/GB-month storage, $0.36/million operations
- KV: 100k reads/day free, then $0.50/million

### Monitoring

**Metrics Cached in Redis:**
- Daily API call counts per school
- AI feature usage quotas
- Image upload volumes

**Health Checks:**
- `/api/health/ready`: Checks Supabase + Redis connectivity
- `/api/health`: Lightweight ping without dependencies
- Circuit breaker state exposed for ops monitoring

---

## 7. Migration Roadmap

### Current State
- **Primary**: Supabase (auth + data) + Upstash Redis (state)
- **Secondary**: Cloudflare R2 (assets) + Workers (gateway)
- **Legacy**: Cloudflare KV (migrating to Redis)

### Planned Changes
1. **Remove KV dependency**: Fully migrate rate limiting to Upstash
2. **Enable Durable Objects**: Activate offline mutation queue
3. **Gateway Worker expansion**: Move more auth logic to edge
4. **R2 CDN optimization**: Implement signed URLs for private assets

---

## 8. Operational Runbooks

### Provisioning New Environment

```bash
# 1. Provision Cloudflare resources
node scripts/provision-cloudflare.mjs

# 2. Push Upstash secrets to Worker
node --env-file=.env.local scripts/put-gateway-upstash-secrets.mjs

# 3. Deploy Worker
cd workers/gateway && npx wrangler deploy

# 4. Verify connectivity
node scripts/check-supabase-connectivity.mjs
node scripts/probe-upstash.mjs
```

### Debugging Redis Issues

```bash
# Check circuit breaker state
curl https://your-app.vercel.app/api/health/ready

# Inspect Redis keys (development only)
node scripts/inspect-upstash.mjs

# Test Redis liveness
node scripts/probe-upstash.mjs --ping
```

### Rotating Secrets

```bash
# Rotate Upstash token
wrangler secret put UPSTASH_REDIS_REST_TOKEN --env production

# Rotate Cloudflare API token (OAuth, not in code)
wrangler login

# Rotate Supabase service role key (requires DB migration)
# Update SUPABASE_SERVICE_ROLE_KEY in Vercel env vars
```

---

## Summary

ZamSchool uses a **three-tier cloud architecture**:

1. **Supabase**: Primary backend for auth, data, and real-time features
2. **Upstash Redis**: Distributed state for rate limiting, caching, and session management
3. **Cloudflare**: Edge compute (Workers), object storage (R2), and legacy KV fallback

This architecture provides:
- **Scalability**: Serverless-friendly, no connection pooling issues
- **Resilience**: Circuit breakers, fallback strategies, multi-region redundancy
- **Security**: Tenant isolation at every layer, secret rotation support
- **Cost efficiency**: Free-tier guards, TTL enforcement, cache-first design

For questions or issues, refer to:
- `lib/redis/keys.ts` — Approved Redis key patterns
- `lib/r2-config.ts` — R2 validation logic
- `workers/gateway/wrangler.toml` — Worker configuration
- `docs/SECURITY.md` — Security audit findings and remediation
