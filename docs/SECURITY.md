# Security

This document describes the security model: who can do what, where the checks live, and how the audits are run. For the data layer details, see [DATA.md](./DATA.md). For findings, see [AUDIT.md](./AUDIT.md).

## Threat model

You should treat every page as if it were public. The application is multi-tenant: every school is a tenant, every user belongs to one school, and every query is scoped to a school. The two threats you are defending against are cross-tenant reads and cross-tenant writes. Cross-role actions (a teacher acting as a parent) are a secondary concern.

## Layers

Security is enforced at four layers. You must satisfy all of them; none is sufficient on its own.

1. **Postgres RLS.** Every production table has row-level security enabled. Policies check role from `auth.jwt()` and school from the user's profile. Personal data is additionally scoped to `user_id`. The current policy taxonomy lives inline in the baseline migration (`supabase/migrations/00000000000000_baseline.sql`) under each table's `create policy` statements.
2. **API route guards.** Every API route under `app/api/*` calls `requireActorContext` or a role-specific guard (`requireTeacherContext`, `requireParentContext`, `requireStudentContext`) before reading or writing. The guards throw and return 401/403 if the user is missing or wrong-role.
3. **Shell guards.** Each shell checks the user's role on mount and redirects away from paths that belong to a different role. `AdminShell` does this in `resolveWorkspaceRedirect` (`AdminShell.tsx`).
4. **Rate limiting.** MFA routes, login, and password-reset are rate-limited with fail-closed semantics. The helper lives in `lib/auth-api-rate-limit.ts`.

## Response header policy

The middleware (`proxy.ts`, function `applySecurityHeaders()`) applies a **two-tier** security header system introduced on 2026-08-31. The split prevents overly broad frame-killing headers from breaking viewport emulators and embed-based tooling on public pages while keeping private surfaces fully locked down.

### Tier 1 — Hardened headers (private surfaces)

Applied to: `/api/*`, `/app/*`, `/dashboard`, `/admin`, `/teacher`, `/student`, `/parent`, `/payments`, `/super-admin`, `/error`.

Defined in `lib/request-security.ts` as `HARDENED_SECURITY_HEADERS`:

- `X-Frame-Options: DENY`
- `Cross-Origin-Opener-Policy: same-origin`
- `Cross-Origin-Resource-Policy: same-origin`
- `X-DNS-Prefetch-Control: off`
- `X-Permitted-Cross-Domain-Policies: none`
- `Referrer-Policy`, `Permissions-Policy`, `X-Content-Type-Options`

CSP `frame-ancestors` is set to `'none'` via `lib/csp-policy.ts` `buildContentSecurityPolicy({ frameAncestors: "none" })`.

### Tier 2 — Public surface headers

Applied to: `/`, `/login`, `/register`, `/forgot-password`, `/reset-password`, `/verify-email`, `/accept-invitation`, `/join`, `/offline`, `/first-login`, `/cookies`, `/privacy`, `/terms`, and SEO-allowed static paths.

Defined in `lib/request-security.ts` as `PUBLIC_SURFACE_SECURITY_HEADERS`:

- `Referrer-Policy`, `Permissions-Policy`, `X-Content-Type-Options` only.
- **No** `X-Frame-Options`, **no** `Cross-Origin-Opener-Policy`, **no** `Cross-Origin-Resource-Policy`, **no** `X-DNS-Prefetch-Control`.

CSP `frame-ancestors` is set to allow `'self' zamschoolos.site *.zamschoolos.site vercel.app *.vercel.app` via `lib/csp-policy.ts` `buildContentSecurityPolicy({ frameAncestors: "selfplus" })`.

## Service role

The Supabase service role bypasses RLS. You should treat it as privileged and rare. Every use of the service role is audited by `npm run audit:tenant`. The strict variant (`npm run audit:tenant:strict`) fails the build if any service-role query touches a tenant-scoped table without an explicit school filter. You should not add new service-role queries; if you think you need one, write a Postgres function with `security definer` instead.

## Auth

Auth is Supabase-managed. MFA supports TOTP factors (`enroll`, `verify`, `challenge`, `factor list`, `factor delete`). The MFA routes are tested in `__tests__/app/api/auth/mfa/route.test.mjs`. The first-login flow forces a password change before the workspace becomes reachable (`app/first-login/page.tsx`). Session switching on the login page revalidates the session before showing the workspace button.

## Tenant audit

Two checks are wired into `package.json` and CI:

- `npm run audit:tenant` — read-only scan of every server file. Lists every place that imports the service-role client and flags any query without a `school_id` guard.
- `npm run audit:tenant:strict` — same scan, but exits non-zero if it finds a service-role query that does not pass `school_id` to the database. Run this in CI before any merge. Currently reports 0 findings.

## What you should not do

You should not log full request bodies. You should not echo back Supabase tokens in error messages. You should not cache sensitive payloads at the edge with a long TTL — keep `Cache-Control: private, no-store` for anything tied to a user's profile, children, or finances. You should not store files outside the `authorized` R2 bucket; the upload route validates the entity type against `ALLOWED_ENTITY_TYPES`.

## Data-center / national scale

When hosting many schools (provincial or Zambia-wide), treat the origin as a **data-center workload**:

- Upstash Redis is **required** for distributed rate limits, login lockout, and temporary IP bans.
- Cloudflare (DNS + WAF + R2) sits in front of the origin; optional gateway worker for edge JWT rate limits.
- Host allow-list and body-size limits are enforced in `proxy.ts`. Edge bot classification and IP blocklists are intentionally **disabled** because they were banning shared school NAT IPs; route-level per-user rate limits still apply. See `proxy.ts` lines 44–47 for the rationale.
- Full runbook: [DATACENTER_SECURITY.md](./DATACENTER_SECURITY.md).
- Preflight: `npm run security:server`.

## Reporting

If you find a vulnerability, do not file a public issue. Report it through the team channel used for production sign-off and pause deployment until reviewed.
