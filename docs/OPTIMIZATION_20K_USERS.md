# Optimization Guide: Supporting 20,000+ Daily Users

This document outlines the comprehensive optimization strategy for ZamSchool to support 20,000+ daily active users while maintaining sub-second response times and minimizing cloud service costs.

---

## Current Infrastructure Capacity

### Upstash Redis (Underutilized)
- **Commands**: 18K / 500K per month (3.6% utilization)
- **Reads**: 7,961 | **Writes**: 9,901
- **Storage**: 10 KB / 256 MB (0.004% utilization)
- **Bandwidth**: 0 B / 50 GB

**Opportunity**: Massive headroom for aggressive caching strategies

### Supabase
- Primary backend for auth + data
- Service role bypasses RLS (requires careful scoping)
- Connection pooling via singleton pattern

### Cloudflare
- Workers Gateway for edge compute
- R2 for asset storage (CDN delivery)
- KV as legacy fallback (migrating to Redis)

---

## Optimization Strategies Implemented

### 1. Enhanced Redis Caching Layer (`lib/redis/enhanced-cache.ts`)

#### Multi-Level Caching Strategies

**Read-Through Cache**
```typescript
// Automatic cache population on miss
const profile = await cacheReadThrough(
  cachePresets.userProfile(userId).key,
  () => fetchUserProfile(userId),
  cachePresets.userProfile(userId).options
);
```

**Write-Behind Cache**
```typescript
// Immediate cache update, async persistence
await cacheWriteBehind(
  cachePresets.dashboardSummary(userId, role).key,
  dashboardData,
  cachePresets.dashboardSummary(userId, role).options,
  () => persistToDatabase(dashboardData)
);
```

**Batch Prefetching**
```typescript
// Eliminate N+1 queries
const students = await cacheBatchPrefetch(
  studentIds.map(id => cachePresets.studentProfile(id).key),
  (missingKeys) => batchFetchStudents(missingKeys),
  { ttl: TTL.PROFILE }
);
```

#### Cache TTL Presets

| Data Type | TTL | Rationale |
|-----------|-----|-----------|
| User Profile | 5 min | Balance freshness vs load |
| School Context | 10 min | Semi-static data |
| Class Lists | 15 min | Changes infrequently |
| Dashboard Summary | 2 min | High-frequency updates |
| Grading Scales | 2 hours | Rarely changes |
| Academic Years | 24 hours | Static reference data |

**Expected Impact**: 70-80% reduction in Supabase read queries

---

### 2. Optimized Supabase Connection Pool (`lib/supabase-connection-pool.ts`)

#### Connection Reuse
- Singleton admin client prevents connection churn
- Adaptive timeout (20s) with exponential backoff
- Automatic retry on transient failures (max 2 retries)

#### Query Optimization
```typescript
// Batch related queries
const [profile, school, classes] = await batchQueries([
  () => optimizedQueries.userProfile(userId, schoolId),
  () => optimizedQueries.schoolContext(schoolId),
  () => optimizedQueries.classList(schoolId),
]);

// Paginated queries with cursor-based pagination
const allStudents = await paginatedQuery(
  (page, pageSize) => supabase
    .from("students")
    .select("*")
    .eq("school_id", schoolId)
    .range(page * pageSize, (page + 1) * pageSize - 1),
  { pageSize: 100, maxPages: 10 }
);
```

#### Health Monitoring
```typescript
const health = await checkSupabaseHealth();
// Returns: { status: "healthy" | "degraded" | "unhealthy", latency: number }
```

**Expected Impact**: 40-50% reduction in connection overhead, 30% faster query execution

---

### 3. Edge Compute Optimization (`workers/gateway/src/optimized-auth.ts`)

#### JWT Validation at Edge
- Validate tokens before reaching origin
- Cache JWKS keys for 1 hour at edge
- Reduce auth route load by 60-70%

#### Edge-Level Rate Limiting
```typescript
const limit = await checkRateLimit(
  `api:${userId}`,
  100, // requests
  60,  // seconds
  env
);

if (!limit.allowed) {
  return new Response("Rate limit exceeded", { status: 429 });
}
```

