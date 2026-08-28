# Pilot School Runbook

## Purpose

Guide a limited pilot school through ZamSchool OS setup, verification, daily operations, and escalation.

## Pilot Scope

- One school or one controlled school group.
- Limited real users first: Head Teacher, ICT/admin, bursar, selected teachers, selected parents/students.
- Production-like environment, but with explicit support coverage and rollback readiness.

## Setup Checklist

- [ ] Configure school profile, terms, classes, subjects, and school hours.
- [ ] Create Head Teacher, Registrar/ICT, Payments, Teacher, Parent, and Student test users.
- [ ] Enable MFA for staff roles.
- [ ] Verify email/SMS/push notification expectations with the school.
- [ ] Confirm R2 uploads and private file downloads.
- [ ] Confirm support and incident contact channels.

## Day-One Verification

- [ ] Staff login and first-login password reset.
- [ ] MFA enrollment and challenge.
- [ ] Class/subject/timetable setup.
- [ ] Teacher roll call.
- [ ] Parent attendance view.
- [ ] Results draft save and publish flow.
- [ ] Fee/payment record and receipt review.
- [ ] Announcements and messages.

## Escalation

- P1: System unavailable, cross-tenant exposure, payment/result corruption.
- P2: Major workflow blocked for staff or parents.
- P3: Single-user issue or non-critical UI defect.

Log incidents in `docs/pilot/INCIDENT_LOG.md`.
