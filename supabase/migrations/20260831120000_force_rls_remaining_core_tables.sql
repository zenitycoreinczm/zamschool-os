-- =============================================================
-- ZamSchool OS — Force RLS on remaining core tenant tables
-- Migration: 20260831120000_force_rls_remaining_core_tables.sql
-- Date: 2026-08-31
--
-- Purpose:
--   The 20260621120000 migration FORCED RLS on 90 tables but missed the
--   core roster tables created in the baseline schema. These eight
--   (+ user_devices) held only ENABLE ROW LEVEL SECURITY, which the
--   table owner can bypass. Forcing closes the owner-bypass gap for:
--     attendance, fee_payments, parent_students, parents, profiles,
--     results, students, teachers, user_devices
--
--   service_role intentionally bypasses RLS; application-layer tenant
--   scoping for service-role queries is enforced separately by
--   scripts/security/audit-service-role-tenant.mjs.
-- =============================================================

ALTER TABLE IF EXISTS public.attendance      FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.fee_payments    FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.parent_students FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.parents         FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.profiles        FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.results         FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.students        FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.teachers        FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_devices    FORCE ROW LEVEL SECURITY;

-- ─── Regression guard (superset of 20260721120000) ────────────────────────
-- Fails the deploy if any table below ever loses ENABLE/FORCE RLS.

DO $$
DECLARE
  _table TEXT;
  _rls_enabled BOOLEAN;
  _rls_forced BOOLEAN;
  _failed TEXT[] := ARRAY[]::TEXT[];

  _tables TEXT[] := ARRAY[
    'academic_terms',
    'academic_years',
    'access_codes',
    'activity_logs',
    'admin_actions',
    'admin_role_scopes',
    'alert_thresholds',
    'announcement_seen',
    'announcement_views',
    'announcements',
    'assignment_submissions',
    'assignments',
    'async_jobs',
    'attendance',
    'attendance_rollcall_sessions',
    'audit_logs',
    'behaviour_followups',
    'behaviour_logs',
    'class_insights',
    'class_subjects',
    'classes',
    'classroom_activity_stream',
    'discipline_actions',
    'discipline_categories',
    'discipline_records',
    'duty_roster',
    'email_verifications',
    'events',
    'exam_questions',
    'exam_submission_answers',
    'exam_submissions',
    'exams',
    'fee_payments',
    'fees',
    'finance_records',
    'finances',
    'grade_publish_history',
    'gradebook_snapshots',
    'grades',
    'grading_scales',
    'idempotency_keys',
    'lesson_plans',
    'lessons',
    'markbook_columns',
    'markbook_entries',
    'markbook_scores',
    'markbook_sheets',
    'merit_logs',
    'message_templates',
    'messages',
    'notifications',
    'outbox_events',
    'parent_students',
    'parents',
    'payments',
    'permission_features',
    'permission_group_roles',
    'permission_groups',
    'permission_slip_responses',
    'permission_slips',
    'profiles',
    'question_bank',
    'report_card_reviews',
    'report_cards',
    'results',
    'role_permissions',
    'scheduled_broadcasts',
    'school_departments',
    'school_emergency_state',
    'school_invites',
    'school_settings',
    'schools',
    'staff_invitations',
    'staff_meetings',
    'student_fees',
    'student_pulse_metrics',
    'student_risk_assessments',
    'students',
    'subjects',
    'sync_queue',
    'system_events',
    'teacher_active_sessions',
    'teacher_alerts',
    'teacher_class_subject_assignments',
    'teacher_office_hours',
    'teacher_performance_metrics',
    'teacher_recognition',
    'teacher_subject_specializations',
    'teachers',
    'temp_tokens',
    'terms',
    'user_devices',
    'user_sessions'
  ];

BEGIN
  FOREACH _table IN ARRAY _tables LOOP
    SELECT
      relrowsecurity,
      relforcerowsecurity
    INTO
      _rls_enabled,
      _rls_forced
    FROM pg_class
    WHERE relname = _table
      AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

    IF NOT FOUND THEN
      -- Table does not exist yet — skip gracefully (may be added in later migration).
      CONTINUE;
    END IF;

    IF NOT _rls_enabled THEN
      _failed := array_append(_failed, _table || ' [RLS NOT ENABLED]');
    ELSIF NOT _rls_forced THEN
      _failed := array_append(_failed, _table || ' [RLS ENABLED but NOT FORCED]');
    END IF;
  END LOOP;

  IF array_length(_failed, 1) > 0 THEN
    RAISE EXCEPTION
      E'RLS Audit Regression Guard FAILED.\n'
      'The following tenant tables are missing FORCE ROW LEVEL SECURITY:\n  %\n\n'
      'Run: ALTER TABLE public.<table_name> FORCE ROW LEVEL SECURITY;\n'
      'for each table listed above, then re-run migrations.',
      array_to_string(_failed, E'\n  ');
  END IF;

  RAISE NOTICE 'RLS Audit: All % tenant tables have FORCE ROW LEVEL SECURITY. ✓',
    array_length(_tables, 1);
END $$;
