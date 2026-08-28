# Pilot Readiness Checklist

**Status:** Automated gates ready; school/operator fields pending.

## Automated Gates

- [x] `npm run test:security` passes.
- [x] `npm run audit:tenant:strict` passes with 0 findings.
- [x] `npm run schema:check:strict` passes.
- [x] Gateway worker tests pass.
- [x] `npm run cdn:preflight` passes in local preflight.
- [x] Load-test smoke dry-run is available through `npm run pilot:preflight`.

## Manual Gates

- [ ] Pilot school profile completed from `SCHOOL_PROFILE.template.md`.
- [ ] Staff accounts created and verified.
- [ ] Parent/student onboarding communication approved.
- [ ] Live health URL checked with `PILOT_HEALTH_URL`.
- [ ] DR drill risk accepted or drill completed.
- [ ] Support rota assigned for first pilot week.

## Go / No-Go

| Area | Status | Notes |
|------|--------|-------|
| Backend/security | Ready for pilot | Automated checks passing. |
| Data setup | Pending | Requires selected school details. |
| Stakeholder approval | Pending | See `docs/STAKEHOLDER_APPROVAL.md`. |
| DR drill | Pending | Required before broad paid launch. |
