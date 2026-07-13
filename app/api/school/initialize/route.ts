import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { safeErrorMessage } from "@/lib/server-guards";
import { requireActorContext } from "@/lib/server-auth";
import { initializeSchoolDefaults } from "@/lib/school-initialization";
import { computeSchoolSetupProgress } from "@/lib/school-setup-catalog";

const DEFAULT_DEPARTMENTS = [
  {
    name: "Administration",
    description: "School administration and leadership",
  },
  { name: "Academic", description: "Academic affairs and curriculum" },
  { name: "Finance", description: "Financial management and accounting" },
  { name: "ICT", description: "Information and communications technology" },
  {
    name: "Guidance & Counseling",
    description: "Student welfare and guidance",
  },
  { name: "Human Resources", description: "Staff management and HR" },
  { name: "Discipline", description: "Student discipline and conduct" },
  {
    name: "Sports & Culture",
    description: "Sports, arts and cultural activities",
  },
];

const DEFAULT_PERMISSION_GROUPS = [
  {
    name: "Full Access",
    description: "Complete system access for school leadership",
    features: [
      {
        feature_key: "users",
        can_create: true,
        can_read: true,
        can_update: true,
        can_delete: true,
        scope: "school",
      },
      {
        feature_key: "classes",
        can_create: true,
        can_read: true,
        can_update: true,
        can_delete: true,
        scope: "school",
      },
      {
        feature_key: "subjects",
        can_create: true,
        can_read: true,
        can_update: true,
        can_delete: true,
        scope: "school",
      },
      {
        feature_key: "finance",
        can_create: true,
        can_read: true,
        can_update: true,
        can_delete: true,
        scope: "school",
      },
      {
        feature_key: "attendance",
        can_create: true,
        can_read: true,
        can_update: true,
        can_delete: false,
        scope: "school",
      },
      {
        feature_key: "grades",
        can_create: true,
        can_read: true,
        can_update: true,
        can_delete: true,
        scope: "school",
      },
      {
        feature_key: "settings",
        can_create: true,
        can_read: true,
        can_update: true,
        can_delete: false,
        scope: "school",
      },
    ],
    roles: ["PRINCIPAL", "DEPUTY_HEAD"],
  },
  {
    name: "Academic Management",
    description: "Academic administration access",
    features: [
      {
        feature_key: "users",
        can_create: false,
        can_read: true,
        can_update: false,
        can_delete: false,
        scope: "school",
      },
      {
        feature_key: "classes",
        can_create: false,
        can_read: true,
        can_update: false,
        can_delete: false,
        scope: "school",
      },
      {
        feature_key: "subjects",
        can_create: true,
        can_read: true,
        can_update: true,
        can_delete: false,
        scope: "school",
      },
      {
        feature_key: "attendance",
        can_create: false,
        can_read: true,
        can_update: false,
        can_delete: false,
        scope: "school",
      },
      {
        feature_key: "grades",
        can_create: true,
        can_read: true,
        can_update: true,
        can_delete: false,
        scope: "school",
      },
      {
        feature_key: "assignments",
        can_create: true,
        can_read: true,
        can_update: true,
        can_delete: false,
        scope: "school",
      },
      {
        feature_key: "timetable",
        can_create: true,
        can_read: true,
        can_update: true,
        can_delete: false,
        scope: "school",
      },
      {
        feature_key: "grading_scales",
        can_create: true,
        can_read: true,
        can_update: true,
        can_delete: false,
        scope: "school",
      },
      {
        feature_key: "academic_years",
        can_create: true,
        can_read: true,
        can_update: true,
        can_delete: false,
        scope: "school",
      },
      {
        feature_key: "terms",
        can_create: true,
        can_read: true,
        can_update: true,
        can_delete: false,
        scope: "school",
      },
    ],
    roles: ["ACADEMIC_ADMIN"],
  },
  {
    name: "Finance Access",
    description: "Financial management access",
    features: [
      {
        feature_key: "finance",
        can_create: true,
        can_read: true,
        can_update: true,
        can_delete: false,
        scope: "school",
      },
      {
        feature_key: "payments",
        can_create: true,
        can_read: true,
        can_update: true,
        can_delete: false,
        scope: "school",
      },
      {
        feature_key: "users",
        can_create: false,
        can_read: true,
        can_update: false,
        can_delete: false,
        scope: "school",
      },
    ],
    roles: ["BURSAR", "PAYMENTS"],
  },
  {
    name: "ICT Administration",
    description: "Technical system administration",
    features: [
      {
        feature_key: "users",
        can_create: false,
        can_read: true,
        can_update: true,
        can_delete: false,
        scope: "school",
      },
      {
        feature_key: "settings",
        can_create: false,
        can_read: true,
        can_update: true,
        can_delete: false,
        scope: "school",
      },
      {
        feature_key: "sessions",
        can_create: false,
        can_read: true,
        can_update: true,
        can_delete: true,
        scope: "school",
      },
    ],
    roles: ["ICT_ADMIN"],
  },
  {
    name: "HR Management",
    description: "Human resources administration",
    features: [
      {
        feature_key: "users",
        can_create: true,
        can_read: true,
        can_update: true,
        can_delete: false,
        scope: "school",
      },
      {
        feature_key: "attendance",
        can_create: false,
        can_read: true,
        can_update: false,
        can_delete: false,
        scope: "department",
      },
    ],
    roles: ["HR_ADMIN"],
  },
  {
    name: "Guidance Access",
    description: "Student welfare and guidance access",
    features: [
      {
        feature_key: "users",
        can_create: false,
        can_read: true,
        can_update: false,
        can_delete: false,
        scope: "school",
      },
      {
        feature_key: "attendance",
        can_create: false,
        can_read: true,
        can_update: false,
        can_delete: false,
        scope: "school",
      },
      {
        feature_key: "grades",
        can_create: false,
        can_read: true,
        can_update: false,
        can_delete: false,
        scope: "school",
      },
    ],
    roles: ["GUIDANCE_OFFICE"],
  },
  {
    name: "Discipline Management",
    description: "Student discipline administration",
    features: [
      {
        feature_key: "users",
        can_create: false,
        can_read: true,
        can_update: false,
        can_delete: false,
        scope: "school",
      },
      {
        feature_key: "attendance",
        can_create: false,
        can_read: true,
        can_update: false,
        can_delete: false,
        scope: "school",
      },
      {
        feature_key: "discipline",
        can_create: true,
        can_read: true,
        can_update: true,
        can_delete: false,
        scope: "school",
      },
    ],
    roles: ["DISCIPLINE_ADMIN"],
  },
  {
    name: "Admissions & Registrar",
    description: "Student admissions, parent registration, and transfers",
    features: [
      {
        feature_key: "users",
        can_create: true,
        can_read: true,
        can_update: true,
        can_delete: false,
        scope: "school",
      },
      {
        feature_key: "classes",
        can_create: false,
        can_read: true,
        can_update: false,
        can_delete: false,
        scope: "school",
      },
      {
        feature_key: "attendance",
        can_create: false,
        can_read: true,
        can_update: false,
        can_delete: false,
        scope: "school",
      },
    ],
    roles: ["REGISTRAR"],
  },
  {
    name: "Teaching Access",
    description: "Standard teaching permissions",
    features: [
      {
        feature_key: "attendance",
        can_create: true,
        can_read: true,
        can_update: true,
        can_delete: false,
        scope: "own",
      },
      {
        feature_key: "grades",
        can_create: true,
        can_read: true,
        can_update: true,
        can_delete: false,
        scope: "own",
      },
      {
        feature_key: "users",
        can_create: false,
        can_read: true,
        can_update: false,
        can_delete: false,
        scope: "department",
      },
    ],
    roles: ["TEACHER"],
  },
];

