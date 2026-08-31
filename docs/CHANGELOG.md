# Changelog

This document records notable changes to ZamSchool OS. You should add an entry on every merge to `main`. Keep entries short — one to three lines each, dated in ISO format.

The format is `## YYYY-MM-DD` for the section header and `- <one line>` for each change. You group changes by area when a release touches several places (`Frontend`, `Backend`, `Security`, `Docs`).

## How to use this

You write the entry when you open the pull request, not when you merge. If the PR is rejected or replaced, you delete the entry. You do not edit a merged entry after the fact; you write a follow-up entry that supersedes it.

You should link to the PR or issue from each entry. Long descriptions belong in the PR body, not here.

## Entries

### 2026-08-31

- **Production release.** Application declared production-ready after comprehensive cross-platform testing (mobile, web, desktop). All core modules confirmed functional: messaging, role-based permissions, attendance, results, fees, timetables, announcements. Deployed to https://zamschoolos.site via Vercel.
- **Mobile layout fix.** Added `overflow-x: hidden` to `html`/`body` in `app/globals.css` and `min-w-0 break-words` to all flex text items in `app/page.tsx` and `components/landing/SystemStatusBadge.tsx`. Prevents wide flex items from expanding the layout viewport past device width on mobile.
- **Security header split.** Introduced two-tier response header system in `lib/request-security.ts` (`HARDENED_SECURITY_HEADERS` vs `PUBLIC_SURFACE_SECURITY_HEADERS`). Updated `proxy.ts` `applySecurityHeaders()` to classify requests by path: public entry pages get lenient headers for emulator/preview compatibility; API and workspace routes get full lockdown (XFO=DENY, COOP, CORP, CSP frame-ancestors 'none'). Updated `lib/csp-policy.ts` with `frameAncestors` option ("none" vs "selfplus"). Fixed viewport emulator connection refusals.
- **vercel.json update.** Split global header rule (lenient for public pages) from `/api/(.*)` overlay (hardened). Removed blanket XFO/COOP/CORP from the catch-all rule.
- Docs: updated README.md (production status, two-tier header reference), SECURITY.md (response header policy section, disabled edge bot classification note), ARCHITECTURE.md (middleware bullet, production deployment section), UI-UX.md (mobile overflow containment subsection), DEVELOPMENT.md (build heap note, deployment section), PRODUCTION.md (Vercel deploy/rollback details), AUDIT.md (production release section).

### 2026-06-21

