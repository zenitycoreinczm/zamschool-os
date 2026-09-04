-- =============================================================
-- ZamSchool OS — Leadership role split: Head Teacher vs Deputy Head
-- Migration: 20260903120000_leadership_role_split.sql
-- Date: 2026-09-03
--
-- Centers the two leadership roles:
--   Head Teacher (principal): governance, staff appointments, budget
--   approvals, policy, final approvals (conduct/expulsions, admissions
--   activation, exam schedule review, financial reports).
--   Deputy Head (deputy_head): daily operations (attendance monitoring,
--   discipline case handling, timetable fixes + substitute cover, events,
--   parent communication) with NO final-approval powers.
--
-- Idempotent: safe to re-run.
-- =============================================================

-- ── Head Teacher Authority: grant discipline (final approvals) ────────────
insert into public.permission_features (
  school_id, group_id, feature_key,
  can_create, can_read, can_update, can_delete, scope
)
select
  pg.school_id,
  pg.id,
  seed.feature_key,
  true, true, true, true,
  'school'
from public.permission_groups pg
join public.permission_group_roles pgr
  on pgr.group_id = pg.id
 and pgr.school_id = pg.school_id
cross join (
  values
    ('discipline'),
    ('events')
) as seed(feature_key)
where pg.name = 'Head Teacher Authority'
  and pgr.role = 'principal'
  and not exists (
    select 1
    from public.permission_features existing
    where existing.school_id = pg.school_id
      and existing.group_id = pg.id
      and existing.feature_key = seed.feature_key
  );

-- Existing discipline rows for the Head Teacher group become full CRUD
-- (they may have been seeded read-only in older schools).
update public.permission_features pf
set can_create = true, can_read = true, can_update = true, can_delete = true,
    scope = 'school'
from public.permission_groups pg
join public.permission_group_roles pgr
  on pgr.group_id = pg.id
 and pgr.school_id = pg.school_id
where pf.group_id = pg.id
  and pf.school_id = pg.school_id
  and pg.name = 'Head Teacher Authority'
  and pgr.role = 'principal'
  and pf.feature_key in ('discipline', 'events');

-- ── Deputy Head Authority: operational timetable fixes + events ───────────
-- timetable becomes update-only (fix lessons / substitute cover; never
-- create or delete structure).
insert into public.permission_features (
  school_id, group_id, feature_key,
  can_create, can_read, can_update, can_delete, scope
)
select
  pg.school_id,
  pg.id,
  seed.feature_key,
  seed.can_create, true, true, false,
  'school'
from public.permission_groups pg
join public.permission_group_roles pgr
  on pgr.group_id = pg.id
 and pgr.school_id = pg.school_id
cross join (
  values
    ('timetable', false),
    ('events', true)
) as seed(feature_key, can_create)
where pg.name = 'Deputy Head Authority'
  and pgr.role = 'deputy_head'
  and not exists (
    select 1
    from public.permission_features existing
    where existing.school_id = pg.school_id
      and existing.group_id = pg.id
      and existing.feature_key = seed.feature_key
  );

-- Upgrade any existing read-only timetable row for the Deputy Head group.
update public.permission_features pf
set can_create = false, can_read = true, can_update = true, can_delete = false,
    scope = 'school'
from public.permission_groups pg
join public.permission_group_roles pgr
  on pgr.group_id = pg.id
 and pgr.school_id = pg.school_id
where pf.group_id = pg.id
  and pf.school_id = pg.school_id
  and pg.name = 'Deputy Head Authority'
  and pgr.role = 'deputy_head'
  and pf.feature_key = 'timetable';

-- Ensure deputy events rows are create-enabled (coordination duty).
update public.permission_features pf
set can_create = true, can_read = true, can_update = true, can_delete = false,
    scope = 'school'
from public.permission_groups pg
join public.permission_group_roles pgr
  on pgr.group_id = pg.id
 and pgr.school_id = pg.school_id
where pf.group_id = pg.id
  and pf.school_id = pg.school_id
  and pg.name = 'Deputy Head Authority'
  and pgr.role = 'deputy_head'
  and pf.feature_key = 'events';

-- ── Sanity: never grant the Deputy Head final-approval finance powers ────
-- (defensive cleanup of mis-seeded rows from older installs)
delete from public.permission_features pf
using public.permission_groups pg
join public.permission_group_roles pgr
  on pgr.group_id = pg.id
 and pgr.school_id = pg.school_id
where pf.group_id = pg.id
  and pf.school_id = pg.school_id
  and pg.name = 'Deputy Head Authority'
  and pgr.role = 'deputy_head'
  and pf.feature_key in ('finance', 'payments', 'settings', 'overrides');