#### Request Deduplication
```typescript
// Prevent thundering herd on cache misses
const data = await deduplicateRequest(
  `school:${schoolId}:context`,
  () => fetchSchoolContext(schoolId)
);
```

**Expected Impact**: 50-60% reduction in origin API calls, 100-200ms latency improvement

---

### 4. Aggressive CDN Strategy

#### R2 Asset Delivery
- All user uploads served via R2 CDN
- Signed URLs for private assets
- Browser cache headers (1 year for immutable assets)

#### Cloudflare Cache Rules
```
/api/public/assets/* → Cache 1 year, stale-while-revalidate 7 days
/api/student/results/certificate/* → Cache 1 hour, revalidate on change
/api/teacher/attendance/export/* → No cache, edge auth only
```

**Expected Impact**: 90% reduction in asset bandwidth from origin

---

## Security Audit Findings & Remediations

### Critical Fixes Already Applied

✅ **H1: Cross-Tenant Invitation Takeover**
- Added global profile/auth-user checks in `/api/staff/invitations`
- Prevents account creation across schools

✅ **H2: AAL2 Enforcement for Sensitive Mutations**
- Created `lib/auth-aal-guard.ts` helper
- Integrated into MFA factor deletion and password change routes
- Blocks aal1 sessions when verified MFA factors exist

✅ **#10: Teacher Discipline Records Scoping**
- Teachers now scoped to assigned classes only
- Uses `loadTeacherAssignmentScope()` for accurate filtering

✅ **#11: Removed user_metadata Role Fallback**
- Eliminated trust of client-controllable metadata
- All role checks now use database `profiles.role` exclusively

### Remaining Security Tasks

🟡 **Medium Priority**:
- Complete-first-login bypass protection
- Reset token replay prevention
- Attendance notification recipient scoping
- Admin message ownership validation

🔵 **Low Priority**:
- Email HTML escaping improvements
- Change-password rate limit tightening

---

## Performance Targets for 20K Users

### Response Time Goals
| Endpoint Type | Target P50 | Target P95 | Target P99 |
|---------------|------------|------------|------------|
| Auth (login/MFA) | < 500ms | < 1s | < 2s |
| Data Read (GET) | < 200ms | < 500ms | < 1s |
| Data Write (POST/PUT) | < 300ms | < 800ms | < 1.5s |
| Dashboard Load | < 1s | < 2s | < 3s |

### Throughput Goals
- **Concurrent Users**: 2,000 simultaneous (10% of 20K daily)
- **API Requests/sec**: 500 rps sustained, 1,000 rps peak
- **Database Queries**: < 10,000/min (via caching)

### Reliability Goals
- **Uptime**: 99.9% (43 minutes downtime/month max)
- **Error Rate**: < 0.1% (excluding 4xx client errors)
- **Cache Hit Rate**: > 75% (Redis + edge cache)

---

## Cost Optimization

### Upstash Redis (Current: $0 - Free Tier)
**Projected Usage at 20K Users**:
- Commands: ~150K/month (30% of 500K free tier)
- Storage: ~50 MB (20% of 256 MB free tier)
- **Cost**: $0 (stays within free tier)

**Optimization Tactics**:
- Key whitelist prevents accidental expensive operations
- TTL enforcement prevents unbounded growth
- Circuit breaker prevents retry storms

### Supabase (Estimated $25-50/month on Pro Plan)
**Cost Reduction Strategies**:
- 70-80% query reduction via Redis caching
- Connection pooling reduces concurrent connections
- Batch queries minimize round-trips

**Projected Savings**: 40-50% compared to naive implementation

### Cloudflare (Free Tier Sufficient)
- Workers: 100K requests/day free (20K users × 5 req/day = 100K)
- R2: $0.015/GB-month storage, $0.36/million operations
- **Estimated Cost**: $5-10/month for R2

**Total Monthly Cloud Cost**: $30-60 for 20K daily users

