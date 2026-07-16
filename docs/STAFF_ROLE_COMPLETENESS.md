# Staff & leadership role completeness

Living checklist for school leadership and specialty staff desks.
Program phases 0–11 are **implemented**. Close-out verification below.

## Acceptance bar (every role)

- [x] Live home metrics (`useWorkspaceSummary` / role metrics)
- [x] Sidebar Today strip (Messages, Notifications, Announcements, Events where relevant)
- [x] Every nav href has a real page (enforced by `__tests__/lib/workspace-nav-hrefs.test.mjs`)
- [x] Settings + MFA via `AccountSettingsPage`
- [x] Permissions match UI (no promised features without screens; ICT `sessions` removed)
- [ ] Smoke: login → home metrics load → open top 3 modules → settings/MFA (manual browser)

## Phase status

| Phase | Role / work | Status |
|-------|-------------|--------|
| 0 | Foundations (`staffTodayItems` + this doc) | Done |
| 1 | Deputy Head Quality Hub | Done |
| 2 | Guidance Office | Done |
| 3 | ICT Admin | Done |
| 4 | Principal polish | Done |
| 5 | Academic Admin | Done |
| 6 | Bursar + Payments | Done |
| 7 | Discipline Admin | Done |
| 8 | HR Admin polish | Done |
| 9 | Registrar | Done |
| 10 | Teacher / dead links / docs | Done |
| 11 | Cross-role verification | Done (unit tests) |
| Close-out | Dock settings paths, dead twin removed, empty dirs removed | Done |

## Shared helpers

- `staffTodayItems({ homeHref, homeLabel })` in `lib/workspace/nav.ts`
- `getRoleSettingsPath(role)` / `ROLE_SETTINGS_PATHS` for dock + nav consistency
- Metrics: `lib/workspace/summary.ts` + `useWorkspaceSummary`
- Strong desks: `DeputyHeadDashboard`, `GuidanceDashboard`, `IctAdminDashboard`, `AcademicAdminDashboard`, `HrAdminDashboard`, `PrincipalWorkspace`

## Automated tests

```text
node --experimental-strip-types --test --test-force-exit `
  __tests__/lib/workspace-nav-today.test.mjs `
  __tests__/lib/workspace-nav-hrefs.test.mjs `
  __tests__/proxy-can-access-path.test.mjs `
  __tests__/app/api/admin/users/mfa-route.test.mjs `
  __tests__/app/api/auth/mfa/route.test.mjs
```

## Manual smoke (browser)

| Role | Checks | Result |
|------|--------|--------|
| Principal | Home metrics; Invite staff (no Users directory); Settings/MFA | Pending |
| Deputy | Live metrics; Timetable; Attendance; Events in nav | Pending |
| Guidance | Metrics; Students; Conduct desk; Messages | Pending |
| ICT | Metrics; User recovery; Disable 2FA; Audit | Pending |
| Others | Spot-check Today feed + settings | Pending |

## Deferred (out of scope)

- Deputy grades write UI product
- ICT active-sessions console
- Parent timetable / teachers pages
