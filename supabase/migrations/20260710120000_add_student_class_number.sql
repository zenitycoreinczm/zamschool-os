-- Class register number for students (e.g. 45 in "Ison Mumbuna | 9A | 45").
-- Used for roll call, results, and desk identity — unique within a class when set.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS class_number integer;

ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS class_number integer;

COMMENT ON COLUMN public.profiles.class_number IS
  'Student register number within their class (roll call / results identity).';
COMMENT ON COLUMN public.students.class_number IS
  'Student register number within their class (roll call / results identity).';

-- Backfill from numeric admission/student numbers where present.
UPDATE public.profiles p
SET class_number = sub.num
FROM (
  SELECT
    id,
    CASE
      WHEN admission_number ~ '^[0-9]+$' THEN admission_number::integer
      WHEN student_number ~ '^[0-9]+$' THEN student_number::integer
      ELSE NULL
    END AS num
  FROM public.profiles
  WHERE role IN ('student', 'STUDENT')
    AND class_number IS NULL
) sub
WHERE p.id = sub.id
  AND sub.num IS NOT NULL
  AND sub.num > 0
  AND sub.num < 100000;

UPDATE public.students s
SET class_number = sub.num
FROM (
  SELECT
    id,
    CASE
      WHEN student_number ~ '^[0-9]+$' THEN student_number::integer
      WHEN admission_number ~ '^[0-9]+$' THEN admission_number::integer
      ELSE NULL
    END AS num
  FROM public.students
  WHERE class_number IS NULL
) sub
WHERE s.id = sub.id
  AND sub.num IS NOT NULL
  AND sub.num > 0
  AND sub.num < 100000;

-- One register number per class (when both class and number are set).
CREATE UNIQUE INDEX IF NOT EXISTS profiles_class_number_per_class_uq
  ON public.profiles (school_id, class_id, class_number)
  WHERE class_id IS NOT NULL
    AND class_number IS NOT NULL
    AND role IN ('student', 'STUDENT');

CREATE UNIQUE INDEX IF NOT EXISTS students_class_number_per_class_uq
  ON public.students (school_id, class_id, class_number)
  WHERE class_id IS NOT NULL
    AND class_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_class_number
  ON public.profiles (school_id, class_id, class_number)
  WHERE class_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_students_class_number
  ON public.students (school_id, class_id, class_number)
  WHERE class_number IS NOT NULL;