- Docs: wiped `docs/_archive/` (33 stale pilot/plan/operation files). Re-pointed the dangling references in `DATA.md`, `SECURITY.md`, `OPERATIONS.md`, `PRODUCTION.md`, and `CHANGELOG.md` to the team wiki or the live baseline migration.
- Cleanup: removed `docs/zamschool os sammary.html` (typo filename, no refs) and the transient `.kimchi/` agent working-notes folder.
- Repo: pruned dead `.gitignore` entries (per-file ignore list of filenames that no longer exist on disk) and replaced them with coarse-grained patterns (`*.log`, `scratch/`, `terminals/`, etc.). Added `.next_broken_*/`.
- Verify: `npm run lint` clean. `npm test` shows 36 pass / 4 fail — all 4 are pre-existing static-grep drift in `__tests__/app/api/account/route.test.mjs` and `__tests__/app/api/admin/route.test.mjs` (assertions reference helpers/patterns the source no longer uses). Scheduled for update.
- Tests: fixed the 4 stale static-grep assertions (account unread summary → `requireActorContext`; admin reset-password/PUT → `createOrUpdateAuthUserWithTemporaryPassword` and whitespace-tolerant `safeUpdateScoped("profiles"`; missing-auth-user repair → helper + `authUserId: profile.id` + `must_change_password: true`). `npm test` now 31 files / 80 tests / 0 failures; `npm run lint` still clean.
- Tests: hardened `verifyAuth rejects tampered JWT signature` to flip the *payload* (with a deliberately unrelated `school_id: "attacker-school"`) instead of one base64url char of the signature — guarantees HMAC mismatch by construction rather than relying on a ~1/64 chance.
- Docs: added a "Test coverage limits and future work" subsection to [AUDIT.md](./docs/AUDIT.md) explaining what static-grep CAN'T catch (runtime regressions, business-logic correctness, time-dependent bugs, schema drift, concurrency, adversarial inputs) and the four worker/runtime tests that already exercise real code paths.
- CI: added [`.github/workflows/ci.yml`](./../.github/workflows/ci.yml) running `npm run lint` + `npm test` on every PR and `npm run build` on push-to-main.
- Docs: added "Working in WSL or switching between Windows and Linux" + "When CI disagrees with local" subsections to [DEVELOPMENT.md](./docs/DEVELOPMENT.md), covering the @esbuild and lightningcss native-binary mismatch and the NODE_ENV/test-fixture globs that can cause CI/local divergence.
- Docs: stripped dangling `npm run schema:check`, `audit:tenant`, `test:security`, `load:test:*`, `cloudflare:*` references from `DEVELOPMENT.md`, `PRODUCTION.md`, `SECURITY.md`, `DATA.md`, `OPERATIONS.md`, and `README.md`. Each script is referenced by its real path under `scripts/` instead. The fictional `scripts/load-test/` k6 fallback file existed but was an uncovered orphaned default export causing a lint warning; renamed the function to `smokeScenario` and lint is now fully clean.
- Docs: corrected README's table count from 88 → **92 tables** (all RLS-enabled), validated against `node scripts/schema-check.mjs` which reports `migrationCount: 2`, `tableCount: 92`, `rlsEnabledStatements: 93`, no missing tables, no missing RLS.
- Docs: regenerated [AUDIT.md](./docs/AUDIT.md) test-freshness table — 31 entries (was 27), 9/11 previously-marked `needs-update` or untracked tests are now `current`, 2 stale-test audit items (#10 #11) marked resolved.
- Admin bug fix: `app/api/admin/announcements/route.ts` PUT and DELETE now write audit-log entries via `auditDomainWrite`. Before this fix, only POST was audited — updates and deletes were silent.
- Admin bug fix: `app/api/admin/timetable/route.ts` DELETE now writes an audit-log entry via `auditDomainWrite` (`action: "timetable.deleted"`). POST and PUT were already audited via `createAuditLog`; only DELETE was missing.
- Admin bug fix: `app/api/admin/users/route.ts` PUT now writes an audit-log entry via `auditDomainWrite` (`action: "user.updated"`, `entityType: "profiles"`) with `oldData` from the loaded profile and `newData` from `writePlan.profile`. DELETE was already audited; POST was already audited via `createAuditLog`.
- Code style: removed all `any` types from `app/api/admin/announcements/route.ts` — replaced with a proper `AnnouncementRow` type and `Record<string, unknown>` for insert/update payloads. Lint clean, tests still pass.
- Audit script: whitelisted `app/api/staff/invitations/route.ts` in `DOCUMENTED_EXCEPTIONS` of `scripts/security/audit-service-role-tenant.mjs`. The script now reports **0 findings (0 fail, 0 review)** in both default and `--strict` modes; the previous single review was a false positive (the route is an INSERT scoped via payload's `school_id`/`created_by`/`invited_by`/`accepted_by`). Manual review confirms all 3 handlers (GET/POST/DELETE) scope by `school_id`.
- Deps: removed unused `@google/genai` from `package.json` (zero imports across the codebase, no env vars, no references). Run `npm install` to update the lockfile.
- CI: extended `.github/workflows/ci.yml` to run `npm run schema:check:strict`, `npm run audit:tenant:strict`, and `npm run audit:routes` (non-blocking) on every PR. All npm scripts (`schema:check`, `audit:tenant`, `audit:routes`, `test:security`, `load:test:*`, `cloudflare:*`, `pilot:*`, `production:sign-off`) are now wired into `package.json` and documented in README, DEVELOPMENT, PRODUCTION, SECURITY, DATA, and OPERATIONS.

### Earlier today

- Docs: trimmed README's stale migration count (the repo's actual migration set is the baseline plus targeted repairs, not 48) and removed CHANGELOG's empty "Earlier" pointer section.

### 2026-06-18

- Docs: rewrote the documentation set as ≤10 simple, consistent markdown files. Added `UI-UX.md`, kept `AUDIT.md`. See [AUDIT.md](./AUDIT.md) for the test freshness audit (25 current, 2 needs-update).
