# ARCHITECTURE

ZamSchool OS is a multi-tenant school management platform.

## Core rules
- Every request is tenant scoped by `school_id`.
- Authenticated API routes resolve actor context through `requireActorContext`.
- Feature access is enforced through `requireFeatureAccess` and route/domain guards.
- Server-side privileged access must remain explicit and must always apply tenant filters.
- New shared backend tenant helpers live in `lib/tenant/tenant-context.ts`.

## Current backend shape
- Next.js App Router for application/API logic
- Supabase for auth, data, and RLS-enforced persistence
- Cloudflare Worker gateway for authenticated cache-first reads
- Upstash Redis for rate limiting and selected operational caches

## Non-negotiable invariants
- No cross-tenant reads or writes
- No service-role use without explicit tenant scoping
- No new parallel infrastructure helpers when an equivalent pattern already exists
