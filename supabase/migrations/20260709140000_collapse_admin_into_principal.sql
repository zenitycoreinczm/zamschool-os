-- Collapse legacy School Administrator (admin) into Head Teacher (principal).
--
-- Product model:
--   - principal  = Head Teacher (school owner; registration only)
--   - deputy_head = Deputy Head Teacher
--   - specialty staff (bursar, registrar, ict_admin, …)
--   - super_admin = platform only
--
-- `admin` is no longer a separate school role.

-- ── 1. Profiles: rewrite role values ─────────────────────────────────────────
UPDATE public.profiles
SET
  role = 'principal',
  updated_at = COALESCE(updated_at, now())
WHERE lower(role) IN ('admin', 'administrator', 'school_administrator');

-- ── 2. Staff invitations: cancel outstanding admin invites, rewrite role ────
-- status check allows: pending | accepted | expired | cancelled
UPDATE public.staff_invitations
SET
  revoked_at = COALESCE(revoked_at, now()),
  status = CASE
    WHEN lower(status) = 'accepted' THEN status
    ELSE 'cancelled'
  END
WHERE lower(role) IN ('admin', 'administrator', 'school_administrator')
  AND revoked_at IS NULL
  AND accepted_at IS NULL;

-- All admin-role invitation rows must leave 'admin' before constraint drop.
-- Map to deputy_head for history only (already cancelled if still open).
UPDATE public.staff_invitations
SET role = 'deputy_head'
WHERE lower(role) IN ('admin', 'administrator', 'school_administrator');

-- ── 3. Permission group roles: admin → principal (dedupe) ───────────────────
-- Prefer keeping an existing principal mapping; drop admin when both exist.
DELETE FROM public.permission_group_roles pgr_admin
USING public.permission_group_roles pgr_principal
WHERE lower(pgr_admin.role) = 'admin'
  AND lower(pgr_principal.role) = 'principal'
  AND pgr_admin.group_id = pgr_principal.group_id
  AND pgr_admin.school_id = pgr_principal.school_id;

UPDATE public.permission_group_roles
SET role = 'principal'
WHERE lower(role) = 'admin';

-- ── 4. Retire "School Administrator" permission groups ──────────────────────
-- Features/roles cascade or are deleted explicitly depending on FK setup.
DELETE FROM public.permission_features pf
USING public.permission_groups pg
WHERE pf.group_id = pg.id
  AND pg.name = 'School Administrator';

DELETE FROM public.permission_group_roles pgr
USING public.permission_groups pg
WHERE pgr.group_id = pg.id
  AND pg.name = 'School Administrator';

DELETE FROM public.permission_groups
WHERE name = 'School Administrator';

-- Ensure Head Teacher Authority is linked to principal for every school that
-- still has the group.
INSERT INTO public.permission_group_roles (school_id, group_id, role)
SELECT pg.school_id, pg.id, 'principal'
FROM public.permission_groups pg
WHERE pg.name = 'Head Teacher Authority'
ON CONFLICT (group_id, role) DO UPDATE
SET school_id = EXCLUDED.school_id;

-- ── 5. Announcements: widen check, rewrite admin → principal ────────────────
-- Baseline only allowed all|admin|teacher|student|parent. Principal/leadership
-- must be allowed before we rewrite rows.
ALTER TABLE IF EXISTS public.announcements
  DROP CONSTRAINT IF EXISTS announcements_target_role_check;

UPDATE public.announcements
SET target_role = 'principal'
WHERE lower(COALESCE(target_role, '')) IN (
  'admin',
  'administrator',
  'school_administrator'
);

ALTER TABLE IF EXISTS public.announcements
  ADD CONSTRAINT announcements_target_role_check
  CHECK (
    target_role IS NULL
    OR target_role = ANY (
      ARRAY[
        'all'::text,
        'principal'::text,
        'leadership'::text,
        'teacher'::text,
        'student'::text,
        'parent'::text
      ]
    )
  );

-- ── 6. Tighten profiles.role check (no admin) ───────────────────────────────
ALTER TABLE IF EXISTS public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE IF EXISTS public.profiles
  ADD CONSTRAINT profiles_role_check CHECK (
    role = ANY (
      ARRAY[
        'super_admin'::text,
        'principal'::text,
        'deputy_head'::text,
        'bursar'::text,
        'guidance_office'::text,
        'academic_admin'::text,
        'hr_admin'::text,
        'ict_admin'::text,
        'discipline_admin'::text,
        'registrar'::text,
        'teacher'::text,
        'student'::text,
        'parent'::text,
        'payments'::text,
        -- uppercase variants still seen in older rows / metadata mirrors
        'SUPER_ADMIN'::text,
        'PRINCIPAL'::text,
        'DEPUTY_HEAD'::text,
        'BURSAR'::text,
        'GUIDANCE_OFFICE'::text,
        'ACADEMIC_ADMIN'::text,
        'HR_ADMIN'::text,
        'ICT_ADMIN'::text,
        'DISCIPLINE_ADMIN'::text,
        'REGISTRAR'::text,
        'TEACHER'::text,
        'STUDENT'::text,
        'PARENT'::text,
        'PAYMENTS'::text
      ]
    )
  );

-- ── 7. Staff invitations role check (no admin) ──────────────────────────────
ALTER TABLE IF EXISTS public.staff_invitations DROP CONSTRAINT IF EXISTS staff_invitations_role_check;
ALTER TABLE IF EXISTS public.staff_invitations
  ADD CONSTRAINT staff_invitations_role_check CHECK (
    lower(role) = ANY (
      ARRAY[
        'teacher'::text,
        'payments'::text,
        'bursar'::text,
        'deputy_head'::text,
        'guidance_office'::text,
        'academic_admin'::text,
        'hr_admin'::text,
        'ict_admin'::text,
        'discipline_admin'::text,
        'registrar'::text
      ]
    )
  );

-- ── 8. Permission group roles check (no admin) ──────────────────────────────
ALTER TABLE IF EXISTS public.permission_group_roles DROP CONSTRAINT IF EXISTS permission_group_roles_role_check;
ALTER TABLE IF EXISTS public.permission_group_roles
  ADD CONSTRAINT permission_group_roles_role_check CHECK (
    lower(role) = ANY (
      ARRAY[
        'principal'::text,
        'deputy_head'::text,
        'bursar'::text,
        'payments'::text,
        'guidance_office'::text,
        'academic_admin'::text,
        'hr_admin'::text,
        'ict_admin'::text,
        'discipline_admin'::text,
        'registrar'::text,
        'teacher'::text
      ]
    )
  );

-- ── 9. Helper functions: drop admin from financial context ──────────────────
CREATE OR REPLACE FUNCTION public.is_financial_context_role()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public', 'auth'
AS $function$
  SELECT public.get_my_role() IN (
    'bursar',
    'payments',
    'principal',
    'super_admin'
  );
$function$;
