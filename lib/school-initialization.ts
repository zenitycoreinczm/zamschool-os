import { supabaseAdmin } from "@/lib/supabase";
import { DEFAULT_PERMISSION_GROUPS } from "@/lib/permission-group-defaults";
import { invalidateSchoolPermissionCache } from "@/lib/feature-permissions";
import { roleToStoredValue } from "@/lib/roles";

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

const DEFAULT_SETTINGS = [
  {
    key: "academic_year_format",
    value: { format: "YYYY-YYYY", example: "2025-2026" },
  },
  { key: "grading_system", value: { type: "percentage", pass_mark: 50 } },
  { key: "attendance_tracking", value: { per_lesson: true, per_day: false } },
  {
    // Shared school day: Head Teacher can override via /api/admin/school-hours.
    // Mobile morning reminders + timetable bounds use this.
    key: "school_day",
    value: {
      timezone: "Africa/Lusaka",
      schoolOpensAt: "07:00",
      classesStartAt: "08:00",
      classesEndAt: "16:00",
      schoolClosesAt: "16:30",
      morningReminderOffsetsMinutes: [120, 90, 60, 30],
    },
  },
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
    value: {
      super_admin: true,
      principal: true,
      bursar: true,
      ict_admin: true,
    },
  },
  {
    key: "tenant_isolation",
    value: { school_is_tenant: true, direct_cross_school_access: false },
  },
];

type InitResult = Record<
  string,
  { status: string; count?: number; error?: string }
>;

async function syncDefaultPermissionGroups(schoolId: string) {
  const { data: groupRows, error: groupError } = await supabaseAdmin
    .from("permission_groups")
    .upsert(
      DEFAULT_PERMISSION_GROUPS.map((group) => ({
        school_id: schoolId,
        name: group.name,
        description: group.description,
        is_system: true,
      })),
      { onConflict: "school_id,name" },
    )
    .select("id, name");

  if (groupError || !groupRows) {
    return {
      status: "error",
      error: groupError?.message || "Failed to synchronize permission groups",
    };
  }

  const groupIdByName = new Map(
    groupRows.map((row: { id: string; name: string }) => [row.name, row.id]),
  );

  const roleRows = DEFAULT_PERMISSION_GROUPS.flatMap((group) => {
    const groupId = groupIdByName.get(group.name);
    if (!groupId) return [];

    return group.roles.flatMap((role) => {
      const storedRole = roleToStoredValue(role);
      return storedRole
        ? [{ school_id: schoolId, group_id: groupId, role: storedRole }]
        : [];
    });
  });

  const featureRows = DEFAULT_PERMISSION_GROUPS.flatMap((group) => {
    const groupId = groupIdByName.get(group.name);
    if (!groupId) return [];

    return group.features.map((feature) => ({
      school_id: schoolId,
      group_id: groupId,
      ...feature,
    }));
  });

  const [rolesUpsert, featuresUpsert] = await Promise.all([
    roleRows.length
      ? supabaseAdmin
          .from("permission_group_roles")
          .upsert(roleRows, { onConflict: "group_id,role" })
      : Promise.resolve({ error: null }),
    featureRows.length
      ? supabaseAdmin
          .from("permission_features")
          .upsert(featureRows, { onConflict: "group_id,feature_key" })
      : Promise.resolve({ error: null }),
  ]);

  const permissionError = rolesUpsert.error || featuresUpsert.error;
  if (permissionError) {
    return { status: "error", error: permissionError.message };
  }

  invalidateSchoolPermissionCache(schoolId);
  return { status: "synced", count: groupRows.length };
}

export async function initializeSchoolDefaults(
  schoolId: string,
): Promise<InitResult> {
  const results: InitResult = {};

  const [departmentsLookup, groupsLookup, settingsLookup] = await Promise.all([
    supabaseAdmin
      .from("school_departments")
      .select("id")
      .eq("school_id", schoolId)
      .limit(1),
    supabaseAdmin
      .from("permission_groups")
      .select("id")
      .eq("school_id", schoolId)
      .limit(1),
    supabaseAdmin
      .from("school_settings")
      .select("id")
      .eq("school_id", schoolId)
      .limit(1),
  ]);

  const existingDepartments = departmentsLookup.data;
  const existingGroups = groupsLookup.data;
  const existingSettings = settingsLookup.data;

  if (!existingDepartments || existingDepartments.length === 0) {
    const { data, error } = await supabaseAdmin
      .from("school_departments")
      .insert(
        DEFAULT_DEPARTMENTS.map((department, index) => ({
          school_id: schoolId,
          name: department.name,
          description: department.description,
          is_default: index === 0,
        })),
      )
      .select("id");

    results.departments = error
      ? { status: "error", error: error.message }
      : { status: "created", count: data?.length || 0 };
  } else {
    results.departments = {
      status: "skipped",
      count: existingDepartments.length,
    };
  }

  results.permissions = await syncDefaultPermissionGroups(schoolId);
  if (
    existingGroups &&
    existingGroups.length > 0 &&
    results.permissions.status === "synced"
  ) {
    results.permissions = {
      ...results.permissions,
      status: "repaired",
      count: existingGroups.length,
    };
  }

  if (!existingSettings || existingSettings.length === 0) {
    const { error } = await supabaseAdmin.from("school_settings").insert(
      DEFAULT_SETTINGS.map((setting) => ({
        school_id: schoolId,
        setting_key: setting.key,
        setting_value: setting.value,
      })),
    );

    results.settings = error
      ? { status: "error", error: error.message }
      : { status: "created", count: DEFAULT_SETTINGS.length };
  } else {
    results.settings = { status: "skipped", count: existingSettings.length };
  }

  return results;
}
