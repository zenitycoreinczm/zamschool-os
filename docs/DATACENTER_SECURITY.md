# Data-center security (Zambia multi-school scale)

This guide is for running ZamSchool OS as a **national / provincial school platform** — many schools, one controlled server (or cluster), with Upstash + Cloudflare in front of Supabase.

For app-layer auth and RLS, see [SECURITY.md](./SECURITY.md). For day-two ops, see [OPERATIONS.md](./OPERATIONS.md).

## Threat model (data center)

| Threat | Defence |
|--------|---------|
| Credential stuffing / bots | Redis login lockout, auth rate limits, honeypot, edge flood, IP ban |
| Scanner / exploit probes | Attack-path 404, bot UA block, temporary IP ban after abuse |
| Host-header attacks | `ALLOWED_HOSTS` / app origin allow-list in middleware |
| Oversized payloads | Content-Length gate (1 MiB API / 25 MiB upload paths) |
| Cross-tenant data access | RLS + `requireActorContext` + service-role audit |
| Origin overload | Upstash rate limits, hot-read cache, R2 for files, optional gateway |
| Secret leakage | Sanitized public errors, no source maps, no service role on client |
| Insider / admin abuse | MFA for sensitive roles, audit logs, least privilege |

## Required production environment

Set these on every origin server (Vercel / VPS / k8s):

```bash
# Identity & tenant DB
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...          # server only — never NEXT_PUBLIC_

# Distributed shield (required for national scale)
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...

# Public host lockdown
NEXT_PUBLIC_APP_ORIGIN=https://app.yourdomain.zm
CORS_ALLOWED_ORIGINS=https://app.yourdomain.zm
ALLOWED_HOSTS=app.yourdomain.zm

# Data-center mode
ZAMSCHOOL_DC_MODE=true
# Optional: refuse process start if gates fail
# ZAMSCHOOL_DC_STRICT=true

# Optional permanent IP denylist (comma-separated)
# SECURITY_BLOCKED_IPS=1.2.3.4,5.6.7.8

# Files off Supabase (use Cloudflare 10GB+ R2)
R2_ENDPOINT=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_PUBLIC_URL=https://pub-xxxx.r2.dev
NEXT_PUBLIC_R2_PUBLIC_URL=https://pub-xxxx.r2.dev
```

## Network layout (recommended)

```
Internet
   │
   ▼
Cloudflare (DNS + WAF + Bot Fight + TLS)
   │  optional: Gateway Worker (JWT + edge cache + KV rate limit)
   ▼
Origin (Next.js standalone / Vercel)
   │  Upstash Redis  — rate limits, lockouts, IP bans, shell cache
   │  Supabase       — Postgres + Auth + RLS (system of record)
   └── R2            — avatars, uploads (not Postgres)
```

### Cloudflare (edge)

1. Proxy orange-cloud on the app hostname.
2. Enable **Bot Fight Mode** / Super Bot Fight (plan dependent).
3. WAF managed rules + rate limiting on `/api/auth/*` and `/login`.
4. TLS 1.2+ only; always HTTPS redirects.
5. Optionally put the **gateway worker** in front of `/api/*`.

### Origin server

1. Run `npm run security:server` before every production deploy.
2. Run `npm run protect:status` to verify Redis + R2.
3. Do not expose Postgres, Redis, or Supabase service role to the public internet.
4. Prefer private networking between app and DB when self-hosting Supabase.
5. Patch OS packages; restrict SSH to bastion + keys only; disable password SSH.

## Application controls already in code

| Control | Location |
|---------|----------|
| Host / method / body size gate | `proxy.ts` + `lib/server-security-edge.ts` |
| Attack path + bot scoring | `lib/request-security.ts` |
| Temporary IP ban after abuse | `lib/ip-reputation.ts` (Redis `rl:ipban:*`) |
| Login lockout | `lib/redis/login-lockout.ts` |
| Production boot gates | `instrumentation.ts` + `lib/server-security-policy.ts` |
| Safe client errors | `lib/safe-error.ts` |
| Tenant RLS + route guards | Supabase migrations + `requireActorContext` |
| Free-tier / Hobby ceilings | `lib/free-tier-guard.ts` (`ZAMSCHOOL_FREE_TIER`) |
| L1 edge flood (per isolate) | `proxy.ts` + `checkMiddlewareFloodLimit` |
| L2 distributed edge limits (Upstash) | `lib/edge-distributed-limit.ts` — minute + daily API cap |
| Platform / auth route limits | `lib/platform-api-guard.ts`, `lib/auth-api-rate-limit.ts` |
| Supabase 25 req/s budget | `lib/supabase-fetch-guard.ts` + `lib/supabase-request-budget.ts` |
| Gateway free-tier rate limits | `workers/gateway` (`FREE_TIER=true`) |

### Free-tier protection (Hobby / free Supabase)

Production defaults to free-tier mode unless `ZAMSCHOOL_FREE_TIER=false`:

1. **Cloudflare** — WAF / bot fight / optional gateway worker absorb scrapers before Vercel.
2. **Edge L1 (memory)** — tight per-IP flood on auth / API / pages.
3. **Edge L2 (Upstash)** — shared minute windows + **2,500 API req/day/IP** so multi-isolate fan-out cannot burn Hobby.
4. **Route Redis limits** — auth + platform presets (tighter on free tier).
5. **Supabase guard** — global fetch intercept caps at ~25 req/s per process/device.
6. **R2** — files never hit Supabase Storage free quota.

Opt out only after paid Vercel + Supabase: set `ZAMSCHOOL_FREE_TIER=false` and gateway `FREE_TIER=false`.

## Capacity notes for “all schools in Zambia”

1. **Supabase** — keep free-tier safe with Redis caches + request budget; plan Pro when concurrent schools grow.
2. **Upstash** — primary for rate limits/bans; watch command budget; never store student lists in Redis.
3. **R2** — all binary assets; set lifecycle rules for temp uploads.
4. **Horizontal scale** — multiple Next.js instances are safe because bans/limits are in Redis.
5. **Load test** — `npm run load:test:tier2` before provincial roll-out; tier3 before national.

## Pre-deploy checklist

```bash
npm run security:server      # this preflight
npm run protect:status       # Redis + R2 + Supabase reachability
npm run audit:tenant:strict  # no unscoped service-role queries
npm run test:security
npm run production:sign-off  # full sign-off pack when ready
```

## Incident: abusive IP

1. Confirm in logs: `security.ip_banned` events (hashed IP only).
2. Temporary ban is automatic (1 hour after abuse threshold).
3. Permanent: add to `SECURITY_BLOCKED_IPS` and redeploy, or block in Cloudflare WAF.
4. Never log raw student data in incident channels.

## What you must not do

- Do not open Supabase service role to the browser.
- Do not disable RLS “to make a report work”.
- Do not run production without Upstash if serving many schools.
- Do not store backups on the same disk as the live DB without offsite copy.
- Do not skip MFA for head-office / principal accounts once rolled out.
