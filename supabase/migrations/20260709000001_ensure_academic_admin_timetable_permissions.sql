-- Ensure Academic Admin can build class and teacher timetables.
--
-- Timetable lessons are created through /api/admin/timetable (POST/PUT). Both
-- the class and teacher workspace views use that API. This repair keeps
-- can_create/can_read/can_update enabled for every permission group linked to
-- the academic_admin role, including legacy "Academic Management" groups from
-- older school initialization flows.

UPDATE permission_features pf
SET can_create = true,
    can_read = true,
    can_update = true,
    can_delete = false
FROM permission_group_roles pgr
JOIN permission_groups pg ON pg.id = pgr.group_id AND pg.school_id = pgr.school_id
WHERE pf.group_id = pgr.group_id
  AND pf.school_id = pgr.school_id
  AND lower(pgr.role) = 'academic_admin'
  AND pf.feature_key = 'timetable';