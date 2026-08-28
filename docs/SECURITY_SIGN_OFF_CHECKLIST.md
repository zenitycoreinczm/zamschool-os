# Security Sign-Off Checklist

**Date:** 2026-07-20  
**Status:** Automated checks passed; human reviewer approval pending.

## Automated Security Gates

| Check | Command | Status |
|-------|---------|--------|
| Tenant isolation audit | `npm run audit:tenant:strict` | Pass, 0 findings |
| Security tests | `npm run test:security` | Pass |
| Full tests | `npm test` | Pass |
| Schema/RLS check | `npm run schema:check:strict` | Pass |
| Lint | `npm run lint` | Pass with warnings |

## Security Controls Confirmed

- API routes use actor or role-specific guards.
- Supabase service-role queries are statically audited for explicit tenant scope.
- MFA routes use fail-closed rate limiting.
- CSRF protection is enforced for same-origin mutations.
- Private upload downloads are tenant-scoped and served with `private, no-store`.
- Gateway cache keys are isolated per bearer token digest.
- Debug routes are blocked outside explicitly enabled local development.

## Manual Reviewer Checklist

- [ ] Review production `NEXT_PUBLIC_SUPABASE_URL`, anon key, and service-role secret handling.
- [ ] Confirm Supabase RLS is enabled and forced on production tenant tables.
- [ ] Confirm Cloudflare allowed origins and host allow-list match production domains.
- [ ] Confirm Upstash Redis is configured for production rate limits.
- [ ] Confirm no `.env.local`, logs, or credentials are committed.
- [ ] Confirm school data-processing and privacy expectations are documented with stakeholders.

## Open Security Notes

- Lint warnings remain for unused eslint-disable comments and one `<img>` warning; no lint errors remain.
- A live production-domain health probe still needs to run before launch.
