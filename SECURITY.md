# SECURITY

## Security invariants
- All endpoints are assumed hostile by default.
- Tenant isolation is enforced through actor context, RLS, and explicit `school_id` filters.
- JWTs are verified before privileged access is granted.
- Rate limiting uses tenant-aware and actor-aware keys.
- Mutations must be auditable.

## Current shared patterns
- Authentication: `requireActorContext`, `requireAdminContext`
- Authorization: `requireFeatureAccess`, route/domain ownership checks
- Tenant helpers: `lib/tenant/tenant-context.ts`
- Rate limiting: `applyRateLimit` with tenant-aware keys

## Login brute-force policy (updated 2026-07-21)
- **Email lockout**: 3 failed attempts → 60-second cooldown.  
  Each subsequent failure after the cooldown doubles the wait (60s → 120s → 240s → … up to 15 min).  
  Counter is cleared on successful login.
- **IP hard-ban**: 4 cumulative failures from the same IP (across any accounts) → 24-hour ban.  
  Stored in a separate Redis key; NOT cleared by a successful login from that IP  
  (prevents shared-NAT abuse via account rotation).
- **Memory fallback**: when Upstash Redis is unavailable, process-local in-memory counters  
  apply the same thresholds (single-instance only — use Redis in production).
- Honeypot field (`zs_login_hp`) silently rejects automated form submissions.
- API-level rate limit for the `login-guard` endpoint: 6 req/min (free tier) / 10 req/min.

## Shared-device privacy
- The login page does **not** reveal the previous session's email address.  
  It shows only the role (e.g. "A teacher account is already signed in.").

## Row Level Security
- All 91 tenant tables have `FORCE ROW LEVEL SECURITY` applied.
- Migration `20260621120000_force_rls_all_tenant_tables.sql` enforces this for the table owner.
- Migration `20260721120000_rls_audit_review.sql` acts as a regression guard —  
  it fails at deploy time if any table is missing FORCE RLS.
- `service_role` bypass is intentional for server-only admin operations.

## Known limitations
- `script-src 'unsafe-inline'` is present in the CSP — this is required by Next.js for CSS-in-JS  
  style injection. Migrating to nonce-based CSP is tracked as future hardening work.
- `Permissions-Policy` blocks camera/microphone/geolocation. If QR-based attendance  
  scanning is added, `camera=(self)` must be added to the policy in `vercel.json`.

## Operational notes
- Privileged service-role code must remain minimal and explicit.
- New cache keys must include tenant scope.
- Security-sensitive architecture changes require documentation updates.
- National / data-center multi-school deploys: see `docs/DATACENTER_SECURITY.md` and run `npm run security:server`.
- Origin edge gates live in `proxy.ts` (host allow-list, body size, IP ban, bot/scanner blocks).
