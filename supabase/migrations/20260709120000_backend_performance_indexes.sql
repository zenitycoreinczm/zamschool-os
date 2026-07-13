-- Backend performance indexes
-- Targets: payment allocation hot path, common tenant filters, dashboard counts.
-- All indexes use IF NOT EXISTS so this is safe to re-apply.

-- Payment allocation in record_student_payment_transaction:
--   WHERE school_id = ? AND student_id = ? AND status IN ('PENDING','PARTIAL')
--   ORDER BY due_date, created_at, id
CREATE INDEX IF NOT EXISTS idx_student_fees_payment_allocation
  ON public.student_fees (school_id, student_id, status, due_date ASC, created_at ASC)
  WHERE status = ANY (ARRAY['PENDING'::text, 'PARTIAL'::text]);

-- Composite for fee listings filtered by school + student + status
CREATE INDEX IF NOT EXISTS idx_student_fees_school_student_status
  ON public.student_fees (school_id, student_id, status);

-- Payments by school + student (admin/payments filters, shell summary)
CREATE INDEX IF NOT EXISTS idx_payments_school_student
  ON public.payments (school_id, student_id);

CREATE INDEX IF NOT EXISTS idx_payments_school_student_status
  ON public.payments (school_id, student_id, status);

-- Students filtered by school + class (directory, class roster)
CREATE INDEX IF NOT EXISTS idx_students_school_class
  ON public.students (school_id, class_id);

-- Results by school + student (parent/student result reads)
CREATE INDEX IF NOT EXISTS idx_results_school_student
  ON public.results (school_id, student_id);

-- Dashboard gender breakdown: school_id + role + gender
CREATE INDEX IF NOT EXISTS idx_profiles_school_role_gender
  ON public.profiles (school_id, role, gender);

-- Audit log admin filters by school + action timeline
CREATE INDEX IF NOT EXISTS idx_audit_logs_school_action_created
  ON public.audit_logs (school_id, action, created_at DESC);

-- Ensure core school_id indexes exist (idempotent safety for partial baselines)
CREATE INDEX IF NOT EXISTS idx_audit_logs_school_id
  ON public.audit_logs USING btree (school_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_school_created
  ON public.audit_logs USING btree (school_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_student_fees_school_id
  ON public.student_fees USING btree (school_id);

CREATE INDEX IF NOT EXISTS idx_student_fees_status
  ON public.student_fees USING btree (school_id, status);
