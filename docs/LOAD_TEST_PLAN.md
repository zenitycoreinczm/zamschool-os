# Load Test Plan

## Goal

Validate ZamSchool OS under realistic school usage before pilot and production rollout.

## Commands

| Tier | Command | Purpose |
|------|---------|---------|
| Smoke dry-run | `npm run load:test:dry` | Validate script configuration. |
| Smoke | `npm run load:test:smoke` | Quick preflight. |
| Tier 1 | `npm run load:test:tier1` | 100-user readiness check. |
| Tier 2 | `npm run load:test:tier2` | Required before production launch. |
| Tier 3 | `npm run load:test:tier3` | Quarterly or major rollout test. |

## Environment

- Set `LOAD_TEST_BASE_URL` to the target environment.
- Use non-production school data unless explicitly authorized.
- Keep test accounts isolated from live school users.

## Pass Criteria

- Error rate stays below agreed launch threshold.
- Login, dashboard, attendance, fees, and messaging flows complete successfully.
- Database connection pool remains stable.
- Gateway cache and origin latency stay within expected bounds.
- No rate-limit false positives affect normal user traffic.

## Current Result

- `npm run pilot:preflight` runs the smoke dry-run gate.
- Full Tier 2 live load test is still required before paid production launch.
