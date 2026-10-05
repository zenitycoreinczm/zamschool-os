-- ============================================================
-- ZamSchool OS ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â Database Schema Baseline
-- Generated from production database: jnnroitaftfmclegbeac
-- Date: 2026-06-18
-- ============================================================
-- This file captures the complete current schema state.
-- All future migrations should be added as new files in
-- supabase/migrations/ with timestamp-prefixed names.
-- ============================================================

-- Functions are listed in Sections below in alphabetical, not
-- dependency, order; skip CREATE-time body validation so forward
-- references (e.g. accessible_class_ids -> current_school_id) resolve
-- at call time once every function exists.
SET check_function_bodies = off;

-- Section 1: Extensions
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "pgcrypto" SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "supabase_vault" SCHEMA "vault";
CREATE EXTENSION IF NOT EXISTS "wrappers" SCHEMA "extensions";

-- Section 2: Schemas
CREATE SCHEMA IF NOT EXISTS "extensions";
CREATE SCHEMA IF NOT EXISTS "vault";
CREATE SCHEMA IF NOT EXISTS "private";

-- Section 3: Enum Types
DO $$ BEGIN
  CREATE TYPE public.behaviour_severity AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Section 4: Tables (92 tables)
CREATE TABLE IF NOT EXISTS public.academic_terms (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  academic_year_id uuid,
  school_id uuid,
  name character varying(50) NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  is_active boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.academic_years (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  school_id uuid,
  name character varying(50) NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  is_active boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.access_codes (
  code character varying(6) NOT NULL,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  expires_at timestamp with time zone NOT NULL,
  used_at timestamp with time zone,
  used_by_email text,
  created_by uuid,
  max_uses integer DEFAULT 1,
  province text,
  school_type text,
  approval_status text DEFAULT 'pending'::text,
  notes text,
  use_count integer DEFAULT 0 NOT NULL,
  district text,
  ownership_type text
);

CREATE TABLE IF NOT EXISTS public.activity_logs (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  school_id uuid NOT NULL,
  actor_profile_id uuid,
  actor_role text NOT NULL,
  action text NOT NULL,
  entity_type text,
  entity_id text,
  summary text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.admin_actions (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  school_id uuid NOT NULL,
  actor_id uuid NOT NULL,
  action_type text NOT NULL,
  target_entity_type text,
  target_entity_id uuid,
  payload jsonb DEFAULT '{}'::jsonb,
  confirmation_token text,
  confirmed_at timestamp with time zone,
  status text DEFAULT 'executed'::text NOT NULL,
  rollback_of uuid,
  executed_at timestamp with time zone DEFAULT now() NOT NULL,
  notes text
);

CREATE TABLE IF NOT EXISTS public.admin_role_scopes (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  school_id uuid NOT NULL,
  user_id uuid NOT NULL,
  scope text NOT NULL,
  granted_by uuid,
  granted_at timestamp with time zone DEFAULT now() NOT NULL,
  revoked_at timestamp with time zone,
  is_active boolean DEFAULT true NOT NULL,
  notes text
);

CREATE TABLE IF NOT EXISTS public.alert_thresholds (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  school_id uuid NOT NULL,
  metric text NOT NULL,
  threshold_value numeric NOT NULL,
  severity text DEFAULT 'warning'::text NOT NULL,
  is_active boolean DEFAULT true NOT NULL,
  updated_by uuid,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.announcement_seen (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  announcement_id uuid,
  profile_id uuid,
  seen_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.announcement_views (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  announcement_id uuid NOT NULL,
  viewer_id uuid NOT NULL,
  viewed_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.announcements (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  school_id uuid NOT NULL,
  title text NOT NULL,
  content text NOT NULL,
  target_role text,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  priority text DEFAULT 'normal'::text,
  status text DEFAULT 'live'::text,
  publish_at timestamp with time zone DEFAULT now(),
  expires_at timestamp with time zone,
  delivered_count integer DEFAULT 0,
  seen_count integer DEFAULT 0,
  updated_at timestamp with time zone DEFAULT now(),
  target_user_id uuid,
  target_class_id uuid,
  target_grade_level integer,
  audience text DEFAULT 'all'::text NOT NULL,
  is_pinned boolean DEFAULT false,
  scheduled_at timestamp with time zone,
  attachment_urls text[],
  voice_note_url text,
  published_at timestamp with time zone,
  target_audience text,
  attachment_url text,
  attachment_name text
);

CREATE TABLE IF NOT EXISTS public.assignment_submissions (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  school_id uuid NOT NULL,
  assignment_id uuid NOT NULL,
  student_profile_id uuid NOT NULL,
  submission_text text,
  submission_link text,
  submitted_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  submission_file_url text,
  submission_file_name text
);

CREATE TABLE IF NOT EXISTS public.assignments (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  school_id uuid NOT NULL,
  subject_id uuid NOT NULL,
  class_id uuid NOT NULL,
  teacher_id uuid,
  title text NOT NULL,
  description text,
  due_date date NOT NULL,
  total_marks integer DEFAULT 100,
  created_at timestamp with time zone DEFAULT now(),
  attachment_url text,
  attachment_name text
);

CREATE TABLE IF NOT EXISTS public.async_jobs (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  school_id uuid NOT NULL,
  job_type text NOT NULL,
  status text DEFAULT 'pending'::text NOT NULL,
  priority integer DEFAULT 100 NOT NULL,
  payload jsonb DEFAULT '{}'::jsonb NOT NULL,
  result jsonb,
  attempts integer DEFAULT 0 NOT NULL,
  max_attempts integer DEFAULT 3 NOT NULL,
  available_at timestamp with time zone DEFAULT now() NOT NULL,
  locked_at timestamp with time zone,
  locked_by text,
  created_by uuid,
  completed_at timestamp with time zone,
  failed_at timestamp with time zone,
  last_error text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.attendance (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  school_id uuid NOT NULL,
  student_id uuid NOT NULL,
  class_id uuid NOT NULL,
  date date NOT NULL,
  status text NOT NULL,
  remarks text,
  recorded_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  session_name text DEFAULT 'Morning Roll Call'::text,
  session_time time without time zone DEFAULT '08:00:00'::time without time zone,
  attendance_date date NOT NULL,
  notes text,
  synced_at timestamp with time zone,
  client_id text
);

CREATE TABLE IF NOT EXISTS public.attendance_rollcall_sessions (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  school_id uuid NOT NULL,
  class_id uuid NOT NULL,
  subject_id uuid,
  teacher_id uuid NOT NULL,
  lesson_id uuid,
  date date DEFAULT CURRENT_DATE NOT NULL,
  status text DEFAULT 'open'::text NOT NULL,
  session_mode text DEFAULT 'standard'::text,
  engagement_metrics jsonb DEFAULT '{}'::jsonb,
  mood_rating text DEFAULT 'neutral'::text,
  quick_action_enabled boolean DEFAULT false,
  swipe_gestures_enabled boolean DEFAULT false,
  present_count integer DEFAULT 0,
  absent_count integer DEFAULT 0,
  late_count integer DEFAULT 0,
  excused_count integer DEFAULT 0,
  total_count integer DEFAULT 0,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid,
  school_id uuid,
  action character varying(50) NOT NULL,
  resource_type character varying(50) DEFAULT 'unknown'::character varying NOT NULL,
  resource_id uuid,
  details jsonb DEFAULT '{}'::jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  entity_type text,
  entity_id uuid,
  old_data jsonb,
  new_data jsonb
);

CREATE TABLE IF NOT EXISTS public.behaviour_followups (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  school_id uuid NOT NULL,
  behaviour_log_id uuid NOT NULL,
  assigned_to uuid,
  status text DEFAULT 'OPEN'::text NOT NULL,
  notes text,
  due_at timestamp with time zone,
  created_by uuid,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  resolved_at timestamp with time zone
);

CREATE TABLE IF NOT EXISTS public.behaviour_logs (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  school_id uuid NOT NULL,
  student_id uuid NOT NULL,
  logged_by uuid NOT NULL,
  category text NOT NULL,
  severity behaviour_severity DEFAULT 'LOW'::behaviour_severity,
  description text,
  action_taken text,
  parent_notified boolean DEFAULT false,
  admin_notified boolean DEFAULT false,
  logged_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  incident_type text DEFAULT 'BEHAVIOUR'::text,
  resolved_at timestamp with time zone,
  resolved_by uuid,
  suspension_days integer DEFAULT 0,
  parent_acknowledged boolean DEFAULT false,
  parent_acknowledged_at timestamp with time zone
);

CREATE TABLE IF NOT EXISTS public.class_insights (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  class_id uuid NOT NULL,
  subject_id uuid,
  teacher_id uuid NOT NULL,
  insight_type text NOT NULL,
  title text NOT NULL,
  description text,
  impact_level text DEFAULT 'medium'::text,
  urgency text DEFAULT 'medium'::text,
  affected_students text[] DEFAULT '{}'::text[],
  affected_groups text[] DEFAULT '{}'::text[],
  recommended_actions text[] DEFAULT '{}'::text[],
  auto_generated boolean DEFAULT true,
  status text DEFAULT 'active'::text,
  acknowledged_at timestamp with time zone,
  resolved_at timestamp with time zone,
  confidence_score numeric(3,2) DEFAULT 0.00,
  data_points jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  school_id uuid
);

CREATE TABLE IF NOT EXISTS public.class_subjects (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  class_id uuid NOT NULL,
  subject_id uuid NOT NULL,
  teacher_id uuid
);

CREATE TABLE IF NOT EXISTS public.classes (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  school_id uuid NOT NULL,
  name text NOT NULL,
  grade_level integer NOT NULL,
  capacity integer DEFAULT 40,
  supervisor_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  grade_id uuid
);

CREATE TABLE IF NOT EXISTS public.classroom_activity_stream (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  class_id uuid NOT NULL,
  teacher_id uuid NOT NULL,
  subject_id uuid,
  activity_type text NOT NULL,
  title text NOT NULL,
  description text,
  content jsonb DEFAULT '{}'::jsonb,
  attachments jsonb DEFAULT '[]'::jsonb,
  visibility text DEFAULT 'class'::text,
  target_students uuid[] DEFAULT '{}'::uuid[],
  views integer DEFAULT 0,
  likes integer DEFAULT 0,
  comments jsonb DEFAULT '[]'::jsonb,
  status text DEFAULT 'published'::text,
  pinned boolean DEFAULT false,
  featured boolean DEFAULT false,
  scheduled_at timestamp with time zone,
  expires_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  school_id uuid
);

CREATE TABLE IF NOT EXISTS public.discipline_actions (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  school_id uuid NOT NULL,
  record_id uuid NOT NULL,
  action_type text NOT NULL,
  description text,
  action_date date DEFAULT CURRENT_DATE NOT NULL,
  duration_days integer,
  issued_by uuid NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.discipline_categories (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  school_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  severity integer DEFAULT 1,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.discipline_records (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  school_id uuid NOT NULL,
  student_id uuid NOT NULL,
  class_id uuid,
  category_id uuid,
  reported_by uuid,
  title text NOT NULL,
  description text,
  incident_date date DEFAULT CURRENT_DATE NOT NULL,
  incident_location text,
  severity integer DEFAULT 1,
  status text DEFAULT 'open'::text,
  resolution_notes text,
  resolved_by uuid,
  resolved_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.duty_roster (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  school_id uuid NOT NULL,
  teacher_id uuid NOT NULL,
  duty_type text NOT NULL,
  duty_date date NOT NULL,
  start_time time without time zone,
  end_time time without time zone,
  location text,
  notes text,
  created_by uuid,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.email_verifications (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  user_id uuid NOT NULL,
  email text NOT NULL,
  otp_code text NOT NULL,
  verified boolean DEFAULT false,
  expires_at timestamp with time zone NOT NULL,
  verified_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.events (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  school_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  start_date timestamp with time zone NOT NULL,
  end_date timestamp with time zone,
  location text,
  category text DEFAULT 'general'::text,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  audience text DEFAULT 'all'::text NOT NULL,
  event_date date,
  start_time time without time zone,
  end_time time without time zone,
  target_role text,
  target_class_id uuid
);

CREATE TABLE IF NOT EXISTS public.exam_questions (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  school_id uuid NOT NULL,
  exam_id uuid NOT NULL,
  "position" integer NOT NULL,
  question_text text NOT NULL,
  question_type text NOT NULL,
  options jsonb,
  correct_answer text,
  sample_answer text,
  points numeric(10,2) DEFAULT 1 NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.exam_submission_answers (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  submission_id uuid NOT NULL,
  question_id uuid NOT NULL,
  answer_text text,
  is_correct boolean,
  awarded_points numeric(10,2),
  review_status text DEFAULT 'pending'::text NOT NULL,
  review_comment text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.exam_submissions (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  school_id uuid NOT NULL,
  exam_id uuid NOT NULL,
  student_id uuid NOT NULL,
  status text DEFAULT 'submitted'::text NOT NULL,
  submitted_at timestamp with time zone,
  auto_score numeric(10,2) DEFAULT 0 NOT NULL,
  manual_score numeric(10,2) DEFAULT 0 NOT NULL,
  final_score numeric(10,2) DEFAULT 0 NOT NULL,
  needs_review boolean DEFAULT false NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.exams (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  school_id uuid NOT NULL,
  subject_id uuid NOT NULL,
  class_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  exam_date date NOT NULL,
  start_time time without time zone,
  duration_minutes integer DEFAULT 60,
  total_marks integer DEFAULT 100,
  created_at timestamp with time zone DEFAULT now(),
  status text DEFAULT 'draft'::text NOT NULL,
  instructions text,
  available_from timestamp with time zone,
  available_until timestamp with time zone
);

CREATE TABLE IF NOT EXISTS public.fee_payments (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  school_id uuid NOT NULL,
  student_id uuid NOT NULL,
  parent_id uuid,
  amount numeric NOT NULL,
  payment_method text DEFAULT 'cash'::text NOT NULL,
  reference_number text,
  term text NOT NULL,
  academic_year text NOT NULL,
  payment_date date DEFAULT CURRENT_DATE NOT NULL,
  status text DEFAULT 'pending'::text NOT NULL,
  notes text,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.fees (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  school_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  amount numeric DEFAULT 30 NOT NULL,
  currency text DEFAULT 'ZMW'::text NOT NULL,
  frequency text DEFAULT 'monthly'::text NOT NULL,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.finance_records (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  school_id uuid NOT NULL,
  transaction_type text NOT NULL,
  category text,
  amount numeric NOT NULL,
  currency text DEFAULT 'ZMW'::text,
  description text,
  payment_method text,
  reference_number text,
  transaction_date date NOT NULL,
  recorded_by uuid NOT NULL,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  attachment_url text,
  attachment_name text
);

CREATE TABLE IF NOT EXISTS public.finances (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  school_id uuid NOT NULL,
  transaction_type text NOT NULL,
  category text,
  amount numeric(12,2) NOT NULL,
  description text,
  transaction_date date NOT NULL,
  recorded_by uuid,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.grade_publish_history (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  school_id uuid NOT NULL,
  class_id uuid NOT NULL,
  subject_id uuid NOT NULL,
  column_id uuid,
  publish_type text NOT NULL,
  published_to text NOT NULL,
  published_by uuid NOT NULL,
  published_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  notification_sent boolean DEFAULT false
);

CREATE TABLE IF NOT EXISTS public.gradebook_snapshots (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  school_id uuid NOT NULL,
  class_id uuid NOT NULL,
  subject_id uuid NOT NULL,
  snapshot_data jsonb NOT NULL,
  snapshot_type text NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.grades (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  school_id uuid NOT NULL,
  level integer NOT NULL,
  name text,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.grading_scales (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  school_id uuid,
  grade character varying(10) NOT NULL,
  min_score numeric NOT NULL,
  max_score numeric NOT NULL,
  remarks character varying(255),
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.idempotency_keys (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  route_key text NOT NULL,
  scope_key text NOT NULL,
  idempotency_key text NOT NULL,
  request_hash text NOT NULL,
  response_json jsonb NOT NULL,
  status_code integer NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.lesson_plans (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  school_id uuid NOT NULL,
  teacher_id uuid NOT NULL,
  subject_id uuid,
  grade_id uuid,
  title text NOT NULL,
  objectives text,
  content text,
  resources text[],
  duration_minutes integer,
  week_number integer,
  term_id uuid,
  is_shared boolean DEFAULT false,
  attachment_urls text[],
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.lessons (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  school_id uuid NOT NULL,
  subject_id uuid NOT NULL,
  class_id uuid NOT NULL,
  teacher_id uuid,
  title text NOT NULL,
  description text,
  day_of_week integer,
  start_time time without time zone,
  end_time time without time zone,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.markbook_columns (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  sheet_id uuid,
  school_id uuid NOT NULL,
  name text NOT NULL,
  category text DEFAULT 'other'::text NOT NULL,
  weight numeric DEFAULT 1 NOT NULL,
  max_marks numeric DEFAULT 100 NOT NULL,
  order_index integer DEFAULT 0 NOT NULL,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  class_id uuid,
  subject_id uuid,
  assignment_id uuid,
  description text,
  is_published boolean DEFAULT false,
  publish_date timestamp with time zone,
  due_date timestamp with time zone,
  rubric text,
  created_by uuid,
  updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.markbook_entries (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  sheet_id uuid NOT NULL,
  column_id uuid NOT NULL,
  school_id uuid NOT NULL,
  student_id uuid NOT NULL,
  score numeric,
  is_excused boolean DEFAULT false NOT NULL,
  remarks text,
  updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.markbook_scores (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  school_id uuid NOT NULL,
  column_id uuid NOT NULL,
  student_profile_id uuid NOT NULL,
  score numeric(8,2),
  is_excused boolean DEFAULT false,
  remarks text,
  graded_by uuid,
  graded_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.markbook_sheets (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  school_id uuid NOT NULL,
  class_id uuid NOT NULL,
  subject_id uuid NOT NULL,
  term_id uuid NOT NULL,
  teacher_profile_id uuid NOT NULL,
  computed_at timestamp with time zone,
  computed_json jsonb,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.merit_logs (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  school_id uuid NOT NULL,
  student_id uuid NOT NULL,
  awarded_by uuid NOT NULL,
  points integer NOT NULL,
  reason text NOT NULL,
  awarded_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.message_templates (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  school_id uuid NOT NULL,
  created_by uuid NOT NULL,
  label text NOT NULL,
  body text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.messages (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  school_id uuid NOT NULL,
  sender_id uuid NOT NULL,
  recipient_id uuid NOT NULL,
  body text NOT NULL,
  is_read boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  subject text,
  thread_id uuid DEFAULT uuid_generate_v4(),
  is_system_generated boolean DEFAULT false,
  attachment_url text,
  attachment_name text
);

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  school_id uuid,
  title text NOT NULL,
  message text NOT NULL,
  type text DEFAULT 'general'::text NOT NULL,
  is_read boolean DEFAULT false,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  dedupe_key text
);

CREATE TABLE IF NOT EXISTS public.outbox_events (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  school_id uuid NOT NULL,
  event_type text NOT NULL,
  aggregate_type text NOT NULL,
  aggregate_id uuid,
  payload jsonb DEFAULT '{}'::jsonb NOT NULL,
  status text DEFAULT 'pending'::text NOT NULL,
  attempts integer DEFAULT 0 NOT NULL,
  available_at timestamp with time zone DEFAULT now() NOT NULL,
  processed_at timestamp with time zone,
  last_error text,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.parent_students (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  parent_id uuid NOT NULL,
  student_id uuid NOT NULL,
  relationship text DEFAULT 'parent'::text,
  school_id uuid
);

CREATE TABLE IF NOT EXISTS public.parents (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  profile_id uuid NOT NULL,
  school_id uuid NOT NULL,
  occupation text,
  created_at timestamp with time zone DEFAULT now(),
  relation_type text,
  phone text,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.payments (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  school_id uuid NOT NULL,
  student_id uuid NOT NULL,
  amount numeric NOT NULL,
  currency text DEFAULT 'ZMW'::text,
  payment_type text,
  payment_method text,
  reference_number text,
  status text DEFAULT 'PENDING'::text,
  paid_at timestamp with time zone,
  created_by uuid NOT NULL,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  receipt_url text
);

CREATE TABLE IF NOT EXISTS public.permission_features (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  school_id uuid NOT NULL,
  group_id uuid NOT NULL,
  feature_key text NOT NULL,
  can_create boolean DEFAULT false,
  can_read boolean DEFAULT true,
  can_update boolean DEFAULT false,
  can_delete boolean DEFAULT false,
  scope text DEFAULT 'school'::text,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.permission_group_roles (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  school_id uuid NOT NULL,
  group_id uuid NOT NULL,
  role text NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.permission_groups (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  school_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  is_system boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.permission_slip_responses (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  permission_slip_id uuid NOT NULL,
  student_id uuid NOT NULL,
  parent_id uuid NOT NULL,
  consent_given boolean NOT NULL,
  digital_signature text,
  signed_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  emergency_contact text NOT NULL,
  medical_notes text,
  school_id uuid
);

CREATE TABLE IF NOT EXISTS public.permission_slips (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  school_id uuid NOT NULL,
  created_by uuid NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  event_date timestamp with time zone NOT NULL,
  cost numeric(10,2) DEFAULT 0.00,
  due_date timestamp with time zone NOT NULL,
  is_approved_by_admin boolean DEFAULT false,
  approved_by uuid,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid NOT NULL,
  school_id uuid,
  role text NOT NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text NOT NULL,
  phone text,
  address text,
  avatar_url text,
  gender text,
  date_of_birth date,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  employee_id text,
  deactivated_at timestamp with time zone,
  deactivate_reason text,
  must_change_password boolean DEFAULT false,
  temporary_password_issued_at timestamp with time zone,
  auth_user_id uuid,
  name text,
  admission_number text,
  student_number text,
  employee_number text,
  teacher_identifier text,
  status text DEFAULT 'ACTIVE'::text,
  class_id uuid,
  grade_id uuid,
  enrollment_date date,
  department text,
  specialization text
);

CREATE TABLE IF NOT EXISTS public.question_bank (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  school_id uuid NOT NULL,
  created_by uuid NOT NULL,
  subject_id uuid,
  question_text text NOT NULL,
  question_type text DEFAULT 'SHORT_ANSWER'::text,
  options jsonb,
  correct_answer text,
  marks numeric DEFAULT 1,
  difficulty text DEFAULT 'MEDIUM'::text,
  tags text[],
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.report_card_reviews (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  school_id uuid NOT NULL,
  student_id uuid NOT NULL,
  term_id text NOT NULL,
  class_id uuid NOT NULL,
  teacher_comment text,
  teacher_commented_at timestamp with time zone,
  student_reflection text,
  student_reflected_at timestamp with time zone,
  parent_comment text,
  parent_signature text,
  parent_signed_at timestamp with time zone,
  is_locked boolean DEFAULT false
);

CREATE TABLE IF NOT EXISTS public.report_cards (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  school_id uuid NOT NULL,
  student_id uuid NOT NULL,
  term_id uuid NOT NULL,
  generated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  pdf_url text,
  published boolean DEFAULT false,
  published_at timestamp with time zone
);

CREATE TABLE IF NOT EXISTS public.results (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  school_id uuid NOT NULL,
  student_id uuid NOT NULL,
  exam_id uuid,
  assignment_id uuid,
  score numeric(5,2),
  grade text,
  remarks text,
  created_at timestamp with time zone DEFAULT now(),
  published_at timestamp with time zone,
  published_by uuid,
  term_id uuid,
  assessment_name text,
  weight numeric DEFAULT 1
);

CREATE TABLE IF NOT EXISTS public.role_permissions (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  school_id uuid NOT NULL,
  user_id uuid NOT NULL,
  permission text NOT NULL,
  granted_by uuid,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.scheduled_broadcasts (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  school_id uuid NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  target_role text,
  target_class_id uuid,
  broadcast_type text DEFAULT 'notification'::text,
  scheduled_at timestamp with time zone,
  sent_at timestamp with time zone,
  status text DEFAULT 'pending'::text,
  created_by uuid,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.school_departments (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  school_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  head_of_department uuid,
  is_default boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.school_emergency_state (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  school_id uuid NOT NULL,
  is_active boolean DEFAULT false NOT NULL,
  emergency_type text,
  message text,
  activated_by uuid,
  activated_at timestamp with time zone,
  deactivated_by uuid,
  deactivated_at timestamp with time zone,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.school_invites (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  code text NOT NULL,
  school_name text,
  notes text,
  created_by uuid,
  expires_at timestamp with time zone NOT NULL,
  max_uses integer DEFAULT 1,
  used_count integer DEFAULT 0,
  status text DEFAULT 'active'::text,
  used_by uuid,
  used_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.school_settings (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  school_id uuid NOT NULL,
  setting_key text NOT NULL,
  setting_value jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.schools (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  name text NOT NULL,
  code text NOT NULL,
  address text,
  phone text,
  email text,
  logo_url text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  emis_code text,
  province text,
  district text,
  school_type text,
  ownership_type text,
  status text DEFAULT 'ACTIVE'::text
);

CREATE TABLE IF NOT EXISTS public.staff_invitations (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  school_id uuid NOT NULL,
  email text NOT NULL,
  role text NOT NULL,
  department text,
  "position" text,
  invitation_token uuid DEFAULT gen_random_uuid() NOT NULL,
  temp_password_hash text NOT NULL,
  status text DEFAULT 'pending'::text NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  expires_at timestamp with time zone NOT NULL,
  accepted_at timestamp with time zone,
  phone text,
  accepted_by uuid,
  revoked_at timestamp with time zone,
  temporary_password text,
  invited_by uuid,
  first_name text,
  last_name text,
  token text,
  updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  auth_user_id uuid
);

CREATE TABLE IF NOT EXISTS public.staff_meetings (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  school_id uuid NOT NULL,
  title text NOT NULL,
  meeting_date date NOT NULL,
  start_time time without time zone,
  location text,
  agenda text,
  created_by uuid,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.student_fees (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  student_id uuid NOT NULL,
  fee_id uuid NOT NULL,
  school_id uuid NOT NULL,
  billing_month date NOT NULL,
  amount_due numeric NOT NULL,
  amount_paid numeric DEFAULT 0 NOT NULL,
  status text DEFAULT 'PENDING'::text NOT NULL,
  due_date date NOT NULL,
  paid_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.student_pulse_metrics (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  student_id uuid NOT NULL,
  class_id uuid NOT NULL,
  subject_id uuid,
  date date NOT NULL,
  academic_performance numeric(5,2) DEFAULT 0.00,
  attendance_rate numeric(5,2) DEFAULT 0.00,
  engagement_score numeric(5,2) DEFAULT 0.00,
  behavior_score numeric(5,2) DEFAULT 0.00,
  social_interaction numeric(5,2) DEFAULT 0.00,
  overall_score numeric(5,2) DEFAULT 0.00,
  risk_level text DEFAULT 'low'::text,
  risk_factors jsonb DEFAULT '[]'::jsonb,
  academic_trend text DEFAULT 'stable'::text,
  behavior_trend text DEFAULT 'stable'::text,
  attendance_trend text DEFAULT 'stable'::text,
  engagement_trend text DEFAULT 'stable'::text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  school_id uuid
);

CREATE TABLE IF NOT EXISTS public.student_risk_assessments (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  student_id uuid NOT NULL,
  class_id uuid NOT NULL,
  teacher_id uuid NOT NULL,
  risk_level text NOT NULL,
  risk_score numeric(5,2) DEFAULT 0.00,
  risk_factors jsonb DEFAULT '{}'::jsonb,
  trigger_events jsonb DEFAULT '{}'::jsonb,
  intervention_required boolean DEFAULT false,
  intervention_plan text,
  intervention_status text DEFAULT 'pending'::text,
  parent_notified boolean DEFAULT false,
  parent_notified_at timestamp with time zone,
  parent_response text,
  follow_up_required boolean DEFAULT false,
  follow_up_date date,
  follow_up_completed boolean DEFAULT false,
  assessment_method text DEFAULT 'automated'::text,
  assessor_confidence numeric(3,2) DEFAULT 0.00,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  school_id uuid
);

CREATE TABLE IF NOT EXISTS public.students (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  profile_id uuid NOT NULL,
  school_id uuid NOT NULL,
  class_id uuid,
  student_number text NOT NULL,
  enrollment_date date DEFAULT CURRENT_DATE,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  first_name text,
  last_name text,
  class_grade text,
  date_of_birth date,
  joined_at timestamp with time zone,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  admission_number text
);

CREATE TABLE IF NOT EXISTS public.subjects (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  school_id uuid NOT NULL,
  name text NOT NULL,
  code text NOT NULL,
  description text,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sync_queue (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  school_id uuid NOT NULL,
  user_id uuid NOT NULL,
  method text NOT NULL,
  path text NOT NULL,
  body jsonb,
  status text DEFAULT 'pending'::text NOT NULL,
  retry_count integer DEFAULT 0,
  error_message text,
  created_at timestamp with time zone DEFAULT now(),
  processed_at timestamp with time zone
);

CREATE TABLE IF NOT EXISTS public.system_events (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  type text NOT NULL,
  domain text NOT NULL,
  school_id uuid NOT NULL,
  actor_id uuid,
  payload jsonb DEFAULT '{}'::jsonb,
  severity text DEFAULT 'info'::text,
  correlation_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  processed boolean DEFAULT false
);

CREATE TABLE IF NOT EXISTS public.teacher_active_sessions (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  teacher_id uuid NOT NULL,
  class_id uuid NOT NULL,
  subject_id uuid NOT NULL,
  lesson_id uuid,
  room text,
  start_time timestamp with time zone DEFAULT now(),
  end_time timestamp with time zone,
  status text DEFAULT 'active'::text NOT NULL,
  attendance_count integer DEFAULT 0,
  total_students integer DEFAULT 0,
  engagement_score numeric(5,2) DEFAULT 0.00,
  mood_rating text DEFAULT 'neutral'::text,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  school_id uuid
);

CREATE TABLE IF NOT EXISTS public.teacher_alerts (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  teacher_id uuid NOT NULL,
  school_id uuid NOT NULL,
  alert_type text NOT NULL,
  severity text DEFAULT 'medium'::text NOT NULL,
  title text NOT NULL,
  description text,
  source text DEFAULT 'system'::text,
  action_required boolean DEFAULT false,
  action_url text,
  action_completed boolean DEFAULT false,
  impact_scope text DEFAULT 'individual'::text,
  affected_students uuid[] DEFAULT '{}'::uuid[],
  status text DEFAULT 'active'::text,
  dismissed_at timestamp with time zone,
  resolved_at timestamp with time zone,
  expires_at timestamp with time zone,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.teacher_class_subject_assignments (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  school_id uuid NOT NULL,
  teacher_profile_id uuid NOT NULL,
  class_id uuid NOT NULL,
  subject_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.teacher_office_hours (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  teacher_id uuid NOT NULL,
  school_id uuid NOT NULL,
  weekdays integer[] NOT NULL,
  start_time time without time zone NOT NULL,
  end_time time without time zone NOT NULL,
  enabled boolean DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.teacher_performance_metrics (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  teacher_id uuid NOT NULL,
  school_id uuid NOT NULL,
  class_id uuid,
  subject_id uuid,
  metric_date date NOT NULL,
  period_type text DEFAULT 'daily'::text,
  attendance_completion_rate numeric(5,2) DEFAULT 0.00,
  grading_timeliness_score numeric(5,2) DEFAULT 0.00,
  student_engagement_average numeric(5,2) DEFAULT 0.00,
  parent_response_rate numeric(5,2) DEFAULT 0.00,
  lesson_plan_completion numeric(5,2) DEFAULT 0.00,
  overall_performance_score numeric(5,2) DEFAULT 0.00,
  performance_trend text DEFAULT 'stable'::text,
  recognition_points integer DEFAULT 0,
  achievements jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.teacher_recognition (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  school_id uuid NOT NULL,
  teacher_id uuid NOT NULL,
  awarded_by uuid,
  award_type text NOT NULL,
  message text,
  month_year text,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.teacher_subject_specializations (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  school_id uuid NOT NULL,
  teacher_profile_id uuid NOT NULL,
  subject_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.teachers (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  profile_id uuid NOT NULL,
  school_id uuid NOT NULL,
  employee_number text NOT NULL,
  department text,
  specialization text,
  hire_date date DEFAULT CURRENT_DATE,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  teacher_identifier text,
  subject text,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  employee_id text,
  phone text
);

CREATE TABLE IF NOT EXISTS public.temp_tokens (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  token_hash text NOT NULL,
  user_id uuid NOT NULL,
  kind text DEFAULT 'verify'::text NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.terms (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  school_id uuid NOT NULL,
  academic_year_id uuid NOT NULL,
  name text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  is_active boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.user_sessions (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  school_id uuid,
  auth_session_id text,
  device_name text,
  device_type text,
  browser text,
  os text,
  ip_address text,
  location text,
  is_active boolean DEFAULT true,
  last_active_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  terminated_at timestamp with time zone
);

-- Section 5: Functions (82 functions)
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

    -- teacher supervised classes
    select c.id as class_id
    from public.classes c
    where c.supervisor_id = auth.uid()

    union

    -- teacher assigned classes
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


CREATE OR REPLACE FUNCTION private.accessible_student_ids()
 RETURNS uuid[]
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select coalesce(array_agg(distinct x.student_id), '{}'::uuid[])
  from (
    -- current student
    select s.id as student_id
    from public.students s
    where s.profile_id = auth.uid()

    union

    -- parent's linked children
    select ps.student_id
    from public.parent_students ps
    join public.parents p on p.id = ps.parent_id
    where p.profile_id = auth.uid()

    union

    -- teachers can access students in their classes
    select s.id
    from public.students s
    where s.class_id = any(private.accessible_class_ids())
      and (select private.is_teacher())
  ) x;
$function$;


CREATE OR REPLACE FUNCTION private.assignment_school(p_assignment_id uuid)
 RETURNS uuid
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select a.school_id
  from public.assignments a
  where a.id = p_assignment_id
  limit 1;
$function$;


CREATE OR REPLACE FUNCTION private.class_school(p_class_id uuid)
 RETURNS uuid
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select c.school_id
  from public.classes c
  where c.id = p_class_id
  limit 1;
$function$;


CREATE OR REPLACE FUNCTION private.current_parent_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select p.id
  from public.parents p
  where p.profile_id = auth.uid()
  limit 1;
$function$;


CREATE OR REPLACE FUNCTION private.current_parent_row_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select p.id
  from public.parents p
  where p.profile_id = auth.uid()
  limit 1;
$function$;


CREATE OR REPLACE FUNCTION private."current_role"()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select p.role
  from public.profiles p
  where p.id = auth.uid()
  limit 1;
$function$;


CREATE OR REPLACE FUNCTION private.current_school_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select p.school_id
  from public.profiles p
  where p.id = auth.uid()
  limit 1;
$function$;


CREATE OR REPLACE FUNCTION private.current_student_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select s.id
  from public.students s
  where s.profile_id = auth.uid()
  limit 1;
$function$;


CREATE OR REPLACE FUNCTION private.current_student_row_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select s.id
  from public.students s
  where s.profile_id = auth.uid()
  limit 1;
$function$;


CREATE OR REPLACE FUNCTION private.current_teacher_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select t.id
  from public.teachers t
  where t.profile_id = auth.uid()
  limit 1;
$function$;


CREATE OR REPLACE FUNCTION private.current_teacher_row_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select t.id
  from public.teachers t
  where t.profile_id = auth.uid()
  limit 1;
$function$;


CREATE OR REPLACE FUNCTION private.current_user_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select auth.uid();
$function$;


CREATE OR REPLACE FUNCTION private.exam_school(p_exam_id uuid)
 RETURNS uuid
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select e.school_id
  from public.exams e
  where e.id = p_exam_id
  limit 1;
$function$;


CREATE OR REPLACE FUNCTION private.is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
      and coalesce(p.is_active, true) = true
  );
$function$;


CREATE OR REPLACE FUNCTION private.is_parent()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'parent'
      and coalesce(p.is_active, true) = true
  );
$function$;


CREATE OR REPLACE FUNCTION private.is_student()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'student'
      and coalesce(p.is_active, true) = true
  );
$function$;


CREATE OR REPLACE FUNCTION private.is_teacher()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'teacher'
      and coalesce(p.is_active, true) = true
  );
$function$;


CREATE OR REPLACE FUNCTION private.parent_can_access_student(target_student_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1
    from public.parent_students ps
    where ps.parent_id = private.current_parent_id()
      and ps.student_id = target_student_id
  );
$function$;


CREATE OR REPLACE FUNCTION private.parent_school(p_parent_id uuid)
 RETURNS uuid
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select p.school_id
  from public.parents p
  where p.id = p_parent_id
  limit 1;
$function$;


CREATE OR REPLACE FUNCTION private.profile_school(p_profile_id uuid)
 RETURNS uuid
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select p.school_id
  from public.profiles p
  where p.id = p_profile_id
  limit 1;
$function$;


CREATE OR REPLACE FUNCTION private.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;


CREATE OR REPLACE FUNCTION private.student_school(p_student_id uuid)
 RETURNS uuid
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select s.school_id
  from public.students s
  where s.id = p_student_id
  limit 1;
$function$;


CREATE OR REPLACE FUNCTION private.subject_school(p_subject_id uuid)
 RETURNS uuid
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select s.school_id
  from public.subjects s
  where s.id = p_subject_id
  limit 1;
$function$;


CREATE OR REPLACE FUNCTION private.sync_attendance_dates()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  if new.attendance_date is null and new.date is not null then
    new.attendance_date := new.date;
  end if;

  if new.date is null and new.attendance_date is not null then
    new.date := new.attendance_date;
  end if;

  if new.date is distinct from new.attendance_date then
    new.attendance_date := coalesce(new.attendance_date, new.date);
    new.date := new.attendance_date;
  end if;

  return new;
end;
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
      from public.class_subjects cs
      join public.teachers t on t.id = cs.teacher_id
      where cs.class_id = p_class_id
        and cs.subject_id = p_subject_id
        and t.profile_id = auth.uid()
    )
    or exists (
      select 1
      from public.classes c
      where c.id = p_class_id
        and c.supervisor_id = auth.uid()
    );
$function$;


CREATE OR REPLACE FUNCTION private.teacher_has_class(target_class_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
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
  select exists (
    select 1
    from public.class_subjects cs
    where cs.teacher_id = private.current_teacher_id()
      and cs.class_id = target_class_id
      and cs.subject_id = target_subject_id
  );
$function$;


CREATE OR REPLACE FUNCTION private.teacher_school(p_teacher_id uuid)
 RETURNS uuid
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select t.school_id
  from public.teachers t
  where t.id = p_teacher_id
  limit 1;
$function$;


CREATE OR REPLACE FUNCTION private.validate_assignments_row()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  if private.class_school(new.class_id) is distinct from new.school_id then
    raise exception 'assignments.class_id must belong to the same school_id';
  end if;

  if private.subject_school(new.subject_id) is distinct from new.school_id then
    raise exception 'assignments.subject_id must belong to the same school_id';
  end if;

  if new.teacher_id is not null
     and private.teacher_school(new.teacher_id) is distinct from new.school_id then
    raise exception 'assignments.teacher_id must belong to the same school_id';
  end if;

  return new;
end;
$function$;


CREATE OR REPLACE FUNCTION private.validate_attendance_row()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  if private.class_school(new.class_id) is distinct from new.school_id then
    raise exception 'attendance.class_id must belong to the same school_id';
  end if;

  if private.student_school(new.student_id) is distinct from new.school_id then
    raise exception 'attendance.student_id must belong to the same school_id';
  end if;

  return new;
end;
$function$;


CREATE OR REPLACE FUNCTION private.validate_class_subjects_row()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  v_school_id uuid;
begin
  v_school_id := private.class_school(new.class_id);

  if v_school_id is null then
    raise exception 'class_subjects.class_id is invalid';
  end if;

  if private.subject_school(new.subject_id) is distinct from v_school_id then
    raise exception 'class_subjects.subject_id must belong to the same school as class_id';
  end if;

  if new.teacher_id is not null
     and private.teacher_school(new.teacher_id) is distinct from v_school_id then
    raise exception 'class_subjects.teacher_id must belong to the same school as class_id';
  end if;

  return new;
end;
$function$;


CREATE OR REPLACE FUNCTION private.validate_exams_row()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  if private.class_school(new.class_id) is distinct from new.school_id then
    raise exception 'exams.class_id must belong to the same school_id';
  end if;

  if private.subject_school(new.subject_id) is distinct from new.school_id then
    raise exception 'exams.subject_id must belong to the same school_id';
  end if;

  return new;
end;
$function$;


CREATE OR REPLACE FUNCTION private.validate_fee_payments_row()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  if private.student_school(new.student_id) is distinct from new.school_id then
    raise exception 'fee_payments.student_id must belong to the same school_id';
  end if;

  if new.parent_id is not null
     and private.parent_school(new.parent_id) is distinct from new.school_id then
    raise exception 'fee_payments.parent_id must belong to the same school_id';
  end if;

  return new;
end;
$function$;


CREATE OR REPLACE FUNCTION private.validate_lessons_row()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  if private.class_school(new.class_id) is distinct from new.school_id then
    raise exception 'lessons.class_id must belong to the same school_id';
  end if;

  if private.subject_school(new.subject_id) is distinct from new.school_id then
    raise exception 'lessons.subject_id must belong to the same school_id';
  end if;

  if new.teacher_id is not null
     and private.teacher_school(new.teacher_id) is distinct from new.school_id then
    raise exception 'lessons.teacher_id must belong to the same school_id';
  end if;

  return new;
end;
$function$;


CREATE OR REPLACE FUNCTION private.validate_messages_row()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'private'
AS $function$
begin
  if private.profile_school(new.sender_id) is distinct from new.school_id then
    raise exception 'messages.sender_id must belong to the same school_id';
  end if;

  if private.profile_school(new.recipient_id) is distinct from new.school_id then
    raise exception 'messages.recipient_id must belong to the same school_id';
  end if;

  return new;
end;
$function$;


CREATE OR REPLACE FUNCTION private.validate_parent_students_row()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  if private.parent_school(new.parent_id) is distinct from private.student_school(new.student_id) then
    raise exception 'parent_students parent and student must belong to the same school';
  end if;

  return new;
end;
$function$;


CREATE OR REPLACE FUNCTION private.validate_parents_row()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  if private.profile_school(new.profile_id) is distinct from new.school_id then
    raise exception 'parents.profile_id must belong to the same school_id';
  end if;

  return new;
end;
$function$;


CREATE OR REPLACE FUNCTION private.validate_results_row()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  if private.student_school(new.student_id) is distinct from new.school_id then
    raise exception 'results.student_id must belong to the same school_id';
  end if;

  if new.exam_id is not null
     and private.exam_school(new.exam_id) is distinct from new.school_id then
    raise exception 'results.exam_id must belong to the same school_id';
  end if;

  if new.assignment_id is not null
     and private.assignment_school(new.assignment_id) is distinct from new.school_id then
    raise exception 'results.assignment_id must belong to the same school_id';
  end if;

  return new;
end;
$function$;


CREATE OR REPLACE FUNCTION private.validate_students_row()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  if private.profile_school(new.profile_id) is distinct from new.school_id then
    raise exception 'students.profile_id must belong to the same school_id';
  end if;

  if new.class_id is not null
     and private.class_school(new.class_id) is distinct from new.school_id then
    raise exception 'students.class_id must belong to the same school_id';
  end if;

  return new;
end;
$function$;


CREATE OR REPLACE FUNCTION private.validate_teachers_row()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  if private.profile_school(new.profile_id) is distinct from new.school_id then
    raise exception 'teachers.profile_id must belong to the same school_id';
  end if;

  return new;
end;
$function$;


CREATE OR REPLACE FUNCTION public.audit_trigger_function()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        INSERT INTO public.audit_logs (
            user_id, school_id, action, resource_type, resource_id, details,
            entity_type, entity_id
        ) VALUES (
            get_my_profile_id(),
            get_my_school_id(),
            TG_OP,
            TG_TABLE_NAME,
            CASE WHEN TG_OP = 'INSERT' THEN NEW.id ELSE OLD.id END,
            jsonb_build_object(
                'new_value', 
                CASE WHEN TG_OP = 'INSERT' THEN to_jsonb(NEW) ELSE NULL END,
                'old_value',
                CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE NULL END
            ),
            TG_TABLE_NAME,
            CASE WHEN TG_OP = 'INSERT' THEN NEW.id ELSE OLD.id END
        );
        RETURN NEW;
    ELSIF (TG_OP = 'UPDATE') THEN
        INSERT INTO public.audit_logs (
            user_id, school_id, action, resource_type, resource_id, details,
            entity_type, entity_id
        ) VALUES (
            get_my_profile_id(),
            get_my_school_id(),
            TG_OP,
            TG_TABLE_NAME,
            NEW.id,
            jsonb_build_object(
                'old_value', to_jsonb(OLD),
                'new_value', to_jsonb(NEW)
            ),
            TG_TABLE_NAME,
            NEW.id
        );
        RETURN NEW;
    ELSIF (TG_OP = 'DELETE') THEN
        INSERT INTO public.audit_logs (
            user_id, school_id, action, resource_type, resource_id, details,
            entity_type, entity_id
        ) VALUES (
            get_my_profile_id(),
            get_my_school_id(),
            TG_OP,
            TG_TABLE_NAME,
            OLD.id,
            jsonb_build_object(
                'old_value', to_jsonb(OLD)
            ),
            TG_TABLE_NAME,
            OLD.id
        );
        RETURN OLD;
    END IF;
    RETURN NULL; -- result is ignored since this is an AFTER trigger
END;
$function$;


CREATE OR REPLACE FUNCTION public.calculate_student_average(p_student_id uuid, p_class_id uuid, p_subject_id uuid)
 RETURNS numeric
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
    v_average DECIMAL(5,2);
BEGIN
    SELECT COALESCE(
        ROUND(
            AVG(
                CASE 
                    WHEN ms.is_excused = false AND ms.score IS NOT NULL 
                    THEN ms.score 
                    ELSE NULL 
                END
            )::DECIMAL, 2
        ), 0
    ) INTO v_average
    FROM public.markbook_scores ms
    JOIN public.markbook_columns mc ON ms.column_id = mc.id
    WHERE ms.student_profile_id = p_student_id
    AND mc.class_id = p_class_id
    AND mc.subject_id = p_subject_id
    AND mc.is_published = true;
    
    RETURN v_average;
END;
$function$;


CREATE OR REPLACE FUNCTION public.calculate_student_pulse_score()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog'
AS $function$
BEGIN
    -- Update overall score based on component metrics
    NEW.overall_score = (
        NEW.academic_performance * 0.4 + 
        NEW.attendance_rate * 0.2 + 
        NEW.engagement_score * 0.2 + 
        NEW.behavior_score * 0.1 + 
        NEW.social_interaction * 0.1
    );
    
    -- Determine risk level based on overall score
    IF NEW.overall_score >= 85 THEN
        NEW.risk_level = 'low';
    ELSIF NEW.overall_score >= 70 THEN
        NEW.risk_level = 'medium';
    ELSIF NEW.overall_score >= 50 THEN
        NEW.risk_level = 'high';
    ELSE
        NEW.risk_level = 'critical';
    END IF;
    
    RETURN NEW;
END;
$function$;


CREATE OR REPLACE FUNCTION public.can_manage_invitations()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
  SELECT public.get_my_role() IN ('head_teacher', 'deputy_head_teacher');
$function$;


CREATE OR REPLACE FUNCTION public.check_habitual_absentees(p_school_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE rec RECORD;
BEGIN
  FOR rec IN
    SELECT student_id, COUNT(*) AS absences
    FROM public.attendance
    WHERE school_id = p_school_id
      AND status = 'ABSENT'
      AND attendance_date >= CURRENT_DATE - INTERVAL '30 days'
    GROUP BY student_id
    HAVING COUNT(*) >= 3
  LOOP
    INSERT INTO public.notifications(school_id, user_id, dedupe_key, title, message, type)
    SELECT p_school_id, p.id,
      'absentee-' || rec.student_id || '-' || to_char(CURRENT_DATE,'YYYY-MM'),
      'Habitual Absentee Alert',
      (SELECT name FROM public.profiles WHERE id = rec.student_id) || ' has been absent '
        || rec.absences || ' times this month.',
      'warning'
    FROM public.profiles p
    WHERE p.school_id = p_school_id
      AND p.role IN ('ADMIN','TEACHER')
    ON CONFLICT (school_id, dedupe_key) DO NOTHING;
  END LOOP;
END;
$function$;


CREATE OR REPLACE FUNCTION public.generate_class_insights()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog'
AS $function$
BEGIN
    -- Generate insights based on student pulse data
    -- This would contain complex logic for pattern recognition
    RETURN NEW;
END;
$function$;


CREATE OR REPLACE FUNCTION public.get_my_parent_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  SELECT id FROM public.parents WHERE profile_id = auth.uid() LIMIT 1;
$function$;


CREATE OR REPLACE FUNCTION public.get_my_profile_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'auth'
AS $function$
  SELECT id
  FROM public.profiles
  WHERE id = auth.uid() OR auth_user_id = auth.uid()
  LIMIT 1;
$function$;


CREATE OR REPLACE FUNCTION public.get_my_role()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
    SELECT LOWER(CAST(role AS TEXT))
    FROM public.profiles
    WHERE id = auth.uid() OR auth_user_id = auth.uid()
    LIMIT 1;
$function$;


CREATE OR REPLACE FUNCTION public.get_my_school_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
    SELECT school_id
    FROM public.profiles
    WHERE id = auth.uid() OR auth_user_id = auth.uid()
    LIMIT 1;
$function$;


CREATE OR REPLACE FUNCTION public.get_my_student_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  SELECT id FROM public.students WHERE profile_id = auth.uid() LIMIT 1;
$function$;


CREATE OR REPLACE FUNCTION public.get_my_teacher_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  SELECT id FROM public.teachers WHERE profile_id = auth.uid() LIMIT 1;
$function$;


CREATE OR REPLACE FUNCTION public.get_student_exam_questions(p_exam_id uuid)
 RETURNS TABLE(id uuid, exam_id uuid, question_position integer, question_type text, question_text text, options jsonb, points numeric)
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
DECLARE
  v_school_id uuid;
  v_class_id uuid;
  v_from timestamptz;
  v_until timestamptz;
  v_status text;
BEGIN
  SELECT e.school_id, e.class_id, e.available_from, e.available_until, e.status
    INTO v_school_id, v_class_id, v_from, v_until, v_status
  FROM public.exams e WHERE e.id = p_exam_id;

  IF v_school_id IS NULL THEN RAISE EXCEPTION 'Exam not found'; END IF;
  IF v_school_id <> (SELECT private.current_school_id()) THEN
    RAISE EXCEPTION 'Exam is not in your school';
  END IF;

  IF (SELECT private.is_admin()) OR (SELECT private.is_teacher()) THEN
    RETURN QUERY
      SELECT q.id, q.exam_id, q.position, q.question_type, q.question_text, q.options, q.points
      FROM public.exam_questions q WHERE q.exam_id = p_exam_id ORDER BY q.position;
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.students s
    WHERE s.profile_id = auth.uid() AND s.class_id = v_class_id
  ) THEN
    RAISE EXCEPTION 'Not enrolled in this exam''s class';
  END IF;

  IF v_status NOT IN ('published','active') THEN
    RAISE EXCEPTION 'Exam is not available';
  END IF;
  IF v_from IS NOT NULL AND now() < v_from THEN
    RAISE EXCEPTION 'Exam has not started yet';
  END IF;
  IF v_until IS NOT NULL AND now() > v_until THEN
    RAISE EXCEPTION 'Exam window has closed';
  END IF;

  RETURN QUERY
    SELECT q.id, q.exam_id, q.position, q.question_type, q.question_text, q.options, q.points
    FROM public.exam_questions q WHERE q.exam_id = p_exam_id ORDER BY q.position;
END;
$function$;


CREATE OR REPLACE FUNCTION public.handle_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog'
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;


CREATE OR REPLACE FUNCTION public.is_admin_role()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
    SELECT public.get_my_role() IN (
        'admin', 'principal', 'super_admin', 'deputy_head',
        'academic_admin', 'hr_admin', 'ict_admin'
    );
$function$;


CREATE OR REPLACE FUNCTION public.is_financial_context_role()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
  SELECT public.get_my_role() IN (
    'bursar',
    'payments',
    'principal',
    'head_teacher',
    'admin',
    'super_admin'
  );
$function$;


CREATE OR REPLACE FUNCTION public.is_payments_role()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
  SELECT public.get_my_role() IN ('payments', 'bursar');
$function$;


CREATE OR REPLACE FUNCTION public.is_sensitive_role()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
  SELECT public.get_my_role() IN (
    'super_admin',
    'principal',
    'head_teacher',
    'bursar',
    'ict_admin',
    'it_admin'
  );
$function$;


CREATE OR REPLACE FUNCTION public.is_super_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'auth'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM profiles 
    WHERE (id = auth.uid() OR auth_user_id = auth.uid()) 
    AND role = 'super_admin'
  );
$function$;


CREATE OR REPLACE FUNCTION public.list_user_conversations(p_profile_id uuid, p_school_id uuid, p_search text DEFAULT NULL::text, p_limit integer DEFAULT 20, p_offset integer DEFAULT 0)
 RETURNS TABLE(partner_id uuid, partner_first_name text, partner_last_name text, partner_role text, partner_avatar_url text, last_message_id uuid, last_message_content text, last_message_at timestamp with time zone, last_message_sender_id uuid, last_message_receiver_id uuid, last_message_is_mine boolean, unread_count bigint, total_count bigint)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  with scoped_messages as (
    select
      m.id,
      m.sender_id,
      m.recipient_id,
      m.body,
      m.created_at,
      m.is_read,
      case
        when m.sender_id = p_profile_id then m.recipient_id
        else m.sender_id
      end as partner_id
    from public.messages m
    where m.school_id = p_school_id
      and (m.sender_id = p_profile_id or m.recipient_id = p_profile_id)
  ),
  ranked_messages as (
    select
      scoped_messages.*,
      row_number() over (
        partition by partner_id
        order by created_at desc, id desc
      ) as conversation_rank
    from scoped_messages
  ),
  conversation_heads as (
    select *
    from ranked_messages
    where conversation_rank = 1
  ),
  unread_counts as (
    select
      sender_id as partner_id,
      count(*)::bigint as unread_count
    from public.messages
    where school_id = p_school_id
      and recipient_id = p_profile_id
      and is_read = false
    group by sender_id
  ),
  filtered_conversations as (
    select
      ch.partner_id,
      p.first_name as partner_first_name,
      p.last_name as partner_last_name,
      p.role as partner_role,
      p.avatar_url as partner_avatar_url,
      ch.id as last_message_id,
      ch.body as last_message_content,
      ch.created_at as last_message_at,
      ch.sender_id as last_message_sender_id,
      ch.recipient_id as last_message_receiver_id,
      (ch.sender_id = p_profile_id) as last_message_is_mine,
      coalesce(uc.unread_count, 0)::bigint as unread_count
    from conversation_heads ch
    join public.profiles p
      on p.id = ch.partner_id
     and p.school_id = p_school_id
    left join unread_counts uc
      on uc.partner_id = ch.partner_id
    where coalesce(p.is_active, true) = true
      and (
        p_search is null
        or p.first_name ilike '%' || p_search || '%'
        or p.last_name ilike '%' || p_search || '%'
        or p.email ilike '%' || p_search || '%'
      )
  )
  select
    filtered_conversations.*,
    count(*) over()::bigint as total_count
  from filtered_conversations
  order by last_message_at desc
  limit greatest(p_limit, 1)
  offset greatest(p_offset, 0);
$function$;


CREATE OR REPLACE FUNCTION public.mark_announcement_seen(p_announcement_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  if not exists (
    select 1
    from public.announcements a
    where a.id = p_announcement_id
      and a.school_id = (select private.current_school_id())
  ) then
    raise exception 'Announcement not found in current school';
  end if;

  insert into public.announcement_seen (announcement_id, profile_id)
  values (p_announcement_id, auth.uid())
  on conflict (announcement_id, profile_id)
  do update set seen_at = now();

  update public.announcements a
  set seen_count = (
    select count(*)
    from public.announcement_seen s
    where s.announcement_id = a.id
  )
  where a.id = p_announcement_id;

  return true;
end;
$function$;


CREATE OR REPLACE FUNCTION public.mark_invite_used(p_code text, p_used_by uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
    invite RECORD;
BEGIN
    -- Lock the row for update
    SELECT * FROM school_invites 
    WHERE code = p_code AND status = 'active'
    FOR UPDATE INTO invite;
    
    IF NOT FOUND THEN
        RETURN false;
    END IF;
    
    -- Check if still valid
    IF invite.expires_at <= CURRENT_TIMESTAMP OR invite.used_count >= invite.max_uses THEN
        UPDATE school_invites 
        SET status = 'expired' 
        WHERE id = invite.id;
        RETURN false;
    END IF;
    
    -- Mark as used
    UPDATE school_invites 
    SET 
        used_count = used_count + 1,
        used_by = p_used_by,
        used_at = CURRENT_TIMESTAMP,
        status = CASE WHEN used_count + 1 >= max_uses THEN 'used' ELSE 'active' END
    WHERE id = invite.id;
    
    RETURN true;
END;
$function$;


CREATE OR REPLACE FUNCTION public.mark_message_read(p_message_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  update public.messages
  set is_read = true
  where id = p_message_id
    and recipient_id = auth.uid();

  if not found then
    raise exception 'Message not found or not owned by current user';
  end if;

  return true;
end;
$function$;


CREATE OR REPLACE FUNCTION public.me()
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$
  select jsonb_build_object(
    'user_id', p.id,
    'school_id', p.school_id,
    'role', p.role,
    'profile', jsonb_build_object(
      'first_name', p.first_name,
      'last_name', p.last_name,
      'email', p.email,
      'phone', p.phone,
      'address', p.address,
      'avatar_url', p.avatar_url,
      'gender', p.gender,
      'date_of_birth', p.date_of_birth,
      'is_active', p.is_active
    ),
    'student_id', s.id,
    'teacher_id', t.id,
    'parent_id', pr.id,
    'class_ids', coalesce((select private.accessible_class_ids()), '{}'::uuid[])
  )
  from public.profiles p
  left join public.students s on s.profile_id = p.id
  left join public.teachers t on t.profile_id = p.id
  left join public.parents pr on pr.profile_id = p.id
  where p.id = auth.uid();
$function$;


CREATE OR REPLACE FUNCTION public.notify_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
    PERFORM pg_notify('table_change', json_build_object(
        'table', TG_TABLE_NAME,
        'op', TG_OP,
        'id', COALESCE(NEW.id, OLD.id)::text
    )::text);
    RETURN COALESCE(NEW, OLD);
END;
$function$;


CREATE OR REPLACE FUNCTION public.record_attendance_bulk(p_class_id uuid, p_attendance_date date, p_session_name text DEFAULT 'Morning Roll Call'::text, p_session_time time without time zone DEFAULT '08:00:00'::time without time zone, p_rows jsonb DEFAULT '[]'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  v_school_id uuid;
  v_row jsonb;
  v_student_id uuid;
  v_status text;
  v_remarks text;
  v_notes text;
  v_processed integer := 0;
begin
  if jsonb_typeof(p_rows) <> 'array' then raise exception 'p_rows must be a JSON array'; end if;
  if trim(coalesce(p_session_name, '')) = '' then raise exception 'p_session_name cannot be empty'; end if;
  select c.school_id into v_school_id from public.classes c where c.id = p_class_id;
  if v_school_id is null then raise exception 'Class not found'; end if;
  if v_school_id <> (select private.current_school_id()) then raise exception 'Class is not in your school'; end if;
  if not (
    (select private.is_admin())
    or ((select private.is_teacher()) and (select private.teacher_can_manage_class(p_class_id)))
  ) then
    raise exception 'Not authorized to record attendance for this class';
  end if;
  for v_row in select value from jsonb_array_elements(p_rows) loop
    v_student_id := (v_row->>'student_id')::uuid;
    v_status := v_row->>'status';
    v_remarks := v_row->>'remarks';
    v_notes := v_row->>'notes';
    if v_status not in ('present', 'absent', 'late', 'excused') then
      raise exception 'Invalid attendance status: %', v_status;
    end if;
    if not exists (
      select 1 from public.students s
      where s.id = v_student_id and s.class_id = p_class_id and s.school_id = v_school_id
    ) then
      raise exception 'Student % does not belong to class %', v_student_id, p_class_id;
    end if;
    insert into public.attendance (
      school_id, student_id, class_id, date, attendance_date,
      status, remarks, recorded_by, session_name, session_time, notes
    ) values (
      v_school_id, v_student_id, p_class_id, p_attendance_date, p_attendance_date,
      v_status, v_remarks, auth.uid(), p_session_name, p_session_time, v_notes
    )
    on conflict (student_id, class_id, attendance_date, session_name)
    do update set
      status = excluded.status, remarks = excluded.remarks,
      recorded_by = excluded.recorded_by, session_time = excluded.session_time, notes = excluded.notes;
    v_processed := v_processed + 1;
  end loop;
  return jsonb_build_object(
    'ok', true, 'processed', v_processed,
    'class_id', p_class_id, 'attendance_date', p_attendance_date, 'session_name', p_session_name
  );
end;
$function$;


CREATE OR REPLACE FUNCTION public.revoke_expired_staff_invitations()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  revoked_count INTEGER;
BEGIN
  UPDATE staff_invitations
  SET revoked_at = NOW(), updated_at = NOW()
  WHERE accepted_at IS NULL
    AND revoked_at IS NULL
    AND expires_at < NOW();
  GET DIAGNOSTICS revoked_count = ROW_COUNT;
  RETURN revoked_count;
END;
$function$;


CREATE OR REPLACE FUNCTION public.rls_auto_enable()
 RETURNS event_trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$function$;


CREATE OR REPLACE FUNCTION public.save_gradebook_data(p_class_id uuid, p_subject_id uuid, p_columns jsonb, p_students jsonb, p_teacher_id uuid)
 RETURNS TABLE(success boolean, message text)
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
    v_school_id UUID;
    v_column_record JSONB;
    v_student_record JSONB;
    v_column_id UUID;
    v_student_id UUID;
    v_score_record JSONB;
    v_column_key TEXT;
BEGIN
    -- Get school_id from class
    SELECT school_id INTO v_school_id 
    FROM public.classes 
    WHERE id = p_class_id;
    
    IF v_school_id IS NULL THEN
        RETURN QUERY SELECT false, 'Class not found'::TEXT;
        RETURN;
    END IF;
    
    -- Process columns (update existing, insert new)
    FOR v_column_record IN SELECT * FROM jsonb_array_elements(p_columns)
    LOOP
        v_column_id := (v_column_record->>'id')::UUID;
        
        IF v_column_id IS NOT NULL AND v_column_id::TEXT LIKE 'temp-%' THEN
            -- New column - insert
            INSERT INTO public.markbook_columns (
                school_id, class_id, subject_id, name, description, category,
                weight, max_marks, order_index, is_published, due_date, rubric, created_by
            ) VALUES (
                v_school_id,
                p_class_id,
                p_subject_id,
                v_column_record->>'name',
                v_column_record->>'description',
                v_column_record->>'category',
                (v_column_record->>'weight')::DECIMAL,
                (v_column_record->>'maxMarks')::DECIMAL,
                (v_column_record->>'orderIndex')::INTEGER,
                (v_column_record->>'isPublished')::BOOLEAN,
                CASE WHEN v_column_record->>'dueDate' != '' THEN 
                    (v_column_record->>'dueDate')::TIMESTAMPTZ ELSE NULL END,
                v_column_record->>'rubric',
                p_teacher_id
            )
            ON CONFLICT (school_id, class_id, subject_id, name) 
            DO UPDATE SET
                description = EXCLUDED.description,
                category = EXCLUDED.category,
                weight = EXCLUDED.weight,
                max_marks = EXCLUDED.max_marks,
                order_index = EXCLUDED.order_index,
                is_published = EXCLUDED.is_published,
                due_date = EXCLUDED.due_date,
                rubric = EXCLUDED.rubric,
                updated_at = CURRENT_TIMESTAMP;
        ELSE
            -- Existing column - update
            UPDATE public.markbook_columns SET
                name = v_column_record->>'name',
                description = v_column_record->>'description',
                category = v_column_record->>'category',
                weight = (v_column_record->>'weight')::DECIMAL,
                max_marks = (v_column_record->>'maxMarks')::DECIMAL,
                order_index = (v_column_record->>'orderIndex')::INTEGER,
                is_published = (v_column_record->>'isPublished')::BOOLEAN,
                due_date = CASE WHEN v_column_record->>'dueDate' != '' THEN 
                    (v_column_record->>'dueDate')::TIMESTAMPTZ ELSE NULL END,
                rubric = v_column_record->>'rubric',
                updated_at = CURRENT_TIMESTAMP
            WHERE id = v_column_id AND school_id = v_school_id;
        END IF;
    END LOOP;
    
    -- Process student scores
    FOR v_student_record IN SELECT * FROM jsonb_array_elements(p_students)
    LOOP
        v_student_id := (v_student_record->>'studentId')::UUID;
        
        -- Process each score for this student
        FOR v_column_key, v_score_record IN SELECT 
            key, value 
        FROM jsonb_each(v_student_record->'scores')
        LOOP
            v_column_id := v_column_key::UUID;
            
            INSERT INTO public.markbook_scores (
                school_id, column_id, student_profile_id, score, is_excused, remarks, graded_by, graded_at
            ) VALUES (
                v_school_id,
                v_column_id,
                v_student_id,
                CASE WHEN (v_score_record->>'score') != '' THEN 
                    (v_score_record->>'score')::DECIMAL ELSE NULL END,
                (v_score_record->>'isExcused')::BOOLEAN,
                v_score_record->>'remarks',
                p_teacher_id,
                CURRENT_TIMESTAMP
            )
            ON CONFLICT (school_id, column_id, student_profile_id) 
            DO UPDATE SET
                score = EXCLUDED.score,
                is_excused = EXCLUDED.is_excused,
                remarks = EXCLUDED.remarks,
                graded_by = EXCLUDED.graded_by,
                graded_at = EXCLUDED.graded_at,
                updated_at = CURRENT_TIMESTAMP;
        END LOOP;
    END LOOP;
    
    -- Create snapshot
    INSERT INTO public.gradebook_snapshots (
        school_id, class_id, subject_id, snapshot_data, snapshot_type, created_by
    ) VALUES (
        v_school_id,
        p_class_id,
        p_subject_id,
        jsonb_build_object('columns', p_columns, 'students', p_students),
        'manual',
        p_teacher_id
    );
    
    RETURN QUERY SELECT true, 'Gradebook saved successfully'::TEXT;
    RETURN;
END;
$function$;


CREATE OR REPLACE FUNCTION public.school_directory(p_role text)
 RETURNS TABLE(id uuid, school_id uuid, role text, first_name text, last_name text, email text, phone text, avatar_url text, is_active boolean)
 LANGUAGE sql
 SET search_path TO ''
AS $function$
  select
    p.id,
    p.school_id,
    p.role,
    p.first_name,
    p.last_name,
    p.email,
    p.phone,
    p.avatar_url,
    p.is_active
  from public.profiles p
  where p.school_id = (select private.current_school_id())
    and coalesce(p.is_active, true) = true
    and (p_role is null or p.role = p_role)
  order by p.first_name, p.last_name;
$function$;


CREATE OR REPLACE FUNCTION public.seed_default_alert_thresholds(p_school_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog'
AS $function$
BEGIN
  INSERT INTO public.alert_thresholds (school_id, metric, threshold_value, severity)
  VALUES
    (p_school_id, 'attendance_rate_min',       70,  'warning'),
    (p_school_id, 'overdue_payments_max',       10,  'warning'),
    (p_school_id, 'ungraded_assignments_max',   20,  'info'),
    (p_school_id, 'critical_incidents_max',      3,  'critical'),
    (p_school_id, 'teacher_inactivity_days',     7,  'warning'),
    (p_school_id, 'unread_messages_max',         30,  'info'),
    (p_school_id, 'fee_collection_rate_min',     60,  'warning')
  ON CONFLICT (school_id, metric) DO NOTHING;
END;
$function$;


CREATE OR REPLACE FUNCTION public.send_message(p_receiver_id uuid, p_content text)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  v_message_id uuid;
begin
  if trim(coalesce(p_content, '')) = '' then
    raise exception 'Message content cannot be empty';
  end if;
  if p_receiver_id = auth.uid() then
    raise exception 'You cannot send a message to yourself';
  end if;
  if not exists (
    select 1 from public.profiles p
    where p.id = p_receiver_id
      and p.school_id = (select private.current_school_id())
      and coalesce(p.is_active, true) = true
  ) then
    raise exception 'Receiver is not in your school';
  end if;
  insert into public.messages (school_id, sender_id, recipient_id, body)
  values ((select private.current_school_id()), auth.uid(), p_receiver_id, trim(p_content))
  returning id into v_message_id;
  return v_message_id;
end;
$function$;


CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;


CREATE OR REPLACE FUNCTION public.submit_fee_payment(p_student_id uuid, p_amount numeric, p_payment_method text DEFAULT 'cash'::text, p_reference_number text DEFAULT NULL::text, p_term text DEFAULT NULL::text, p_academic_year text DEFAULT NULL::text, p_notes text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  v_payment_id uuid;
  v_school_id uuid;
  v_parent_id uuid;
begin
  if not (select private.is_parent()) then
    raise exception 'Only parents can submit payments from the parent portal';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Amount must be greater than 0';
  end if;
  if trim(coalesce(p_term, '')) = '' then raise exception 'Term is required'; end if;
  if trim(coalesce(p_academic_year, '')) = '' then raise exception 'Academic year is required'; end if;
  v_parent_id := (select private.current_parent_row_id());
  if v_parent_id is null then raise exception 'Parent profile not found'; end if;
  if not exists (
    select 1 from public.parent_students ps
    where ps.parent_id = v_parent_id and ps.student_id = p_student_id
  ) then
    raise exception 'You are not linked to this student';
  end if;
  select s.school_id into v_school_id from public.students s where s.id = p_student_id;
  insert into public.fee_payments (
    school_id, student_id, parent_id, amount, payment_method,
    reference_number, term, academic_year, payment_date, status, notes
  ) values (
    v_school_id, p_student_id, v_parent_id, p_amount,
    coalesce(p_payment_method, 'cash'), p_reference_number,
    trim(p_term), trim(p_academic_year), current_date, 'pending', p_notes
  )
  returning id into v_payment_id;
  return v_payment_id;
end;
$function$;


CREATE OR REPLACE FUNCTION public.update_my_profile(p_first_name text, p_last_name text, p_phone text DEFAULT NULL::text, p_address text DEFAULT NULL::text, p_avatar_url text DEFAULT NULL::text, p_gender text DEFAULT NULL::text, p_date_of_birth date DEFAULT NULL::date)
 RETURNS profiles
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  v_row public.profiles;
begin
  update public.profiles
  set
    first_name = p_first_name,
    last_name = p_last_name,
    phone = p_phone,
    address = p_address,
    avatar_url = p_avatar_url,
    gender = p_gender,
    date_of_birth = p_date_of_birth
  where id = auth.uid()
  returning * into v_row;
  if v_row.id is null then
    raise exception 'Profile not found for current user';
  end if;
  return v_row;
end;
$function$;


CREATE OR REPLACE FUNCTION public.update_payment_status()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
    IF NEW.paid_at IS NOT NULL AND OLD.status = 'PENDING' THEN
        NEW.status := 'PAID';
    END IF;
    RETURN NEW;
END;
$function$;


CREATE OR REPLACE FUNCTION public.update_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;


CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$function$;


CREATE OR REPLACE FUNCTION public.upsert_results_bulk(p_exam_id uuid DEFAULT NULL::uuid, p_assignment_id uuid DEFAULT NULL::uuid, p_rows jsonb DEFAULT '[]'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  v_school_id uuid;
  v_class_id uuid;
  v_subject_id uuid;
  v_total_marks integer;
  v_row jsonb;
  v_student_id uuid;
  v_score numeric;
  v_grade text;
  v_remarks text;
  v_processed integer := 0;
begin
  if jsonb_typeof(p_rows) <> 'array' then raise exception 'p_rows must be a JSON array'; end if;
  if (p_exam_id is null and p_assignment_id is null)
     or (p_exam_id is not null and p_assignment_id is not null) then
    raise exception 'Provide exactly one of p_exam_id or p_assignment_id';
  end if;
  if p_exam_id is not null then
    select e.school_id, e.class_id, e.subject_id, e.total_marks
    into v_school_id, v_class_id, v_subject_id, v_total_marks
    from public.exams e where e.id = p_exam_id;
  else
    select a.school_id, a.class_id, a.subject_id, a.total_marks
    into v_school_id, v_class_id, v_subject_id, v_total_marks
    from public.assignments a where a.id = p_assignment_id;
  end if;
  if v_school_id is null then raise exception 'Assessment source not found'; end if;
  if v_school_id <> (select private.current_school_id()) then raise exception 'Assessment is not in your school'; end if;
  if not (
    (select private.is_admin())
    or ((select private.is_teacher()) and (select private.teacher_can_manage_class_subject(v_class_id, v_subject_id)))
  ) then
    raise exception 'Not authorized to publish results for this assessment';
  end if;
  for v_row in select value from jsonb_array_elements(p_rows) loop
    v_student_id := (v_row->>'student_id')::uuid;
    v_score := nullif(v_row->>'score', '')::numeric;
    v_grade := v_row->>'grade';
    v_remarks := v_row->>'remarks';
    if not exists (
      select 1 from public.students s
      where s.id = v_student_id and s.class_id = v_class_id and s.school_id = v_school_id
    ) then
      raise exception 'Student % does not belong to class %', v_student_id, v_class_id;
    end if;
    if v_score is not null and (v_score < 0 or v_score > v_total_marks) then
      raise exception 'Score % is outside valid range 0..%', v_score, v_total_marks;
    end if;
    if p_exam_id is not null then
      update public.results
      set school_id = v_school_id, score = v_score, grade = v_grade, remarks = v_remarks
      where student_id = v_student_id and exam_id = p_exam_id;
      if not found then
        insert into public.results (school_id, student_id, exam_id, score, grade, remarks)
        values (v_school_id, v_student_id, p_exam_id, v_score, v_grade, v_remarks);
      end if;
    else
      update public.results
      set school_id = v_school_id, score = v_score, grade = v_grade, remarks = v_remarks
      where student_id = v_student_id and assignment_id = p_assignment_id;
      if not found then
        insert into public.results (school_id, student_id, assignment_id, score, grade, remarks)
        values (v_school_id, v_student_id, p_assignment_id, v_score, v_grade, v_remarks);
      end if;
    end if;
    v_processed := v_processed + 1;
  end loop;
  return jsonb_build_object(
    'ok', true, 'processed', v_processed,
    'exam_id', p_exam_id, 'assignment_id', p_assignment_id
  );
end;
$function$;


CREATE OR REPLACE FUNCTION public.validate_invite_code(p_code text)
 RETURNS TABLE(valid boolean, invite_id uuid, school_name text)
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog'
AS $function$
BEGIN
    RETURN QUERY
    SELECT 
        CASE 
            WHEN i.status = 'active' 
            AND i.expires_at > CURRENT_TIMESTAMP 
            AND i.used_count < i.max_uses
            THEN true
            ELSE false
        END as valid,
        i.id as invite_id,
        i.school_name
    FROM school_invites i
    WHERE i.code = p_code;
END;
$function$;


-- Section 6: Views (8 views)
CREATE OR REPLACE VIEW public.admin_workspace_summary AS  SELECT ( SELECT count(*) AS count
           FROM students
          WHERE students.is_active = true OR students.is_active IS NULL) AS total_active_students,
    ( SELECT count(*) AS count
           FROM teachers
          WHERE teachers.is_active = true OR teachers.is_active IS NULL) AS total_active_teachers,
    ( SELECT count(*) AS count
           FROM classes) AS total_classes,
    ( SELECT count(*) AS count
           FROM announcements
          WHERE announcements.published_at >= (CURRENT_DATE - '7 days'::interval) OR announcements.created_at >= (CURRENT_DATE - '7 days'::interval)) AS recent_announcements,
    ( SELECT count(DISTINCT student_fees.student_id) AS count
           FROM student_fees
          WHERE student_fees.status = ANY (ARRAY['owing'::text, 'partial'::text])) AS students_with_outstanding_fees,
    COALESCE(( SELECT count(*) AS count
           FROM behaviour_logs
          WHERE behaviour_logs.resolved_at IS NULL), 0::bigint) AS open_behaviour_cases,
    ( SELECT count(*) AS count
           FROM results
          WHERE results.published_at >= (CURRENT_DATE - '7 days'::interval)) AS results_published_last_7_days;

CREATE OR REPLACE VIEW public.attendance_monthly_summary AS  SELECT school_id,
    class_id,
    student_id,
    date_trunc('month'::text, COALESCE(attendance_date, date)::timestamp with time zone)::date AS month_start,
    count(*)::integer AS total_records,
    count(*) FILTER (WHERE lower(status) = 'present'::text)::integer AS present_count,
    count(*) FILTER (WHERE lower(status) = 'absent'::text)::integer AS absent_count,
    count(*) FILTER (WHERE lower(status) = 'late'::text)::integer AS late_count,
    count(*) FILTER (WHERE lower(status) = 'excused'::text)::integer AS excused_count
   FROM attendance a
  WHERE COALESCE(attendance_date, date) IS NOT NULL
  GROUP BY school_id, class_id, student_id, (date_trunc('month'::text, COALESCE(attendance_date, date)::timestamp with time zone)::date);

CREATE OR REPLACE VIEW public.class_assignments AS  SELECT DISTINCT school_id,
    teacher_profile_id AS teacher_id,
    class_id
   FROM teacher_class_subject_assignments;

CREATE OR REPLACE VIEW public.parent_children_summary AS  SELECT pr.id AS parent_id,
    pr.school_id,
    (p.first_name || ' '::text) || p.last_name AS parent_name,
    s.id AS student_id,
    s.admission_number,
    COALESCE((s.first_name || ' '::text) || s.last_name, sp.name) AS student_name,
    c.name AS class_name,
    c.grade_level,
    COALESCE(( SELECT count(*) AS count
           FROM results r
          WHERE r.student_id = s.id AND r.published_at IS NOT NULL), 0::bigint) AS published_results_count,
    COALESCE(( SELECT sum(sf.amount_due - sf.amount_paid) AS sum
           FROM student_fees sf
          WHERE sf.student_id = s.id AND (sf.status = ANY (ARRAY['owing'::text, 'partial'::text]))), 0::numeric) AS outstanding_balance,
        CASE
            WHEN COALESCE(att.total_days, 0::bigint) > 0 THEN round(COALESCE(att.present_days, 0::bigint)::numeric / att.total_days::numeric * 100::numeric, 1)
            ELSE NULL::numeric
        END AS recent_attendance_rate
   FROM parents pr
     JOIN profiles p ON pr.profile_id = p.id
     JOIN parent_students ps ON ps.parent_id = pr.id
     JOIN students s ON ps.student_id = s.id
     LEFT JOIN profiles sp ON s.profile_id = sp.id
     LEFT JOIN classes c ON s.class_id = c.id
     LEFT JOIN LATERAL ( SELECT count(*) AS total_days,
            count(*) FILTER (WHERE a.status = 'present'::text) AS present_days
           FROM attendance a
          WHERE a.student_id = s.id AND a.date >= (CURRENT_DATE - '30 days'::interval)) att ON true;

CREATE OR REPLACE VIEW public.payment_summaries AS  SELECT sf.school_id,
    sf.student_id,
    pr.first_name,
    pr.last_name,
    pr.email,
    count(sf.id) AS total_payments,
    count(
        CASE
            WHEN sf.status = ANY (ARRAY['PENDING'::text, 'PARTIAL'::text]) THEN 1
            ELSE NULL::integer
        END) AS pending_payments,
    count(
        CASE
            WHEN sf.status = 'PAID'::text THEN 1
            ELSE NULL::integer
        END) AS paid_payments,
    COALESCE(sum(sf.amount_due - sf.amount_paid), 0::numeric) AS pending_amount,
    COALESCE(sum(sf.amount_paid), 0::numeric) AS paid_amount,
    COALESCE(sum(sf.amount_due), 0::numeric) AS total_amount
   FROM student_fees sf
     JOIN profiles pr ON sf.student_id = pr.id
  GROUP BY sf.school_id, sf.student_id, pr.first_name, pr.last_name, pr.email;

CREATE OR REPLACE VIEW public.student_dashboard_summary AS  SELECT s.id AS student_id,
    s.school_id,
    COALESCE((s.first_name || ' '::text) || s.last_name, p.name) AS student_name,
    s.admission_number,
    s.student_number,
    c.name AS class_name,
    c.grade_level,
    COALESCE(( SELECT count(*) AS count
           FROM results r
          WHERE r.student_id = s.id AND r.published_at IS NOT NULL), 0::bigint) AS published_results_count,
    COALESCE(( SELECT count(*) AS count
           FROM attendance a
          WHERE a.student_id = s.id AND a.date >= (CURRENT_DATE - '30 days'::interval) AND a.status = 'present'::text), 0::bigint) AS recent_present_days,
    COALESCE(( SELECT count(*) AS count
           FROM attendance a
          WHERE a.student_id = s.id AND a.date >= (CURRENT_DATE - '30 days'::interval)), 0::bigint) AS recent_attendance_days,
    COALESCE(( SELECT sum(sf.amount_due - sf.amount_paid) AS sum
           FROM student_fees sf
          WHERE sf.student_id = s.id AND (sf.status = ANY (ARRAY['owing'::text, 'partial'::text]))), 0::numeric) AS outstanding_balance,
    ( SELECT academic_terms.name
           FROM academic_terms
          WHERE academic_terms.is_active = true
         LIMIT 1) AS current_term
   FROM students s
     LEFT JOIN profiles p ON s.profile_id = p.id
     LEFT JOIN classes c ON s.class_id = c.id;

CREATE OR REPLACE VIEW public.teacher_assignments AS  SELECT DISTINCT school_id,
    teacher_profile_id AS teacher_id,
    class_id
   FROM teacher_class_subject_assignments;

CREATE OR REPLACE VIEW public.teacher_workspace_summary AS  SELECT t.id AS teacher_id,
    t.school_id,
    (p.first_name || ' '::text) || p.last_name AS teacher_name,
    p.employee_id,
    COALESCE(( SELECT count(DISTINCT tcsa.class_id) AS count
           FROM teacher_class_subject_assignments tcsa
          WHERE tcsa.teacher_profile_id = t.profile_id), 0::bigint) AS classes_assigned,
    COALESCE(( SELECT count(DISTINCT tcsa.subject_id) AS count
           FROM teacher_class_subject_assignments tcsa
          WHERE tcsa.teacher_profile_id = t.profile_id), 0::bigint) AS subjects_assigned,
    COALESCE(( SELECT count(*) AS count
           FROM results r
             JOIN students s ON s.id = r.student_id
             JOIN teacher_class_subject_assignments tcsa ON tcsa.class_id = s.class_id AND tcsa.teacher_profile_id = t.profile_id
          WHERE r.published_at IS NULL), 0::bigint) AS pending_results_to_publish,
    COALESCE(( SELECT count(*) AS count
           FROM attendance a
             JOIN students s ON s.id = a.student_id
             JOIN teacher_class_subject_assignments tcsa ON tcsa.class_id = s.class_id AND tcsa.teacher_profile_id = t.profile_id
          WHERE a.created_at >= (CURRENT_DATE - '7 days'::interval)), 0::bigint) AS recent_attendance_marked
   FROM teachers t
     JOIN profiles p ON t.profile_id = p.id;

-- Section 7: Constraints (461)
ALTER TABLE IF EXISTS public.academic_terms ADD CONSTRAINT academic_terms_pkey PRIMARY KEY (id);
ALTER TABLE IF EXISTS public.academic_years ADD CONSTRAINT academic_years_pkey PRIMARY KEY (id);
ALTER TABLE IF EXISTS public.access_codes ADD CONSTRAINT access_codes_pkey PRIMARY KEY (code);
ALTER TABLE IF EXISTS public.activity_logs ADD CONSTRAINT activity_logs_pkey PRIMARY KEY (id);
ALTER TABLE IF EXISTS public.admin_actions ADD CONSTRAINT admin_actions_pkey PRIMARY KEY (id);
ALTER TABLE IF EXISTS public.admin_role_scopes ADD CONSTRAINT admin_role_scopes_pkey PRIMARY KEY (id);
ALTER TABLE IF EXISTS public.alert_thresholds ADD CONSTRAINT alert_thresholds_pkey PRIMARY KEY (id);
ALTER TABLE IF EXISTS public.announcement_seen ADD CONSTRAINT announcement_seen_pkey PRIMARY KEY (id);
ALTER TABLE IF EXISTS public.announcement_views ADD CONSTRAINT announcement_views_pkey PRIMARY KEY (id);
ALTER TABLE IF EXISTS public.announcements ADD CONSTRAINT announcements_pkey PRIMARY KEY (id);
ALTER TABLE IF EXISTS public.assignment_submissions ADD CONSTRAINT assignment_submissions_pkey PRIMARY KEY (id);
ALTER TABLE IF EXISTS public.assignments ADD CONSTRAINT assignments_pkey PRIMARY KEY (id);
ALTER TABLE IF EXISTS public.async_jobs ADD CONSTRAINT async_jobs_pkey PRIMARY KEY (id);
ALTER TABLE IF EXISTS public.attendance ADD CONSTRAINT attendance_pkey PRIMARY KEY (id);
ALTER TABLE IF EXISTS public.attendance_rollcall_sessions ADD CONSTRAINT attendance_rollcall_sessions_pkey PRIMARY KEY (id);
ALTER TABLE IF EXISTS public.audit_logs ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);
ALTER TABLE IF EXISTS public.behaviour_followups ADD CONSTRAINT behaviour_followups_pkey PRIMARY KEY (id);
ALTER TABLE IF EXISTS public.behaviour_logs ADD CONSTRAINT behaviour_logs_pkey PRIMARY KEY (id);
ALTER TABLE IF EXISTS public.class_insights ADD CONSTRAINT class_insights_pkey PRIMARY KEY (id);
ALTER TABLE IF EXISTS public.class_subjects ADD CONSTRAINT class_subjects_pkey PRIMARY KEY (id);
ALTER TABLE IF EXISTS public.classes ADD CONSTRAINT classes_pkey PRIMARY KEY (id);
ALTER TABLE IF EXISTS public.classroom_activity_stream ADD CONSTRAINT classroom_activity_stream_pkey PRIMARY KEY (id);
ALTER TABLE IF EXISTS public.discipline_actions ADD CONSTRAINT discipline_actions_pkey PRIMARY KEY (id);
ALTER TABLE IF EXISTS public.discipline_categories ADD CONSTRAINT discipline_categories_pkey PRIMARY KEY (id);
ALTER TABLE IF EXISTS public.discipline_records ADD CONSTRAINT discipline_records_pkey PRIMARY KEY (id);
ALTER TABLE IF EXISTS public.duty_roster ADD CONSTRAINT duty_roster_pkey PRIMARY KEY (id);
ALTER TABLE IF EXISTS public.email_verifications ADD CONSTRAINT email_verifications_pkey PRIMARY KEY (id);
ALTER TABLE IF EXISTS public.events ADD CONSTRAINT events_pkey PRIMARY KEY (id);
ALTER TABLE IF EXISTS public.exam_questions ADD CONSTRAINT exam_questions_pkey PRIMARY KEY (id);
ALTER TABLE IF EXISTS public.exam_submission_answers ADD CONSTRAINT exam_submission_answers_pkey PRIMARY KEY (id);
ALTER TABLE IF EXISTS public.exam_submissions ADD CONSTRAINT exam_submissions_pkey PRIMARY KEY (id);
ALTER TABLE IF EXISTS public.exams ADD CONSTRAINT exams_pkey PRIMARY KEY (id);
ALTER TABLE IF EXISTS public.fee_payments ADD CONSTRAINT fee_payments_pkey PRIMARY KEY (id);
ALTER TABLE IF EXISTS public.fees ADD CONSTRAINT fees_pkey PRIMARY KEY (id);
ALTER TABLE IF EXISTS public.finance_records ADD CONSTRAINT finance_records_pkey PRIMARY KEY (id);
ALTER TABLE IF EXISTS public.finances ADD CONSTRAINT finances_pkey PRIMARY KEY (id);
ALTER TABLE IF EXISTS public.grade_publish_history ADD CONSTRAINT grade_publish_history_pkey PRIMARY KEY (id);
ALTER TABLE IF EXISTS public.gradebook_snapshots ADD CONSTRAINT gradebook_snapshots_pkey PRIMARY KEY (id);
ALTER TABLE IF EXISTS public.grades ADD CONSTRAINT grades_pkey PRIMARY KEY (id);
ALTER TABLE IF EXISTS public.grading_scales ADD CONSTRAINT grading_scales_pkey PRIMARY KEY (id);
ALTER TABLE IF EXISTS public.idempotency_keys ADD CONSTRAINT idempotency_keys_pkey PRIMARY KEY (id);
ALTER TABLE IF EXISTS public.lesson_plans ADD CONSTRAINT lesson_plans_pkey PRIMARY KEY (id);
ALTER TABLE IF EXISTS public.lessons ADD CONSTRAINT lessons_pkey PRIMARY KEY (id);
ALTER TABLE IF EXISTS public.markbook_columns ADD CONSTRAINT markbook_columns_pkey PRIMARY KEY (id);
ALTER TABLE IF EXISTS public.markbook_entries ADD CONSTRAINT markbook_entries_pkey PRIMARY KEY (id);
ALTER TABLE IF EXISTS public.markbook_scores ADD CONSTRAINT markbook_scores_pkey PRIMARY KEY (id);
ALTER TABLE IF EXISTS public.markbook_sheets ADD CONSTRAINT markbook_sheets_pkey PRIMARY KEY (id);
ALTER TABLE IF EXISTS public.merit_logs ADD CONSTRAINT merit_logs_pkey PRIMARY KEY (id);
ALTER TABLE IF EXISTS public.message_templates ADD CONSTRAINT message_templates_pkey PRIMARY KEY (id);
ALTER TABLE IF EXISTS public.messages ADD CONSTRAINT messages_pkey PRIMARY KEY (id);
ALTER TABLE IF EXISTS public.notifications ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);
ALTER TABLE IF EXISTS public.outbox_events ADD CONSTRAINT outbox_events_pkey PRIMARY KEY (id);
ALTER TABLE IF EXISTS public.parent_students ADD CONSTRAINT parent_students_pkey PRIMARY KEY (id);
ALTER TABLE IF EXISTS public.parents ADD CONSTRAINT parents_pkey PRIMARY KEY (id);
ALTER TABLE IF EXISTS public.payments ADD CONSTRAINT payments_pkey PRIMARY KEY (id);
ALTER TABLE IF EXISTS public.permission_features ADD CONSTRAINT permission_features_pkey PRIMARY KEY (id);
ALTER TABLE IF EXISTS public.permission_group_roles ADD CONSTRAINT permission_group_roles_pkey PRIMARY KEY (id);
ALTER TABLE IF EXISTS public.permission_groups ADD CONSTRAINT permission_groups_pkey PRIMARY KEY (id);
ALTER TABLE IF EXISTS public.permission_slip_responses ADD CONSTRAINT permission_slip_responses_pkey PRIMARY KEY (id);
ALTER TABLE IF EXISTS public.permission_slips ADD CONSTRAINT permission_slips_pkey PRIMARY KEY (id);
ALTER TABLE IF EXISTS public.profiles ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);
ALTER TABLE IF EXISTS public.question_bank ADD CONSTRAINT question_bank_pkey PRIMARY KEY (id);
ALTER TABLE IF EXISTS public.report_card_reviews ADD CONSTRAINT report_card_reviews_pkey PRIMARY KEY (id);
ALTER TABLE IF EXISTS public.report_cards ADD CONSTRAINT report_cards_pkey PRIMARY KEY (id);
ALTER TABLE IF EXISTS public.results ADD CONSTRAINT results_pkey PRIMARY KEY (id);
ALTER TABLE IF EXISTS public.role_permissions ADD CONSTRAINT role_permissions_pkey PRIMARY KEY (id);
ALTER TABLE IF EXISTS public.scheduled_broadcasts ADD CONSTRAINT scheduled_broadcasts_pkey PRIMARY KEY (id);
ALTER TABLE IF EXISTS public.school_departments ADD CONSTRAINT school_departments_pkey PRIMARY KEY (id);
ALTER TABLE IF EXISTS public.school_emergency_state ADD CONSTRAINT school_emergency_state_pkey PRIMARY KEY (id);
ALTER TABLE IF EXISTS public.school_invites ADD CONSTRAINT school_invites_pkey PRIMARY KEY (id);
ALTER TABLE IF EXISTS public.school_settings ADD CONSTRAINT school_settings_pkey PRIMARY KEY (id);
ALTER TABLE IF EXISTS public.schools ADD CONSTRAINT schools_pkey PRIMARY KEY (id);
ALTER TABLE IF EXISTS public.staff_invitations ADD CONSTRAINT staff_invitations_pkey PRIMARY KEY (id);
ALTER TABLE IF EXISTS public.staff_meetings ADD CONSTRAINT staff_meetings_pkey PRIMARY KEY (id);
ALTER TABLE IF EXISTS public.student_fees ADD CONSTRAINT student_fees_pkey PRIMARY KEY (id);
ALTER TABLE IF EXISTS public.student_pulse_metrics ADD CONSTRAINT student_pulse_metrics_pkey PRIMARY KEY (id);
ALTER TABLE IF EXISTS public.student_risk_assessments ADD CONSTRAINT student_risk_assessments_pkey PRIMARY KEY (id);
ALTER TABLE IF EXISTS public.students ADD CONSTRAINT students_pkey PRIMARY KEY (id);
ALTER TABLE IF EXISTS public.subjects ADD CONSTRAINT subjects_pkey PRIMARY KEY (id);
ALTER TABLE IF EXISTS public.sync_queue ADD CONSTRAINT sync_queue_pkey PRIMARY KEY (id);
ALTER TABLE IF EXISTS public.system_events ADD CONSTRAINT system_events_pkey PRIMARY KEY (id);
ALTER TABLE IF EXISTS public.teacher_active_sessions ADD CONSTRAINT teacher_active_sessions_pkey PRIMARY KEY (id);
ALTER TABLE IF EXISTS public.teacher_alerts ADD CONSTRAINT teacher_alerts_pkey PRIMARY KEY (id);
ALTER TABLE IF EXISTS public.teacher_class_subject_assignments ADD CONSTRAINT teacher_class_subject_assignments_pkey PRIMARY KEY (id);
ALTER TABLE IF EXISTS public.teacher_office_hours ADD CONSTRAINT teacher_office_hours_pkey PRIMARY KEY (id);
ALTER TABLE IF EXISTS public.teacher_performance_metrics ADD CONSTRAINT teacher_performance_metrics_pkey PRIMARY KEY (id);
ALTER TABLE IF EXISTS public.teacher_recognition ADD CONSTRAINT teacher_recognition_pkey PRIMARY KEY (id);
ALTER TABLE IF EXISTS public.teacher_subject_specializations ADD CONSTRAINT teacher_subject_specializations_pkey PRIMARY KEY (id);
ALTER TABLE IF EXISTS public.teachers ADD CONSTRAINT teachers_pkey PRIMARY KEY (id);
ALTER TABLE IF EXISTS public.temp_tokens ADD CONSTRAINT temp_tokens_pkey PRIMARY KEY (id);
ALTER TABLE IF EXISTS public.terms ADD CONSTRAINT terms_pkey PRIMARY KEY (id);
ALTER TABLE IF EXISTS public.user_sessions ADD CONSTRAINT user_sessions_pkey PRIMARY KEY (id);
ALTER TABLE IF EXISTS public.admin_role_scopes ADD CONSTRAINT admin_role_scopes_school_id_user_id_scope_key UNIQUE (school_id, user_id, scope);
ALTER TABLE IF EXISTS public.alert_thresholds ADD CONSTRAINT alert_thresholds_school_id_metric_key UNIQUE (school_id, metric);
ALTER TABLE IF EXISTS public.announcement_seen ADD CONSTRAINT announcement_seen_announcement_id_profile_id_key UNIQUE (announcement_id, profile_id);
ALTER TABLE IF EXISTS public.announcement_views ADD CONSTRAINT announcement_views_announcement_id_viewer_id_key UNIQUE (announcement_id, viewer_id);
ALTER TABLE IF EXISTS public.assignment_submissions ADD CONSTRAINT assignment_submissions_school_id_assignment_id_student_prof_key UNIQUE (school_id, assignment_id, student_profile_id);
ALTER TABLE IF EXISTS public.assignments ADD CONSTRAINT assignments_class_subject_title_unique UNIQUE (school_id, class_id, subject_id, title);
ALTER TABLE IF EXISTS public.attendance ADD CONSTRAINT attendance_roll_call_unique UNIQUE (school_id, class_id, student_id, attendance_date, session_name);
ALTER TABLE IF EXISTS public.attendance ADD CONSTRAINT attendance_unique UNIQUE (student_id, class_id, date, session_name);
ALTER TABLE IF EXISTS public.attendance_rollcall_sessions ADD CONSTRAINT attendance_rollcall_sessions_class_id_subject_id_date_key UNIQUE (class_id, subject_id, date);
ALTER TABLE IF EXISTS public.class_subjects ADD CONSTRAINT class_subjects_class_id_subject_id_key UNIQUE (class_id, subject_id);
ALTER TABLE IF EXISTS public.classes ADD CONSTRAINT classes_school_name_unique UNIQUE (school_id, name);
ALTER TABLE IF EXISTS public.discipline_categories ADD CONSTRAINT discipline_categories_school_id_name_key UNIQUE (school_id, name);
ALTER TABLE IF EXISTS public.email_verifications ADD CONSTRAINT email_verifications_user_id_key UNIQUE (user_id);
ALTER TABLE IF EXISTS public.exams ADD CONSTRAINT exams_class_subject_title_unique UNIQUE (school_id, class_id, subject_id, title);
ALTER TABLE IF EXISTS public.markbook_columns ADD CONSTRAINT markbook_columns_school_id_class_id_subject_id_name_key UNIQUE (school_id, class_id, subject_id, name);
ALTER TABLE IF EXISTS public.markbook_entries ADD CONSTRAINT markbook_entries_column_id_student_id_key UNIQUE (column_id, student_id);
ALTER TABLE IF EXISTS public.markbook_scores ADD CONSTRAINT markbook_scores_school_id_column_id_student_profile_id_key UNIQUE (school_id, column_id, student_profile_id);
ALTER TABLE IF EXISTS public.markbook_sheets ADD CONSTRAINT markbook_sheets_school_id_class_id_subject_id_term_id_key UNIQUE (school_id, class_id, subject_id, term_id);
ALTER TABLE IF EXISTS public.notifications ADD CONSTRAINT notifications_school_dedupe_key_unique UNIQUE (school_id, dedupe_key);
ALTER TABLE IF EXISTS public.parent_students ADD CONSTRAINT parent_students_parent_id_student_id_key UNIQUE (parent_id, student_id);
ALTER TABLE IF EXISTS public.permission_features ADD CONSTRAINT permission_features_group_id_feature_key_key UNIQUE (group_id, feature_key);
ALTER TABLE IF EXISTS public.permission_group_roles ADD CONSTRAINT permission_group_roles_group_id_role_key UNIQUE (group_id, role);
ALTER TABLE IF EXISTS public.permission_groups ADD CONSTRAINT permission_groups_school_id_name_key UNIQUE (school_id, name);
ALTER TABLE IF EXISTS public.permission_slip_responses ADD CONSTRAINT unique_student_consent UNIQUE (permission_slip_id, student_id);
ALTER TABLE IF EXISTS public.report_card_reviews ADD CONSTRAINT unique_student_term_report UNIQUE (student_id, term_id);
ALTER TABLE IF EXISTS public.report_cards ADD CONSTRAINT report_cards_school_id_student_id_term_id_key UNIQUE (school_id, student_id, term_id);
ALTER TABLE IF EXISTS public.results ADD CONSTRAINT results_student_assignment_unique UNIQUE (student_id, assignment_id);
ALTER TABLE IF EXISTS public.role_permissions ADD CONSTRAINT role_permissions_school_id_user_id_permission_key UNIQUE (school_id, user_id, permission);
ALTER TABLE IF EXISTS public.school_departments ADD CONSTRAINT school_departments_school_id_name_key UNIQUE (school_id, name);
ALTER TABLE IF EXISTS public.school_emergency_state ADD CONSTRAINT school_emergency_state_school_id_key UNIQUE (school_id);
ALTER TABLE IF EXISTS public.school_invites ADD CONSTRAINT school_invites_code_key UNIQUE (code);
ALTER TABLE IF EXISTS public.school_settings ADD CONSTRAINT school_settings_school_id_setting_key_key UNIQUE (school_id, setting_key);
ALTER TABLE IF EXISTS public.schools ADD CONSTRAINT schools_code_key UNIQUE (code);
ALTER TABLE IF EXISTS public.staff_invitations ADD CONSTRAINT staff_invitations_invitation_token_key UNIQUE (invitation_token);
ALTER TABLE IF EXISTS public.staff_invitations ADD CONSTRAINT staff_invitations_token_key UNIQUE (token);
ALTER TABLE IF EXISTS public.student_fees ADD CONSTRAINT student_fees_student_id_fee_id_billing_month_key UNIQUE (student_id, fee_id, billing_month);
ALTER TABLE IF EXISTS public.student_pulse_metrics ADD CONSTRAINT student_pulse_metrics_student_id_class_id_subject_id_date_key UNIQUE (student_id, class_id, subject_id, date);
ALTER TABLE IF EXISTS public.students ADD CONSTRAINT students_student_number_key UNIQUE (student_number);
ALTER TABLE IF EXISTS public.subjects ADD CONSTRAINT subjects_school_code_unique UNIQUE (school_id, code);
ALTER TABLE IF EXISTS public.teacher_class_subject_assignments ADD CONSTRAINT teacher_class_subject_assignm_teacher_profile_id_class_id_s_key UNIQUE (teacher_profile_id, class_id, subject_id);
ALTER TABLE IF EXISTS public.teacher_performance_metrics ADD CONSTRAINT teacher_performance_metrics_teacher_id_school_id_metric_dat_key UNIQUE (teacher_id, school_id, metric_date, period_type);
ALTER TABLE IF EXISTS public.teacher_recognition ADD CONSTRAINT teacher_recognition_school_id_award_type_month_year_key UNIQUE (school_id, award_type, month_year);
ALTER TABLE IF EXISTS public.teacher_subject_specializations ADD CONSTRAINT teacher_subject_specializatio_teacher_profile_id_subject_id_key UNIQUE (teacher_profile_id, subject_id);
ALTER TABLE IF EXISTS public.teachers ADD CONSTRAINT teachers_employee_number_key UNIQUE (employee_number);
ALTER TABLE IF EXISTS public.access_codes ADD CONSTRAINT access_codes_approval_status_check CHECK ((approval_status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'expired'::text])));
ALTER TABLE IF EXISTS public.access_codes ADD CONSTRAINT access_codes_usage_check CHECK (((max_uses > 0) AND (use_count >= 0) AND (use_count <= max_uses)));
ALTER TABLE IF EXISTS public.activity_logs ADD CONSTRAINT activity_logs_actor_role_check CHECK ((actor_role = ANY (ARRAY['admin'::text, 'teacher'::text, 'student'::text, 'parent'::text, 'system'::text])));
ALTER TABLE IF EXISTS public.admin_actions ADD CONSTRAINT admin_actions_action_type_check CHECK ((action_type = ANY (ARRAY['suspend_user'::text, 'unsuspend_user'::text, 'send_broadcast'::text, 'resolve_incident'::text, 'escalate_incident'::text, 'toggle_emergency'::text, 'delete_user'::text, 'modify_payment'::text, 'modify_grade'::text, 'grant_scope'::text, 'revoke_scope'::text, 'system_override'::text])));
ALTER TABLE IF EXISTS public.admin_actions ADD CONSTRAINT admin_actions_status_check CHECK ((status = ANY (ARRAY['pending_confirm'::text, 'executed'::text, 'rolled_back'::text, 'failed'::text])));
ALTER TABLE IF EXISTS public.admin_role_scopes ADD CONSTRAINT admin_role_scopes_scope_check CHECK ((scope = ANY (ARRAY['head_teacher'::text, 'deputy'::text, 'academic'::text, 'finance'::text, 'discipline'::text, 'communication'::text, 'guidance'::text])));
ALTER TABLE IF EXISTS public.alert_thresholds ADD CONSTRAINT alert_thresholds_metric_check CHECK ((metric = ANY (ARRAY['attendance_rate_min'::text, 'overdue_payments_max'::text, 'ungraded_assignments_max'::text, 'critical_incidents_max'::text, 'teacher_inactivity_days'::text, 'unread_messages_max'::text, 'fee_collection_rate_min'::text])));
ALTER TABLE IF EXISTS public.alert_thresholds ADD CONSTRAINT alert_thresholds_severity_check CHECK ((severity = ANY (ARRAY['info'::text, 'warning'::text, 'critical'::text])));
ALTER TABLE IF EXISTS public.announcements ADD CONSTRAINT announcements_audience_check CHECK ((audience = ANY (ARRAY['all'::text, 'students'::text, 'parents'::text, 'teachers'::text])));
ALTER TABLE IF EXISTS public.announcements ADD CONSTRAINT announcements_target_role_check CHECK ((target_role = ANY (ARRAY['all'::text, 'admin'::text, 'teacher'::text, 'student'::text, 'parent'::text])));
ALTER TABLE IF EXISTS public.attendance ADD CONSTRAINT attendance_status_check CHECK ((status = ANY (ARRAY['present'::text, 'absent'::text, 'late'::text, 'excused'::text])));
ALTER TABLE IF EXISTS public.attendance_rollcall_sessions ADD CONSTRAINT attendance_rollcall_sessions_mood_rating_check CHECK ((mood_rating = ANY (ARRAY['positive'::text, 'neutral'::text, 'concerned'::text])));
ALTER TABLE IF EXISTS public.attendance_rollcall_sessions ADD CONSTRAINT attendance_rollcall_sessions_session_mode_check CHECK ((session_mode = ANY (ARRAY['standard'::text, 'quick'::text, 'bulk'::text, 'emergency'::text])));
ALTER TABLE IF EXISTS public.attendance_rollcall_sessions ADD CONSTRAINT attendance_rollcall_sessions_status_check CHECK ((status = ANY (ARRAY['open'::text, 'closed'::text, 'synced'::text])));
ALTER TABLE IF EXISTS public.behaviour_followups ADD CONSTRAINT behaviour_followups_status_check CHECK ((status = ANY (ARRAY['OPEN'::text, 'IN_PROGRESS'::text, 'RESOLVED'::text])));
ALTER TABLE IF EXISTS public.class_insights ADD CONSTRAINT class_insights_impact_level_check CHECK ((impact_level = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text])));
ALTER TABLE IF EXISTS public.class_insights ADD CONSTRAINT class_insights_insight_type_check CHECK ((insight_type = ANY (ARRAY['academic'::text, 'behavioral'::text, 'attendance'::text, 'engagement'::text, 'social'::text])));
ALTER TABLE IF EXISTS public.class_insights ADD CONSTRAINT class_insights_status_check CHECK ((status = ANY (ARRAY['active'::text, 'acknowledged'::text, 'resolved'::text, 'archived'::text])));
ALTER TABLE IF EXISTS public.class_insights ADD CONSTRAINT class_insights_urgency_check CHECK ((urgency = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text])));
ALTER TABLE IF EXISTS public.classroom_activity_stream ADD CONSTRAINT classroom_activity_stream_activity_type_check CHECK ((activity_type = ANY (ARRAY['assignment'::text, 'announcement'::text, 'praise'::text, 'incident'::text, 'milestone'::text, 'resource'::text, 'note'::text])));
ALTER TABLE IF EXISTS public.classroom_activity_stream ADD CONSTRAINT classroom_activity_stream_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'published'::text, 'archived'::text])));
ALTER TABLE IF EXISTS public.classroom_activity_stream ADD CONSTRAINT classroom_activity_stream_visibility_check CHECK ((visibility = ANY (ARRAY['class'::text, 'students'::text, 'parents'::text, 'admin'::text])));
ALTER TABLE IF EXISTS public.discipline_actions ADD CONSTRAINT discipline_actions_action_type_check CHECK ((action_type = ANY (ARRAY['warning'::text, 'detention'::text, 'suspension'::text, 'expulsion'::text, 'community_service'::text, 'parent_meeting'::text, 'counseling'::text, 'other'::text])));
ALTER TABLE IF EXISTS public.discipline_categories ADD CONSTRAINT discipline_categories_severity_check CHECK (((severity >= 1) AND (severity <= 5)));
ALTER TABLE IF EXISTS public.discipline_records ADD CONSTRAINT discipline_records_severity_check CHECK (((severity >= 1) AND (severity <= 5)));
ALTER TABLE IF EXISTS public.discipline_records ADD CONSTRAINT discipline_records_status_check CHECK ((status = ANY (ARRAY['open'::text, 'investigating'::text, 'resolved'::text, 'escalated'::text, 'closed'::text])));
ALTER TABLE IF EXISTS public.events ADD CONSTRAINT events_audience_check CHECK ((audience = ANY (ARRAY['all'::text, 'students'::text, 'parents'::text, 'teachers'::text])));
ALTER TABLE IF EXISTS public.exam_questions ADD CONSTRAINT exam_questions_type_check CHECK ((question_type = ANY (ARRAY['mcq'::text, 'short_answer'::text])));
ALTER TABLE IF EXISTS public.exam_submission_answers ADD CONSTRAINT exam_submission_answers_review_status_check CHECK ((review_status = ANY (ARRAY['pending'::text, 'auto_scored'::text, 'reviewed'::text])));
ALTER TABLE IF EXISTS public.exam_submissions ADD CONSTRAINT exam_submissions_status_check CHECK ((status = ANY (ARRAY['submitted'::text, 'in_review'::text, 'graded'::text, 'published'::text])));
ALTER TABLE IF EXISTS public.exams ADD CONSTRAINT exams_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'published'::text, 'closed'::text])));
ALTER TABLE IF EXISTS public.fee_payments ADD CONSTRAINT fee_payments_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'confirmed'::text, 'rejected'::text])));
ALTER TABLE IF EXISTS public.fees ADD CONSTRAINT fees_amount_positive CHECK ((amount > (0)::numeric));
ALTER TABLE IF EXISTS public.fees ADD CONSTRAINT fees_frequency_check CHECK ((frequency = ANY (ARRAY['monthly'::text, 'termly'::text, 'once-off'::text])));
ALTER TABLE IF EXISTS public.finances ADD CONSTRAINT finances_type_check CHECK ((transaction_type = ANY (ARRAY['income'::text, 'expense'::text])));
ALTER TABLE IF EXISTS public.lessons ADD CONSTRAINT lessons_day_of_week_check CHECK (((day_of_week >= 0) AND (day_of_week <= 6)));
ALTER TABLE IF EXISTS public.merit_logs ADD CONSTRAINT merit_logs_points_check CHECK (((points > 0) AND (points <= 100)));
ALTER TABLE IF EXISTS public.notifications ADD CONSTRAINT notifications_type_check CHECK ((type = ANY (ARRAY['announcement'::text, 'fee_payment'::text, 'attendance'::text, 'exam_result'::text, 'low_attendance'::text, 'general'::text])));
ALTER TABLE IF EXISTS public.permission_group_roles ADD CONSTRAINT permission_group_roles_role_check CHECK ((lower(role) = ANY (ARRAY['admin'::text, 'principal'::text, 'deputy_head'::text, 'bursar'::text, 'payments'::text, 'guidance_office'::text, 'academic_admin'::text, 'hr_admin'::text, 'ict_admin'::text, 'discipline_admin'::text, 'teacher'::text])));
ALTER TABLE IF EXISTS public.profiles ADD CONSTRAINT profiles_gender_check CHECK ((gender = ANY (ARRAY['male'::text, 'female'::text])));
ALTER TABLE IF EXISTS public.profiles ADD CONSTRAINT profiles_role_check CHECK ((role = ANY (ARRAY['super_admin'::text, 'principal'::text, 'deputy_head'::text, 'bursar'::text, 'guidance_office'::text, 'academic_admin'::text, 'hr_admin'::text, 'ict_admin'::text, 'discipline_admin'::text, 'teacher'::text, 'student'::text, 'parent'::text, 'payments'::text, 'admin'::text, 'ADMIN'::text, 'TEACHER'::text, 'STUDENT'::text, 'PARENT'::text, 'PAYMENTS'::text, 'PRINCIPAL'::text, 'DEPUTY_HEAD'::text, 'BURSAR'::text, 'GUIDANCE_OFFICE'::text, 'ACADEMIC_ADMIN'::text, 'HR_ADMIN'::text, 'ICT_ADMIN'::text, 'DISCIPLINE_ADMIN'::text, 'SUPER_ADMIN'::text])));
ALTER TABLE IF EXISTS public.results ADD CONSTRAINT results_exactly_one_source CHECK ((((exam_id IS NOT NULL) AND (assignment_id IS NULL)) OR ((exam_id IS NULL) AND (assignment_id IS NOT NULL))));
ALTER TABLE IF EXISTS public.results ADD CONSTRAINT results_non_negative_score CHECK (((score IS NULL) OR (score >= (0)::numeric)));
ALTER TABLE IF EXISTS public.scheduled_broadcasts ADD CONSTRAINT scheduled_broadcasts_broadcast_type_check CHECK ((broadcast_type = ANY (ARRAY['notification'::text, 'announcement'::text, 'emergency'::text])));
ALTER TABLE IF EXISTS public.scheduled_broadcasts ADD CONSTRAINT scheduled_broadcasts_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'sent'::text, 'cancelled'::text])));
ALTER TABLE IF EXISTS public.school_emergency_state ADD CONSTRAINT school_emergency_state_emergency_type_check CHECK ((emergency_type = ANY (ARRAY['lockdown'::text, 'evacuation'::text, 'communication_blackout'::text, 'custom'::text])));
ALTER TABLE IF EXISTS public.staff_invitations ADD CONSTRAINT staff_invitations_role_check CHECK ((lower(role) = ANY (ARRAY['admin'::text, 'teacher'::text, 'payments'::text, 'bursar'::text, 'deputy_head'::text, 'guidance_office'::text, 'academic_admin'::text, 'hr_admin'::text, 'ict_admin'::text, 'discipline_admin'::text])));
ALTER TABLE IF EXISTS public.staff_invitations ADD CONSTRAINT staff_invitations_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'accepted'::text, 'expired'::text, 'cancelled'::text])));
ALTER TABLE IF EXISTS public.student_fees ADD CONSTRAINT student_fees_amount_due_positive CHECK ((amount_due > (0)::numeric));
ALTER TABLE IF EXISTS public.student_fees ADD CONSTRAINT student_fees_amount_paid_nonneg CHECK ((amount_paid >= (0)::numeric));
ALTER TABLE IF EXISTS public.student_fees ADD CONSTRAINT student_fees_status_check CHECK ((status = ANY (ARRAY['PENDING'::text, 'PARTIAL'::text, 'PAID'::text, 'WAIVED'::text])));
ALTER TABLE IF EXISTS public.student_pulse_metrics ADD CONSTRAINT student_pulse_metrics_academic_trend_check CHECK ((academic_trend = ANY (ARRAY['up'::text, 'down'::text, 'stable'::text])));
ALTER TABLE IF EXISTS public.student_pulse_metrics ADD CONSTRAINT student_pulse_metrics_attendance_trend_check CHECK ((attendance_trend = ANY (ARRAY['up'::text, 'down'::text, 'stable'::text])));
ALTER TABLE IF EXISTS public.student_pulse_metrics ADD CONSTRAINT student_pulse_metrics_behavior_trend_check CHECK ((behavior_trend = ANY (ARRAY['up'::text, 'down'::text, 'stable'::text])));
ALTER TABLE IF EXISTS public.student_pulse_metrics ADD CONSTRAINT student_pulse_metrics_engagement_trend_check CHECK ((engagement_trend = ANY (ARRAY['up'::text, 'down'::text, 'stable'::text])));
ALTER TABLE IF EXISTS public.student_pulse_metrics ADD CONSTRAINT student_pulse_metrics_risk_level_check CHECK ((risk_level = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'critical'::text])));
ALTER TABLE IF EXISTS public.student_risk_assessments ADD CONSTRAINT student_risk_assessments_intervention_status_check CHECK ((intervention_status = ANY (ARRAY['pending'::text, 'in_progress'::text, 'completed'::text, 'cancelled'::text])));
ALTER TABLE IF EXISTS public.student_risk_assessments ADD CONSTRAINT student_risk_assessments_risk_level_check CHECK ((risk_level = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'critical'::text])));
ALTER TABLE IF EXISTS public.sync_queue ADD CONSTRAINT sync_queue_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'processing'::text, 'completed'::text, 'failed'::text])));
ALTER TABLE IF EXISTS public.system_events ADD CONSTRAINT system_events_domain_check CHECK ((domain = ANY (ARRAY['admin'::text, 'teacher'::text, 'system'::text])));
ALTER TABLE IF EXISTS public.system_events ADD CONSTRAINT system_events_severity_check CHECK ((severity = ANY (ARRAY['info'::text, 'warning'::text, 'critical'::text])));
ALTER TABLE IF EXISTS public.teacher_active_sessions ADD CONSTRAINT teacher_active_sessions_mood_rating_check CHECK ((mood_rating = ANY (ARRAY['positive'::text, 'neutral'::text, 'concerned'::text])));
ALTER TABLE IF EXISTS public.teacher_active_sessions ADD CONSTRAINT teacher_active_sessions_status_check CHECK ((status = ANY (ARRAY['active'::text, 'completed'::text, 'paused'::text])));
ALTER TABLE IF EXISTS public.teacher_alerts ADD CONSTRAINT teacher_alerts_alert_type_check CHECK ((alert_type = ANY (ARRAY['attendance'::text, 'grading'::text, 'parent'::text, 'student'::text, 'system'::text, 'emergency'::text])));
ALTER TABLE IF EXISTS public.teacher_alerts ADD CONSTRAINT teacher_alerts_impact_scope_check CHECK ((impact_scope = ANY (ARRAY['individual'::text, 'group'::text, 'class'::text, 'school'::text])));
ALTER TABLE IF EXISTS public.teacher_alerts ADD CONSTRAINT teacher_alerts_severity_check CHECK ((severity = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'critical'::text])));
ALTER TABLE IF EXISTS public.teacher_alerts ADD CONSTRAINT teacher_alerts_status_check CHECK ((status = ANY (ARRAY['active'::text, 'dismissed'::text, 'resolved'::text, 'expired'::text])));
ALTER TABLE IF EXISTS public.teacher_performance_metrics ADD CONSTRAINT teacher_performance_metrics_performance_trend_check CHECK ((performance_trend = ANY (ARRAY['up'::text, 'down'::text, 'stable'::text])));
ALTER TABLE IF EXISTS public.teacher_performance_metrics ADD CONSTRAINT teacher_performance_metrics_period_type_check CHECK ((period_type = ANY (ARRAY['daily'::text, 'weekly'::text, 'monthly'::text])));
ALTER TABLE IF EXISTS public.temp_tokens ADD CONSTRAINT temp_tokens_kind_check CHECK ((kind = 'verify'::text));
ALTER TABLE IF EXISTS public.academic_terms ADD CONSTRAINT academic_terms_academic_year_id_fkey FOREIGN KEY (academic_year_id) REFERENCES academic_years(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.academic_terms ADD CONSTRAINT academic_terms_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.academic_years ADD CONSTRAINT academic_years_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.access_codes ADD CONSTRAINT access_codes_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.activity_logs ADD CONSTRAINT activity_logs_actor_profile_id_fkey FOREIGN KEY (actor_profile_id) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.activity_logs ADD CONSTRAINT activity_logs_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.admin_actions ADD CONSTRAINT admin_actions_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES profiles(id) ON DELETE RESTRICT;
ALTER TABLE IF EXISTS public.admin_actions ADD CONSTRAINT admin_actions_rollback_of_fkey FOREIGN KEY (rollback_of) REFERENCES admin_actions(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.admin_actions ADD CONSTRAINT admin_actions_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.admin_role_scopes ADD CONSTRAINT admin_role_scopes_granted_by_fkey FOREIGN KEY (granted_by) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.admin_role_scopes ADD CONSTRAINT admin_role_scopes_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.admin_role_scopes ADD CONSTRAINT admin_role_scopes_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.alert_thresholds ADD CONSTRAINT alert_thresholds_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.alert_thresholds ADD CONSTRAINT alert_thresholds_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.announcement_seen ADD CONSTRAINT announcement_seen_announcement_id_fkey FOREIGN KEY (announcement_id) REFERENCES announcements(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.announcement_seen ADD CONSTRAINT announcement_seen_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.announcement_views ADD CONSTRAINT announcement_views_announcement_id_fkey FOREIGN KEY (announcement_id) REFERENCES announcements(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.announcement_views ADD CONSTRAINT announcement_views_viewer_id_fkey FOREIGN KEY (viewer_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.announcements ADD CONSTRAINT announcements_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id);
ALTER TABLE IF EXISTS public.announcements ADD CONSTRAINT announcements_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.announcements ADD CONSTRAINT announcements_target_class_id_fkey FOREIGN KEY (target_class_id) REFERENCES classes(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.announcements ADD CONSTRAINT announcements_target_user_id_fkey FOREIGN KEY (target_user_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.assignment_submissions ADD CONSTRAINT assignment_submissions_assignment_id_fkey FOREIGN KEY (assignment_id) REFERENCES assignments(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.assignment_submissions ADD CONSTRAINT assignment_submissions_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.assignment_submissions ADD CONSTRAINT assignment_submissions_student_profile_id_fkey FOREIGN KEY (student_profile_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.assignments ADD CONSTRAINT assignments_class_id_fkey FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.assignments ADD CONSTRAINT assignments_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.assignments ADD CONSTRAINT assignments_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.assignments ADD CONSTRAINT assignments_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES teachers(id);
ALTER TABLE IF EXISTS public.async_jobs ADD CONSTRAINT async_jobs_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.async_jobs ADD CONSTRAINT async_jobs_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.attendance ADD CONSTRAINT attendance_class_id_fkey FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.attendance ADD CONSTRAINT attendance_recorded_by_fkey FOREIGN KEY (recorded_by) REFERENCES profiles(id);
ALTER TABLE IF EXISTS public.attendance ADD CONSTRAINT attendance_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.attendance ADD CONSTRAINT attendance_student_id_fkey FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.attendance_rollcall_sessions ADD CONSTRAINT attendance_rollcall_sessions_class_id_fkey FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.attendance_rollcall_sessions ADD CONSTRAINT attendance_rollcall_sessions_lesson_id_fkey FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.attendance_rollcall_sessions ADD CONSTRAINT attendance_rollcall_sessions_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.attendance_rollcall_sessions ADD CONSTRAINT attendance_rollcall_sessions_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.attendance_rollcall_sessions ADD CONSTRAINT attendance_rollcall_sessions_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.audit_logs ADD CONSTRAINT audit_logs_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.audit_logs ADD CONSTRAINT audit_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.behaviour_followups ADD CONSTRAINT behaviour_followups_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.behaviour_followups ADD CONSTRAINT behaviour_followups_behaviour_log_id_fkey FOREIGN KEY (behaviour_log_id) REFERENCES behaviour_logs(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.behaviour_followups ADD CONSTRAINT behaviour_followups_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.behaviour_followups ADD CONSTRAINT behaviour_followups_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.behaviour_logs ADD CONSTRAINT behaviour_logs_logged_by_fkey FOREIGN KEY (logged_by) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.behaviour_logs ADD CONSTRAINT behaviour_logs_resolved_by_fkey FOREIGN KEY (resolved_by) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.behaviour_logs ADD CONSTRAINT behaviour_logs_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.behaviour_logs ADD CONSTRAINT behaviour_logs_student_id_fkey FOREIGN KEY (student_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.class_insights ADD CONSTRAINT class_insights_class_id_fkey FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.class_insights ADD CONSTRAINT class_insights_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.class_insights ADD CONSTRAINT class_insights_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.class_insights ADD CONSTRAINT class_insights_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.class_subjects ADD CONSTRAINT class_subjects_class_id_fkey FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.class_subjects ADD CONSTRAINT class_subjects_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.class_subjects ADD CONSTRAINT class_subjects_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES teachers(id);
ALTER TABLE IF EXISTS public.classes ADD CONSTRAINT classes_grade_id_fkey FOREIGN KEY (grade_id) REFERENCES grades(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.classes ADD CONSTRAINT classes_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.classes ADD CONSTRAINT classes_supervisor_id_fkey FOREIGN KEY (supervisor_id) REFERENCES profiles(id);
ALTER TABLE IF EXISTS public.classroom_activity_stream ADD CONSTRAINT classroom_activity_stream_class_id_fkey FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.classroom_activity_stream ADD CONSTRAINT classroom_activity_stream_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.classroom_activity_stream ADD CONSTRAINT classroom_activity_stream_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.classroom_activity_stream ADD CONSTRAINT classroom_activity_stream_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.discipline_actions ADD CONSTRAINT discipline_actions_issued_by_fkey FOREIGN KEY (issued_by) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.discipline_actions ADD CONSTRAINT discipline_actions_record_id_fkey FOREIGN KEY (record_id) REFERENCES discipline_records(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.discipline_actions ADD CONSTRAINT discipline_actions_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.discipline_categories ADD CONSTRAINT discipline_categories_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.discipline_records ADD CONSTRAINT discipline_records_category_id_fkey FOREIGN KEY (category_id) REFERENCES discipline_categories(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.discipline_records ADD CONSTRAINT discipline_records_class_id_fkey FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.discipline_records ADD CONSTRAINT discipline_records_reported_by_fkey FOREIGN KEY (reported_by) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.discipline_records ADD CONSTRAINT discipline_records_resolved_by_fkey FOREIGN KEY (resolved_by) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.discipline_records ADD CONSTRAINT discipline_records_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.discipline_records ADD CONSTRAINT discipline_records_student_id_fkey FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.duty_roster ADD CONSTRAINT duty_roster_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.duty_roster ADD CONSTRAINT duty_roster_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.duty_roster ADD CONSTRAINT duty_roster_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.email_verifications ADD CONSTRAINT email_verifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.events ADD CONSTRAINT events_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id);
ALTER TABLE IF EXISTS public.events ADD CONSTRAINT events_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.events ADD CONSTRAINT events_target_class_id_fkey FOREIGN KEY (target_class_id) REFERENCES classes(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.exam_questions ADD CONSTRAINT exam_questions_exam_id_fkey FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.exam_questions ADD CONSTRAINT exam_questions_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.exam_submission_answers ADD CONSTRAINT exam_submission_answers_question_id_fkey FOREIGN KEY (question_id) REFERENCES exam_questions(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.exam_submission_answers ADD CONSTRAINT exam_submission_answers_submission_id_fkey FOREIGN KEY (submission_id) REFERENCES exam_submissions(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.exam_submissions ADD CONSTRAINT exam_submissions_exam_id_fkey FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.exam_submissions ADD CONSTRAINT exam_submissions_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.exam_submissions ADD CONSTRAINT exam_submissions_student_id_fkey FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.exams ADD CONSTRAINT exams_class_id_fkey FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.exams ADD CONSTRAINT exams_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.exams ADD CONSTRAINT exams_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.fee_payments ADD CONSTRAINT fee_payments_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES parents(id);
ALTER TABLE IF EXISTS public.fee_payments ADD CONSTRAINT fee_payments_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id);
ALTER TABLE IF EXISTS public.fee_payments ADD CONSTRAINT fee_payments_student_id_fkey FOREIGN KEY (student_id) REFERENCES students(id);
ALTER TABLE IF EXISTS public.fees ADD CONSTRAINT fees_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.finance_records ADD CONSTRAINT finance_records_recorded_by_fkey FOREIGN KEY (recorded_by) REFERENCES profiles(id);
ALTER TABLE IF EXISTS public.finance_records ADD CONSTRAINT finance_records_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.finances ADD CONSTRAINT finances_recorded_by_fkey FOREIGN KEY (recorded_by) REFERENCES profiles(id);
ALTER TABLE IF EXISTS public.finances ADD CONSTRAINT finances_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.grade_publish_history ADD CONSTRAINT grade_publish_history_class_id_fkey FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.grade_publish_history ADD CONSTRAINT grade_publish_history_column_id_fkey FOREIGN KEY (column_id) REFERENCES markbook_columns(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.grade_publish_history ADD CONSTRAINT grade_publish_history_published_by_fkey FOREIGN KEY (published_by) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.grade_publish_history ADD CONSTRAINT grade_publish_history_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.grade_publish_history ADD CONSTRAINT grade_publish_history_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.gradebook_snapshots ADD CONSTRAINT gradebook_snapshots_class_id_fkey FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.gradebook_snapshots ADD CONSTRAINT gradebook_snapshots_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.gradebook_snapshots ADD CONSTRAINT gradebook_snapshots_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.gradebook_snapshots ADD CONSTRAINT gradebook_snapshots_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.grades ADD CONSTRAINT grades_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.grading_scales ADD CONSTRAINT grading_scales_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.lesson_plans ADD CONSTRAINT lesson_plans_grade_id_fkey FOREIGN KEY (grade_id) REFERENCES grades(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.lesson_plans ADD CONSTRAINT lesson_plans_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.lesson_plans ADD CONSTRAINT lesson_plans_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.lesson_plans ADD CONSTRAINT lesson_plans_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.lesson_plans ADD CONSTRAINT lesson_plans_term_id_fkey FOREIGN KEY (term_id) REFERENCES terms(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.lessons ADD CONSTRAINT lessons_class_id_fkey FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.lessons ADD CONSTRAINT lessons_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.lessons ADD CONSTRAINT lessons_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.lessons ADD CONSTRAINT lessons_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES teachers(id);
ALTER TABLE IF EXISTS public.markbook_columns ADD CONSTRAINT markbook_columns_assignment_id_fkey FOREIGN KEY (assignment_id) REFERENCES assignments(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.markbook_columns ADD CONSTRAINT markbook_columns_class_id_fkey FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.markbook_columns ADD CONSTRAINT markbook_columns_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.markbook_columns ADD CONSTRAINT markbook_columns_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.markbook_columns ADD CONSTRAINT markbook_columns_sheet_id_fkey FOREIGN KEY (sheet_id) REFERENCES markbook_sheets(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.markbook_columns ADD CONSTRAINT markbook_columns_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.markbook_entries ADD CONSTRAINT markbook_entries_column_id_fkey FOREIGN KEY (column_id) REFERENCES markbook_columns(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.markbook_entries ADD CONSTRAINT markbook_entries_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.markbook_entries ADD CONSTRAINT markbook_entries_sheet_id_fkey FOREIGN KEY (sheet_id) REFERENCES markbook_sheets(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.markbook_entries ADD CONSTRAINT markbook_entries_student_id_fkey FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.markbook_scores ADD CONSTRAINT markbook_scores_column_id_fkey FOREIGN KEY (column_id) REFERENCES markbook_columns(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.markbook_scores ADD CONSTRAINT markbook_scores_graded_by_fkey FOREIGN KEY (graded_by) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.markbook_scores ADD CONSTRAINT markbook_scores_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.markbook_scores ADD CONSTRAINT markbook_scores_student_profile_id_fkey FOREIGN KEY (student_profile_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.markbook_sheets ADD CONSTRAINT markbook_sheets_class_id_fkey FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.markbook_sheets ADD CONSTRAINT markbook_sheets_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.markbook_sheets ADD CONSTRAINT markbook_sheets_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.markbook_sheets ADD CONSTRAINT markbook_sheets_teacher_profile_id_fkey FOREIGN KEY (teacher_profile_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.markbook_sheets ADD CONSTRAINT markbook_sheets_term_id_fkey FOREIGN KEY (term_id) REFERENCES terms(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.merit_logs ADD CONSTRAINT merit_logs_awarded_by_fkey FOREIGN KEY (awarded_by) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.merit_logs ADD CONSTRAINT merit_logs_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.merit_logs ADD CONSTRAINT merit_logs_student_id_fkey FOREIGN KEY (student_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.message_templates ADD CONSTRAINT message_templates_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.message_templates ADD CONSTRAINT message_templates_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.messages ADD CONSTRAINT messages_receiver_id_fkey FOREIGN KEY (recipient_id) REFERENCES profiles(id);
ALTER TABLE IF EXISTS public.messages ADD CONSTRAINT messages_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.messages ADD CONSTRAINT messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES profiles(id);
ALTER TABLE IF EXISTS public.notifications ADD CONSTRAINT notifications_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.notifications ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.outbox_events ADD CONSTRAINT outbox_events_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.parent_students ADD CONSTRAINT parent_students_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES parents(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.parent_students ADD CONSTRAINT parent_students_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.parent_students ADD CONSTRAINT parent_students_student_id_fkey FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.parents ADD CONSTRAINT parents_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.parents ADD CONSTRAINT parents_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.payments ADD CONSTRAINT payments_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id);
ALTER TABLE IF EXISTS public.payments ADD CONSTRAINT payments_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.payments ADD CONSTRAINT payments_student_id_fkey FOREIGN KEY (student_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.permission_features ADD CONSTRAINT permission_features_group_id_fkey FOREIGN KEY (group_id) REFERENCES permission_groups(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.permission_features ADD CONSTRAINT permission_features_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.permission_group_roles ADD CONSTRAINT permission_group_roles_group_id_fkey FOREIGN KEY (group_id) REFERENCES permission_groups(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.permission_group_roles ADD CONSTRAINT permission_group_roles_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.permission_groups ADD CONSTRAINT permission_groups_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.permission_slip_responses ADD CONSTRAINT permission_slip_responses_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.permission_slip_responses ADD CONSTRAINT permission_slip_responses_permission_slip_id_fkey FOREIGN KEY (permission_slip_id) REFERENCES permission_slips(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.permission_slip_responses ADD CONSTRAINT permission_slip_responses_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.permission_slip_responses ADD CONSTRAINT permission_slip_responses_student_id_fkey FOREIGN KEY (student_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.permission_slips ADD CONSTRAINT permission_slips_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES profiles(id);
ALTER TABLE IF EXISTS public.permission_slips ADD CONSTRAINT permission_slips_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.permission_slips ADD CONSTRAINT permission_slips_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.profiles ADD CONSTRAINT profiles_auth_user_id_fkey FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.profiles ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.profiles ADD CONSTRAINT profiles_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.question_bank ADD CONSTRAINT question_bank_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.question_bank ADD CONSTRAINT question_bank_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.question_bank ADD CONSTRAINT question_bank_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.report_card_reviews ADD CONSTRAINT report_card_reviews_class_id_fkey FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.report_card_reviews ADD CONSTRAINT report_card_reviews_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.report_card_reviews ADD CONSTRAINT report_card_reviews_student_id_fkey FOREIGN KEY (student_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.report_cards ADD CONSTRAINT report_cards_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.report_cards ADD CONSTRAINT report_cards_student_id_fkey FOREIGN KEY (student_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.report_cards ADD CONSTRAINT report_cards_term_id_fkey FOREIGN KEY (term_id) REFERENCES terms(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.results ADD CONSTRAINT results_assignment_id_fkey FOREIGN KEY (assignment_id) REFERENCES assignments(id);
ALTER TABLE IF EXISTS public.results ADD CONSTRAINT results_exam_id_fkey FOREIGN KEY (exam_id) REFERENCES exams(id);
ALTER TABLE IF EXISTS public.results ADD CONSTRAINT results_published_by_fkey FOREIGN KEY (published_by) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.results ADD CONSTRAINT results_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.results ADD CONSTRAINT results_student_id_fkey FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.results ADD CONSTRAINT results_term_id_fkey FOREIGN KEY (term_id) REFERENCES terms(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.role_permissions ADD CONSTRAINT role_permissions_granted_by_fkey FOREIGN KEY (granted_by) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.role_permissions ADD CONSTRAINT role_permissions_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.role_permissions ADD CONSTRAINT role_permissions_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.scheduled_broadcasts ADD CONSTRAINT scheduled_broadcasts_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.scheduled_broadcasts ADD CONSTRAINT scheduled_broadcasts_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.school_departments ADD CONSTRAINT school_departments_head_of_department_fkey FOREIGN KEY (head_of_department) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.school_departments ADD CONSTRAINT school_departments_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.school_emergency_state ADD CONSTRAINT school_emergency_state_activated_by_fkey FOREIGN KEY (activated_by) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.school_emergency_state ADD CONSTRAINT school_emergency_state_deactivated_by_fkey FOREIGN KEY (deactivated_by) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.school_emergency_state ADD CONSTRAINT school_emergency_state_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.school_invites ADD CONSTRAINT school_invites_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id);
ALTER TABLE IF EXISTS public.school_invites ADD CONSTRAINT school_invites_used_by_fkey FOREIGN KEY (used_by) REFERENCES profiles(id);
ALTER TABLE IF EXISTS public.school_settings ADD CONSTRAINT school_settings_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.staff_invitations ADD CONSTRAINT staff_invitations_accepted_by_fkey FOREIGN KEY (accepted_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.staff_invitations ADD CONSTRAINT staff_invitations_auth_user_id_fkey FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.staff_invitations ADD CONSTRAINT staff_invitations_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id);
ALTER TABLE IF EXISTS public.staff_invitations ADD CONSTRAINT staff_invitations_invited_by_fkey FOREIGN KEY (invited_by) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.staff_invitations ADD CONSTRAINT staff_invitations_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.staff_meetings ADD CONSTRAINT staff_meetings_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.staff_meetings ADD CONSTRAINT staff_meetings_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.student_fees ADD CONSTRAINT student_fees_fee_id_fkey FOREIGN KEY (fee_id) REFERENCES fees(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.student_fees ADD CONSTRAINT student_fees_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.student_fees ADD CONSTRAINT student_fees_student_id_fkey FOREIGN KEY (student_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.student_pulse_metrics ADD CONSTRAINT student_pulse_metrics_class_id_fkey FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.student_pulse_metrics ADD CONSTRAINT student_pulse_metrics_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.student_pulse_metrics ADD CONSTRAINT student_pulse_metrics_student_id_fkey FOREIGN KEY (student_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.student_pulse_metrics ADD CONSTRAINT student_pulse_metrics_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.student_risk_assessments ADD CONSTRAINT student_risk_assessments_class_id_fkey FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.student_risk_assessments ADD CONSTRAINT student_risk_assessments_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.student_risk_assessments ADD CONSTRAINT student_risk_assessments_student_id_fkey FOREIGN KEY (student_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.student_risk_assessments ADD CONSTRAINT student_risk_assessments_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.students ADD CONSTRAINT students_class_id_fkey FOREIGN KEY (class_id) REFERENCES classes(id);
ALTER TABLE IF EXISTS public.students ADD CONSTRAINT students_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.students ADD CONSTRAINT students_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.subjects ADD CONSTRAINT subjects_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.sync_queue ADD CONSTRAINT sync_queue_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.sync_queue ADD CONSTRAINT sync_queue_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.system_events ADD CONSTRAINT system_events_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.system_events ADD CONSTRAINT system_events_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.teacher_active_sessions ADD CONSTRAINT teacher_active_sessions_class_id_fkey FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.teacher_active_sessions ADD CONSTRAINT teacher_active_sessions_lesson_id_fkey FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.teacher_active_sessions ADD CONSTRAINT teacher_active_sessions_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.teacher_active_sessions ADD CONSTRAINT teacher_active_sessions_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.teacher_active_sessions ADD CONSTRAINT teacher_active_sessions_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.teacher_alerts ADD CONSTRAINT teacher_alerts_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.teacher_alerts ADD CONSTRAINT teacher_alerts_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.teacher_class_subject_assignments ADD CONSTRAINT teacher_class_subject_assignments_class_id_fkey FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.teacher_class_subject_assignments ADD CONSTRAINT teacher_class_subject_assignments_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.teacher_class_subject_assignments ADD CONSTRAINT teacher_class_subject_assignments_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.teacher_class_subject_assignments ADD CONSTRAINT teacher_class_subject_assignments_teacher_profile_id_fkey FOREIGN KEY (teacher_profile_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.teacher_office_hours ADD CONSTRAINT teacher_office_hours_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.teacher_office_hours ADD CONSTRAINT teacher_office_hours_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.teacher_performance_metrics ADD CONSTRAINT teacher_performance_metrics_class_id_fkey FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.teacher_performance_metrics ADD CONSTRAINT teacher_performance_metrics_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.teacher_performance_metrics ADD CONSTRAINT teacher_performance_metrics_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.teacher_performance_metrics ADD CONSTRAINT teacher_performance_metrics_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.teacher_recognition ADD CONSTRAINT teacher_recognition_awarded_by_fkey FOREIGN KEY (awarded_by) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.teacher_recognition ADD CONSTRAINT teacher_recognition_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.teacher_recognition ADD CONSTRAINT teacher_recognition_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.teacher_subject_specializations ADD CONSTRAINT teacher_subject_specializations_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.teacher_subject_specializations ADD CONSTRAINT teacher_subject_specializations_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.teacher_subject_specializations ADD CONSTRAINT teacher_subject_specializations_teacher_profile_id_fkey FOREIGN KEY (teacher_profile_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.teachers ADD CONSTRAINT teachers_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.teachers ADD CONSTRAINT teachers_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.terms ADD CONSTRAINT terms_academic_year_id_fkey FOREIGN KEY (academic_year_id) REFERENCES academic_years(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.terms ADD CONSTRAINT terms_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.user_sessions ADD CONSTRAINT user_sessions_school_id_fkey FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.user_sessions ADD CONSTRAINT user_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- Section 8: Indexes (409)
CREATE INDEX idx_academic_terms_school_id ON public.academic_terms USING btree (school_id);
CREATE INDEX idx_academic_terms_year_id ON public.academic_terms USING btree (academic_year_id);
CREATE INDEX idx_academic_years_school_id ON public.academic_years USING btree (school_id);
CREATE INDEX idx_access_codes_approval_usage ON public.access_codes USING btree (approval_status, expires_at, use_count);
CREATE INDEX idx_access_codes_created_by ON public.access_codes USING btree (created_by);
CREATE INDEX activity_logs_actor_profile_idx ON public.activity_logs USING btree (actor_profile_id, created_at DESC);
CREATE INDEX activity_logs_entity_lookup_idx ON public.activity_logs USING btree (entity_type, entity_id, created_at DESC);
CREATE INDEX idx_activity_logs_school_created ON public.activity_logs USING btree (school_id, created_at DESC);
CREATE INDEX idx_admin_actions_actor_id ON public.admin_actions USING btree (actor_id);
CREATE INDEX idx_admin_actions_rollback_of ON public.admin_actions USING btree (rollback_of);
CREATE INDEX idx_admin_actions_school_actor ON public.admin_actions USING btree (school_id, actor_id, executed_at DESC);
CREATE INDEX idx_admin_actions_target ON public.admin_actions USING btree (target_entity_type, target_entity_id) WHERE (target_entity_id IS NOT NULL);
CREATE INDEX idx_admin_role_scopes_granted_by ON public.admin_role_scopes USING btree (granted_by);
CREATE INDEX idx_admin_role_scopes_school_user ON public.admin_role_scopes USING btree (school_id, user_id) WHERE (is_active = true);
CREATE INDEX idx_admin_role_scopes_user_id ON public.admin_role_scopes USING btree (user_id);
CREATE INDEX idx_alert_thresholds_school ON public.alert_thresholds USING btree (school_id) WHERE (is_active = true);
CREATE INDEX idx_alert_thresholds_updated_by ON public.alert_thresholds USING btree (updated_by);
CREATE INDEX idx_announcement_seen_announcement_id ON public.announcement_seen USING btree (announcement_id);
CREATE INDEX idx_announcement_seen_profile_id ON public.announcement_seen USING btree (profile_id);
CREATE INDEX idx_announcement_views_viewer_id ON public.announcement_views USING btree (viewer_id);
CREATE INDEX idx_announcements_created_by ON public.announcements USING btree (created_by);
CREATE INDEX idx_announcements_publish_at ON public.announcements USING btree (publish_at);
CREATE INDEX idx_announcements_scheduled_publish ON public.announcements USING btree (scheduled_at) WHERE ((published_at IS NULL) AND (scheduled_at IS NOT NULL));
CREATE INDEX idx_announcements_school_audience ON public.announcements USING btree (school_id, target_audience);
CREATE INDEX idx_announcements_school_created ON public.announcements USING btree (school_id, created_at DESC);
CREATE INDEX idx_announcements_school_id ON public.announcements USING btree (school_id);
CREATE INDEX idx_announcements_school_publish ON public.announcements USING btree (school_id, publish_at);
CREATE INDEX idx_announcements_school_status ON public.announcements USING btree (school_id, status);
CREATE INDEX idx_announcements_status ON public.announcements USING btree (status);
CREATE INDEX idx_announcements_target_class_id ON public.announcements USING btree (target_class_id);
CREATE INDEX idx_announcements_target_user_id ON public.announcements USING btree (target_user_id);
CREATE INDEX idx_assignment_submissions_assignment_id ON public.assignment_submissions USING btree (assignment_id);
CREATE INDEX idx_assignment_submissions_school_assignment ON public.assignment_submissions USING btree (school_id, assignment_id);
CREATE INDEX idx_assignment_submissions_school_student ON public.assignment_submissions USING btree (school_id, student_profile_id);
CREATE INDEX idx_assignment_submissions_student_profile_id ON public.assignment_submissions USING btree (student_profile_id);
CREATE INDEX idx_assignments_class_id ON public.assignments USING btree (class_id);
CREATE INDEX idx_assignments_due_date ON public.assignments USING btree (due_date);
CREATE INDEX idx_assignments_school_id ON public.assignments USING btree (school_id);
CREATE INDEX idx_assignments_subject_id ON public.assignments USING btree (subject_id);
CREATE INDEX idx_assignments_teacher_class_school ON public.assignments USING btree (school_id, teacher_id, class_id);
CREATE INDEX idx_assignments_teacher_id ON public.assignments USING btree (teacher_id);
CREATE INDEX idx_async_jobs_created_by ON public.async_jobs USING btree (created_by);
CREATE INDEX idx_async_jobs_school_status_available ON public.async_jobs USING btree (school_id, status, available_at);
CREATE INDEX idx_async_jobs_status_available ON public.async_jobs USING btree (status, available_at);
CREATE INDEX idx_async_jobs_status_priority_available ON public.async_jobs USING btree (status, priority, available_at);
CREATE UNIQUE INDEX attendance_idempotent_slot_uq ON public.attendance USING btree (school_id, student_id, class_id, attendance_date);
CREATE INDEX idx_attendance_class ON public.attendance USING btree (class_id);
CREATE INDEX idx_attendance_class_date ON public.attendance USING btree (class_id, attendance_date);
CREATE UNIQUE INDEX idx_attendance_client_id ON public.attendance USING btree (school_id, client_id) WHERE (client_id IS NOT NULL);
CREATE INDEX idx_attendance_date ON public.attendance USING btree (date);
CREATE INDEX idx_attendance_recorded_by ON public.attendance USING btree (recorded_by);
CREATE INDEX idx_attendance_school_date ON public.attendance USING btree (school_id, date);
CREATE INDEX idx_attendance_school_id ON public.attendance USING btree (school_id);
CREATE INDEX idx_attendance_school_student_date ON public.attendance USING btree (school_id, student_id, attendance_date);
CREATE INDEX idx_attendance_student_date ON public.attendance USING btree (student_id, attendance_date DESC);
CREATE INDEX idx_attendance_student_id ON public.attendance USING btree (student_id);
CREATE UNIQUE INDEX idx_attendance_upsert_key ON public.attendance USING btree (student_id, class_id, attendance_date, session_name);
CREATE INDEX idx_attendance_rollcall_class_date ON public.attendance_rollcall_sessions USING btree (class_id, date);
CREATE INDEX idx_attendance_rollcall_sessions_class_id ON public.attendance_rollcall_sessions USING btree (class_id);
CREATE INDEX idx_attendance_rollcall_sessions_lesson_id ON public.attendance_rollcall_sessions USING btree (lesson_id);
CREATE INDEX idx_attendance_rollcall_sessions_school_id ON public.attendance_rollcall_sessions USING btree (school_id);
CREATE INDEX idx_attendance_rollcall_sessions_subject_id ON public.attendance_rollcall_sessions USING btree (subject_id);
CREATE INDEX idx_attendance_rollcall_teacher ON public.attendance_rollcall_sessions USING btree (teacher_id, date);
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs USING btree (created_at DESC);
CREATE INDEX idx_audit_logs_entity ON public.audit_logs USING btree (entity_type, entity_id);
CREATE INDEX idx_audit_logs_entity_id ON public.audit_logs USING btree (entity_id);
CREATE INDEX idx_audit_logs_entity_type ON public.audit_logs USING btree (entity_type);
CREATE INDEX idx_audit_logs_school_created ON public.audit_logs USING btree (school_id, created_at DESC);
CREATE INDEX idx_audit_logs_school_id ON public.audit_logs USING btree (school_id);
CREATE INDEX idx_audit_logs_user_action ON public.audit_logs USING btree (user_id, created_at DESC);
CREATE INDEX idx_audit_logs_user_id ON public.audit_logs USING btree (user_id);
CREATE INDEX idx_audit_resource_type ON public.audit_logs USING btree (resource_type, created_at DESC);
CREATE INDEX idx_behaviour_followups_assigned_to ON public.behaviour_followups USING btree (assigned_to);
CREATE INDEX idx_behaviour_followups_created_by ON public.behaviour_followups USING btree (created_by);
CREATE INDEX idx_behaviour_followups_log ON public.behaviour_followups USING btree (behaviour_log_id);
CREATE INDEX idx_behaviour_followups_school_status ON public.behaviour_followups USING btree (school_id, status);
CREATE INDEX idx_behaviour_logs_logged_by ON public.behaviour_logs USING btree (logged_by);
CREATE INDEX idx_behaviour_logs_resolved_by ON public.behaviour_logs USING btree (resolved_by);
CREATE INDEX idx_behaviour_school_date ON public.behaviour_logs USING btree (school_id, logged_at DESC);
CREATE INDEX idx_behaviour_student ON public.behaviour_logs USING btree (student_id);
CREATE INDEX idx_class_insights_class_id ON public.class_insights USING btree (class_id);
CREATE INDEX idx_class_insights_class_type ON public.class_insights USING btree (class_id, insight_type, status);
CREATE INDEX idx_class_insights_school_id ON public.class_insights USING btree (school_id);
CREATE INDEX idx_class_insights_subject_id ON public.class_insights USING btree (subject_id);
CREATE INDEX idx_class_insights_teacher_id ON public.class_insights USING btree (teacher_id);
CREATE INDEX idx_class_subjects_class_id ON public.class_subjects USING btree (class_id);
CREATE INDEX idx_class_subjects_subject_id ON public.class_subjects USING btree (subject_id);
CREATE INDEX idx_class_subjects_teacher_id ON public.class_subjects USING btree (teacher_id);
CREATE INDEX idx_classes_grade_id ON public.classes USING btree (grade_id);
CREATE INDEX idx_classes_school_grade ON public.classes USING btree (school_id, grade_level);
CREATE INDEX idx_classes_school_id ON public.classes USING btree (school_id);
CREATE INDEX idx_classes_supervisor_id ON public.classes USING btree (supervisor_id);
CREATE INDEX idx_classroom_activity_stream_class_date ON public.classroom_activity_stream USING btree (class_id, created_at);
CREATE INDEX idx_classroom_activity_stream_class_id ON public.classroom_activity_stream USING btree (class_id);
CREATE INDEX idx_classroom_activity_stream_school_id ON public.classroom_activity_stream USING btree (school_id);
CREATE INDEX idx_classroom_activity_stream_subject_id ON public.classroom_activity_stream USING btree (subject_id);
CREATE INDEX idx_classroom_activity_stream_teacher_id ON public.classroom_activity_stream USING btree (teacher_id);
CREATE INDEX idx_classroom_activity_stream_type_status ON public.classroom_activity_stream USING btree (activity_type, status);
CREATE INDEX idx_discipline_actions_issued_by ON public.discipline_actions USING btree (issued_by);
CREATE INDEX idx_discipline_actions_record ON public.discipline_actions USING btree (record_id);
CREATE INDEX idx_discipline_actions_type ON public.discipline_actions USING btree (school_id, action_type);
CREATE INDEX idx_discipline_records_category_id ON public.discipline_records USING btree (category_id);
CREATE INDEX idx_discipline_records_class ON public.discipline_records USING btree (class_id);
CREATE INDEX idx_discipline_records_incident_date ON public.discipline_records USING btree (incident_date);
CREATE INDEX idx_discipline_records_reported_by ON public.discipline_records USING btree (reported_by);
CREATE INDEX idx_discipline_records_resolved_by ON public.discipline_records USING btree (resolved_by);
CREATE INDEX idx_discipline_records_school_status ON public.discipline_records USING btree (school_id, status);
CREATE INDEX idx_discipline_records_school_student ON public.discipline_records USING btree (school_id, student_id);
CREATE INDEX idx_discipline_records_student_id ON public.discipline_records USING btree (student_id);
CREATE INDEX idx_duty_roster_created_by ON public.duty_roster USING btree (created_by);
CREATE INDEX idx_duty_roster_school_id ON public.duty_roster USING btree (school_id);
CREATE INDEX idx_duty_roster_teacher_id ON public.duty_roster USING btree (teacher_id);
CREATE INDEX idx_events_created_by ON public.events USING btree (created_by);
CREATE INDEX idx_events_school_date ON public.events USING btree (school_id, event_date);
CREATE INDEX idx_events_school_id ON public.events USING btree (school_id);
CREATE INDEX idx_events_school_start ON public.events USING btree (school_id, start_date);
CREATE INDEX idx_events_start_date ON public.events USING btree (start_date);
CREATE INDEX idx_events_target_class_id ON public.events USING btree (target_class_id);
CREATE UNIQUE INDEX exam_questions_exam_position_uidx ON public.exam_questions USING btree (exam_id, "position");
CREATE INDEX idx_exam_questions_exam_id ON public.exam_questions USING btree (exam_id);
CREATE INDEX idx_exam_questions_school_id ON public.exam_questions USING btree (school_id);
CREATE UNIQUE INDEX exam_submission_answers_submission_question_uidx ON public.exam_submission_answers USING btree (submission_id, question_id);
CREATE INDEX idx_exam_submission_answers_question_id ON public.exam_submission_answers USING btree (question_id);
CREATE INDEX idx_exam_submission_answers_submission_id ON public.exam_submission_answers USING btree (submission_id);
CREATE UNIQUE INDEX exam_submissions_exam_student_uidx ON public.exam_submissions USING btree (exam_id, student_id);
CREATE INDEX idx_exam_submissions_exam_id ON public.exam_submissions USING btree (exam_id);
CREATE INDEX idx_exam_submissions_school_id ON public.exam_submissions USING btree (school_id);
CREATE INDEX idx_exam_submissions_student_id ON public.exam_submissions USING btree (student_id);
CREATE INDEX idx_exams_class_id ON public.exams USING btree (class_id);
CREATE INDEX idx_exams_exam_date ON public.exams USING btree (exam_date);
CREATE INDEX idx_exams_school_class ON public.exams USING btree (school_id, class_id);
CREATE INDEX idx_exams_school_id ON public.exams USING btree (school_id);
CREATE INDEX idx_exams_subject_id ON public.exams USING btree (subject_id);
CREATE INDEX idx_exams_window ON public.exams USING btree (available_from, available_until);
CREATE INDEX idx_fee_payments_parent_id ON public.fee_payments USING btree (parent_id);
CREATE INDEX idx_fee_payments_payment_date ON public.fee_payments USING btree (payment_date DESC);
CREATE INDEX idx_fee_payments_school_id ON public.fee_payments USING btree (school_id);
CREATE INDEX idx_fee_payments_status ON public.fee_payments USING btree (status);
CREATE INDEX idx_fee_payments_student_id ON public.fee_payments USING btree (student_id);
CREATE INDEX idx_fees_is_active ON public.fees USING btree (school_id, is_active);
CREATE INDEX idx_fees_school_id ON public.fees USING btree (school_id);
CREATE INDEX idx_finance_records_date ON public.finance_records USING btree (transaction_date);
CREATE INDEX idx_finance_records_recorded_by ON public.finance_records USING btree (recorded_by);
CREATE INDEX idx_finance_records_school_date ON public.finance_records USING btree (school_id, transaction_date DESC);
CREATE INDEX idx_finance_records_school_id ON public.finance_records USING btree (school_id);
CREATE INDEX idx_finance_records_type ON public.finance_records USING btree (transaction_type);
CREATE INDEX idx_finances_date ON public.finances USING btree (transaction_date);
CREATE INDEX idx_finances_recorded_by ON public.finances USING btree (recorded_by);
CREATE INDEX idx_finances_school_date ON public.finances USING btree (school_id, transaction_date);
CREATE INDEX idx_finances_school_id ON public.finances USING btree (school_id);
CREATE INDEX idx_finances_transaction_date ON public.finances USING btree (transaction_date DESC);
CREATE INDEX idx_finances_type ON public.finances USING btree (transaction_type);
CREATE INDEX idx_grade_publish_history_class ON public.grade_publish_history USING btree (class_id, subject_id);
CREATE INDEX idx_grade_publish_history_class_id ON public.grade_publish_history USING btree (class_id);
CREATE INDEX idx_grade_publish_history_column_id ON public.grade_publish_history USING btree (column_id);
CREATE INDEX idx_grade_publish_history_published_by ON public.grade_publish_history USING btree (published_by);
CREATE INDEX idx_grade_publish_history_school_id ON public.grade_publish_history USING btree (school_id);
CREATE INDEX idx_grade_publish_history_subject_id ON public.grade_publish_history USING btree (subject_id);
CREATE INDEX idx_gradebook_snapshots_class_id ON public.gradebook_snapshots USING btree (class_id);
CREATE INDEX idx_gradebook_snapshots_class_subject ON public.gradebook_snapshots USING btree (class_id, subject_id);
CREATE INDEX idx_gradebook_snapshots_created ON public.gradebook_snapshots USING btree (created_at DESC);
CREATE INDEX idx_gradebook_snapshots_created_by ON public.gradebook_snapshots USING btree (created_by);
CREATE INDEX idx_gradebook_snapshots_school_id ON public.gradebook_snapshots USING btree (school_id);
CREATE INDEX idx_gradebook_snapshots_subject_id ON public.gradebook_snapshots USING btree (subject_id);
CREATE INDEX idx_grades_school_id ON public.grades USING btree (school_id);
CREATE INDEX idx_grading_scales_school_id ON public.grading_scales USING btree (school_id);
CREATE UNIQUE INDEX idempotency_keys_route_scope_key ON public.idempotency_keys USING btree (route_key, scope_key, idempotency_key);
CREATE INDEX idx_idempotency_keys_created_at ON public.idempotency_keys USING btree (created_at DESC);
CREATE INDEX idx_lesson_plans_grade_id ON public.lesson_plans USING btree (grade_id);
CREATE INDEX idx_lesson_plans_school_id ON public.lesson_plans USING btree (school_id);
CREATE INDEX idx_lesson_plans_subject_id ON public.lesson_plans USING btree (subject_id);
CREATE INDEX idx_lesson_plans_teacher_id ON public.lesson_plans USING btree (teacher_id);
CREATE INDEX idx_lesson_plans_term_id ON public.lesson_plans USING btree (term_id);
CREATE INDEX idx_lessons_class_day ON public.lessons USING btree (school_id, class_id, day_of_week);
CREATE INDEX idx_lessons_class_id ON public.lessons USING btree (class_id);
CREATE INDEX idx_lessons_day ON public.lessons USING btree (day_of_week);
CREATE INDEX idx_lessons_school_id ON public.lessons USING btree (school_id);
CREATE INDEX idx_lessons_subject_id ON public.lessons USING btree (subject_id);
CREATE INDEX idx_lessons_teacher_day ON public.lessons USING btree (school_id, teacher_id, day_of_week);
CREATE INDEX idx_lessons_teacher_id ON public.lessons USING btree (teacher_id);
CREATE INDEX idx_markbook_columns_assignment_id ON public.markbook_columns USING btree (assignment_id);
CREATE INDEX idx_markbook_columns_class_id ON public.markbook_columns USING btree (class_id);
CREATE INDEX idx_markbook_columns_class_subject ON public.markbook_columns USING btree (class_id, subject_id);
CREATE INDEX idx_markbook_columns_created_by ON public.markbook_columns USING btree (created_by);
CREATE INDEX idx_markbook_columns_published ON public.markbook_columns USING btree (is_published, publish_date);
CREATE INDEX idx_markbook_columns_school ON public.markbook_columns USING btree (school_id);
CREATE INDEX idx_markbook_columns_sheet ON public.markbook_columns USING btree (sheet_id, order_index);
CREATE INDEX idx_markbook_columns_subject_id ON public.markbook_columns USING btree (subject_id);
CREATE INDEX idx_markbook_entries_column_id ON public.markbook_entries USING btree (column_id);
CREATE INDEX idx_markbook_entries_school_id ON public.markbook_entries USING btree (school_id);
CREATE INDEX idx_markbook_entries_sheet_student ON public.markbook_entries USING btree (sheet_id, student_id);
CREATE INDEX idx_markbook_entries_student_id ON public.markbook_entries USING btree (student_id);
CREATE INDEX idx_markbook_scores_column_id ON public.markbook_scores USING btree (column_id);
CREATE INDEX idx_markbook_scores_column_student ON public.markbook_scores USING btree (column_id, student_profile_id);
CREATE INDEX idx_markbook_scores_graded_by ON public.markbook_scores USING btree (graded_by);
CREATE INDEX idx_markbook_scores_school ON public.markbook_scores USING btree (school_id);
CREATE INDEX idx_markbook_scores_student ON public.markbook_scores USING btree (student_profile_id);
CREATE INDEX idx_markbook_sheets_class_id ON public.markbook_sheets USING btree (class_id);
CREATE INDEX idx_markbook_sheets_school_class ON public.markbook_sheets USING btree (school_id, class_id);
CREATE INDEX idx_markbook_sheets_subject_id ON public.markbook_sheets USING btree (subject_id);
CREATE INDEX idx_markbook_sheets_teacher_profile_id ON public.markbook_sheets USING btree (teacher_profile_id);
CREATE INDEX idx_markbook_sheets_term_id ON public.markbook_sheets USING btree (term_id);
CREATE INDEX idx_merit_logs_awarded_by ON public.merit_logs USING btree (awarded_by);
CREATE INDEX idx_merit_school ON public.merit_logs USING btree (school_id, awarded_at DESC);
CREATE INDEX idx_merit_student ON public.merit_logs USING btree (student_id);
CREATE INDEX message_templates_created_by_idx ON public.message_templates USING btree (created_by);
CREATE INDEX message_templates_school_id_idx ON public.message_templates USING btree (school_id);
CREATE INDEX idx_messages_created_at ON public.messages USING btree (created_at DESC);
CREATE INDEX idx_messages_recipient_id ON public.messages USING btree (recipient_id);
CREATE INDEX idx_messages_recipient_school ON public.messages USING btree (school_id, recipient_id, is_read);
CREATE INDEX idx_messages_recipient_unread ON public.messages USING btree (recipient_id, is_read, created_at DESC);
CREATE INDEX idx_messages_school_created ON public.messages USING btree (school_id, created_at DESC);
CREATE INDEX idx_messages_school_id ON public.messages USING btree (school_id);
CREATE INDEX idx_messages_sender_created ON public.messages USING btree (sender_id, created_at DESC);
CREATE INDEX idx_messages_sender_id ON public.messages USING btree (sender_id);
CREATE INDEX idx_messages_sender_receiver ON public.messages USING btree (sender_id, recipient_id);
CREATE INDEX idx_notifications_created_at ON public.notifications USING btree (created_at DESC);
CREATE INDEX idx_notifications_is_read ON public.notifications USING btree (user_id, is_read);
CREATE INDEX idx_notifications_school_id ON public.notifications USING btree (school_id);
CREATE INDEX idx_notifications_school_user_read ON public.notifications USING btree (school_id, user_id, is_read);
CREATE INDEX idx_notifications_user_id ON public.notifications USING btree (user_id);
CREATE INDEX idx_notifications_user_unread ON public.notifications USING btree (user_id) WHERE (is_read = false);
CREATE INDEX idx_outbox_events_school_created ON public.outbox_events USING btree (school_id, created_at DESC);
CREATE INDEX idx_outbox_events_status_available ON public.outbox_events USING btree (status, available_at);
CREATE INDEX idx_parent_students_parent_id ON public.parent_students USING btree (parent_id);
CREATE INDEX idx_parent_students_school_id ON public.parent_students USING btree (school_id);
CREATE INDEX idx_parent_students_student_id ON public.parent_students USING btree (student_id);
CREATE INDEX idx_parents_profile_id ON public.parents USING btree (profile_id);
CREATE INDEX idx_parents_school_id ON public.parents USING btree (school_id);
CREATE UNIQUE INDEX parents_profile_unique ON public.parents USING btree (profile_id) WHERE (profile_id IS NOT NULL);
CREATE INDEX idx_payments_created_by ON public.payments USING btree (created_by);
CREATE INDEX idx_payments_school_id ON public.payments USING btree (school_id);
CREATE INDEX idx_payments_school_status ON public.payments USING btree (school_id, status);
CREATE INDEX idx_payments_status ON public.payments USING btree (status);
CREATE INDEX idx_payments_student_id ON public.payments USING btree (student_id);
CREATE INDEX idx_payments_student_status ON public.payments USING btree (student_id, status);
CREATE INDEX idx_permission_features_school_id ON public.permission_features USING btree (school_id);
CREATE INDEX idx_permission_group_roles_school_role ON public.permission_group_roles USING btree (school_id, lower(role));
CREATE INDEX idx_permission_slip_responses_parent_id ON public.permission_slip_responses USING btree (parent_id);
CREATE INDEX idx_permission_slip_responses_school_id ON public.permission_slip_responses USING btree (school_id);
CREATE INDEX idx_response_slip ON public.permission_slip_responses USING btree (permission_slip_id);
CREATE INDEX idx_response_student ON public.permission_slip_responses USING btree (student_id);
CREATE INDEX idx_permission_slips_approved_by ON public.permission_slips USING btree (approved_by);
CREATE INDEX idx_permission_slips_created_by ON public.permission_slips USING btree (created_by);
CREATE INDEX idx_slip_school ON public.permission_slips USING btree (school_id);
CREATE INDEX idx_profiles_auth_user_id ON public.profiles USING btree (auth_user_id);
CREATE INDEX idx_profiles_email ON public.profiles USING btree (email);
CREATE INDEX idx_profiles_role ON public.profiles USING btree (role);
CREATE INDEX idx_profiles_school_id ON public.profiles USING btree (school_id);
CREATE INDEX idx_profiles_school_role ON public.profiles USING btree (school_id, role);
CREATE INDEX idx_question_bank_created_by ON public.question_bank USING btree (created_by);
CREATE INDEX idx_question_bank_school_id ON public.question_bank USING btree (school_id);
CREATE INDEX idx_question_bank_subject_id ON public.question_bank USING btree (subject_id);
CREATE INDEX idx_report_card_reviews_school_id ON public.report_card_reviews USING btree (school_id);
CREATE INDEX idx_report_card_reviews_student_id ON public.report_card_reviews USING btree (student_id);
CREATE INDEX idx_report_review_class ON public.report_card_reviews USING btree (class_id);
CREATE INDEX idx_report_cards_student_id ON public.report_cards USING btree (student_id);
CREATE INDEX idx_report_cards_term_id ON public.report_cards USING btree (term_id);
CREATE INDEX idx_results_assignment_id ON public.results USING btree (assignment_id);
CREATE INDEX idx_results_assignment_school ON public.results USING btree (school_id, assignment_id);
CREATE INDEX idx_results_exam_id ON public.results USING btree (exam_id);
CREATE INDEX idx_results_published_by ON public.results USING btree (published_by);
CREATE INDEX idx_results_school_id ON public.results USING btree (school_id);
CREATE INDEX idx_results_school_student_published ON public.results USING btree (school_id, student_id, published_at) WHERE (published_at IS NOT NULL);
CREATE INDEX idx_results_student_id ON public.results USING btree (student_id);
CREATE INDEX idx_results_student_published ON public.results USING btree (student_id, published_at);
CREATE INDEX idx_results_term_id ON public.results USING btree (term_id);
CREATE UNIQUE INDEX results_assignment_unique ON public.results USING btree (student_id, assignment_id) WHERE (assignment_id IS NOT NULL);
CREATE UNIQUE INDEX results_assignment_unique_key ON public.results USING btree (school_id, student_id, assignment_id) WHERE (assignment_id IS NOT NULL);
CREATE UNIQUE INDEX results_exam_unique ON public.results USING btree (student_id, exam_id) WHERE (exam_id IS NOT NULL);
CREATE UNIQUE INDEX results_exam_unique_key ON public.results USING btree (school_id, student_id, exam_id) WHERE (exam_id IS NOT NULL);
CREATE INDEX idx_role_permissions_granted_by ON public.role_permissions USING btree (granted_by);
CREATE INDEX idx_role_permissions_school_user ON public.role_permissions USING btree (school_id, user_id);
CREATE INDEX idx_role_permissions_user_id ON public.role_permissions USING btree (user_id);
CREATE INDEX idx_scheduled_broadcasts_created_by ON public.scheduled_broadcasts USING btree (created_by);
CREATE INDEX idx_scheduled_broadcasts_school ON public.scheduled_broadcasts USING btree (school_id, status);
CREATE INDEX idx_school_departments_head_of_department ON public.school_departments USING btree (head_of_department);
CREATE INDEX idx_school_emergency_state_activated_by ON public.school_emergency_state USING btree (activated_by);
CREATE INDEX idx_school_emergency_state_deactivated_by ON public.school_emergency_state USING btree (deactivated_by);
CREATE INDEX idx_school_invites_created_by ON public.school_invites USING btree (created_by);
CREATE INDEX idx_school_invites_expires_at ON public.school_invites USING btree (expires_at);
CREATE INDEX idx_school_invites_status ON public.school_invites USING btree (status);
CREATE INDEX idx_school_invites_used_by ON public.school_invites USING btree (used_by);
CREATE INDEX idx_schools_province_district ON public.schools USING btree (province, district);
CREATE UNIQUE INDEX schools_code_unique_ci ON public.schools USING btree (upper(code));
CREATE UNIQUE INDEX schools_emis_code_key ON public.schools USING btree (emis_code) WHERE (emis_code IS NOT NULL);
CREATE INDEX idx_staff_invitations_accepted_by ON public.staff_invitations USING btree (accepted_by);
CREATE INDEX idx_staff_invitations_auth_user_id ON public.staff_invitations USING btree (auth_user_id);
CREATE INDEX idx_staff_invitations_created_by ON public.staff_invitations USING btree (created_by);
CREATE INDEX idx_staff_invitations_invited_by ON public.staff_invitations USING btree (invited_by);
CREATE INDEX idx_staff_invitations_school_email ON public.staff_invitations USING btree (school_id, email);
CREATE INDEX idx_staff_invitations_school_role ON public.staff_invitations USING btree (school_id, lower(role));
CREATE INDEX idx_staff_invitations_school_status ON public.staff_invitations USING btree (school_id, accepted_at, revoked_at);
CREATE INDEX idx_staff_meetings_created_by ON public.staff_meetings USING btree (created_by);
CREATE INDEX idx_staff_meetings_school_id ON public.staff_meetings USING btree (school_id);
CREATE INDEX idx_student_fees_billing_month ON public.student_fees USING btree (school_id, billing_month);
CREATE INDEX idx_student_fees_due_date ON public.student_fees USING btree (due_date) WHERE (status <> 'PAID'::text);
CREATE INDEX idx_student_fees_fee_id ON public.student_fees USING btree (fee_id);
CREATE INDEX idx_student_fees_school_id ON public.student_fees USING btree (school_id);
CREATE INDEX idx_student_fees_status ON public.student_fees USING btree (school_id, status);
CREATE INDEX idx_student_fees_student_id ON public.student_fees USING btree (student_id);
CREATE INDEX idx_student_fees_student_status ON public.student_fees USING btree (student_id, status);
CREATE INDEX idx_student_pulse_metrics_class_id ON public.student_pulse_metrics USING btree (class_id);
CREATE INDEX idx_student_pulse_metrics_risk_level ON public.student_pulse_metrics USING btree (risk_level, date);
CREATE INDEX idx_student_pulse_metrics_school_id ON public.student_pulse_metrics USING btree (school_id);
CREATE INDEX idx_student_pulse_metrics_student_date ON public.student_pulse_metrics USING btree (student_id, date);
CREATE INDEX idx_student_pulse_metrics_student_id ON public.student_pulse_metrics USING btree (student_id);
CREATE INDEX idx_student_pulse_metrics_subject_id ON public.student_pulse_metrics USING btree (subject_id);
CREATE INDEX idx_student_risk_assessments_class_id ON public.student_risk_assessments USING btree (class_id);
CREATE INDEX idx_student_risk_assessments_school_id ON public.student_risk_assessments USING btree (school_id);
CREATE INDEX idx_student_risk_assessments_student_id ON public.student_risk_assessments USING btree (student_id);
CREATE INDEX idx_student_risk_assessments_student_level ON public.student_risk_assessments USING btree (student_id, risk_level);
CREATE INDEX idx_student_risk_assessments_teacher_id ON public.student_risk_assessments USING btree (teacher_id);
CREATE UNIQUE INDEX student_risk_assessments_unique_idx ON public.student_risk_assessments USING btree (student_id, class_id, (((created_at AT TIME ZONE 'UTC'::text))::date));
CREATE INDEX idx_students_active ON public.students USING btree (is_active);
CREATE INDEX idx_students_class_id ON public.students USING btree (class_id);
CREATE INDEX idx_students_profile_id ON public.students USING btree (profile_id);
CREATE INDEX idx_students_school_active ON public.students USING btree (school_id) WHERE (is_active = true);
CREATE INDEX idx_students_school_id ON public.students USING btree (school_id);
CREATE UNIQUE INDEX students_number_school_unique ON public.students USING btree (school_id, student_number) WHERE (student_number IS NOT NULL);
CREATE UNIQUE INDEX students_profile_unique ON public.students USING btree (profile_id) WHERE (profile_id IS NOT NULL);
CREATE INDEX idx_subjects_school_id ON public.subjects USING btree (school_id);
CREATE INDEX idx_sync_queue_school_status ON public.sync_queue USING btree (school_id, status);
CREATE INDEX idx_sync_queue_user_id ON public.sync_queue USING btree (user_id);
CREATE INDEX idx_system_events_actor_id ON public.system_events USING btree (actor_id);
CREATE INDEX idx_system_events_correlation ON public.system_events USING btree (correlation_id);
CREATE INDEX idx_system_events_domain_school ON public.system_events USING btree (domain, school_id, created_at DESC);
CREATE INDEX idx_system_events_school_id ON public.system_events USING btree (school_id);
CREATE INDEX idx_system_events_type ON public.system_events USING btree (type);
CREATE INDEX idx_system_events_unprocessed ON public.system_events USING btree (processed, domain) WHERE (processed = false);
CREATE INDEX idx_teacher_active_sessions_class_status ON public.teacher_active_sessions USING btree (class_id, status);
CREATE INDEX idx_teacher_active_sessions_lesson_id ON public.teacher_active_sessions USING btree (lesson_id);
CREATE INDEX idx_teacher_active_sessions_school_id ON public.teacher_active_sessions USING btree (school_id);
CREATE INDEX idx_teacher_active_sessions_subject_id ON public.teacher_active_sessions USING btree (subject_id);
CREATE INDEX idx_teacher_active_sessions_teacher_date ON public.teacher_active_sessions USING btree (teacher_id, (((start_time AT TIME ZONE 'UTC'::text))::date));
CREATE INDEX idx_teacher_active_sessions_teacher_id ON public.teacher_active_sessions USING btree (teacher_id);
CREATE UNIQUE INDEX teacher_active_sessions_unique_idx ON public.teacher_active_sessions USING btree (teacher_id, class_id, subject_id, (((start_time AT TIME ZONE 'UTC'::text))::date));
CREATE INDEX idx_teacher_alerts_school_id ON public.teacher_alerts USING btree (school_id);
CREATE INDEX idx_teacher_alerts_teacher_severity ON public.teacher_alerts USING btree (teacher_id, severity, status);
CREATE INDEX idx_teacher_alerts_type_created ON public.teacher_alerts USING btree (alert_type, created_at);
CREATE INDEX idx_teacher_class_subject_assignments_class_id ON public.teacher_class_subject_assignments USING btree (class_id);
CREATE INDEX idx_teacher_class_subject_assignments_school_class ON public.teacher_class_subject_assignments USING btree (school_id, class_id);
CREATE INDEX idx_teacher_class_subject_assignments_school_teacher ON public.teacher_class_subject_assignments USING btree (school_id, teacher_profile_id);
CREATE INDEX idx_teacher_class_subject_assignments_subject_id ON public.teacher_class_subject_assignments USING btree (subject_id);
CREATE INDEX idx_teacher_class_subject_assignments_teacher ON public.teacher_class_subject_assignments USING btree (teacher_profile_id);
CREATE INDEX teacher_office_hours_school_id_idx ON public.teacher_office_hours USING btree (school_id);
CREATE INDEX teacher_office_hours_teacher_id_idx ON public.teacher_office_hours USING btree (teacher_id);
CREATE INDEX idx_teacher_performance_metrics_class_id ON public.teacher_performance_metrics USING btree (class_id);
CREATE INDEX idx_teacher_performance_metrics_school_id ON public.teacher_performance_metrics USING btree (school_id);
CREATE INDEX idx_teacher_performance_metrics_subject_id ON public.teacher_performance_metrics USING btree (subject_id);
CREATE INDEX idx_teacher_performance_metrics_teacher_date ON public.teacher_performance_metrics USING btree (teacher_id, metric_date);
CREATE INDEX idx_teacher_performance_metrics_teacher_id ON public.teacher_performance_metrics USING btree (teacher_id);
CREATE INDEX idx_teacher_recognition_awarded_by ON public.teacher_recognition USING btree (awarded_by);
CREATE INDEX idx_teacher_recognition_teacher_id ON public.teacher_recognition USING btree (teacher_id);
CREATE INDEX idx_teacher_subject_specializations_school_teacher ON public.teacher_subject_specializations USING btree (school_id, teacher_profile_id);
CREATE INDEX idx_teacher_subject_specializations_subject_id ON public.teacher_subject_specializations USING btree (subject_id);
CREATE INDEX idx_teachers_profile_id ON public.teachers USING btree (profile_id);
CREATE INDEX idx_teachers_school_active ON public.teachers USING btree (school_id) WHERE (is_active = true);
CREATE INDEX idx_teachers_school_id ON public.teachers USING btree (school_id);
CREATE UNIQUE INDEX teachers_profile_unique ON public.teachers USING btree (profile_id) WHERE (profile_id IS NOT NULL);
CREATE INDEX idx_temp_tokens_lookup ON public.temp_tokens USING btree (user_id, expires_at DESC);
CREATE INDEX idx_terms_academic_year_id ON public.terms USING btree (academic_year_id);
CREATE INDEX idx_terms_school_id ON public.terms USING btree (school_id);
CREATE INDEX idx_user_sessions_school_id ON public.user_sessions USING btree (school_id);
CREATE INDEX idx_user_sessions_user_id ON public.user_sessions USING btree (user_id);

-- Section 9: Enable RLS (92 tables)
ALTER TABLE IF EXISTS public.academic_terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.academic_years ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.access_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.admin_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.admin_role_scopes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.alert_thresholds ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.announcement_seen ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.announcement_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.assignment_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.async_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.attendance FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.attendance_rollcall_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.behaviour_followups ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.behaviour_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.class_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.class_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.classroom_activity_stream ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.discipline_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.discipline_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.discipline_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.duty_roster ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.email_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.exam_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.exam_submission_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.exam_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.fee_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.fee_payments FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.fees ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.finance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.finances ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.grade_publish_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.gradebook_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.grading_scales ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.idempotency_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.lesson_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.markbook_columns ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.markbook_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.markbook_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.markbook_sheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.merit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.message_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.outbox_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.parent_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.parent_students FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.parents ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.parents FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.permission_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.permission_group_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.permission_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.permission_slip_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.permission_slips ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.profiles FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.question_bank ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.report_card_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.report_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.results ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.results FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.scheduled_broadcasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.school_departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.school_emergency_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.school_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.school_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.staff_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.staff_meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.student_fees ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.student_pulse_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.student_risk_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.students FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.sync_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.system_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.teacher_active_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.teacher_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.teacher_class_subject_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.teacher_office_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.teacher_performance_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.teacher_recognition ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.teacher_subject_specializations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.teachers FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.temp_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_sessions ENABLE ROW LEVEL SECURITY;

-- Section 10: RLS Policies (255 policies)
CREATE POLICY academic_terms_admin_manage ON public.academic_terms FOR ALL USING (((school_id = private.current_school_id()) AND (private."current_role"() = 'admin'::text))) WITH CHECK (((school_id = private.current_school_id()) AND (private."current_role"() = 'admin'::text)));
CREATE POLICY academic_terms_same_school_select ON public.academic_terms FOR SELECT USING ((school_id = private.current_school_id())) ;
CREATE POLICY academic_years_admin_manage ON public.academic_years FOR ALL USING (((school_id = get_my_school_id()) AND is_admin_role())) WITH CHECK (((school_id = get_my_school_id()) AND is_admin_role()));
CREATE POLICY academic_years_same_school_read ON public.academic_years FOR SELECT USING ((school_id = get_my_school_id())) ;
CREATE POLICY access_codes_super_admin_manage ON public.access_codes FOR ALL USING ((get_my_role() = 'super_admin'::text)) WITH CHECK ((get_my_role() = 'super_admin'::text));
CREATE POLICY activity_logs_admin_select ON public.activity_logs FOR SELECT USING (((school_id = private.current_school_id()) AND (private."current_role"() = 'admin'::text))) ;
CREATE POLICY activity_logs_no_direct_write ON public.activity_logs FOR ALL USING (false) WITH CHECK (false);
CREATE POLICY admin_actions_admin_insert ON public.admin_actions FOR INSERT WITH CHECK (((school_id = get_my_school_id()) AND is_admin_role()));
CREATE POLICY admin_actions_admin_select ON public.admin_actions FOR SELECT USING (((school_id = get_my_school_id()) AND is_admin_role())) ;
CREATE POLICY admin_actions_admin_update ON public.admin_actions FOR UPDATE USING (((school_id = get_my_school_id()) AND is_admin_role())) WITH CHECK (((school_id = get_my_school_id()) AND is_admin_role()));
CREATE POLICY admin_role_scopes_admin_manage ON public.admin_role_scopes FOR ALL USING (((school_id = get_my_school_id()) AND is_admin_role())) WITH CHECK (((school_id = get_my_school_id()) AND is_admin_role()));
CREATE POLICY admin_role_scopes_admin_select ON public.admin_role_scopes FOR SELECT USING (((school_id = get_my_school_id()) AND is_admin_role())) ;
CREATE POLICY alert_thresholds_admin_manage ON public.alert_thresholds FOR ALL USING (((school_id = get_my_school_id()) AND is_admin_role())) WITH CHECK (((school_id = get_my_school_id()) AND is_admin_role()));
CREATE POLICY alert_thresholds_admin_select ON public.alert_thresholds FOR SELECT USING (((school_id = get_my_school_id()) AND is_admin_role())) ;
CREATE POLICY announcement_seen_insert_self ON public.announcement_seen FOR INSERT WITH CHECK ((profile_id = ( SELECT auth.uid() AS uid)));
CREATE POLICY announcement_seen_select_self ON public.announcement_seen FOR SELECT USING ((profile_id = ( SELECT private.current_user_id() AS current_user_id))) ;
CREATE POLICY "Users can insert their own announcement_views" ON public.announcement_views FOR INSERT WITH CHECK ((viewer_id = ( SELECT auth.uid() AS uid)));
CREATE POLICY "Users can view announcement_views of their announcements" ON public.announcement_views FOR SELECT USING ((EXISTS ( SELECT 1
   FROM announcements a
  WHERE ((a.id = announcement_views.announcement_id) AND (a.created_by = ( SELECT auth.uid() AS uid)))))) ;
CREATE POLICY announcements_admin_manage ON public.announcements FOR ALL USING (((school_id = get_my_school_id()) AND is_admin_role())) WITH CHECK (((school_id = get_my_school_id()) AND is_admin_role()));
CREATE POLICY assignment_submissions_admin_delete ON public.assignment_submissions FOR DELETE USING (((school_id = get_my_school_id()) AND is_admin_role())) ;
CREATE POLICY assignment_submissions_select_accessible ON public.assignment_submissions FOR SELECT USING (((school_id = get_my_school_id()) AND (is_admin_role() OR (private.is_student() AND (student_profile_id = private.current_student_row_id())) OR (private.is_parent() AND (student_profile_id IN ( SELECT ps.student_id
   FROM (parent_students ps
     JOIN parents p ON ((p.id = ps.parent_id)))
  WHERE (p.profile_id = ( SELECT auth.uid() AS uid))))) OR (private.is_teacher() AND (assignment_id IN ( SELECT a.id
   FROM assignments a
  WHERE (a.class_id = ANY (private.accessible_class_ids())))))))) ;
CREATE POLICY assignment_submissions_student_insert ON public.assignment_submissions FOR INSERT WITH CHECK (((school_id = get_my_school_id()) AND private.is_student() AND (student_profile_id = private.current_student_row_id())));
CREATE POLICY assignment_submissions_teacher_or_admin_update ON public.assignment_submissions FOR UPDATE USING (((school_id = get_my_school_id()) AND (is_admin_role() OR private.is_teacher()))) WITH CHECK (((school_id = get_my_school_id()) AND (is_admin_role() OR private.is_teacher())));
CREATE POLICY assignments_select_accessible ON public.assignments FOR SELECT USING (((school_id = get_my_school_id()) AND (is_admin_role() OR (class_id = ANY (private.accessible_class_ids()))))) ;
CREATE POLICY assignments_teacher_or_admin_delete ON public.assignments FOR DELETE USING (((school_id = get_my_school_id()) AND (is_admin_role() OR (private.is_teacher() AND private.teacher_can_manage_class_subject(class_id, subject_id))))) ;
CREATE POLICY assignments_teacher_or_admin_insert ON public.assignments FOR INSERT WITH CHECK (((school_id = get_my_school_id()) AND (is_admin_role() OR (private.is_teacher() AND private.teacher_can_manage_class_subject(class_id, subject_id)))));
CREATE POLICY assignments_teacher_or_admin_update ON public.assignments FOR UPDATE USING (((school_id = get_my_school_id()) AND (is_admin_role() OR (private.is_teacher() AND private.teacher_can_manage_class_subject(class_id, subject_id))))) WITH CHECK (((school_id = get_my_school_id()) AND (is_admin_role() OR (private.is_teacher() AND private.teacher_can_manage_class_subject(class_id, subject_id)))));
CREATE POLICY async_jobs_admin_insert ON public.async_jobs FOR INSERT WITH CHECK (((school_id = private.current_school_id()) AND (private."current_role"() = 'admin'::text)));
CREATE POLICY async_jobs_admin_select ON public.async_jobs FOR SELECT USING (((school_id = private.current_school_id()) AND (private."current_role"() = 'admin'::text))) ;
CREATE POLICY async_jobs_admin_update ON public.async_jobs FOR UPDATE USING (((school_id = private.current_school_id()) AND (private."current_role"() = 'admin'::text))) WITH CHECK (((school_id = private.current_school_id()) AND (private."current_role"() = 'admin'::text)));
CREATE POLICY attendance_select_accessible ON public.attendance FOR SELECT USING (((school_id = get_my_school_id()) AND (is_admin_role() OR (class_id = ANY (private.accessible_class_ids())) OR (student_id = ANY (private.accessible_student_ids()))))) ;
CREATE POLICY attendance_teacher_or_admin_delete ON public.attendance FOR DELETE USING (((school_id = get_my_school_id()) AND (is_admin_role() OR (private.is_teacher() AND private.teacher_can_manage_class(class_id))))) ;
CREATE POLICY attendance_teacher_or_admin_insert ON public.attendance FOR INSERT WITH CHECK (((school_id = get_my_school_id()) AND (is_admin_role() OR (private.is_teacher() AND private.teacher_can_manage_class(class_id)))));
CREATE POLICY attendance_teacher_or_admin_update ON public.attendance FOR UPDATE USING (((school_id = get_my_school_id()) AND (is_admin_role() OR (private.is_teacher() AND private.teacher_can_manage_class(class_id))))) WITH CHECK (((school_id = get_my_school_id()) AND (is_admin_role() OR (private.is_teacher() AND private.teacher_can_manage_class(class_id)))));
CREATE POLICY attendance_rollcall_sessions_admin_delete ON public.attendance_rollcall_sessions FOR DELETE USING (((school_id = get_my_school_id()) AND is_admin_role())) ;
CREATE POLICY attendance_rollcall_sessions_select_accessible ON public.attendance_rollcall_sessions FOR SELECT USING (((school_id = get_my_school_id()) AND (is_admin_role() OR (private.is_teacher() AND (class_id = ANY (private.accessible_class_ids())))))) ;
CREATE POLICY attendance_rollcall_sessions_teacher_or_admin_insert ON public.attendance_rollcall_sessions FOR INSERT WITH CHECK (((school_id = get_my_school_id()) AND (is_admin_role() OR (private.is_teacher() AND private.teacher_can_manage_class(class_id)))));
CREATE POLICY attendance_rollcall_sessions_teacher_or_admin_update ON public.attendance_rollcall_sessions FOR UPDATE USING (((school_id = get_my_school_id()) AND (is_admin_role() OR (private.is_teacher() AND private.teacher_can_manage_class(class_id))))) WITH CHECK (((school_id = get_my_school_id()) AND (is_admin_role() OR (private.is_teacher() AND private.teacher_can_manage_class(class_id)))));
CREATE POLICY audit_logs_admin_read ON public.audit_logs FOR SELECT USING (((school_id = get_my_school_id()) AND (lower(get_my_role()) = ANY (ARRAY['admin'::text, 'principal'::text, 'super_admin'::text])))) ;
CREATE POLICY audit_logs_service_insert ON public.audit_logs FOR INSERT WITH CHECK ((school_id = get_my_school_id()));
CREATE POLICY behaviour_followups_admin_delete ON public.behaviour_followups FOR DELETE USING (((school_id = get_my_school_id()) AND is_admin_role())) ;
CREATE POLICY behaviour_followups_staff_insert ON public.behaviour_followups FOR INSERT WITH CHECK (((school_id = get_my_school_id()) AND (is_admin_role() OR private.is_teacher())));
CREATE POLICY behaviour_followups_staff_or_admin_update ON public.behaviour_followups FOR UPDATE USING (((school_id = get_my_school_id()) AND (is_admin_role() OR (private.is_teacher() AND ((assigned_to = ( SELECT auth.uid() AS uid)) OR (created_by = ( SELECT auth.uid() AS uid))))))) WITH CHECK (((school_id = get_my_school_id()) AND (is_admin_role() OR (private.is_teacher() AND ((assigned_to = ( SELECT auth.uid() AS uid)) OR (created_by = ( SELECT auth.uid() AS uid)))))));
CREATE POLICY behaviour_followups_staff_read ON public.behaviour_followups FOR SELECT USING (((school_id = get_my_school_id()) AND (is_admin_role() OR (private.is_teacher() AND ((assigned_to = ( SELECT auth.uid() AS uid)) OR (created_by = ( SELECT auth.uid() AS uid))))))) ;
CREATE POLICY behaviour_logs_admin_delete ON public.behaviour_logs FOR DELETE USING (((school_id = get_my_school_id()) AND is_admin_role())) ;
CREATE POLICY behaviour_logs_admin_update ON public.behaviour_logs FOR UPDATE USING (((school_id = get_my_school_id()) AND is_admin_role())) WITH CHECK (((school_id = get_my_school_id()) AND is_admin_role()));
CREATE POLICY behaviour_logs_parent_own ON public.behaviour_logs FOR SELECT USING (((school_id = get_my_school_id()) AND private.is_parent() AND private.parent_can_access_student(student_id))) ;
CREATE POLICY behaviour_logs_staff_insert ON public.behaviour_logs FOR INSERT WITH CHECK (((school_id = get_my_school_id()) AND (is_admin_role() OR private.is_teacher())));
CREATE POLICY behaviour_logs_staff_read ON public.behaviour_logs FOR SELECT USING (((school_id = get_my_school_id()) AND (is_admin_role() OR (private.is_teacher() AND (student_id = ANY (private.accessible_student_ids())))))) ;
CREATE POLICY behaviour_logs_student_own ON public.behaviour_logs FOR SELECT USING (((school_id = get_my_school_id()) AND private.is_student() AND (student_id = private.current_student_row_id()))) ;
CREATE POLICY class_insights_admin_manage ON public.class_insights FOR ALL USING (((school_id = get_my_school_id()) AND is_admin_role())) WITH CHECK (((school_id = get_my_school_id()) AND is_admin_role()));
CREATE POLICY class_insights_select_accessible ON public.class_insights FOR SELECT USING (((school_id = get_my_school_id()) AND (is_admin_role() OR (private.is_teacher() AND (class_id = ANY (private.accessible_class_ids())))))) ;
CREATE POLICY class_subjects_admin_delete ON public.class_subjects FOR DELETE USING ((( SELECT private.is_admin() AS is_admin) AND (EXISTS ( SELECT 1
   FROM classes c
  WHERE ((c.id = class_subjects.class_id) AND (c.school_id = ( SELECT private.current_school_id() AS current_school_id))))))) ;
CREATE POLICY class_subjects_admin_insert ON public.class_subjects FOR INSERT WITH CHECK ((( SELECT private.is_admin() AS is_admin) AND (EXISTS ( SELECT 1
   FROM classes c
  WHERE ((c.id = class_subjects.class_id) AND (c.school_id = ( SELECT private.current_school_id() AS current_school_id)))))));
CREATE POLICY class_subjects_admin_update ON public.class_subjects FOR UPDATE USING ((( SELECT private.is_admin() AS is_admin) AND (EXISTS ( SELECT 1
   FROM classes c
  WHERE ((c.id = class_subjects.class_id) AND (c.school_id = ( SELECT private.current_school_id() AS current_school_id))))))) WITH CHECK ((( SELECT private.is_admin() AS is_admin) AND (EXISTS ( SELECT 1
   FROM classes c
  WHERE ((c.id = class_subjects.class_id) AND (c.school_id = ( SELECT private.current_school_id() AS current_school_id)))))));
CREATE POLICY class_subjects_select_same_school ON public.class_subjects FOR SELECT USING ((EXISTS ( SELECT 1
   FROM classes c
  WHERE ((c.id = class_subjects.class_id) AND (c.school_id = ( SELECT private.current_school_id() AS current_school_id)))))) ;
CREATE POLICY classes_admin_delete ON public.classes FOR DELETE USING (((school_id = get_my_school_id()) AND is_admin_role())) ;
CREATE POLICY classes_admin_insert ON public.classes FOR INSERT WITH CHECK (((school_id = get_my_school_id()) AND is_admin_role()));
CREATE POLICY classes_admin_update ON public.classes FOR UPDATE USING (((school_id = get_my_school_id()) AND is_admin_role())) WITH CHECK (((school_id = get_my_school_id()) AND is_admin_role()));
CREATE POLICY classes_select_accessible ON public.classes FOR SELECT USING (((school_id = get_my_school_id()) AND (is_admin_role() OR (id = ANY (private.accessible_class_ids()))))) ;
CREATE POLICY classroom_activity_stream_select_accessible ON public.classroom_activity_stream FOR SELECT USING (((school_id = get_my_school_id()) AND (is_admin_role() OR (private.is_teacher() AND (class_id = ANY (private.accessible_class_ids()))) OR (private.is_student() AND (class_id IN ( SELECT s.class_id
   FROM students s
  WHERE (s.profile_id = ( SELECT auth.uid() AS uid)))))))) ;
CREATE POLICY classroom_activity_stream_teacher_or_admin_delete ON public.classroom_activity_stream FOR DELETE USING (((school_id = get_my_school_id()) AND (is_admin_role() OR (private.is_teacher() AND (teacher_id = private.current_teacher_row_id()))))) ;
CREATE POLICY classroom_activity_stream_teacher_or_admin_insert ON public.classroom_activity_stream FOR INSERT WITH CHECK (((school_id = get_my_school_id()) AND (is_admin_role() OR (private.is_teacher() AND (teacher_id = private.current_teacher_row_id())))));
CREATE POLICY classroom_activity_stream_teacher_or_admin_update ON public.classroom_activity_stream FOR UPDATE USING (((school_id = get_my_school_id()) AND (is_admin_role() OR (private.is_teacher() AND (teacher_id = private.current_teacher_row_id()))))) WITH CHECK (((school_id = get_my_school_id()) AND (is_admin_role() OR (private.is_teacher() AND (teacher_id = private.current_teacher_row_id())))));
CREATE POLICY discipline_actions_record_access ON public.discipline_actions FOR SELECT USING (((school_id = get_my_school_id()) AND (record_id IN ( SELECT discipline_records.id
   FROM discipline_records
  WHERE (discipline_records.school_id = get_my_school_id()))))) ;
CREATE POLICY discipline_actions_school_access ON public.discipline_actions FOR ALL USING (((school_id = get_my_school_id()) AND is_admin_role())) WITH CHECK (((school_id = get_my_school_id()) AND is_admin_role()));
CREATE POLICY discipline_categories_school_access ON public.discipline_categories FOR ALL USING (((school_id = get_my_school_id()) AND is_admin_role())) WITH CHECK (((school_id = get_my_school_id()) AND is_admin_role()));
CREATE POLICY discipline_categories_staff_read ON public.discipline_categories FOR SELECT USING ((school_id = get_my_school_id())) ;
CREATE POLICY discipline_records_admin_all ON public.discipline_records FOR ALL USING (((school_id = get_my_school_id()) AND is_admin_role())) WITH CHECK (((school_id = get_my_school_id()) AND is_admin_role()));
CREATE POLICY discipline_records_parent_own ON public.discipline_records FOR SELECT USING (((school_id = get_my_school_id()) AND (student_id IN ( SELECT ps.student_id
   FROM (parent_students ps
     JOIN parents p ON ((p.id = ps.parent_id)))
  WHERE (p.profile_id = ( SELECT auth.uid() AS uid)))))) ;
CREATE POLICY discipline_records_student_own ON public.discipline_records FOR SELECT USING (((school_id = get_my_school_id()) AND (student_id = ANY (private.accessible_student_ids())))) ;
CREATE POLICY discipline_records_teacher_insert ON public.discipline_records FOR INSERT WITH CHECK (((school_id = get_my_school_id()) AND private.is_teacher() AND (class_id = ANY (private.accessible_class_ids()))));
CREATE POLICY discipline_records_teacher_read ON public.discipline_records FOR SELECT USING (((school_id = get_my_school_id()) AND private.is_teacher() AND (class_id = ANY (private.accessible_class_ids())))) ;
CREATE POLICY duty_roster_admin_manage ON public.duty_roster FOR ALL USING (((school_id = get_my_school_id()) AND is_admin_role())) WITH CHECK (((school_id = get_my_school_id()) AND is_admin_role()));
CREATE POLICY duty_roster_school_read ON public.duty_roster FOR SELECT USING (((school_id = get_my_school_id()) AND (is_admin_role() OR (private.is_teacher() AND (teacher_id = private.current_teacher_row_id()))))) ;
CREATE POLICY email_verifications_own_read ON public.email_verifications FOR SELECT USING ((user_id = ( SELECT auth.uid() AS uid))) ;
CREATE POLICY email_verifications_own_update ON public.email_verifications FOR UPDATE USING ((user_id = ( SELECT auth.uid() AS uid))) WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));
CREATE POLICY events_admin_manage ON public.events FOR ALL USING (((school_id = get_my_school_id()) AND is_admin_role())) WITH CHECK (((school_id = get_my_school_id()) AND is_admin_role()));
CREATE POLICY exam_questions_admin_teacher_all ON public.exam_questions FOR ALL USING (((school_id = ( SELECT private.current_school_id() AS current_school_id)) AND (( SELECT private.is_admin() AS is_admin) OR ( SELECT private.is_teacher() AS is_teacher)))) WITH CHECK (((school_id = ( SELECT private.current_school_id() AS current_school_id)) AND (( SELECT private.is_admin() AS is_admin) OR ( SELECT private.is_teacher() AS is_teacher))));
CREATE POLICY exam_submission_answers_admin_delete ON public.exam_submission_answers FOR DELETE USING ((EXISTS ( SELECT 1
   FROM exam_submissions es
  WHERE ((es.id = exam_submission_answers.submission_id) AND (es.school_id = get_my_school_id()) AND is_admin_role())))) ;
CREATE POLICY exam_submission_answers_select_via_submission ON public.exam_submission_answers FOR SELECT USING ((EXISTS ( SELECT 1
   FROM exam_submissions es
  WHERE ((es.id = exam_submission_answers.submission_id) AND (es.school_id = get_my_school_id()) AND (is_admin_role() OR (private.is_student() AND (es.student_id = private.current_student_row_id())) OR (private.is_parent() AND private.parent_can_access_student(es.student_id)) OR (private.is_teacher() AND (es.exam_id IN ( SELECT e.id
           FROM exams e
          WHERE (e.class_id = ANY (private.accessible_class_ids())))))))))) ;
CREATE POLICY exam_submission_answers_student_insert ON public.exam_submission_answers FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM exam_submissions es
  WHERE ((es.id = exam_submission_answers.submission_id) AND (es.school_id = get_my_school_id()) AND (es.student_id = private.current_student_row_id()) AND private.is_student()))));
CREATE POLICY exam_submission_answers_teacher_or_admin_update ON public.exam_submission_answers FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM exam_submissions es
  WHERE ((es.id = exam_submission_answers.submission_id) AND (es.school_id = get_my_school_id()) AND (is_admin_role() OR private.is_teacher()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM exam_submissions es
  WHERE ((es.id = exam_submission_answers.submission_id) AND (es.school_id = get_my_school_id()) AND (is_admin_role() OR private.is_teacher())))));
CREATE POLICY exam_submissions_admin_delete ON public.exam_submissions FOR DELETE USING (((school_id = get_my_school_id()) AND is_admin_role())) ;
CREATE POLICY exam_submissions_select_accessible ON public.exam_submissions FOR SELECT USING (((school_id = get_my_school_id()) AND (is_admin_role() OR (private.is_teacher() AND (exam_id IN ( SELECT e.id
   FROM exams e
  WHERE (e.class_id = ANY (private.accessible_class_ids()))))) OR (private.is_student() AND (student_id = private.current_student_row_id())) OR (private.is_parent() AND private.parent_can_access_student(student_id))))) ;
CREATE POLICY exam_submissions_student_insert ON public.exam_submissions FOR INSERT WITH CHECK (((school_id = get_my_school_id()) AND private.is_student() AND (student_id = private.current_student_row_id())));
CREATE POLICY exam_submissions_teacher_or_admin_update ON public.exam_submissions FOR UPDATE USING (((school_id = get_my_school_id()) AND (is_admin_role() OR private.is_teacher()))) WITH CHECK (((school_id = get_my_school_id()) AND (is_admin_role() OR private.is_teacher())));
CREATE POLICY exams_select_accessible ON public.exams FOR SELECT USING (((( SELECT private.is_admin() AS is_admin) AND (school_id = ( SELECT private.current_school_id() AS current_school_id))) OR (class_id = ANY (private.accessible_class_ids())))) ;
CREATE POLICY exams_teacher_or_admin_delete ON public.exams FOR DELETE USING (((school_id = ( SELECT private.current_school_id() AS current_school_id)) AND (( SELECT private.is_admin() AS is_admin) OR (( SELECT private.is_teacher() AS is_teacher) AND ( SELECT private.teacher_can_manage_class_subject(exams.class_id, exams.subject_id) AS teacher_can_manage_class_subject))))) ;
CREATE POLICY exams_teacher_or_admin_insert ON public.exams FOR INSERT WITH CHECK (((school_id = ( SELECT private.current_school_id() AS current_school_id)) AND (( SELECT private.is_admin() AS is_admin) OR (( SELECT private.is_teacher() AS is_teacher) AND ( SELECT private.teacher_can_manage_class_subject(exams.class_id, exams.subject_id) AS teacher_can_manage_class_subject)))));
CREATE POLICY exams_teacher_or_admin_update ON public.exams FOR UPDATE USING (((school_id = ( SELECT private.current_school_id() AS current_school_id)) AND (( SELECT private.is_admin() AS is_admin) OR (( SELECT private.is_teacher() AS is_teacher) AND ( SELECT private.teacher_can_manage_class_subject(exams.class_id, exams.subject_id) AS teacher_can_manage_class_subject))))) WITH CHECK (((school_id = ( SELECT private.current_school_id() AS current_school_id)) AND (( SELECT private.is_admin() AS is_admin) OR (( SELECT private.is_teacher() AS is_teacher) AND ( SELECT private.teacher_can_manage_class_subject(exams.class_id, exams.subject_id) AS teacher_can_manage_class_subject)))));
CREATE POLICY fee_payments_admin_update ON public.fee_payments FOR UPDATE USING ((( SELECT private.is_admin() AS is_admin) AND (school_id = ( SELECT private.current_school_id() AS current_school_id)))) WITH CHECK ((( SELECT private.is_admin() AS is_admin) AND (school_id = ( SELECT private.current_school_id() AS current_school_id))));
CREATE POLICY fee_payments_delete_financial_context ON public.fee_payments FOR DELETE USING (((school_id = get_my_school_id()) AND is_admin_role())) ;
CREATE POLICY fee_payments_insert_financial_context ON public.fee_payments FOR INSERT WITH CHECK (((school_id = get_my_school_id()) AND is_financial_context_role()));
CREATE POLICY fee_payments_read_financial_context ON public.fee_payments FOR SELECT USING (((school_id = get_my_school_id()) AND is_financial_context_role())) ;
CREATE POLICY fee_payments_select_accessible ON public.fee_payments FOR SELECT USING (((( SELECT private.is_admin() AS is_admin) AND (school_id = ( SELECT private.current_school_id() AS current_school_id))) OR (parent_id = ( SELECT private.current_parent_row_id() AS current_parent_row_id)) OR (student_id = ANY (private.accessible_student_ids())))) ;
CREATE POLICY fee_payments_update_financial_context ON public.fee_payments FOR UPDATE USING (((school_id = get_my_school_id()) AND is_financial_context_role())) WITH CHECK (((school_id = get_my_school_id()) AND is_financial_context_role()));
CREATE POLICY fees_delete_financial_context ON public.fees FOR DELETE USING (((school_id = get_my_school_id()) AND is_admin_role())) ;
CREATE POLICY fees_insert_financial_context ON public.fees FOR INSERT WITH CHECK (((school_id = get_my_school_id()) AND is_financial_context_role()));
CREATE POLICY fees_read_financial_context ON public.fees FOR SELECT USING (((school_id = get_my_school_id()) AND is_financial_context_role())) ;
CREATE POLICY fees_update_financial_context ON public.fees FOR UPDATE USING (((school_id = get_my_school_id()) AND is_financial_context_role())) WITH CHECK (((school_id = get_my_school_id()) AND is_financial_context_role()));
CREATE POLICY finance_records_delete_financial_context ON public.finance_records FOR DELETE USING (((school_id = get_my_school_id()) AND is_admin_role())) ;
CREATE POLICY finance_records_insert_financial_context ON public.finance_records FOR INSERT WITH CHECK (((school_id = get_my_school_id()) AND is_financial_context_role()));
CREATE POLICY finance_records_read_financial_context ON public.finance_records FOR SELECT USING (((school_id = get_my_school_id()) AND is_financial_context_role())) ;
CREATE POLICY finance_records_update_financial_context ON public.finance_records FOR UPDATE USING (((school_id = get_my_school_id()) AND is_financial_context_role())) WITH CHECK (((school_id = get_my_school_id()) AND is_financial_context_role()));
CREATE POLICY finances_delete_financial_context ON public.finances FOR DELETE USING (((school_id = get_my_school_id()) AND is_admin_role())) ;
CREATE POLICY finances_insert_financial_context ON public.finances FOR INSERT WITH CHECK (((school_id = get_my_school_id()) AND is_financial_context_role()));
CREATE POLICY finances_read_financial_context ON public.finances FOR SELECT USING (((school_id = get_my_school_id()) AND is_financial_context_role())) ;
CREATE POLICY finances_update_financial_context ON public.finances FOR UPDATE USING (((school_id = get_my_school_id()) AND is_financial_context_role())) WITH CHECK (((school_id = get_my_school_id()) AND is_financial_context_role()));
CREATE POLICY grade_publish_history_admin_delete ON public.grade_publish_history FOR DELETE USING (((school_id = get_my_school_id()) AND is_admin_role())) ;
CREATE POLICY grade_publish_history_select_accessible ON public.grade_publish_history FOR SELECT USING (((school_id = get_my_school_id()) AND (is_admin_role() OR (private.is_teacher() AND (class_id = ANY (private.accessible_class_ids())))))) ;
CREATE POLICY grade_publish_history_teacher_or_admin_insert ON public.grade_publish_history FOR INSERT WITH CHECK (((school_id = get_my_school_id()) AND (is_admin_role() OR private.is_teacher())));
CREATE POLICY gradebook_snapshots_admin_delete ON public.gradebook_snapshots FOR DELETE USING (((school_id = get_my_school_id()) AND is_admin_role())) ;
CREATE POLICY gradebook_snapshots_select_accessible ON public.gradebook_snapshots FOR SELECT USING (((school_id = get_my_school_id()) AND (is_admin_role() OR (private.is_teacher() AND (class_id = ANY (private.accessible_class_ids())))))) ;
CREATE POLICY gradebook_snapshots_teacher_or_admin_insert ON public.gradebook_snapshots FOR INSERT WITH CHECK (((school_id = get_my_school_id()) AND (is_admin_role() OR private.is_teacher())));
CREATE POLICY grades_admin_all ON public.grades FOR ALL USING (((school_id = get_my_school_id()) AND is_admin_role())) WITH CHECK (((school_id = get_my_school_id()) AND is_admin_role()));
CREATE POLICY grades_select_same_school ON public.grades FOR SELECT USING ((school_id = get_my_school_id())) ;
CREATE POLICY grading_scales_admin_manage ON public.grading_scales FOR ALL USING (((school_id = get_my_school_id()) AND is_admin_role())) WITH CHECK (((school_id = get_my_school_id()) AND is_admin_role()));
CREATE POLICY grading_scales_same_school_read ON public.grading_scales FOR SELECT USING ((school_id = get_my_school_id())) ;
CREATE POLICY idempotency_keys_no_access ON public.idempotency_keys FOR ALL USING (false) WITH CHECK (false);
CREATE POLICY lesson_plans_select_accessible ON public.lesson_plans FOR SELECT USING (((school_id = get_my_school_id()) AND (is_admin_role() OR (private.is_teacher() AND ((teacher_id = private.current_teacher_row_id()) OR (is_shared = true)))))) ;
CREATE POLICY lesson_plans_teacher_or_admin_delete ON public.lesson_plans FOR DELETE USING (((school_id = get_my_school_id()) AND (is_admin_role() OR (private.is_teacher() AND (teacher_id = private.current_teacher_row_id()))))) ;
CREATE POLICY lesson_plans_teacher_or_admin_insert ON public.lesson_plans FOR INSERT WITH CHECK (((school_id = get_my_school_id()) AND (is_admin_role() OR (private.is_teacher() AND (teacher_id = private.current_teacher_row_id())))));
CREATE POLICY lesson_plans_teacher_or_admin_update ON public.lesson_plans FOR UPDATE USING (((school_id = get_my_school_id()) AND (is_admin_role() OR (private.is_teacher() AND (teacher_id = private.current_teacher_row_id()))))) WITH CHECK (((school_id = get_my_school_id()) AND (is_admin_role() OR (private.is_teacher() AND (teacher_id = private.current_teacher_row_id())))));
CREATE POLICY lessons_admin_manage ON public.lessons FOR ALL USING (((school_id = get_my_school_id()) AND is_admin_role())) WITH CHECK (((school_id = get_my_school_id()) AND is_admin_role()));
CREATE POLICY lessons_same_school_read ON public.lessons FOR SELECT USING ((school_id = get_my_school_id())) ;
CREATE POLICY markbook_columns_select_accessible ON public.markbook_columns FOR SELECT USING (((school_id = get_my_school_id()) AND (is_admin_role() OR (private.is_teacher() AND ((class_id = ANY (private.accessible_class_ids())) OR ((sheet_id IS NOT NULL) AND (sheet_id IN ( SELECT ms.id
   FROM markbook_sheets ms
  WHERE (ms.class_id = ANY (private.accessible_class_ids())))))))))) ;
CREATE POLICY markbook_columns_teacher_or_admin_manage ON public.markbook_columns FOR ALL USING (((school_id = get_my_school_id()) AND (is_admin_role() OR (private.is_teacher() AND (class_id = ANY (private.accessible_class_ids())))))) WITH CHECK (((school_id = get_my_school_id()) AND (is_admin_role() OR (private.is_teacher() AND (class_id = ANY (private.accessible_class_ids()))))));
CREATE POLICY markbook_entries_select_accessible ON public.markbook_entries FOR SELECT USING (((school_id = get_my_school_id()) AND (is_admin_role() OR (private.is_teacher() AND (student_id = ANY (private.accessible_student_ids())))))) ;
CREATE POLICY markbook_entries_teacher_or_admin_manage ON public.markbook_entries FOR ALL USING (((school_id = get_my_school_id()) AND (is_admin_role() OR (private.is_teacher() AND (student_id = ANY (private.accessible_student_ids())))))) WITH CHECK (((school_id = get_my_school_id()) AND (is_admin_role() OR (private.is_teacher() AND (student_id = ANY (private.accessible_student_ids()))))));
CREATE POLICY markbook_scores_select_accessible ON public.markbook_scores FOR SELECT USING (((school_id = get_my_school_id()) AND (is_admin_role() OR (private.is_teacher() AND (student_profile_id = ANY (private.accessible_student_ids())))))) ;
CREATE POLICY markbook_scores_teacher_or_admin_manage ON public.markbook_scores FOR ALL USING (((school_id = get_my_school_id()) AND (is_admin_role() OR (private.is_teacher() AND (student_profile_id = ANY (private.accessible_student_ids())))))) WITH CHECK (((school_id = get_my_school_id()) AND (is_admin_role() OR (private.is_teacher() AND (student_profile_id = ANY (private.accessible_student_ids()))))));
CREATE POLICY markbook_sheets_select_accessible ON public.markbook_sheets FOR SELECT USING (((school_id = get_my_school_id()) AND (is_admin_role() OR (private.is_teacher() AND private.teacher_can_manage_class_subject(class_id, subject_id))))) ;
CREATE POLICY markbook_sheets_teacher_or_admin_manage ON public.markbook_sheets FOR ALL USING (((school_id = get_my_school_id()) AND (is_admin_role() OR (private.is_teacher() AND private.teacher_can_manage_class_subject(class_id, subject_id))))) WITH CHECK (((school_id = get_my_school_id()) AND (is_admin_role() OR (private.is_teacher() AND private.teacher_can_manage_class_subject(class_id, subject_id)))));
CREATE POLICY merit_logs_admin_delete ON public.merit_logs FOR DELETE USING (((school_id = get_my_school_id()) AND is_admin_role())) ;
CREATE POLICY merit_logs_parent_own ON public.merit_logs FOR SELECT USING (((school_id = get_my_school_id()) AND private.is_parent() AND private.parent_can_access_student(student_id))) ;
CREATE POLICY merit_logs_staff_insert ON public.merit_logs FOR INSERT WITH CHECK (((school_id = get_my_school_id()) AND (is_admin_role() OR private.is_teacher())));
CREATE POLICY merit_logs_staff_read ON public.merit_logs FOR SELECT USING (((school_id = get_my_school_id()) AND (is_admin_role() OR (private.is_teacher() AND (student_id = ANY (private.accessible_student_ids())))))) ;
CREATE POLICY merit_logs_student_own ON public.merit_logs FOR SELECT USING (((school_id = get_my_school_id()) AND private.is_student() AND (student_id = private.current_student_row_id()))) ;
CREATE POLICY "Teachers can create templates for their school" ON public.message_templates FOR INSERT WITH CHECK (((school_id IN ( SELECT profiles.school_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid)))) AND (created_by = ( SELECT auth.uid() AS uid))));
CREATE POLICY "Teachers can delete their own templates" ON public.message_templates FOR DELETE USING ((created_by = ( SELECT auth.uid() AS uid))) ;
CREATE POLICY "Teachers can update their own templates" ON public.message_templates FOR UPDATE USING ((created_by = ( SELECT auth.uid() AS uid))) WITH CHECK ((created_by = ( SELECT auth.uid() AS uid)));
CREATE POLICY "Teachers can view their school's templates" ON public.message_templates FOR SELECT USING ((school_id IN ( SELECT profiles.school_id
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid))))) ;
CREATE POLICY messages_admin_manage ON public.messages FOR ALL USING (((school_id = get_my_school_id()) AND is_admin_role())) WITH CHECK (((school_id = get_my_school_id()) AND is_admin_role()));
CREATE POLICY messages_own_insert ON public.messages FOR INSERT WITH CHECK (((school_id = get_my_school_id()) AND (sender_id = ( SELECT auth.uid() AS uid))));
CREATE POLICY messages_own_read ON public.messages FOR SELECT USING (((school_id = get_my_school_id()) AND ((sender_id = ( SELECT auth.uid() AS uid)) OR (recipient_id = ( SELECT auth.uid() AS uid))))) ;
CREATE POLICY messages_own_update ON public.messages FOR UPDATE USING (((school_id = get_my_school_id()) AND (recipient_id = ( SELECT auth.uid() AS uid)))) WITH CHECK (((school_id = get_my_school_id()) AND (recipient_id = ( SELECT auth.uid() AS uid))));
CREATE POLICY notifications_admin_manage ON public.notifications FOR ALL USING (((school_id = get_my_school_id()) AND is_admin_role())) WITH CHECK (((school_id = get_my_school_id()) AND is_admin_role()));
CREATE POLICY notifications_own_read ON public.notifications FOR SELECT USING ((user_id = ( SELECT auth.uid() AS uid))) ;
CREATE POLICY notifications_own_update ON public.notifications FOR UPDATE USING ((user_id = ( SELECT auth.uid() AS uid))) WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));
CREATE POLICY outbox_events_admin_select ON public.outbox_events FOR SELECT USING (((school_id = private.current_school_id()) AND (private."current_role"() = 'admin'::text))) ;
CREATE POLICY outbox_events_no_access ON public.outbox_events FOR ALL USING (false) WITH CHECK (false);
CREATE POLICY parent_students_admin_manage ON public.parent_students FOR ALL USING (((school_id = get_my_school_id()) AND is_admin_role())) WITH CHECK (((school_id = get_my_school_id()) AND is_admin_role()));
CREATE POLICY parents_admin_manage ON public.parents FOR ALL USING (((school_id = get_my_school_id()) AND is_admin_role())) WITH CHECK (((school_id = get_my_school_id()) AND is_admin_role()));
CREATE POLICY payments_delete_financial_context ON public.payments FOR DELETE USING (((school_id = get_my_school_id()) AND is_admin_role())) ;
CREATE POLICY payments_insert_financial_context ON public.payments FOR INSERT WITH CHECK (((school_id = get_my_school_id()) AND is_financial_context_role()));
CREATE POLICY payments_read_financial_context ON public.payments FOR SELECT USING (((school_id = get_my_school_id()) AND is_financial_context_role())) ;
CREATE POLICY payments_update_financial_context ON public.payments FOR UPDATE USING (((school_id = get_my_school_id()) AND is_financial_context_role())) WITH CHECK (((school_id = get_my_school_id()) AND is_financial_context_role()));
CREATE POLICY permission_features_school_access ON public.permission_features FOR ALL USING (((school_id = get_my_school_id()) AND is_admin_role())) WITH CHECK (((school_id = get_my_school_id()) AND is_admin_role()));
CREATE POLICY permission_features_staff_read ON public.permission_features FOR SELECT USING ((school_id = get_my_school_id())) ;
CREATE POLICY permission_group_roles_school_access ON public.permission_group_roles FOR ALL USING (((school_id = get_my_school_id()) AND is_admin_role())) WITH CHECK (((school_id = get_my_school_id()) AND is_admin_role()));
CREATE POLICY permission_group_roles_staff_read ON public.permission_group_roles FOR SELECT USING ((school_id = get_my_school_id())) ;
CREATE POLICY permission_groups_school_access ON public.permission_groups FOR ALL USING (((school_id = get_my_school_id()) AND is_admin_role())) WITH CHECK (((school_id = get_my_school_id()) AND is_admin_role()));
CREATE POLICY permission_groups_staff_read ON public.permission_groups FOR SELECT USING ((school_id = get_my_school_id())) ;
CREATE POLICY permission_slip_responses_admin_delete ON public.permission_slip_responses FOR DELETE USING (is_admin_role()) ;
CREATE POLICY permission_slip_responses_parent_insert ON public.permission_slip_responses FOR INSERT WITH CHECK ((private.is_parent() AND (parent_id = private.current_parent_row_id()) AND private.parent_can_access_student(student_id)));
CREATE POLICY permission_slip_responses_parent_update ON public.permission_slip_responses FOR UPDATE USING ((private.is_parent() AND (parent_id = private.current_parent_row_id()))) WITH CHECK ((private.is_parent() AND (parent_id = private.current_parent_row_id())));
CREATE POLICY permission_slip_responses_select_accessible ON public.permission_slip_responses FOR SELECT USING (((EXISTS ( SELECT 1
   FROM permission_slips ps
  WHERE ((ps.id = permission_slip_responses.permission_slip_id) AND (ps.school_id = get_my_school_id())))) AND (is_admin_role() OR private.is_teacher() OR (private.is_parent() AND (parent_id = private.current_parent_row_id()))))) ;
CREATE POLICY permission_slips_select_accessible ON public.permission_slips FOR SELECT USING (((school_id = get_my_school_id()) AND (is_admin_role() OR private.is_teacher() OR private.is_parent() OR private.is_student()))) ;
CREATE POLICY permission_slips_staff_manage ON public.permission_slips FOR ALL USING (((school_id = get_my_school_id()) AND (is_admin_role() OR private.is_teacher()))) WITH CHECK (((school_id = get_my_school_id()) AND (is_admin_role() OR private.is_teacher())));
CREATE POLICY profiles_admin_delete ON public.profiles FOR DELETE USING (((school_id = get_my_school_id()) AND is_admin_role())) ;
CREATE POLICY profiles_admin_insert ON public.profiles FOR INSERT WITH CHECK (((school_id = get_my_school_id()) AND is_admin_role()));
CREATE POLICY profiles_admin_update ON public.profiles FOR UPDATE USING (((school_id = get_my_school_id()) AND is_admin_role())) WITH CHECK (((school_id = get_my_school_id()) AND is_admin_role()));
CREATE POLICY profiles_select_own_or_admin ON public.profiles FOR SELECT USING (((id = ( SELECT auth.uid() AS uid)) OR (auth_user_id = ( SELECT auth.uid() AS uid)) OR ((school_id = get_my_school_id()) AND is_admin_role()))) ;
CREATE POLICY question_bank_select_same_school ON public.question_bank FOR SELECT USING (((school_id = get_my_school_id()) AND (is_admin_role() OR private.is_teacher()))) ;
CREATE POLICY question_bank_teacher_or_admin_manage ON public.question_bank FOR ALL USING (((school_id = get_my_school_id()) AND (is_admin_role() OR (private.is_teacher() AND (created_by = ( SELECT auth.uid() AS uid)))))) WITH CHECK (((school_id = get_my_school_id()) AND (is_admin_role() OR (private.is_teacher() AND (created_by = ( SELECT auth.uid() AS uid))))));
CREATE POLICY report_card_reviews_admin_delete ON public.report_card_reviews FOR DELETE USING (((school_id = get_my_school_id()) AND is_admin_role())) ;
CREATE POLICY report_card_reviews_select_accessible ON public.report_card_reviews FOR SELECT USING (((school_id = get_my_school_id()) AND (is_admin_role() OR (private.is_teacher() AND (class_id = ANY (private.accessible_class_ids()))) OR (private.is_parent() AND private.parent_can_access_student(student_id)) OR (private.is_student() AND (student_id = private.current_student_row_id()))))) ;
CREATE POLICY report_card_reviews_teacher_or_admin_insert ON public.report_card_reviews FOR INSERT WITH CHECK (((school_id = get_my_school_id()) AND (is_admin_role() OR (private.is_teacher() AND (class_id = ANY (private.accessible_class_ids()))))));
CREATE POLICY report_card_reviews_teacher_or_admin_update ON public.report_card_reviews FOR UPDATE USING (((school_id = get_my_school_id()) AND (is_admin_role() OR (private.is_teacher() AND (class_id = ANY (private.accessible_class_ids()))) OR (private.is_parent() AND private.parent_can_access_student(student_id)) OR (private.is_student() AND (student_id = private.current_student_row_id()))))) WITH CHECK (((school_id = get_my_school_id()) AND (is_admin_role() OR (private.is_teacher() AND (class_id = ANY (private.accessible_class_ids()))) OR (private.is_parent() AND private.parent_can_access_student(student_id)) OR (private.is_student() AND (student_id = private.current_student_row_id())))));
CREATE POLICY report_cards_admin_manage ON public.report_cards FOR ALL USING (((school_id = get_my_school_id()) AND is_admin_role())) WITH CHECK (((school_id = get_my_school_id()) AND is_admin_role()));
CREATE POLICY report_cards_select_accessible ON public.report_cards FOR SELECT USING (((school_id = get_my_school_id()) AND (is_admin_role() OR (private.is_teacher() AND (student_id = ANY (private.accessible_student_ids()))) OR (private.is_parent() AND private.parent_can_access_student(student_id) AND (published = true)) OR (private.is_student() AND (student_id = private.current_student_row_id()) AND (published = true))))) ;
CREATE POLICY results_admin_manage ON public.results FOR ALL USING (((school_id = get_my_school_id()) AND is_admin_role())) WITH CHECK (((school_id = get_my_school_id()) AND is_admin_role()));
CREATE POLICY role_permissions_admin_manage ON public.role_permissions FOR ALL USING (((school_id = get_my_school_id()) AND is_admin_role())) WITH CHECK (((school_id = get_my_school_id()) AND is_admin_role()));
CREATE POLICY role_permissions_admin_select ON public.role_permissions FOR SELECT USING (((school_id = get_my_school_id()) AND is_admin_role())) ;
CREATE POLICY scheduled_broadcasts_admin_manage ON public.scheduled_broadcasts FOR ALL USING (((school_id = get_my_school_id()) AND is_admin_role())) WITH CHECK (((school_id = get_my_school_id()) AND is_admin_role()));
CREATE POLICY scheduled_broadcasts_admin_select ON public.scheduled_broadcasts FOR SELECT USING (((school_id = get_my_school_id()) AND is_admin_role())) ;
CREATE POLICY school_departments_school_access ON public.school_departments FOR ALL USING (((school_id = get_my_school_id()) AND is_admin_role())) WITH CHECK (((school_id = get_my_school_id()) AND is_admin_role()));
CREATE POLICY school_departments_staff_read ON public.school_departments FOR SELECT USING ((school_id = get_my_school_id())) ;
CREATE POLICY school_emergency_state_admin_manage ON public.school_emergency_state FOR ALL USING (((school_id = get_my_school_id()) AND is_admin_role())) WITH CHECK (((school_id = get_my_school_id()) AND is_admin_role()));
CREATE POLICY school_emergency_state_school_read ON public.school_emergency_state FOR SELECT USING ((school_id = get_my_school_id())) ;
CREATE POLICY school_invites_admin_manage ON public.school_invites FOR ALL USING (((get_my_role() = 'super_admin'::text) OR ((created_by = ( SELECT auth.uid() AS uid)) AND is_admin_role()))) WITH CHECK (((get_my_role() = 'super_admin'::text) OR is_admin_role()));
CREATE POLICY school_settings_school_access ON public.school_settings FOR ALL USING (((school_id = get_my_school_id()) AND is_admin_role())) WITH CHECK (((school_id = get_my_school_id()) AND is_admin_role()));
CREATE POLICY school_settings_staff_read ON public.school_settings FOR SELECT USING ((school_id = get_my_school_id())) ;
CREATE POLICY schools_admin_update ON public.schools FOR UPDATE USING (((id = get_my_school_id()) AND is_admin_role())) WITH CHECK (((id = get_my_school_id()) AND is_admin_role()));
CREATE POLICY schools_same_school_read ON public.schools FOR SELECT USING ((id = get_my_school_id())) ;
CREATE POLICY staff_invitations_delete_manage ON public.staff_invitations FOR DELETE USING (((school_id = ( SELECT profiles.school_id
   FROM profiles
  WHERE (profiles.id = get_my_profile_id()))) AND can_manage_invitations() AND (status = 'pending'::text))) ;
CREATE POLICY staff_invitations_insert_manage ON public.staff_invitations FOR INSERT WITH CHECK (((school_id = ( SELECT profiles.school_id
   FROM profiles
  WHERE (profiles.id = get_my_profile_id()))) AND can_manage_invitations()));
CREATE POLICY staff_invitations_select_own_school ON public.staff_invitations FOR SELECT USING ((school_id = ( SELECT profiles.school_id
   FROM profiles
  WHERE (profiles.id = get_my_profile_id())))) ;
CREATE POLICY staff_invitations_update_manage ON public.staff_invitations FOR UPDATE USING (((school_id = ( SELECT profiles.school_id
   FROM profiles
  WHERE (profiles.id = get_my_profile_id()))) AND can_manage_invitations() AND (status = 'pending'::text))) WITH CHECK (((school_id = ( SELECT profiles.school_id
   FROM profiles
  WHERE (profiles.id = get_my_profile_id()))) AND can_manage_invitations() AND (status = 'pending'::text)));
CREATE POLICY staff_meetings_admin_manage ON public.staff_meetings FOR ALL USING (((school_id = get_my_school_id()) AND is_admin_role())) WITH CHECK (((school_id = get_my_school_id()) AND is_admin_role()));
CREATE POLICY staff_meetings_school_read ON public.staff_meetings FOR SELECT USING ((school_id = get_my_school_id())) ;
CREATE POLICY admin_bursar_manage_fees ON public.student_fees FOR ALL USING ((( SELECT profiles.role
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid))) = ANY (ARRAY['admin'::text, 'bursar'::text, 'head_teacher'::text, 'super_admin'::text]))) WITH CHECK ((( SELECT profiles.role
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid))) = ANY (ARRAY['admin'::text, 'bursar'::text, 'head_teacher'::text, 'super_admin'::text])));
CREATE POLICY parents_read_children_fees ON public.student_fees FOR SELECT USING ((student_id IN ( SELECT ps.student_id
   FROM (parent_students ps
     JOIN parents p ON ((ps.parent_id = p.id)))
  WHERE (p.profile_id = ( SELECT auth.uid() AS uid))))) ;
CREATE POLICY student_fees_delete_financial_context ON public.student_fees FOR DELETE USING (((school_id = get_my_school_id()) AND is_admin_role())) ;
CREATE POLICY student_fees_insert_financial_context ON public.student_fees FOR INSERT WITH CHECK (((school_id = get_my_school_id()) AND is_financial_context_role()));
CREATE POLICY student_fees_read_financial_context ON public.student_fees FOR SELECT USING (((school_id = get_my_school_id()) AND is_financial_context_role())) ;
CREATE POLICY student_fees_update_financial_context ON public.student_fees FOR UPDATE USING (((school_id = get_my_school_id()) AND is_financial_context_role())) WITH CHECK (((school_id = get_my_school_id()) AND is_financial_context_role()));
CREATE POLICY student_pulse_metrics_admin_manage ON public.student_pulse_metrics FOR ALL USING (((school_id = get_my_school_id()) AND is_admin_role())) WITH CHECK (((school_id = get_my_school_id()) AND is_admin_role()));
CREATE POLICY student_pulse_metrics_select_accessible ON public.student_pulse_metrics FOR SELECT USING (((school_id = get_my_school_id()) AND (is_admin_role() OR (private.is_teacher() AND (class_id = ANY (private.accessible_class_ids()))) OR (private.is_parent() AND private.parent_can_access_student(student_id)) OR (private.is_student() AND (student_id = private.current_student_row_id()))))) ;
CREATE POLICY student_risk_assessments_admin_delete ON public.student_risk_assessments FOR DELETE USING (((school_id = get_my_school_id()) AND is_admin_role())) ;
CREATE POLICY student_risk_assessments_select_accessible ON public.student_risk_assessments FOR SELECT USING (((school_id = get_my_school_id()) AND (is_admin_role() OR (private.is_teacher() AND (class_id = ANY (private.accessible_class_ids()))) OR (private.is_parent() AND private.parent_can_access_student(student_id))))) ;
CREATE POLICY student_risk_assessments_teacher_or_admin_insert ON public.student_risk_assessments FOR INSERT WITH CHECK (((school_id = get_my_school_id()) AND (is_admin_role() OR (private.is_teacher() AND (class_id = ANY (private.accessible_class_ids()))))));
CREATE POLICY student_risk_assessments_teacher_or_admin_update ON public.student_risk_assessments FOR UPDATE USING (((school_id = get_my_school_id()) AND (is_admin_role() OR (private.is_teacher() AND (class_id = ANY (private.accessible_class_ids())))))) WITH CHECK (((school_id = get_my_school_id()) AND (is_admin_role() OR (private.is_teacher() AND (class_id = ANY (private.accessible_class_ids()))))));
CREATE POLICY parents_read_their_children ON public.students FOR SELECT USING ((id IN ( SELECT ps.student_id
   FROM (parent_students ps
     JOIN parents p ON ((ps.parent_id = p.id)))
  WHERE (p.profile_id = ( SELECT auth.uid() AS uid))))) ;
CREATE POLICY staff_read_students ON public.students FOR SELECT USING ((( SELECT profiles.role
   FROM profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid))) = ANY (ARRAY['teacher'::text, 'admin'::text, 'head_teacher'::text, 'super_admin'::text]))) ;
CREATE POLICY students_admin_delete ON public.students FOR DELETE USING (((school_id = get_my_school_id()) AND is_admin_role())) ;
CREATE POLICY students_admin_insert ON public.students FOR INSERT WITH CHECK (((school_id = get_my_school_id()) AND is_admin_role()));
CREATE POLICY students_admin_update ON public.students FOR UPDATE USING (((school_id = get_my_school_id()) AND is_admin_role())) WITH CHECK (((school_id = get_my_school_id()) AND is_admin_role()));
CREATE POLICY students_read_own_record ON public.students FOR SELECT USING ((profile_id = ( SELECT auth.uid() AS uid))) ;
CREATE POLICY students_select_accessible ON public.students FOR SELECT USING (((is_admin_role() AND (school_id = get_my_school_id())) OR ((school_id = get_my_school_id()) AND (id = ANY (private.accessible_student_ids()))))) ;
CREATE POLICY subjects_admin_manage ON public.subjects FOR ALL USING (((school_id = get_my_school_id()) AND is_admin_role())) WITH CHECK (((school_id = get_my_school_id()) AND is_admin_role()));
CREATE POLICY subjects_same_school_read ON public.subjects FOR SELECT USING ((school_id = get_my_school_id())) ;
CREATE POLICY sync_queue_admin_delete ON public.sync_queue FOR DELETE USING (((school_id = get_my_school_id()) AND is_admin_role())) ;
CREATE POLICY sync_queue_own_insert ON public.sync_queue FOR INSERT WITH CHECK (((school_id = get_my_school_id()) AND (user_id = ( SELECT auth.uid() AS uid))));
CREATE POLICY sync_queue_own_select ON public.sync_queue FOR SELECT USING (((school_id = get_my_school_id()) AND ((user_id = ( SELECT auth.uid() AS uid)) OR is_admin_role()))) ;
CREATE POLICY sync_queue_own_update ON public.sync_queue FOR UPDATE USING (((school_id = get_my_school_id()) AND ((user_id = ( SELECT auth.uid() AS uid)) OR is_admin_role()))) WITH CHECK (((school_id = get_my_school_id()) AND ((user_id = ( SELECT auth.uid() AS uid)) OR is_admin_role())));
CREATE POLICY "System events insert access" ON public.system_events FOR INSERT WITH CHECK ((( SELECT auth.uid() AS uid) IS NOT NULL));
CREATE POLICY "Teachers can insert their own sessions" ON public.teacher_active_sessions FOR INSERT WITH CHECK ((( SELECT auth.uid() AS uid) = teacher_id));
CREATE POLICY "Teachers can update their own sessions" ON public.teacher_active_sessions FOR UPDATE USING ((( SELECT auth.uid() AS uid) = teacher_id)) WITH CHECK ((( SELECT auth.uid() AS uid) = teacher_id));
CREATE POLICY "Teachers can view their own sessions" ON public.teacher_active_sessions FOR SELECT USING ((( SELECT auth.uid() AS uid) = teacher_id)) ;
CREATE POLICY "Teachers can update their own alerts" ON public.teacher_alerts FOR UPDATE USING ((( SELECT auth.uid() AS uid) = teacher_id)) WITH CHECK ((( SELECT auth.uid() AS uid) = teacher_id));
CREATE POLICY "Teachers can view their own alerts" ON public.teacher_alerts FOR SELECT USING ((( SELECT auth.uid() AS uid) = teacher_id)) ;
CREATE POLICY teacher_class_subject_assignments_admin_manage ON public.teacher_class_subject_assignments FOR ALL USING (((school_id = get_my_school_id()) AND is_admin_role())) WITH CHECK (((school_id = get_my_school_id()) AND is_admin_role()));
CREATE POLICY teacher_class_subject_assignments_school_read ON public.teacher_class_subject_assignments FOR SELECT USING ((school_id = get_my_school_id())) ;
CREATE POLICY "Teachers can create their own office hours" ON public.teacher_office_hours FOR INSERT WITH CHECK ((teacher_id = ( SELECT auth.uid() AS uid)));
CREATE POLICY "Teachers can delete their own office hours" ON public.teacher_office_hours FOR DELETE USING ((teacher_id = ( SELECT auth.uid() AS uid))) ;
CREATE POLICY "Teachers can update their own office hours" ON public.teacher_office_hours FOR ALL USING ((teacher_id = ( SELECT auth.uid() AS uid))) WITH CHECK ((teacher_id = ( SELECT auth.uid() AS uid)));
CREATE POLICY "Teachers can view their own office hours" ON public.teacher_office_hours FOR SELECT USING ((teacher_id = ( SELECT auth.uid() AS uid))) ;
CREATE POLICY "Teachers can view their own performance metrics" ON public.teacher_performance_metrics FOR SELECT USING ((( SELECT auth.uid() AS uid) = teacher_id)) ;
CREATE POLICY teacher_recognition_admin_manage ON public.teacher_recognition FOR ALL USING (((school_id = get_my_school_id()) AND is_admin_role())) WITH CHECK (((school_id = get_my_school_id()) AND is_admin_role()));
CREATE POLICY teacher_recognition_school_read ON public.teacher_recognition FOR SELECT USING ((school_id = get_my_school_id())) ;
CREATE POLICY teacher_subject_specializations_admin_manage ON public.teacher_subject_specializations FOR ALL USING (((school_id = get_my_school_id()) AND is_admin_role())) WITH CHECK (((school_id = get_my_school_id()) AND is_admin_role()));
CREATE POLICY teacher_subject_specializations_school_read ON public.teacher_subject_specializations FOR SELECT USING ((school_id = get_my_school_id())) ;
CREATE POLICY teachers_admin_delete ON public.teachers FOR DELETE USING (((school_id = get_my_school_id()) AND is_admin_role())) ;
CREATE POLICY teachers_admin_insert ON public.teachers FOR INSERT WITH CHECK (((school_id = get_my_school_id()) AND is_admin_role()));
CREATE POLICY teachers_admin_update ON public.teachers FOR UPDATE USING (((school_id = get_my_school_id()) AND is_admin_role())) WITH CHECK (((school_id = get_my_school_id()) AND is_admin_role()));
CREATE POLICY teachers_select_accessible ON public.teachers FOR SELECT USING ((school_id = get_my_school_id())) ;
CREATE POLICY temp_tokens_own_delete ON public.temp_tokens FOR DELETE USING ((user_id = ( SELECT auth.uid() AS uid))) ;
CREATE POLICY temp_tokens_own_insert ON public.temp_tokens FOR INSERT WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));
CREATE POLICY temp_tokens_own_select ON public.temp_tokens FOR SELECT USING ((user_id = ( SELECT auth.uid() AS uid))) ;
CREATE POLICY terms_admin_manage ON public.terms FOR ALL USING (((school_id = get_my_school_id()) AND is_admin_role())) WITH CHECK (((school_id = get_my_school_id()) AND is_admin_role()));
CREATE POLICY terms_same_school_read ON public.terms FOR SELECT USING ((school_id = get_my_school_id())) ;
CREATE POLICY user_sessions_admin_view ON public.user_sessions FOR SELECT USING (((school_id = get_my_school_id()) AND is_admin_role())) ;
CREATE POLICY user_sessions_self ON public.user_sessions FOR ALL USING ((user_id IN ( SELECT profiles.id
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) OR (profiles.auth_user_id = ( SELECT auth.uid() AS uid)))))) WITH CHECK ((user_id IN ( SELECT profiles.id
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) OR (profiles.auth_user_id = ( SELECT auth.uid() AS uid))))));

-- Section 11: Triggers (47)
CREATE TRIGGER trg_announcements_updated_at BEFORE UPDATE ON public.announcements FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();
CREATE TRIGGER trg_assignments_validate BEFORE INSERT OR UPDATE ON public.assignments FOR EACH ROW EXECUTE FUNCTION private.validate_assignments_row();
CREATE TRIGGER set_async_jobs_updated_at BEFORE UPDATE ON public.async_jobs FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_attendance_sync_dates BEFORE INSERT OR UPDATE ON public.attendance FOR EACH ROW EXECUTE FUNCTION private.sync_attendance_dates();
CREATE TRIGGER trg_attendance_validate BEFORE INSERT OR UPDATE ON public.attendance FOR EACH ROW EXECUTE FUNCTION private.validate_attendance_row();
CREATE TRIGGER update_attendance_rollcall_sessions_updated_at BEFORE UPDATE ON public.attendance_rollcall_sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_class_insights_updated_at BEFORE UPDATE ON public.class_insights FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_class_subjects_validate BEFORE INSERT OR UPDATE ON public.class_subjects FOR EACH ROW EXECUTE FUNCTION private.validate_class_subjects_row();
CREATE TRIGGER update_classroom_activity_stream_updated_at BEFORE UPDATE ON public.classroom_activity_stream FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_exams_validate BEFORE INSERT OR UPDATE ON public.exams FOR EACH ROW EXECUTE FUNCTION private.validate_exams_row();
CREATE TRIGGER trg_fee_payments_validate BEFORE INSERT OR UPDATE ON public.fee_payments FOR EACH ROW EXECUTE FUNCTION private.validate_fee_payments_row();
CREATE TRIGGER fees_updated_at BEFORE UPDATE ON public.fees FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_lessons_validate BEFORE INSERT OR UPDATE ON public.lessons FOR EACH ROW EXECUTE FUNCTION private.validate_lessons_row();
CREATE TRIGGER update_markbook_columns_updated_at BEFORE UPDATE ON public.markbook_columns FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_markbook_scores_updated_at BEFORE UPDATE ON public.markbook_scores FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER message_templates_updated_at BEFORE UPDATE ON public.message_templates FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER trg_messages_validate BEFORE INSERT OR UPDATE ON public.messages FOR EACH ROW EXECUTE FUNCTION private.validate_messages_row();
CREATE TRIGGER trg_parent_students_validate BEFORE INSERT OR UPDATE ON public.parent_students FOR EACH ROW EXECUTE FUNCTION private.validate_parent_students_row();
CREATE TRIGGER set_parents_updated_at BEFORE UPDATE ON public.parents FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_parents_updated_at BEFORE UPDATE ON public.parents FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();
CREATE TRIGGER trg_parents_validate BEFORE INSERT OR UPDATE ON public.parents FOR EACH ROW EXECUTE FUNCTION private.validate_parents_row();
CREATE TRIGGER payment_status_update BEFORE UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION update_payment_status();
CREATE TRIGGER audit_profiles AFTER INSERT OR DELETE OR UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();
CREATE TRIGGER set_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_results_validate BEFORE INSERT OR UPDATE ON public.results FOR EACH ROW EXECUTE FUNCTION private.validate_results_row();
CREATE TRIGGER audit_role_permissions AFTER INSERT OR DELETE OR UPDATE ON public.role_permissions FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();
CREATE TRIGGER audit_schools AFTER INSERT OR DELETE OR UPDATE ON public.schools FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();
CREATE TRIGGER set_schools_updated_at BEFORE UPDATE ON public.schools FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_schools_updated_at BEFORE UPDATE ON public.schools FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();
CREATE TRIGGER update_schools_updated_at BEFORE UPDATE ON public.schools FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER audit_staff_invitations AFTER INSERT OR DELETE OR UPDATE ON public.staff_invitations FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();
CREATE TRIGGER student_fees_updated_at BEFORE UPDATE ON public.student_fees FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trigger_calculate_student_pulse_score BEFORE INSERT OR UPDATE ON public.student_pulse_metrics FOR EACH ROW EXECUTE FUNCTION calculate_student_pulse_score();
CREATE TRIGGER update_student_pulse_metrics_updated_at BEFORE UPDATE ON public.student_pulse_metrics FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_student_risk_assessments_updated_at BEFORE UPDATE ON public.student_risk_assessments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_students_updated_at BEFORE UPDATE ON public.students FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_students_updated_at BEFORE UPDATE ON public.students FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();
CREATE TRIGGER trg_students_validate BEFORE INSERT OR UPDATE ON public.students FOR EACH ROW EXECUTE FUNCTION private.validate_students_row();
CREATE TRIGGER update_teacher_active_sessions_updated_at BEFORE UPDATE ON public.teacher_active_sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_teacher_alerts_updated_at BEFORE UPDATE ON public.teacher_alerts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER teacher_office_hours_updated_at BEFORE UPDATE ON public.teacher_office_hours FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER update_teacher_performance_metrics_updated_at BEFORE UPDATE ON public.teacher_performance_metrics FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_teachers_updated_at BEFORE UPDATE ON public.teachers FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_teachers_updated_at BEFORE UPDATE ON public.teachers FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();
CREATE TRIGGER trg_teachers_validate BEFORE INSERT OR UPDATE ON public.teachers FOR EACH ROW EXECUTE FUNCTION private.validate_teachers_row();

-- Section 12: Grants
-- Table grants (161)
GRANT SELECT, INSERT, UPDATE, DELETE, TRIGGER, REFERENCES, TRUNCATE ON public.academic_terms TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRIGGER, TRUNCATE, REFERENCES ON public.academic_years TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRIGGER, TRUNCATE, REFERENCES ON public.access_codes TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE, REFERENCES, TRUNCATE, TRIGGER ON public.access_codes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRIGGER, REFERENCES, TRUNCATE ON public.activity_logs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER, REFERENCES ON public.admin_actions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE, TRIGGER, REFERENCES, TRUNCATE ON public.admin_actions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRIGGER, REFERENCES, TRUNCATE ON public.admin_role_scopes TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE, TRIGGER, REFERENCES, TRUNCATE ON public.admin_role_scopes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, REFERENCES, TRIGGER, TRUNCATE ON public.admin_workspace_summary TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE, TRIGGER, REFERENCES, TRUNCATE ON public.admin_workspace_summary TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER, REFERENCES ON public.alert_thresholds TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE, TRIGGER, REFERENCES, TRUNCATE ON public.alert_thresholds TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRIGGER, REFERENCES, TRUNCATE ON public.announcement_seen TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, REFERENCES, TRUNCATE, TRIGGER ON public.announcement_views TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.announcement_views TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRIGGER, REFERENCES, TRUNCATE ON public.announcements TO authenticated;
GRANT INSERT, UPDATE, DELETE, REFERENCES, TRUNCATE, TRIGGER ON public.assignment_submissions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE, REFERENCES, TRIGGER, TRUNCATE ON public.assignment_submissions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, REFERENCES, TRUNCATE, TRIGGER ON public.assignments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRIGGER, TRUNCATE, REFERENCES ON public.async_jobs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRIGGER, REFERENCES, TRUNCATE ON public.attendance TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, REFERENCES, TRIGGER, TRUNCATE ON public.attendance_monthly_summary TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER, REFERENCES ON public.attendance_monthly_summary TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, REFERENCES, TRIGGER, TRUNCATE ON public.attendance_rollcall_sessions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER, REFERENCES ON public.attendance_rollcall_sessions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER, REFERENCES ON public.audit_logs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRIGGER, REFERENCES, TRUNCATE ON public.behaviour_followups TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE, REFERENCES, TRUNCATE, TRIGGER ON public.behaviour_followups TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, REFERENCES, TRIGGER, TRUNCATE ON public.behaviour_logs TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER, REFERENCES ON public.behaviour_logs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER, REFERENCES ON public.class_assignments TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE, TRIGGER, TRUNCATE, REFERENCES ON public.class_assignments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, REFERENCES, TRIGGER, TRUNCATE ON public.class_insights TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE, TRIGGER, REFERENCES, TRUNCATE ON public.class_insights TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRIGGER, REFERENCES, TRUNCATE ON public.class_subjects TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.classes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRIGGER, TRUNCATE, REFERENCES ON public.classroom_activity_stream TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE, REFERENCES, TRIGGER, TRUNCATE ON public.classroom_activity_stream TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, REFERENCES, TRUNCATE, TRIGGER ON public.discipline_actions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE, TRIGGER, TRUNCATE, REFERENCES ON public.discipline_actions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, REFERENCES, TRUNCATE, TRIGGER ON public.discipline_categories TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER, REFERENCES ON public.discipline_categories TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRIGGER, REFERENCES, TRUNCATE ON public.discipline_records TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.discipline_records TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER, REFERENCES ON public.duty_roster TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.duty_roster TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRIGGER, REFERENCES, TRUNCATE ON public.email_verifications TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRIGGER, TRUNCATE, REFERENCES ON public.events TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRIGGER, REFERENCES, TRUNCATE ON public.exam_questions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER, REFERENCES ON public.exam_submission_answers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, REFERENCES, TRUNCATE, TRIGGER ON public.exam_submissions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRIGGER, TRUNCATE, REFERENCES ON public.exams TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRIGGER, TRUNCATE, REFERENCES ON public.fee_payments TO authenticated;
GRANT INSERT, UPDATE, DELETE, TRIGGER, REFERENCES, TRUNCATE ON public.fees TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE, TRIGGER, TRUNCATE, REFERENCES ON public.fees TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRIGGER, REFERENCES, TRUNCATE ON public.finance_records TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER, REFERENCES ON public.finances TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, REFERENCES, TRIGGER, TRUNCATE ON public.grade_publish_history TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE, TRIGGER, TRUNCATE, REFERENCES ON public.grade_publish_history TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRIGGER, TRUNCATE, REFERENCES ON public.gradebook_snapshots TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE, REFERENCES, TRIGGER, TRUNCATE ON public.gradebook_snapshots TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRIGGER, TRUNCATE, REFERENCES ON public.grades TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, REFERENCES, TRUNCATE, TRIGGER ON public.grading_scales TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, REFERENCES, TRUNCATE, TRIGGER ON public.idempotency_keys TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, REFERENCES, TRUNCATE, TRIGGER ON public.lesson_plans TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE, TRIGGER, TRUNCATE, REFERENCES ON public.lesson_plans TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, REFERENCES, TRIGGER, TRUNCATE ON public.lessons TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER, REFERENCES ON public.markbook_columns TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.markbook_columns TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRIGGER, TRUNCATE, REFERENCES ON public.markbook_entries TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE, REFERENCES, TRUNCATE, TRIGGER ON public.markbook_entries TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRIGGER, REFERENCES, TRUNCATE ON public.markbook_scores TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE, TRIGGER, TRUNCATE, REFERENCES ON public.markbook_scores TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, REFERENCES, TRIGGER, TRUNCATE ON public.markbook_sheets TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE, TRIGGER, REFERENCES, TRUNCATE ON public.markbook_sheets TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, REFERENCES, TRIGGER, TRUNCATE ON public.merit_logs TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE, TRIGGER, TRUNCATE, REFERENCES ON public.merit_logs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRIGGER, REFERENCES, TRUNCATE ON public.message_templates TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER, REFERENCES ON public.message_templates TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER, REFERENCES ON public.messages TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, REFERENCES, TRUNCATE, TRIGGER ON public.notifications TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRIGGER, REFERENCES, TRUNCATE ON public.outbox_events TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, REFERENCES, TRIGGER, TRUNCATE ON public.parent_children_summary TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE, REFERENCES, TRUNCATE, TRIGGER ON public.parent_children_summary TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRIGGER, TRUNCATE, REFERENCES ON public.parent_students TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.parents TO authenticated;
GRANT INSERT, UPDATE, DELETE, TRIGGER, REFERENCES, TRUNCATE ON public.payment_summaries TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE, REFERENCES, TRIGGER, TRUNCATE ON public.payment_summaries TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRIGGER, REFERENCES, TRUNCATE ON public.payments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, REFERENCES, TRIGGER, TRUNCATE ON public.permission_features TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE, TRIGGER, REFERENCES, TRUNCATE ON public.permission_features TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER, REFERENCES ON public.permission_group_roles TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.permission_group_roles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.permission_groups TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.permission_groups TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER, REFERENCES ON public.permission_slip_responses TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER, REFERENCES ON public.permission_slip_responses TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRIGGER, REFERENCES, TRUNCATE ON public.permission_slips TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE, TRIGGER, REFERENCES, TRUNCATE ON public.permission_slips TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.question_bank TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER, REFERENCES ON public.question_bank TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRIGGER, REFERENCES, TRUNCATE ON public.report_card_reviews TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE, REFERENCES, TRUNCATE, TRIGGER ON public.report_card_reviews TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRIGGER, REFERENCES, TRUNCATE ON public.report_cards TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.report_cards TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, REFERENCES, TRIGGER, TRUNCATE ON public.results TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRIGGER, TRUNCATE, REFERENCES ON public.role_permissions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE, TRIGGER, TRUNCATE, REFERENCES ON public.role_permissions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER, REFERENCES ON public.scheduled_broadcasts TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.scheduled_broadcasts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.school_departments TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE, TRIGGER, REFERENCES, TRUNCATE ON public.school_departments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER, REFERENCES ON public.school_emergency_state TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE, TRIGGER, TRUNCATE, REFERENCES ON public.school_emergency_state TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, REFERENCES, TRIGGER, TRUNCATE ON public.school_invites TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE, TRIGGER, TRUNCATE, REFERENCES ON public.school_invites TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRIGGER, TRUNCATE, REFERENCES ON public.school_settings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.school_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRIGGER, TRUNCATE, REFERENCES ON public.schools TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER, REFERENCES ON public.staff_invitations TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE, TRIGGER, REFERENCES, TRUNCATE ON public.staff_invitations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRIGGER, REFERENCES, TRUNCATE ON public.staff_meetings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.staff_meetings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRIGGER, TRUNCATE, REFERENCES ON public.student_dashboard_summary TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE, REFERENCES, TRIGGER, TRUNCATE ON public.student_dashboard_summary TO authenticated;
GRANT INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER, REFERENCES ON public.student_fees TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE, REFERENCES, TRUNCATE, TRIGGER ON public.student_fees TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER, REFERENCES ON public.student_pulse_metrics TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE, TRIGGER, REFERENCES, TRUNCATE ON public.student_pulse_metrics TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.student_risk_assessments TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER, REFERENCES ON public.student_risk_assessments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRIGGER, TRUNCATE, REFERENCES ON public.students TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, REFERENCES, TRIGGER, TRUNCATE ON public.subjects TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER, REFERENCES ON public.sync_queue TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE, TRIGGER, TRUNCATE, REFERENCES ON public.sync_queue TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRIGGER, REFERENCES, TRUNCATE ON public.system_events TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE, TRIGGER, TRUNCATE, REFERENCES ON public.system_events TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, REFERENCES, TRUNCATE, TRIGGER ON public.teacher_active_sessions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE, REFERENCES, TRIGGER, TRUNCATE ON public.teacher_active_sessions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.teacher_alerts TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.teacher_alerts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRIGGER, TRUNCATE, REFERENCES ON public.teacher_assignments TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.teacher_assignments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRIGGER, TRUNCATE, REFERENCES ON public.teacher_class_subject_assignments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRIGGER, REFERENCES, TRUNCATE ON public.teacher_office_hours TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE, TRIGGER, REFERENCES, TRUNCATE ON public.teacher_office_hours TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRIGGER, REFERENCES, TRUNCATE ON public.teacher_performance_metrics TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE, TRIGGER, TRUNCATE, REFERENCES ON public.teacher_performance_metrics TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRIGGER, REFERENCES, TRUNCATE ON public.teacher_recognition TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER, REFERENCES ON public.teacher_recognition TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRIGGER, REFERENCES, TRUNCATE ON public.teacher_subject_specializations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRIGGER, REFERENCES, TRUNCATE ON public.teacher_workspace_summary TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.teacher_workspace_summary TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRIGGER, REFERENCES, TRUNCATE ON public.teachers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRIGGER, REFERENCES, TRUNCATE ON public.temp_tokens TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER, REFERENCES ON public.temp_tokens TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRIGGER, REFERENCES, TRUNCATE ON public.terms TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRIGGER, REFERENCES, TRUNCATE ON public.user_sessions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE, TRIGGER, REFERENCES, TRUNCATE ON public.user_sessions TO authenticated;

-- Function grants (82)
GRANT EXECUTE ON FUNCTION private.accessible_class_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION private.accessible_student_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION private.assignment_school(p_assignment_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.class_school(p_class_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.current_parent_id() TO authenticated;
GRANT EXECUTE ON FUNCTION private.current_parent_row_id() TO authenticated;
GRANT EXECUTE ON FUNCTION private."current_role"() TO authenticated;
GRANT EXECUTE ON FUNCTION private.current_school_id() TO authenticated;
GRANT EXECUTE ON FUNCTION private.current_student_id() TO authenticated;
GRANT EXECUTE ON FUNCTION private.current_student_row_id() TO authenticated;
GRANT EXECUTE ON FUNCTION private.current_teacher_id() TO authenticated;
GRANT EXECUTE ON FUNCTION private.current_teacher_row_id() TO authenticated;
GRANT EXECUTE ON FUNCTION private.current_user_id() TO authenticated;
GRANT EXECUTE ON FUNCTION private.exam_school(p_exam_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_parent() TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_student() TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_teacher() TO authenticated;
GRANT EXECUTE ON FUNCTION private.parent_can_access_student(target_student_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.parent_school(p_parent_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.profile_school(p_profile_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.set_updated_at() TO authenticated;
GRANT EXECUTE ON FUNCTION private.student_school(p_student_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.subject_school(p_subject_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.sync_attendance_dates() TO authenticated;
GRANT EXECUTE ON FUNCTION private.teacher_can_manage_class(p_class_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.teacher_can_manage_class_subject(p_class_id uuid, p_subject_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.teacher_has_class(target_class_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.teacher_has_class_subject(target_class_id uuid, target_subject_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.teacher_school(p_teacher_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.validate_assignments_row() TO authenticated;
GRANT EXECUTE ON FUNCTION private.validate_attendance_row() TO authenticated;
GRANT EXECUTE ON FUNCTION private.validate_class_subjects_row() TO authenticated;
GRANT EXECUTE ON FUNCTION private.validate_exams_row() TO authenticated;
GRANT EXECUTE ON FUNCTION private.validate_fee_payments_row() TO authenticated;
GRANT EXECUTE ON FUNCTION private.validate_lessons_row() TO authenticated;
GRANT EXECUTE ON FUNCTION private.validate_messages_row() TO authenticated;
GRANT EXECUTE ON FUNCTION private.validate_parent_students_row() TO authenticated;
GRANT EXECUTE ON FUNCTION private.validate_parents_row() TO authenticated;
GRANT EXECUTE ON FUNCTION private.validate_results_row() TO authenticated;
GRANT EXECUTE ON FUNCTION private.validate_students_row() TO authenticated;
GRANT EXECUTE ON FUNCTION private.validate_teachers_row() TO authenticated;
GRANT EXECUTE ON FUNCTION public.audit_trigger_function() TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_student_average(p_student_id uuid, p_class_id uuid, p_subject_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_student_pulse_score() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_invitations() TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_habitual_absentees(p_school_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_class_insights() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_parent_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_profile_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_school_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_student_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_teacher_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_student_exam_questions(p_exam_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.handle_updated_at() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_financial_context_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_payments_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_sensitive_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_user_conversations(p_profile_id uuid, p_school_id uuid, p_search text, p_limit integer, p_offset integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_announcement_seen(p_announcement_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_invite_used(p_code text, p_used_by uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_message_read(p_message_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.me() TO authenticated;
GRANT EXECUTE ON FUNCTION public.notify_change() TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_attendance_bulk(p_class_id uuid, p_attendance_date date, p_session_name text, p_session_time time without time zone, p_rows jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_expired_staff_invitations() TO authenticated;
GRANT EXECUTE ON FUNCTION public.rls_auto_enable() TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_gradebook_data(p_class_id uuid, p_subject_id uuid, p_columns jsonb, p_students jsonb, p_teacher_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.school_directory(p_role text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.seed_default_alert_thresholds(p_school_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_message(p_receiver_id uuid, p_content text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_updated_at() TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_fee_payment(p_student_id uuid, p_amount numeric, p_payment_method text, p_reference_number text, p_term text, p_academic_year text, p_notes text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_my_profile(p_first_name text, p_last_name text, p_phone text, p_address text, p_avatar_url text, p_gender text, p_date_of_birth date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_payment_status() TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_updated_at() TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_updated_at_column() TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_results_bulk(p_exam_id uuid, p_assignment_id uuid, p_rows jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.validate_invite_code(p_code text) TO authenticated;

-- Schema grants
GRANT USAGE ON SCHEMA private TO authenticated;
GRANT USAGE ON SCHEMA private TO anon;
GRANT USAGE ON SCHEMA private TO service_role;
