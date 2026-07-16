-- Repair: domain owners who can create must also be able to delete.
-- writable() seeds left can_delete=false while APIs enforce featureAction "delete".

-- Academic Admin — full academic lifecycle
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
  AND lower(pgr.role) = 'academic_admin'
  AND pf.feature_key IN (
    'subjects',
    'grades',
    'assignments',
    'timetable',
    'grading_scales',
    'academic_years',
    'terms'
  );

-- Head Teacher — announcements / settings / messaging delete
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
  AND lower(pgr.role) = 'principal'
  AND pf.feature_key IN (
    'announcements',
    'settings',
    'messages',
    'notifications',
    'timetable',
    'subjects',
    'grades',
    'assignments'
  );

-- Deputy Head — operational write features that support delete
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
  AND lower(pgr.role) = 'deputy_head'
  AND pf.feature_key IN (
    'attendance',
    'grades',
    'announcements',
    'messages',
    'notifications'
  );

-- Finance office
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
  AND lower(pgr.role) IN ('bursar', 'payments')
  AND pf.feature_key IN ('finance', 'payments');

-- Discipline + guidance
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
  AND lower(pgr.role) IN ('discipline_admin', 'guidance_office')
  AND pf.feature_key IN ('discipline', 'messages');

-- ICT recovery / settings
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
  AND lower(pgr.role) = 'ict_admin'
  AND pf.feature_key IN ('users', 'settings', 'messages', 'notifications');

-- Registrar messaging
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
  AND lower(pgr.role) = 'registrar'
  AND pf.feature_key IN ('users', 'classes', 'messages', 'notifications');

-- Teachers — own scoped features
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
  AND lower(pgr.role) = 'teacher'
  AND pf.feature_key IN ('attendance', 'grades', 'assignments');