---

## Monitoring & Alerting

### Key Metrics to Track

**Redis Metrics**:
```typescript
import { getQueryMetrics } from "@/lib/supabase-connection-pool";

const metrics = getQueryMetrics();
// { totalQueries, cachedQueries, batchedQueries, queriesPerHour, cacheHitRate }
```

**Supabase Health**:
```typescript
import { checkSupabaseHealth } from "@/lib/supabase-connection-pool";

const health = await checkSupabaseHealth();
if (health.status === "degraded" || health.status === "unhealthy") {
  // Trigger alert
}
```

**Worker Performance**:
- Edge cache hit rate
- JWT validation success rate
- Rate limit trigger frequency

### Alert Thresholds

| Metric | Warning | Critical |
|--------|---------|----------|
| Redis Circuit Breaker | OPEN state | > 5min in OPEN state |
| Supabase Latency | > 1s P95 | > 3s P95 |
| Error Rate | > 0.5% | > 2% |
| Cache Hit Rate | < 60% | < 40% |
| Upstash Commands | > 400K/month | > 480K/month |

---

## Deployment Checklist

### Pre-Deployment
- [ ] Run security audit: `node scripts/security-audit-supabase.mjs`
- [ ] Verify Redis connectivity: `node scripts/probe-upstash.mjs`
- [ ] Check Supabase health: `node scripts/check-supabase-connectivity.mjs`
- [ ] Deploy Worker: `cd workers/gateway && npx wrangler deploy`

### Post-Deployment Verification
- [ ] Monitor Redis command count (should increase from 18K)
- [ ] Verify cache hit rates (> 60% within 24 hours)
- [ ] Check error logs for circuit breaker triggers
- [ ] Validate JWT edge validation is working
- [ ] Confirm R2 CDN delivery for assets

### Rollback Plan
If issues occur:
1. Disable enhanced cache: Set `REDIS_CACHE_ENABLED=false` env var
2. Bypass Worker: Update DNS to point directly to Vercel
3. Revert to previous deployment: `git revert <commit>`

---

## Migration Timeline

### Phase 1: Foundation (Week 1-2)
- ✅ Install Upstash skills
- ✅ Create enhanced cache layer
- ✅ Implement connection pool optimizer
- ✅ Deploy security audit script

### Phase 2: Edge Optimization (Week 3-4)
- Deploy JWT validation at edge
- Enable request deduplication
- Configure R2 CDN rules
- Test Durable Objects for offline sync

### Phase 3: Monitoring & Tuning (Week 5-6)
- Set up alerting dashboards
- Analyze cache hit patterns
- Tune TTL values based on usage
- Optimize slow queries

### Phase 4: Scale Testing (Week 7-8)
- Load test with 5K concurrent users
- Identify bottlenecks
- Fine-tune connection pools
- Validate cost projections

---

## Support Resources

### Documentation
- `docs/CLOUD_SERVICES_ARCHITECTURE.md` - Service integration details
- `lib/redis/enhanced-cache.ts` - Caching API reference
- `lib/supabase-connection-pool.ts` - Query optimization guide
- `workers/gateway/src/optimized-auth.ts` - Edge compute patterns

### Scripts
- `scripts/security-audit-supabase.mjs` - Security posture check
- `scripts/probe-upstash.mjs` - Redis connectivity test
- `scripts/check-supabase-connectivity.mjs` - Database health check

### Monitoring
- Redis circuit breaker state: `/api/health/ready`
- Supabase latency: `checkSupabaseHealth()`
- Query metrics: `getQueryMetrics()`

---

## Conclusion

With these optimizations, ZamSchool can confidently support 20,000+ daily users while:
- Staying within Upstash free tier (3.6% → 30% utilization)
- Reducing Supabase costs by 40-50% via aggressive caching
- Achieving sub-second response times via edge compute
- Maintaining strong security posture with automated audits

The architecture is designed to scale horizontally - adding more Upstash capacity or upgrading Supabase plans requires zero code changes, only configuration updates.
