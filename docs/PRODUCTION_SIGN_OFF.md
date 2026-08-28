# Production Sign-Off

**Product:** ZamSchool OS  
**Release date:** 2026-07-20  
**Release owner:** TBD  
**Target environment:** Production  
**Status:** Automated gates ready; human approval still required before launch.

## Automated Gates

| Gate | Command | Status | Notes |
|------|---------|--------|-------|
| Build | `npm run build` | Pass | Reported passing by operator. |
| Tests | `npm test` | Pass | All 94 test files passed on 2026-07-20. |
| Lint | `npm run lint` | Pass with warnings | 0 errors; warnings are non-blocking cleanup. |
| Schema | `npm run schema:check:strict` | Pass | No missing tables, duplicate migrations, or RLS gaps. |
| Tenant audit | `npm run audit:tenant:strict` | Pass | 0 fail, 0 review findings. |
| Security subset | `npm run test:security` | Pass | MFA, tenant audit, gateway auth/rate-limit, file route checks passed. |
| Pilot preflight | `npm run pilot:preflight` | Required | Must pass before production sign-off. |

## Release Scope

- Backend tenant isolation hardening for service-role queries.
- Explicit school scoping for push devices and idempotency storage.
- Gateway cache isolation and private upload download protections.
- Production and pilot runbooks/checklists added for launch control.

## Human Sign-Off

| Role | Name | Approval | Date | Notes |
|------|------|----------|------|-------|
| Release engineer | TBD | Pending | TBD | Runs final commands. |
| Independent reviewer | TBD | Pending | TBD | Confirms security and rollback. |
| School stakeholder | TBD | Pending | TBD | Confirms pilot workflows. |
| Operations owner | TBD | Pending | TBD | Confirms monitoring and DR readiness. |

## Required Before Production Launch

- Confirm production environment variables and secrets are configured.
- Apply migrations in lexical order to production Supabase.
- Run `npm run production:sign-off` from a clean release candidate.
- Run a real health probe using `PILOT_HEALTH_URL` or `LOAD_TEST_BASE_URL`.
- Complete stakeholder approval in `docs/STAKEHOLDER_APPROVAL.md`.
- Confirm DR drill status in `docs/DR_DRILL_LOG.md`.

## Rollback

- Revert the release commit and redeploy the previous successful build.
- Roll back Cloudflare Worker through deployment history if gateway changed.
- Purge Cloudflare cache after rollback.
- For migrations, use the documented forward-only mitigation or manually verified reverse plan.
