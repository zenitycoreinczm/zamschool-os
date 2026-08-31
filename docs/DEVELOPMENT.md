# Development

This document describes how you work on the codebase day to day: setup, commands, conventions, and what the CI does. For the production deployment story, see [PRODUCTION.md](./PRODUCTION.md). For findings, see [AUDIT.md](./AUDIT.md).

## Setup

You need Node.js (matching `.nvmrc` if present), npm, and access to a Supabase project. The setup is:

1. `npm install`
2. Copy `.env.example` to `.env.local` and fill in the Supabase URL, anon key, and service role key (only if you need the strict tenant audit locally).
3. `npm run dev` to start the Next.js server on port 3000.
4. `npx wrangler dev` (from `workers/gateway/`) or `npm run cloudflare:status` — if you are working on the gateway worker.

## Commands

The scripts in `package.json` today (`npm run <name>`):

| Command | What it does |
|---------|--------------|
| `dev` | Start the Next.js dev server (webpack mode, port 3000). |
| `dev:restart` | Windows-only helper to tear down and restart the dev server. |
| `build` | `next build --webpack`. Triggers `postbuild` `prepare-standalone.mjs`. Requires ~8GB heap (`NODE_OPTIONS=--max-old-space-size=8192`) on machines with limited RAM. |
| `start` | Run the standalone build via `scripts/start-standalone.mjs`. |
| `test` | Run the test suite — currently **36 inventoried** static-grep + runtime files under `__tests__/`, `lib/`, `components/`, `public/`, `scripts/`, and `workers/` (the runner reports 53 in aggregate because some suites are split). |
| `test:all` | Alias for `test`. |
| `lint` | ESLint across the repo. |
| `clean` | Remove `.next/` and `.next_broken_*/`. |
| `healthcheck` | Probe the production endpoints (`scripts/healthcheck.mjs`). |
| `schema:check` / `schema:check:strict` | Verify migrations (required tables, RLS coverage, no duplicates). |
| `audit:tenant` / `audit:tenant:strict` | Service-role tenant isolation audit (fails on unscoped queries in strict mode). |
| `audit:routes` | Route coverage audit — lists mutation routes missing auth, feature checks, or audit logs. |
| `audit:refresh` | Re-read every cited source file referenced from `docs/AUDIT.md` and assert the 11 invariants still hold. Exit code is 0 if all pass. |
| `test:security` | Security-focused subset: tenant audit + worker JWT/rate-limit tests + MFA/session-switch/files route tests. |
| `load:test:smoke` / `:tier1` / `:tier2` / `:tier3` / `:dry` | Load tests at four tiers (Node-native, no k6 required). |
| `cloudflare:status` / `:cache-rules` / `:discover-r2` / `:r2-test` | Cloudflare Worker and R2 helpers. |
| `pilot:preflight` / `:log-incident` | Pilot readiness and incident logging. |
| `production:sign-off` | Production sign-off preflight. |

## Branching

You branch off `main`. Branch names are `feat/<short-name>`, `fix/<short-name>`, or `chore/<short-name>`. You commit with explicit `git add <path>`. You do not run `git add -A` or `git add .` and you do not skip hooks with `--no-verify`.

## Pull request checklist

Before you request review, you confirm:

- [ ] `npm run lint` passes (CI runs this on every PR).
- [ ] `npm test` passes (CI runs this on every PR).
- [ ] `npm run schema:check:strict` passes (CI runs this on every PR).
- [ ] `npm run audit:tenant:strict` passes (CI runs this on every PR).
- [ ] If you touched a migration: `node scripts/apply-migrations.mjs --dry-run` reproduces cleanly against a fresh database.
- [ ] No new `console.log` left in the diff.
- [ ] No `any` introduced in a TypeScript file you touched.
- [ ] No token, key, or URL leaked into a log line or a commit message.
- [ ] Your diff is under 400 lines or you have called out why it cannot be split.

## Code style

- One component per file. Default export at the bottom.
- `useMemo` for derived data; `useCallback` for stable handlers. Smallest dep arrays you can justify.
- No `any`. No `// @ts-ignore`. If you need it, the type is wrong and you should fix the type.
- No raw color values; read from `app/globals.css` tokens.
- No `100vh` in CSS; use `100dvh` for shell layouts.

## `lib/` subdomain policy

