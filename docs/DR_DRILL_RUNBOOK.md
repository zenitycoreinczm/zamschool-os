# DR Drill Runbook

## Purpose

Verify that ZamSchool OS can restore from backup and resume key school workflows without cross-tenant data exposure.

## Frequency

- Run at least every 90 days.
- Run before first paid production launch.
- Run after major schema, RLS, auth, or storage changes.

## Preconditions

- Supabase point-in-time recovery or latest backup is available.
- A non-production Supabase project is available for restore testing.
- Test accounts exist for Head Teacher, Teacher, Parent, Student, and Payments roles.
- Cloudflare R2 test bucket or isolated prefix is configured.

## Procedure

1. Restore the latest production backup to a non-production Supabase project.
2. Apply all migrations in lexical order if the restore is behind the current release.
3. Run `npm run schema:check:strict` against the restored database configuration.
4. Run `npm run audit:tenant:strict` locally.
5. Verify login, MFA challenge, first-login password reset, and sign-out.
6. Verify one representative read flow per role: dashboard, timetable, attendance, results, fees.
7. Verify one representative write flow: announcement creation, attendance roll call, payment record in test data.
8. Verify private upload access is same-school only.
9. Confirm no School A account can read School B data.
10. Record results in `docs/DR_DRILL_LOG.md`.

## Pass Criteria

- Restore completes successfully.
- Schema and tenant audit pass.
- All representative role flows pass.
- No cross-tenant read or write is observed.
- Recovery time and issues are recorded.

## Failure Handling

- Pause production launch.
- Open an incident or release blocker.
- Root-cause the failure and re-run the drill after fixes.
