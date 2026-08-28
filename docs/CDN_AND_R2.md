# CDN And R2

## Purpose

ZamSchool OS uses Cloudflare and R2 for public assets, private upload routing, and edge gateway caching.

## Required Configuration

- Cloudflare DNS points the production domain to the deployed app.
- Gateway Worker is configured with `UPSTREAM_API` and allowed origins.
- R2 upload and asset buckets are bound to the worker.
- Private uploads are served only after bearer-auth verification and tenant key validation.
- Public assets use long-lived public cache headers.
- User/profile/finance/private payloads use private or no-store headers.

## Preflight

Run:

```bash
npm run cdn:preflight
```

Expected result: command exits 0.

## Cache Rules

- Auth, inbox, attendance, results, and mutations must not be cached publicly.
- Gateway cached reads must vary by authenticated user token digest.
- Private upload downloads must return `Cache-Control: private, no-store`.
- Public assets may use `public, max-age=86400, stale-while-revalidate=604800`.

## Operational Checks

- Confirm R2 object access for same-school private uploads.
- Confirm cross-school upload keys return forbidden.
- Confirm Cloudflare allowed origins match production and pilot domains.
- Confirm cache purge procedure is available during rollback.
