# Service-role tenant isolation audit

**Generated:** 2026-07-12  
**Command:** `node scripts/security/audit-service-role-tenant.mjs`

This report lists `supabaseAdmin.from(...)` calls where a `school_id` (or documented exception) was **not** detected in the static scan window.

| Severity | Count |
|----------|-------|
| Fail | 0 |
| Review | 0 |

_No findings — all scanned calls matched tenant guard heuristics._
