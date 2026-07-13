-- ============================================================
-- ZamSchool OS — Demo Data Cleanup Script
-- Purpose: Delete all demo data before going live
-- Preserves: superadmin@zamschool.edu.zm only
-- Date: 2026-07-11
-- ============================================================
-- WARNING: This script is DESTRUCTIVE and irreversible!
-- Run this ONLY if you want to delete all demo data.
-- ============================================================

BEGIN;

-- Step 1: Store the superadmin user ID for preservation
DO $$
DECLARE
  v_superadmin_id uuid;
BEGIN
  SELECT id INTO v_superadmin_id
  FROM auth.users
  WHERE email = 'superadmin@zamschool.edu.zm'
  LIMIT 1;

  IF v_superadmin_id IS NULL THEN
    RAISE EXCEPTION 'Superadmin user (superadmin@zamschool.edu.zm) not found! Aborting cleanup.';
  END IF;

  RAISE NOTICE 'Preserving superadmin user: %', v_superadmin_id;

  -- Disable all triggers temporarily to avoid FK constraint issues
  PERFORM set_config('session_replication_role', 'replica', false);

  -- ============================================================
  -- PHASE 1: Delete school-scoped data (child tables first)
  -- ============================================================

  -- Assignment submissions
  DELETE FROM public.assignment_submissions;
  RAISE NOTICE 'Cleared assignment_submissions';

  -- Assignments
  DELETE FROM public.assignments;
  RAISE NOTICE 'Cleared assignments';

  -- Attendance rollcall sessions
  DELETE FROM public.attendance_rollcall_sessions;
  RAISE NOTICE 'Cleared attendance_rollcall_sessions';

  -- Attendance
  DELETE FROM public.attendance;
  RAISE NOTICE 'Cleared attendance';

  -- Behaviour followups
  DELETE FROM public.behaviour_followups;
  RAISE NOTICE 'Cleared behaviour_followups';

  -- Behaviour logs
  DELETE FROM public.behaviour_logs;
  RAISE NOTICE 'Cleared behaviour_logs';

  -- Class insights
  DELETE FROM public.class_insights;
  RAISE NOTICE 'Cleared class_insights';

  -- Classroom activity stream
  DELETE FROM public.classroom_activity_stream;
  RAISE NOTICE 'Cleared classroom_activity_stream';

  -- Class subjects
  DELETE FROM public.class_subjects;
  RAISE NOTICE 'Cleared class_subjects';

  -- Discipline actions
  DELETE FROM public.discipline_actions;
  RAISE NOTICE 'Cleared discipline_actions';

  -- Discipline records
  DELETE FROM public.discipline_records;
  RAISE NOTICE 'Cleared discipline_records';

  -- Discipline categories
  DELETE FROM public.discipline_categories;
  RAISE NOTICE 'Cleared discipline_categories';

  -- Duty roster
  DELETE FROM public.duty_roster;
  RAISE NOTICE 'Cleared duty_roster';

  -- Events
  DELETE FROM public.events;
  RAISE NOTICE 'Cleared events';

  -- Exam submission answers
  DELETE FROM public.exam_submission_answers;
  RAISE NOTICE 'Cleared exam_submission_answers';

  -- Exam submissions
  DELETE FROM public.exam_submissions;
  RAISE NOTICE 'Cleared exam_submissions';

  -- Exam questions
  DELETE FROM public.exam_questions;
  RAISE NOTICE 'Cleared exam_questions';

  -- Exams
  DELETE FROM public.exams;
  RAISE NOTICE 'Cleared exams';

  -- Fee payments
  DELETE FROM public.fee_payments;
  RAISE NOTICE 'Cleared fee_payments';

  -- Student fees
  DELETE FROM public.student_fees;
  RAISE NOTICE 'Cleared student_fees';

  -- Fees
  DELETE FROM public.fees;
  RAISE NOTICE 'Cleared fees';

  -- Finance records
  DELETE FROM public.finance_records;
  RAISE NOTICE 'Cleared finance_records';

  -- Finances
  DELETE FROM public.finances;
  RAISE NOTICE 'Cleared finances';

  -- Grade publish history
  DELETE FROM public.grade_publish_history;
  RAISE NOTICE 'Cleared grade_publish_history';

  -- Gradebook snapshots
  DELETE FROM public.gradebook_snapshots;
  RAISE NOTICE 'Cleared gradebook_snapshots';

  -- Markbook entries
  DELETE FROM public.markbook_entries;
  RAISE NOTICE 'Cleared markbook_entries';

  -- Markbook columns
  DELETE FROM public.markbook_columns;
  RAISE NOTICE 'Cleared markbook_columns';

  -- Markbook scores
  DELETE FROM public.markbook_scores;
  RAISE NOTICE 'Cleared markbook_scores';

  -- Markbook sheets
  DELETE FROM public.markbook_sheets;
  RAISE NOTICE 'Cleared markbook_sheets';

  -- Merit logs
  DELETE FROM public.merit_logs;
  RAISE NOTICE 'Cleared merit_logs';

  -- Message templates
  DELETE FROM public.message_templates;
  RAISE NOTICE 'Cleared message_templates';

  -- Messages
  DELETE FROM public.messages;
  RAISE NOTICE 'Cleared messages';

  -- Notifications
  DELETE FROM public.notifications;
  RAISE NOTICE 'Cleared notifications';

  -- Announcement seen
  DELETE FROM public.announcement_seen;
  RAISE NOTICE 'Cleared announcement_seen';

  -- Announcement views
  DELETE FROM public.announcement_views;
  RAISE NOTICE 'Cleared announcement_views';

  -- Announcements
  DELETE FROM public.announcements;
  RAISE NOTICE 'Cleared announcements';

  -- Outbox events
  DELETE FROM public.outbox_events;
  RAISE NOTICE 'Cleared outbox_events';

  -- System events
  DELETE FROM public.system_events;
  RAISE NOTICE 'Cleared system_events';

  -- Sync queue
  DELETE FROM public.sync_queue;
  RAISE NOTICE 'Cleared sync_queue';

  -- Async jobs
  DELETE FROM public.async_jobs;
  RAISE NOTICE 'Cleared async_jobs';

  -- Activity logs
  DELETE FROM public.activity_logs;
  RAISE NOTICE 'Cleared activity_logs';

  -- Audit logs
  DELETE FROM public.audit_logs;
  RAISE NOTICE 'Cleared audit_logs';

  -- Admin actions
  DELETE FROM public.admin_actions;
  RAISE NOTICE 'Cleared admin_actions';

  -- Alert thresholds
  DELETE FROM public.alert_thresholds;
  RAISE NOTICE 'Cleared alert_thresholds';

  -- Teacher active sessions
  DELETE FROM public.teacher_active_sessions;
  RAISE NOTICE 'Cleared teacher_active_sessions';

  -- Teacher alerts
  DELETE FROM public.teacher_alerts;
  RAISE NOTICE 'Cleared teacher_alerts';

  -- Teacher class subject assignments
  DELETE FROM public.teacher_class_subject_assignments;
  RAISE NOTICE 'Cleared teacher_class_subject_assignments';

  -- Teacher office hours
  DELETE FROM public.teacher_office_hours;
  RAISE NOTICE 'Cleared teacher_office_hours';

  -- Teacher performance metrics
  DELETE FROM public.teacher_performance_metrics;
  RAISE NOTICE 'Cleared teacher_performance_metrics';

  -- Teacher recognition
  DELETE FROM public.teacher_recognition;
  RAISE NOTICE 'Cleared teacher_recognition';

  -- Teacher subject specializations
  DELETE FROM public.teacher_subject_specializations;
  RAISE NOTICE 'Cleared teacher_subject_specializations';

  -- Student pulse metrics
  DELETE FROM public.student_pulse_metrics;
  RAISE NOTICE 'Cleared student_pulse_metrics';

  -- Student risk assessments
  DELETE FROM public.student_risk_assessments;
  RAISE NOTICE 'Cleared student_risk_assessments';

  -- Lesson plans
  DELETE FROM public.lesson_plans;
  RAISE NOTICE 'Cleared lesson_plans';

  -- Lessons
  DELETE FROM public.lessons;
  RAISE NOTICE 'Cleared lessons';

  -- Results
  DELETE FROM public.results;
  RAISE NOTICE 'Cleared results';

  -- Report card reviews
  DELETE FROM public.report_card_reviews;
  RAISE NOTICE 'Cleared report_card_reviews';

  -- Report cards
  DELETE FROM public.report_cards;
  RAISE NOTICE 'Cleared report_cards';

  -- Question bank
  DELETE FROM public.question_bank;
  RAISE NOTICE 'Cleared question_bank';

  -- Permission slip responses
  DELETE FROM public.permission_slip_responses;
  RAISE NOTICE 'Cleared permission_slip_responses';

  -- Permission slips
  DELETE FROM public.permission_slips;
  RAISE NOTICE 'Cleared permission_slips';

  -- Scheduled broadcasts
  DELETE FROM public.scheduled_broadcasts;
  RAISE NOTICE 'Cleared scheduled_broadcasts';

  -- School emergency state
  DELETE FROM public.school_emergency_state;
  RAISE NOTICE 'Cleared school_emergency_state';

  -- School settings
  DELETE FROM public.school_settings;
  RAISE NOTICE 'Cleared school_settings';

  -- School departments
  DELETE FROM public.school_departments;
  RAISE NOTICE 'Cleared school_departments';

  -- Staff meetings
  DELETE FROM public.staff_meetings;
  RAISE NOTICE 'Cleared staff_meetings';

  -- Payments
  DELETE FROM public.payments;
  RAISE NOTICE 'Cleared payments';

  -- Parent students
  DELETE FROM public.parent_students;
  RAISE NOTICE 'Cleared parent_students';

  -- Parents
  DELETE FROM public.parents;
  RAISE NOTICE 'Cleared parents';

  -- Students
  DELETE FROM public.students;
  RAISE NOTICE 'Cleared students';

  -- Teachers
  DELETE FROM public.teachers;
  RAISE NOTICE 'Cleared teachers';

  -- Classes
  DELETE FROM public.classes;
  RAISE NOTICE 'Cleared classes';

  -- Subjects
  DELETE FROM public.subjects;
  RAISE NOTICE 'Cleared subjects';

  -- Grades
  DELETE FROM public.grades;
  RAISE NOTICE 'Cleared grades';

  -- Grading scales
  DELETE FROM public.grading_scales;
  RAISE NOTICE 'Cleared grading_scales';

  -- Academic terms
  DELETE FROM public.academic_terms;
  RAISE NOTICE 'Cleared academic_terms';

  -- Academic years
  DELETE FROM public.academic_years;
  RAISE NOTICE 'Cleared academic_years';

  -- Terms
  DELETE FROM public.terms;
  RAISE NOTICE 'Cleared terms';

  -- Permission features
  DELETE FROM public.permission_features;
  RAISE NOTICE 'Cleared permission_features';

  -- Permission group roles
  DELETE FROM public.permission_group_roles;
  RAISE NOTICE 'Cleared permission_group_roles';

  -- Permission groups
  DELETE FROM public.permission_groups;
  RAISE NOTICE 'Cleared permission_groups';

  -- Role permissions
  DELETE FROM public.role_permissions;
  RAISE NOTICE 'Cleared role_permissions';

  -- Admin role scopes
  DELETE FROM public.admin_role_scopes;
  RAISE NOTICE 'Cleared admin_role_scopes';

  -- User sessions
  DELETE FROM public.user_sessions;
  RAISE NOTICE 'Cleared user_sessions';

  -- Email verifications
  DELETE FROM public.email_verifications;
  RAISE NOTICE 'Cleared email_verifications';

  -- Temp tokens
  DELETE FROM public.temp_tokens;
  RAISE NOTICE 'Cleared temp_tokens';

  -- Access codes
  DELETE FROM public.access_codes;
  RAISE NOTICE 'Cleared access_codes';

  -- School invites
  DELETE FROM public.school_invites;
  RAISE NOTICE 'Cleared school_invites';

  -- Staff invitations
  DELETE FROM public.staff_invitations;
  RAISE NOTICE 'Cleared staff_invitations';

  -- Idempotency keys
  DELETE FROM public.idempotency_keys;
  RAISE NOTICE 'Cleared idempotency_keys';

  -- ============================================================
  -- PHASE 2: Delete all profiles EXCEPT superadmin
  -- ============================================================
  DELETE FROM public.profiles
  WHERE id != v_superadmin_id;
  RAISE NOTICE 'Cleared all profiles except superadmin';

  -- ============================================================
  -- PHASE 3: Delete all schools
  -- ============================================================
  DELETE FROM public.schools;
  RAISE NOTICE 'Cleared all schools';

  -- ============================================================
  -- PHASE 4: Delete all auth users EXCEPT superadmin
  -- ============================================================
  DELETE FROM auth.users
  WHERE id != v_superadmin_id;
  RAISE NOTICE 'Cleared all auth users except superadmin';

  -- Re-enable triggers
  PERFORM set_config('session_replication_role', 'origin', false);

  RAISE NOTICE '========================================';
  RAISE NOTICE 'Cleanup complete!';
  RAISE NOTICE 'Preserved: superadmin@zamschool.edu.zm';
  RAISE NOTICE '========================================';
END $$;

COMMIT;