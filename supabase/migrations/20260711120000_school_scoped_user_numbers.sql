-- Student and employee numbers must be unique per school, not globally.
-- Mongu can have student "1" and Manda can also have student "1".

-- Students: drop global unique on student_number
ALTER TABLE IF EXISTS public.students
  DROP CONSTRAINT IF EXISTS students_student_number_key;

DROP INDEX IF EXISTS public.students_student_number_key;

-- Teachers: drop global unique on employee_number
ALTER TABLE IF EXISTS public.teachers
  DROP CONSTRAINT IF EXISTS teachers_employee_number_key;

DROP INDEX IF EXISTS public.teachers_employee_number_key;

-- Ensure composite uniqueness per school (partial: ignore nulls)
CREATE UNIQUE INDEX IF NOT EXISTS students_number_school_unique
  ON public.students (school_id, student_number)
  WHERE student_number IS NOT NULL AND btrim(student_number) <> '';

CREATE UNIQUE INDEX IF NOT EXISTS students_admission_school_unique
  ON public.students (school_id, admission_number)
  WHERE admission_number IS NOT NULL AND btrim(admission_number) <> '';

CREATE UNIQUE INDEX IF NOT EXISTS teachers_employee_number_school_unique
  ON public.teachers (school_id, employee_number)
  WHERE employee_number IS NOT NULL AND btrim(employee_number) <> '';

CREATE UNIQUE INDEX IF NOT EXISTS teachers_employee_id_school_unique
  ON public.teachers (school_id, employee_id)
  WHERE employee_id IS NOT NULL AND btrim(employee_id) <> '';
