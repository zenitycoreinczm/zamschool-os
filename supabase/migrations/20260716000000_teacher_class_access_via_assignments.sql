-- Subject / teaching teachers get the same class student access as class teachers.
-- Source of truth: teacher_class_subject_assignments + lessons + supervised classes.
-- Legacy class_subjects remains supported for older data paths.

CREATE OR REPLACE FUNCTION private.accessible_class_ids()
 RETURNS uuid[]
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select coalesce(array_agg(distinct x.class_id), '{}'::uuid[])
  from (
    -- admins: all classes in school
    select c.id as class_id
    from public.classes c
    where c.school_id = (select private.current_school_id())
      and (select private.is_admin())

    union

    -- teacher supervised classes (class teacher)
    select c.id as class_id
    from public.classes c
    where c.supervisor_id = auth.uid()

    union

    -- modern teaching assignments (class + subject)
    select tcsa.class_id
    from public.teacher_class_subject_assignments tcsa
    where tcsa.teacher_profile_id = auth.uid()

    union

    -- timetable lessons
    select l.class_id
    from public.lessons l
    join public.teachers t on t.id = l.teacher_id
    where t.profile_id = auth.uid()
      and l.class_id is not null

    union

    -- legacy class_subjects assignments
    select cs.class_id
    from public.class_subjects cs
    join public.teachers t on t.id = cs.teacher_id
    where t.profile_id = auth.uid()

    union

    -- current student's class
    select s.class_id
    from public.students s
    where s.profile_id = auth.uid()
      and s.class_id is not null

    union

    -- current parent's linked students' classes
    select s.class_id
    from public.parent_students ps
    join public.parents p on p.id = ps.parent_id
    join public.students s on s.id = ps.student_id
    where p.profile_id = auth.uid()
      and s.class_id is not null
  ) x;
$function$;

CREATE OR REPLACE FUNCTION private.teacher_can_manage_class(p_class_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select
    exists (
      select 1
      from public.classes c
      where c.id = p_class_id
        and c.supervisor_id = auth.uid()
    )
    or exists (
      select 1
      from public.teacher_class_subject_assignments tcsa
      where tcsa.class_id = p_class_id
        and tcsa.teacher_profile_id = auth.uid()
    )
    or exists (
      select 1
      from public.lessons l
      join public.teachers t on t.id = l.teacher_id
      where l.class_id = p_class_id
        and t.profile_id = auth.uid()
    )
    or exists (
      select 1
      from public.class_subjects cs
      join public.teachers t on t.id = cs.teacher_id
      where cs.class_id = p_class_id
        and t.profile_id = auth.uid()
    );
$function$;

CREATE OR REPLACE FUNCTION private.teacher_can_manage_class_subject(p_class_id uuid, p_subject_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select
    exists (
      select 1
      from public.classes c
      where c.id = p_class_id
        and c.supervisor_id = auth.uid()
    )
    or exists (
      select 1
      from public.teacher_class_subject_assignments tcsa
      where tcsa.class_id = p_class_id
        and tcsa.subject_id = p_subject_id
        and tcsa.teacher_profile_id = auth.uid()
    )
    or exists (
      select 1
      from public.lessons l
      join public.teachers t on t.id = l.teacher_id
      where l.class_id = p_class_id
        and l.subject_id = p_subject_id
        and t.profile_id = auth.uid()
    )
    or exists (
      select 1
      from public.class_subjects cs
      join public.teachers t on t.id = cs.teacher_id
      where cs.class_id = p_class_id
        and cs.subject_id = p_subject_id
        and t.profile_id = auth.uid()
    );
$function$;

CREATE OR REPLACE FUNCTION private.teacher_has_class(target_class_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select
    exists (
      select 1
      from public.classes c
      where c.id = target_class_id
        and c.supervisor_id = auth.uid()
    )
    or exists (
      select 1
      from public.teacher_class_subject_assignments tcsa
      where tcsa.class_id = target_class_id
        and tcsa.teacher_profile_id = auth.uid()
    )
    or exists (
      select 1
      from public.lessons l
      join public.teachers t on t.id = l.teacher_id
      where l.class_id = target_class_id
        and t.profile_id = auth.uid()
    )
    or exists (
      select 1
      from public.class_subjects cs
      where cs.teacher_id = private.current_teacher_id()
        and cs.class_id = target_class_id
    );
$function$;

CREATE OR REPLACE FUNCTION private.teacher_has_class_subject(target_class_id uuid, target_subject_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select
    exists (
      select 1
      from public.classes c
      where c.id = target_class_id
        and c.supervisor_id = auth.uid()
    )
    or exists (
      select 1
      from public.teacher_class_subject_assignments tcsa
      where tcsa.class_id = target_class_id
        and tcsa.subject_id = target_subject_id
        and tcsa.teacher_profile_id = auth.uid()
    )
    or exists (
      select 1
      from public.lessons l
      join public.teachers t on t.id = l.teacher_id
      where l.class_id = target_class_id
        and l.subject_id = target_subject_id
        and t.profile_id = auth.uid()
    )
    or exists (
      select 1
      from public.class_subjects cs
      where cs.teacher_id = private.current_teacher_id()
        and cs.class_id = target_class_id
        and cs.subject_id = target_subject_id
    );
$function$;
