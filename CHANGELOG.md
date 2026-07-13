# CHANGELOG

All notable changes to ZamSchool OS are recorded here. The format is borrowed from Keep a Changelog; entries are grouped by date.

## 2026-07-08 — Class creation moves to the Registrar
- The Registrar (not the Academic Admin) now creates, edits, and deletes classes. `app/api/admin/classes/route.ts` checks the `registry` domain (owned by `REGISTRAR`) instead of `academic` for all three write operations; error messages updated to match.
- `lib/permission-group-defaults.ts`: "Admissions & Registrar" gained `can_create` on `classes`; "Academic Administration" is now read-only on `classes`. Added `supabase/migrations/20260709000000_transfer_class_creation_to_registrar.sql` to sync existing schools' DB-backed permissions.
- `components/registrar/RegistrarClassesPage.tsx` gained a full create/edit/delete class form (name, grade level, capacity), replacing the old "Academic Admin creates classes" messaging.
- `app/app/admin/classes/page.tsx` (shared classes console) now hides the Add/Edit/Delete controls for roles that no longer own the class entity (e.g. Academic Admin), showing a clean read-only view instead of a dead-end 403.
- Refreshed workflow copy on the Registrar workspace home, Academic Admin dashboard, and `AdminRoleWorkspace` module descriptions so every surface agrees on who owns class creation.

## 2026-06-28 — Head-teacher Settings fix
- Added a dedicated `app/app/principal/settings/page.tsx` that renders the head-teacher Settings page with `accent="indigo"`, matching the `PrincipalWorkspace` accent. The principal's Settings nav in `lib/workspace-nav.ts` now points at the new path instead of the admin-level fallback (which used `accent="emerald"`).
- Made `/api/account/session` log to the server console in non-prod on 500 so the underlying cause is recoverable from logs. The response shape now includes a `cause` field with that detail in non-prod; prod stays generic.
- `lib/account-portal-api.ts` and `components/account/AccountSettingsPage.tsx` now read `body.cause` before falling back to `body.error`, so a non-prod toast carries the real cause instead of the literal "Failed to load session".
- Pinned the load-bearing contracts with `__tests__/components/principal-settings.test.mjs` (4 assertions).

## 2026-06-28 — Quality pass
- Refreshed `docs/AUDIT.md` against current source; six prior "Needs Work" items confirmed resolved in the working tree and moved into a new "Resolved since 2026-06-21" subsection.
- Re-verified `MobileDock`, sidebar width source-of-truth, `prefers-reduced-motion` coverage, and inbox unread refresh model; promoted to `Done Well` where they held.
- Added shell a11y invariants test (`__tests__/components/shell-a11y.test.mjs`) so the resolved a11y shape cannot regress.
- Fixed `role="alert"` on the `TeacherShell` workspace error banner so it matches the other four role shells.
- Clarified the boundary between `WorkspaceContextProvider` and `TeacherWorkspaceProvider` in `docs/ARCHITECTURE.md` — the two providers carry different data shapes (`stats`, `workload`, `refresh()`) and a wholesale merge is not appropriate today.
- Documented the rationale for `suppressHydrationWarning` on `<body>` in `app/layout.tsx` (Next/font class hash).
- Shipped `scripts/audit-refresh.mjs` (wired as `npm run audit:refresh`) — re-reads each cited file from `docs/AUDIT.md` and asserts 11 invariants. Codified by `__tests__/lib/audit-refresh.test.mjs`.
- Documented the `lib/` subdomain policy in `docs/DEVELOPMENT.md` so new files land in subdomain folders instead of at the top level.
- Shipped the `lib/` subdomain guardrail (`eslint-rules/lib-subdomain-policy.mjs` + `eslint-rules/lib-legacy-whitelist.json`) and codified it with `__tests__/lib/lib-subdomain-policy.test.mjs`. The legacy allow-list contains every current top-level `lib/` file; new files at the top level emit a warning with the suggested subdomain.
- Moved the `lib/redis-*` cluster (6 files) into `lib/redis/` as the Phase 4 pilot. Import paths rewritten across `app/api/account/shell/route.ts`, `app/api/auth/send-otp/route.ts`, and 7 files under `lib/`. TypeScript clean; `npm test` green (55 test files).

## 2026-07-12 — Test stabilization and lib/ subdomain migration
- Fixed a real policy gap: `admin` accounts were missing from `MANAGED_FIRST_LOGIN_ROLES` in `lib/account-state.ts`, so school administrator accounts skipped the mandatory first-login password change that every other managed role gets.
- Updated several stale static-grep test assertions left behind by prior refactors (admin users UI copy, `AdminShell`/`WorkspaceShellHeader` badge wiring, `Announcements` admin-role set, teacher shell route JSX, teacher portal nav routes, ICT permission defaults) so `npm test` is green (85/85 test files).
- Fixed a real React lint error in `components/workspace/useNavBadges.ts` (`react-hooks/set-state-in-effect`) by deriving workspace unread values before the effect and scoping a documented lint exception for the external-sync effects that remain. `npm run lint` is now clean (0 errors).
- Registered the current in-progress security/infrastructure `lib/` additions in `eslint-rules/lib-legacy-whitelist.json` so the subdomain-policy test suite does not flag them as unexpected.
- Continued the Phase 4 `lib/` subdomain migration: moved `lib/tenant-context.ts` into `lib/tenant/tenant-context.ts` (5 importers rewritten across `app/api/admin/announcements/route.ts`, `app/api/admin/notifications/route.ts`, `app/api/admin/users/route.ts`, `app/api/staff/invitations/route.ts`, and `lib/platform-api-guard.ts`). Updated `scripts/audit-refresh.mjs`, `__tests__/lib/audit-refresh.test.mjs`, `ARCHITECTURE.md`, and `SECURITY.md` to reference the new path.
- Added genuine runtime tests for `lib/tenant/tenant-context.ts` (previously untested) proving `requireTenantId` fails closed on missing/blank school ids and `withTenantFilter` / `tenantActorRateLimitKey` actually scope queries and rate-limit keys by school, not just grep-match the source.

## Unreleased
- Standardized tenant-aware actor rate-limit key composition
- Added required architecture/security/operations documentation stubs
- Hardened staff invitation and admin user write rate limits with tenant scope
