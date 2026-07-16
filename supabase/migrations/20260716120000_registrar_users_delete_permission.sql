-- Registrar must be able to delete students/parents/teachers they manage.
-- Defaults previously used writable("users") which sets can_delete = false.

UPDATE public.permission_features pf
SET
  can_create = true,
  can_read = true,
  can_update = true,
  can_delete = true
FROM public.permission_groups pg
JOIN public.permission_group_roles pgr
  ON pgr.group_id = pg.id
 AND pgr.school_id = pg.school_id
WHERE pf.group_id = pg.id
  AND pf.school_id = pg.school_id
  AND pf.feature_key = 'users'
  AND lower(pgr.role) = 'registrar';

-- Class delete for registrar admissions desk (create/remove classes).
UPDATE public.permission_features pf
SET
  can_create = true,
  can_read = true,
  can_update = true,
  can_delete = true
FROM public.permission_groups pg
JOIN public.permission_group_roles pgr
  ON pgr.group_id = pg.id
 AND pgr.school_id = pg.school_id
WHERE pf.group_id = pg.id
  AND pf.school_id = pg.school_id
  AND pf.feature_key = 'classes'
  AND lower(pgr.role) = 'registrar';
