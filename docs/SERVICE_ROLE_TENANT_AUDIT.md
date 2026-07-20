# Service-role tenant isolation audit

**Generated:** 2026-07-20  
**Command:** `node scripts/security/audit-service-role-tenant.mjs`

This report lists `supabaseAdmin.from(...)` calls where a `school_id` (or documented exception) was **not** detected in the static scan window.

| Severity | Count |
|----------|-------|
| Fail | 0 |
| Review | 0 |

_No findings - all scanned calls matched tenant guard heuristics._

## Exceptions (by design)

- **Global tables:** `schools`, `access_codes`, `auth.users`, `temp_tokens`
- **Token flows:** `staff_invitations` with `.eq('token')` or invitation id
- **Auth admin:** `supabaseAdmin.auth.*` (not scanned)
- **Idempotency:** `idempotency_keys` filtered by `school_id` + route/scope/key (service-role only)

## Checklist

- [ ] Confirm each **review** row is safe or add `.eq('school_id', schoolId)`
- [ ] Re-run with `--strict` before production sign-off
