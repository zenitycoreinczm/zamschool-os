# ZamSchool OS

ZamSchool OS is a school administration platform for Zambia. You use it to manage classes, subjects, timetables, attendance, results, fees, messaging, and announcements. The application is multi-tenant: every school is a tenant, every user belongs to one school, every query is scoped to a school.

The documentation set is small and focused. You should read these in order:

1. [ARCHITECTURE.md](./docs/ARCHITECTURE.md) — stack, layers, data flow, roles.
2. [UI-UX.md](./docs/UI-UX.md) — shell patterns, component conventions, design tokens, accessibility, responsiveness.
3. [DATA.md](./docs/DATA.md) — Postgres, migrations, caching, indexes, files.
4. [SECURITY.md](./docs/SECURITY.md) — RLS, auth, service-role policy, MFA, rate limiting, audit.
5. [DEVELOPMENT.md](./docs/DEVELOPMENT.md) — setup, commands, branching, PR checklist.
6. [PRODUCTION.md](./docs/PRODUCTION.md) — readiness gates, sign-off, rollback.
7. [OPERATIONS.md](./docs/OPERATIONS.md) — DR drills, load tests, incidents.
8. [CHANGELOG.md](./docs/CHANGELOG.md) — notable changes.
9. [AUDIT.md](./docs/AUDIT.md) — frontend audit findings and test freshness.

## Stack

You are looking at a Next.js 16 application using the App Router, Tailwind 4 for styling, and Supabase for auth, database, and storage. The runtime is Node.js for the Next.js server plus a Cloudflare Worker for the edge gateway under `workers/gateway/`. See [ARCHITECTURE.md](./docs/ARCHITECTURE.md) for the full picture.

- **Framework**: Next.js 16 (App Router, standalone output)
- **Database & Auth**: Supabase (Postgres, Auth, Realtime)
- **Styling**: Tailwind CSS 4
- **Charts**: Recharts, React Big Calendar
- **Forms**: React Hook Form, Zod 4
- **Image CDN**: Cloudflare R2
- **Edge cache**: Cloudflare

## Getting started

You need Node.js, a Supabase project, and (optionally) a Cloudflare R2 bucket.

1. `npm install`
2. Copy `.env.example` to `.env.local` and fill in the Supabase URL, anon key, and (if you need the strict tenant audit locally) the service role key. Add R2 credentials if you are working on uploads.
3. Apply migrations in lexical order from `supabase/migrations/`. There are around 48 of them. See [DATA.md](./docs/DATA.md) for the policy.
4. `npm run dev` — start the Next.js server on port 3000.
5. `npm run cloudflare:status` — if you are working on the gateway worker.

## Project structure

- `app/` — App Router pages and API routes. The authenticated workspace lives under `app/app/*`; the public landing is `app/page.tsx`; auth edges are `app/login/*`, `app/first-login/*`, `app/error.tsx`.
- `app/api/*` — API routes. Every route uses `requireActorContext` or a role-scoped guard.
- `components/` — shells, sidebars, header, dock, modals, widgets. Side components co-locate with their owning shell.
- `lib/` — pure helpers: `admin-route-client`, `gateway-read-client`, `workspace-nav`, `workspace-search`, auth and rate-limit helpers.
- `hooks/` — `use-mobile`, `useReveal`, and other micro-hooks.
- `supabase/migrations/` — 001-048, applied in lexical order.
- `scripts/` — healthcheck, schema-check, tenant audit, load tests, CDN preflight.
- `workers/gateway/` — Cloudflare Worker for edge reads.
- `__tests__/` — static-grep tests. See [AUDIT.md](./docs/AUDIT.md) for the freshness audit.

## Common commands

You will use these most often:

- `npm run dev` — start the dev server.
- `npm run build` and `npm run start` — production build and run.
- `npm test` — run all 27 static-grep tests.
- `npm run test:security` — run the security-focused subset.
- `npm run lint` — ESLint across the repo.
- `npm run schema:check` and `npm run schema:check:strict` — verify migrations.
- `npm run audit:tenant` and `npm run audit:tenant:strict` — service-role audit.
- `npm run load:test:<tier>` — load tests at smoke, tier1_100, tier2_500, tier3_1000.

See [DEVELOPMENT.md](./docs/DEVELOPMENT.md) for the full list and [PRODUCTION.md](./docs/PRODUCTION.md) for the readiness gates.

## Roles

The system supports 14 roles with role-based shells and route prefixes. The active roles in production are admin, principal, teacher, parent, student, and payments (bursar); admin subtypes include super_admin, guidance_office, discipline_admin, it_admin, and auditor. Unknown roles fall back to the admin shell. See [ARCHITECTURE.md](./docs/ARCHITECTURE.md#roles-and-routes) for the full list and [SECURITY.md](./docs/SECURITY.md) for the authorization model.

## Security

You should treat every page as if it were public. RLS is enabled on every production table; service-role queries are audited by `npm run audit:tenant:strict`. MFA is TOTP-based with fail-closed rate limiting. See [SECURITY.md](./docs/SECURITY.md) for the threat model and the layers.

## License

Internal. Not for redistribution.