const DEFAULT_SETTINGS = [
  {
    key: "academic_year_format",
    value: { format: "YYYY-YYYY", example: "2025-2026" },
  },
  { key: "grading_system", value: { type: "percentage", pass_mark: 50 } },
  { key: "attendance_tracking", value: { per_lesson: true, per_day: false } },
  {
    key: "parent_portal",
    value: {
      enabled: true,
      can_view_grades: true,
      can_view_attendance: true,
      can_view_fees: true,
    },
  },
  {
    key: "student_portal",
    value: { enabled: true, can_view_grades: true, can_view_timetable: true },
  },
  { key: "notifications", value: { email: true, in_app: true, sms: false } },
  {
    key: "mfa_required",
    value: { principal: true, bursar: true, ict_admin: true },
  },
];

export async function POST(req: Request) {
  const access = await requireActorContext(
    {
      allowedRoles: ["PRINCIPAL", "SUPER_ADMIN"],
      requireSchool: true,
    },
    req,
  );
  if (!access.ok) return access.response;

  const schoolId = access.context.schoolId!;

  try {
    const results = await initializeSchoolDefaults(schoolId);

    return NextResponse.json({
      success: true,
      schoolId,
      results,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: safeErrorMessage(err, "Failed to initialize school") },
      { status: 500 },
    );
  }
}

export async function GET(req: Request) {
  const access = await requireActorContext(
    {
      allowedRoles: ["PRINCIPAL", "SUPER_ADMIN"],
      requireSchool: true,
    },
    req,
  );
  if (!access.ok) return access.response;

  const schoolId = access.context.schoolId!;

  try {
    const [departments, permissionGroups, settings] = await Promise.all([
      supabaseAdmin
        .from("school_departments")
        .select("id, name, description, head_of_department")
        .eq("school_id", schoolId),
      supabaseAdmin
        .from("permission_groups")
        .select("id, name, description, is_system")
        .eq("school_id", schoolId),
      supabaseAdmin
        .from("school_settings")
        .select("setting_key, setting_value")
        .eq("school_id", schoolId),
    ]);

    const departmentCount = departments.data?.length || 0;
    const permissionGroupCount = permissionGroups.data?.length || 0;
    const settingsCount = settings.data?.length || 0;
    const progress = computeSchoolSetupProgress({
      departments: departmentCount,
      permissionGroups: permissionGroupCount,
      settings: settingsCount,
    });

    return NextResponse.json({
      success: true,
      data: {
        departments: departments.data || [],
        permissionGroups: permissionGroups.data || [],
        settings: settings.data || [],
        initialized: progress.initialized,
        setupProgressPercent: progress.percent,
      },
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: safeErrorMessage(err, "Failed to get school info") },
      { status: 500 },
    );
  }
}
