# Service-role tenant isolation audit

**Generated:** 2026-07-20  
**Command:** `node scripts/security/audit-service-role-tenant.mjs`

This report lists `supabaseAdmin.from(...)` calls where a `school_id` (or documented exception) was **not** detected in the static scan window.

| Severity | Count |
|----------|-------|
| Fail | 0 |
| Review | 13 |

## Findings

| File | Line | Table | Level | Reason |
|------|------|-------|-------|--------|
| `app/api/account/push-token/route.ts` | 49 | `user_devices` | review | no school_id guard detected in scan window |
| `app/api/account/push-token/route.ts` | 55 | `user_devices` | review | no school_id guard detected in scan window |
| `app/api/notifications/push/route.ts` | 73 | `user_devices` | review | no school_id guard detected in scan window |
| `app/api/notifications/push/route.ts` | 80 | `user_devices` | review | no school_id guard detected in scan window |
| `app/api/notifications/push/route.ts` | 86 | `user_devices` | review | no school_id guard detected in scan window |
| `lib/attendance/parent-recipients.ts` | 117 | `parents` | review | no school_id guard detected in scan window |
| `lib/attendance/sync-notifications.ts` | 226 | `user_devices` | review | no school_id guard detected in scan window |
| `lib/attendance/sync-notifications.ts` | 233 | `user_devices` | review | no school_id guard detected in scan window |
| `lib/idempotency.ts` | 37 | `idempotency_keys` | review | no school_id guard detected in scan window |
| `lib/idempotency.ts` | 59 | `idempotency_keys` | review | no school_id guard detected in scan window |
| `lib/push-dispatch.ts` | 64 | `user_devices` | review | no school_id guard detected in scan window |
| `lib/push-dispatch.ts` | 71 | `user_devices` | review | no school_id guard detected in scan window |
| `lib/push-dispatch.ts` | 78 | `user_devices` | review | no school_id guard detected in scan window |

## Exceptions (by design)

- **Global tables:** `schools`, `access_codes`, `auth.users`, `temp_tokens`
- **Token flows:** `staff_invitations` with `.eq('token')` or invitation id
- **Auth admin:** `supabaseAdmin.auth.*` (not scanned)

## Week 2 checklist

- [ ] Confirm each **review** row is safe or add `.eq('school_id', schoolId)`
- [ ] Re-run with `--strict` before production sign-off
