import { buildAcademicContextLabel } from "@/lib/live-schema-adapters";
import { CACHE_CONFIGS, withCache } from "@/lib/enhanced-cache";
import { supabaseAdmin } from "@/lib/supabase";

export type DashboardRoleCounts = {
  admin: number;
  teacher: number;
  student: number;
  parent: number;
};

export type DashboardStudentTotals = {
  total: number;
  boys: number;
  girls: number;
  unspecified: number;
};

export type DashboardSummary = {
  schoolId: string;
  academicLabel: string;
  roleCounts: DashboardRoleCounts;
  studentTotals: DashboardStudentTotals;
};

export async function loadDashboardSummary(schoolId: string): Promise<DashboardSummary> {
  return withCache(
    `school:${schoolId}`,
    () => buildDashboardSummary(schoolId),
    {
      ...CACHE_CONFIGS.admin.analytics,
      tags: ["dashboard"],
    }
  );
}

async function buildDashboardSummary(schoolId: string): Promise<DashboardSummary> {
  // All queries run in parallel. Role counts and gender breakdown are computed
  // server-side with targeted count queries - no full profiles table scan.
  const [
    yearResult,
    termResult,
    studentCount,
    teacherCount,
    parentCount,
    adminCount,
    boysCount,
    girlsCount,
  ] = await Promise.all([
    supabaseAdmin
      .from("academic_years")
      .select("name")
      .eq("school_id", schoolId)
      .eq("is_active", true)
      .maybeSingle(),
    supabaseAdmin
      .from("terms")
      .select("name")
      .eq("school_id", schoolId)
      .eq("is_active", true)
      .order("start_date", { ascending: false })
      .limit(1)
      .maybeSingle(),
    countSchoolRows("students", schoolId),
    countSchoolRows("teachers", schoolId),
    countSchoolRows("parents", schoolId),
    // Count admin-role profiles directly in the DB.
    countProfilesByRoles(schoolId, ["PRINCIPAL", "super_admin", "deputy_head", "academic_admin", "hr_admin", "ict_admin"]),
    // Gender breakdown via targeted count queries on profiles.
    countProfilesByGenders(schoolId, ["male", "m", "boy", "boys"]),
    countProfilesByGenders(schoolId, ["female", "f", "girl", "girls"]),
  ]);

  const academicLabel = buildAcademicContextLabel(yearResult.data?.name, termResult.data?.name);

  const roleCounts: DashboardRoleCounts = {
    admin: adminCount,
    teacher: teacherCount,
    student: studentCount,
    parent: parentCount,
  };

  const studentTotals: DashboardStudentTotals = {
    total: studentCount,
    boys: boysCount,
    girls: girlsCount,
    unspecified: Math.max(0, studentCount - boysCount - girlsCount),
  };

  return {
    schoolId,
    academicLabel,
    roleCounts,
    studentTotals,
  };
}

/** Count profiles in a school whose role matches any of the given stored values. */
async function countProfilesByRoles(schoolId: string, roles: string[]): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("school_id", schoolId)
    .in("role", roles);

  if (error) return 0;
  return count || 0;
}

/** Count student profiles in a school whose gender matches any of the given values. */
async function countProfilesByGenders(schoolId: string, genders: string[]): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("school_id", schoolId)
    .eq("role", "student")
    .in("gender", genders);

  if (error) return 0;
  return count || 0;
}

async function countSchoolRows(table: string, schoolId: string) {
  const { count, error } = await supabaseAdmin
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("school_id", schoolId);

  if (error) return 0;
  return count || 0;
}