`lib/` currently holds 130+ files at the top level by naming convention only (`lib/attendance-summary.ts`, `lib/auth-mfa.ts`, `lib/redis.ts`, etc.). New files **must** land in a subdomain folder, not at the top level. This prevents the flat-folder rot that the audit flags at [AUDIT.md → Needs Work #4](./AUDIT.md#needs-work).

Allowed subdomain folders (canonical naming; do not introduce alternative spellings for these):

| Subdomain | Example files |
|-----------|---------------|
| `lib/attendance/` | daily-totals, conflicts, integrity, notifications, recipients, status, summary, upsert, draft, analytics |
| `lib/auth/` | session, mfa, rate-limit, otp, routing, account-state, profile-lookup |
| `lib/messaging/` | compose-limits, participants, send-quota, quota-types, inbox-queries, inbox-events, inbox-read-cache |
| `lib/redis/` | connection, ttl, temp, session, role-cache, keys |
| `lib/storage/` | r2-client, r2-config, r2-url, avatar-storage, image-optimization, cdn-optimization, remote-image-hosts |
| `lib/tenant/` | tenant-context (canonical), tenant-rate-limit, tenant-actor-rate-limit, tenant-filter |
| `lib/timetable/` | timetable-workspace |
| `lib/messaging/` (inbox) | (see `lib/inbox-*` files) |
| `lib/models/` | already a folder — keep |
| `lib/supabase/` | already a folder — keep |

If a file does not fit any of these subdomains, propose a new subdomain in the PR description and add it to the table. ESLint blocks new top-level additions via `eslint-rules/lib-subdomain-policy.mjs` against the legacy allow-list in `eslint-rules/lib-legacy-whitelist.json`. The redis cluster (`lib/redis.ts`, `lib/redis-keys.ts`, `lib/redis-role-cache.ts`, `lib/redis-session.ts`, `lib/redis-temp.ts`, `lib/redis-ttl.ts`) was the pilot; further clusters (attendance, auth, messaging, etc.) should follow the same shape.

## Static-grep tests

The test suite is intentionally static: each test reads a target file and asserts that specific symbols, paths, or strings are present. You write one when a refactor risks silently removing a public symbol or breaking a contract. The runner is `scripts/run-tests.mjs`. The exception is the worker edge tests under `workers/gateway/src/*.test.mjs` — those run a runtime harness with mock KV/R2 to assert behavior, not just structure. See [AUDIT.md](./AUDIT.md) for the current freshness audit and the **Test coverage limits** subsection near its end.

## When you get stuck

If a build fails with a cache error, `npm run clean` then rebuild. If the gateway worker is unreachable in dev, the gateway client falls back to the local API route — you do not need it to develop the frontend. If a Supabase migration fails locally, drop the schema and re-apply from `supabase/migrations/` in order.

## Working in WSL or switching between Windows and Linux

`@esbuild` and a handful of other devDependencies ship native binaries that npm picks based on the host OS at install time. The lockfile alone does not pin which binary runs — `node_modules/@esbuild/<platform>-<arch>/.../esbuild.exe` (Windows) vs `node_modules/@esbuild/<platform>-<arch>/.../esbuild` (Linux ELF) are different files, and Next.js's webpack builder calls into the local one.

Symptoms when the binaries are wrong for the runner:

- `npm run dev` fails with `Could not find ... esbuild.exe` or `failed to map segment from executable` under WSL after a Windows `npm install`.
- `npm run build` errors with `EBUSY: resource busy or locked, rm ... esbuild.exe` when the Windows filesystem has the file open under a separate process.
- `npm test` aborts with `MODULE_NOT_FOUND` for native modules like `lightningcss-win32-x64-msvc`.

How to fix:

1. From WSL Linux, blow away the Windows-derived `node_modules` and reinstall: `rm -rf node_modules && npm ci`.
2. From Windows, do the same after a long WSL session: `rd /s /q node_modules && npm ci`.
3. Don't share a single `node_modules/` across the two environments. They are not interchangeable.
4. If you use Docker or Codespaces for the build, `node_modules` is mounted empty and `npm ci` runs there — no cross-contamination.

The same caveat applies to `lightningcss` (an `optionalDependencies` entry in `package.json`): if you don't have a native binary for your platform, just delete the matching `lightningcss-*-<arch>` folder — it's optional.

## When CI disagrees with local

If a test passes locally but fails on GitHub Actions (or vice versa), the suspect list, in order:

1. **`node_modules` platform mismatch** (see above).
2. **Lockfile drift** — `npm ci` in CI uses `package-lock.json` exactly. Locally, `npm install` may have moved things. Run `npm ci` locally before pushing.
3. **Environment variables** — the test runner sets `NODE_ENV=test`. If you have stray dev-only env vars in `.env.local`, they may pass locally and break CI.
4. **Hidden file globs** — `.gitignore` covers a lot; if your local checkout has scratch files that happen to contain test-fixture strings, they could be matched. `scripts/run-tests.mjs` only scans `__tests__/`, `lib/`, `components/`, `public/`, `scripts/`, `workers/` — nothing else.

## Deployment

Production deploys to https://zamschoolos.site via Vercel CLI:

```
vercel --prod --yes
```

The `.next/` directory should be cleaned before deploying if you have run a local build (`npm run clean`). Vercel builds remotely with 8GB RAM and restores cache from prior deployments. The production alias is managed in the Vercel dashboard under the `zamschool-os-web` project.
