-- Transfer class lifecycle ownership from Academic Admin to Registrar.
--
-- The Registrar now creates, edits, and deletes classes (name, grade level,
-- capacity, initial class teacher) as part of the admissions/enrolment
-- workflow. The Academic Admin keeps read-only visibility into classes for
-- building timetables, subjects, and assessments, but no longer creates or
-- edits the class entity directly.
--
-- can_delete remains false for the Registrar group — deleting a class stays
-- restricted to the Head Teacher / School Administrator groups, which
-- already hold full "classes" permissions.

-- 1. Registrar ("Admissions & Registrar") gains can_create; can_update was
--    already granted aby 20260628160000_update_registrar_classes_permission.sql.
UPDATE permission_features pf
SET can_create = true,
    can_read = true,
    can_update = true
FROM permission_group_roles pgr
JOIN permission_groups pg ON pg.id = pgr.group_id
WHERE pf.group_id = pgr.group_id
  AND pg.school_id = pgr.school_id
  AND lower(pgr.role) = 'registrar'
  AND pf.feature_key = 'classes';

-- 2. Academic Admin ("Academic Administration") loses can_create/can_update
--    on classes, keeping read-only access.
UPDATE permission_features pf
SET can_create = false,
    can_update = false,
    can_delete = false
FROM permission_group_roles pgr
JOIN permission_groups pg ON pg.id = pgr.group_id
WHERE pf.group_id = pgr.group_id
  AND pg.school_id = pgr.school_id
  AND lower(pgr.role) = 'academic_admin'
  AND pf.feature_key = 'classes';
