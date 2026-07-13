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

## Operational notes
- Privileged service-role code must remain minimal and explicit.
- New cache keys must include tenant scope.
- Security-sensitive architecture changes require documentation updates.
- National / data-center multi-school deploys: see `docs/DATACENTER_SECURITY.md` and run `npm run security:server`.
- Origin edge gates live in `proxy.ts` (host allow-list, body size, IP ban, bot/scanner blocks).
