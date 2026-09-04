-- Head Teacher reviews published timetables but never creates lessons.
--
-- The lesson lifecycle (create/update/delete) belongs to Academic Admin:
-- app/api/admin/timetable enforces ACADEMIC_ADMIN-only writes and the
-- timetable workspace renders read-only for PRINCIPAL. This migration syncs
-- existing schools' DB-backed permission_features rows with the seed change
-- in lib/permission-group-defaults.ts ("Head Teacher Authority" now holds
-- readOnly("timetable")).
--
-- Head Teacher keeps can_read so "Published timetables" stays visible.

UPDATE permission_features pf
SET can_create = false,
    can_update = false,
    can_delete = false,
    can_read = true
FROM permission_group_roles pgr
JOIN permission_groups pg ON pg.id = pgr.group_id
WHERE pf.group_id = pgr.group_id
  AND pg.school_id = pgr.school_id
  AND lower(pgr.role) = 'principal'
  AND pf.feature_key = 'timetable';
