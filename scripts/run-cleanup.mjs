import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load env vars from .env.local
const envPath = join(__dirname, '..', '.env.local');
const envContent = readFileSync(envPath, 'utf-8');
const env = {};
for (const line of envContent.split('\n')) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) {
    env[match[1].trim()] = match[2].trim();
  }
}

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

// Tables to clear in order (child tables first to respect FK constraints)
const tablesToClear = [
  'assignment_submissions',
  'assignments',
  'attendance_rollcall_sessions',
  'attendance',
  'behaviour_followups',
  'behaviour_logs',
  'class_insights',
  'classroom_activity_stream',
  'class_subjects',
  'discipline_actions',
  'discipline_records',
  'discipline_categories',
  'duty_roster',
  'events',
  'exam_submission_answers',
  'exam_submissions',
  'exam_questions',
  'exams',
  'fee_payments',
  'student_fees',
  'fees',
  'finance_records',
  'finances',
  'grade_publish_history',
  'gradebook_snapshots',
  'markbook_entries',
  'markbook_columns',
  'markbook_scores',
  'markbook_sheets',
  'merit_logs',
  'message_templates',
  'messages',
  'notifications',
  'announcement_seen',
  'announcement_views',
  'announcements',
  'outbox_events',
  'system_events',
  'sync_queue',
  'async_jobs',
  'activity_logs',
  'audit_logs',
  'admin_actions',
  'alert_thresholds',
  'teacher_active_sessions',
  'teacher_alerts',
  'teacher_class_subject_assignments',
  'teacher_office_hours',
  'teacher_performance_metrics',
  'teacher_recognition',
  'teacher_subject_specializations',
  'student_pulse_metrics',
  'student_risk_assessments',
  'lesson_plans',
  'lessons',
  'results',
  'report_card_reviews',
  'report_cards',
  'question_bank',
  'permission_slip_responses',
  'permission_slips',
  'scheduled_broadcasts',
  'school_emergency_state',
  'school_settings',
  'school_departments',
  'staff_meetings',
  'payments',
  'parent_students',
  'parents',
  'students',
  'teachers',
  'classes',
  'subjects',
  'grades',
  'grading_scales',
  'academic_terms',
  'academic_years',
  'terms',
  'permission_features',
  'permission_group_roles',
  'permission_groups',
  'role_permissions',
  'admin_role_scopes',
  'user_sessions',
  'email_verifications',
  'temp_tokens',
  'access_codes',
  'school_invites',
  'staff_invitations',
  'idempotency_keys',
];

async function main() {
  console.log('=== ZamSchool Demo Data Cleanup ===\n');

  // Step 1: Find superadmin user
  const { data: superadminUser, error: userError } = await supabase.auth.admin.listUsers();
  if (userError) {
    console.error('Error listing users:', userError.message);
    process.exit(1);
  }

  const superadmin = superadminUser.users.find(u => u.email === 'superadmin@zamschool.edu.zm');
  if (!superadmin) {
    console.error('ERROR: superadmin@zamschool.edu.zm not found! Aborting.');
    process.exit(1);
  }

  console.log(`Found superadmin: ${superadmin.id}`);
  console.log(`Total users before cleanup: ${superadminUser.users.length}\n`);

  // Step 2: Clear all tables
  let totalDeleted = 0;
  for (const table of tablesToClear) {
    const { error, count } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true });

    if (error) {
      // Table might not exist, skip
      if (error.message.includes('does not exist')) {
        console.log(`  [SKIP] ${table} (does not exist)`);
        continue;
      }
      console.error(`  [ERROR] ${table}: ${error.message}`);
      continue;
    }

    if (count === 0) {
      console.log(`  [EMPTY] ${table}`);
      continue;
    }

    const { error: deleteError } = await supabase
      .from(table)
      .delete()
      .neq('1', '1'); // Delete all rows

    if (deleteError) {
      console.error(`  [ERROR] ${table}: ${deleteError.message}`);
      continue;
    }

    console.log(`  [DELETED] ${table} (${count} rows)`);
    totalDeleted += count;
  }

  console.log(`\nTotal rows deleted from tables: ${totalDeleted}`);

  // Step 3: Delete all profiles except superadmin
  console.log('\nDeleting profiles...');
  const { data: profilesBefore } = await supabase
    .from('profiles')
    .select('id, email, role');

  const profilesToDelete = (profilesBefore || []).filter(p => p.id !== superadmin.id);
  console.log(`Profiles to delete: ${profilesToDelete.length}`);

  if (profilesToDelete.length > 0) {
    const { error: profileError } = await supabase
      .from('profiles')
      .delete()
      .neq('id', superadmin.id);

    if (profileError) {
      console.error(`Error deleting profiles: ${profileError.message}`);
    } else {
      console.log(`Deleted ${profilesToDelete.length} profiles`);
    }
  }

  // Step 4: Delete all schools
  console.log('\nDeleting schools...');
  const { data: schools, error: schoolListError } = await supabase
    .from('schools')
    .select('id, name');

  if (schoolListError) {
    console.error(`Error listing schools: ${schoolListError.message}`);
  } else {
    console.log(`Schools to delete: ${(schools || []).length}`);
    if (schools && schools.length > 0) {
      const { error: schoolError } = await supabase
        .from('schools')
        .delete()
        .neq('1', '1');

      if (schoolError) {
        console.error(`Error deleting schools: ${schoolError.message}`);
      } else {
        console.log(`Deleted ${schools.length} schools`);
      }
    }
  }

  // Step 5: Delete all auth users except superadmin
  console.log('\nDeleting auth users...');
  const { data: allUsers } = await supabase.auth.admin.listUsers();
  const usersToDelete = (allUsers?.users || []).filter(u => u.id !== superadmin.id);
  console.log(`Users to delete: ${usersToDelete.length}`);

  for (const user of usersToDelete) {
    const { error: deleteUserError } = await supabase.auth.admin.deleteUser(user.id);
    if (deleteUserError) {
      console.error(`  Error deleting user ${user.email}: ${deleteUserError.message}`);
    } else {
      console.log(`  Deleted: ${user.email}`);
    }
  }

  // Final verification
  console.log('\n=== Final Verification ===');
  const { data: finalUsers } = await supabase.auth.admin.listUsers();
  console.log(`Remaining auth users: ${finalUsers?.users?.length || 0}`);
  finalUsers?.users?.forEach(u => console.log(`  - ${u.email} (${u.id})`));

  const { count: profileCount } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true });
  console.log(`Remaining profiles: ${profileCount || 0}`);

  const { count: schoolCount } = await supabase
    .from('schools')
    .select('*', { count: 'exact', head: true });
  console.log(`Remaining schools: ${schoolCount || 0}`);

  console.log('\n=== Cleanup Complete ===');
  console.log('Preserved: superadmin@zamschool.edu.zm');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});