import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase";
import { createAuditLog } from "@/lib/audit-log";
import { requireActorContext } from "@/lib/server-auth";
import {
  checkFeaturePermission,
  requireFeatureAccess,
  type FeatureAction,
} from "@/lib/feature-permissions";
import { assertDomainAccess } from "@/lib/domain-ownership";
import {
  getClientIp,
  parseJsonWithSchema,
  safeErrorMessage,
} from "@/lib/server-guards";
import {
  buildDepartmentsStats,
  countMembersByDepartmentName,
  enrichDepartments,
  formatDepartmentHeadLabel,
  isEligibleDepartmentHeadRole,
  roleDisplayLabel,
  type DepartmentHeadSummary,
  type DepartmentStaffOption,
} from "@/lib/departments-workspace";
import { normalizeRole } from "@/lib/roles";

/** HR is seeded with `department`; older seeds used `users` for structure. */
async function requireDepartmentWriteAccess(
  context: { schoolId: string | null; role: string },
  action: FeatureAction,
) {
  if (await checkFeaturePermission(context, "department", action)) {
    return { ok: true as const };
  }
  return requireFeatureAccess(context, "users", action);
}

const departmentSchema = z.object({
  name: z.string().min(2).max(120),
  description: z.string().max(500).optional().nullable(),
  head_of_department: z.string().uuid().optional().nullable(),
});

const updateDepartmentSchema = departmentSchema.partial().extend({
  id: z.string().uuid(),
});

const DEPT_SELECT =
  "id, name, description, head_of_department, is_default, created_at, updated_at";

async function assertHeadInSchool(
  schoolId: string,
  headId: string | null | undefined,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!headId) return { ok: true };
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id, role, school_id")
    .eq("id", headId)
    .eq("school_id", schoolId)
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    return { ok: false, error: "Head of department must be a staff member at this school" };
  }
  if (!isEligibleDepartmentHeadRole(data.role)) {
    return {
      ok: false,
      error: "Only school staff can be assigned as head of department",
    };
  }
  return { ok: true };
}

async function loadWorkspacePayload(schoolId: string) {
  const [deptRes, profilesRes, teachersRes] = await Promise.all([
    supabaseAdmin
      .from("school_departments")
      .select(DEPT_SELECT)
      .eq("school_id", schoolId)
      .order("name", { ascending: true }),
    supabaseAdmin
      .from("profiles")
      .select(
        "id, first_name, last_name, email, role, department, is_active, status",
      )
      .eq("school_id", schoolId)
      .order("last_name", { ascending: true }),
    supabaseAdmin
      .from("teachers")
      .select("profile_id, department, is_active")
      .eq("school_id", schoolId),
  ]);

  if (deptRes.error) throw deptRes.error;
  if (profilesRes.error) throw profilesRes.error;
  if (teachersRes.error) throw teachersRes.error;

  const departmentsRaw = deptRes.data || [];
  const profiles = profilesRes.data || [];
  const teachers = teachersRes.data || [];

  const teacherDeptByProfile = new Map<string, string | null>();
  for (const row of teachers) {
    const pid = String(row.profile_id || "");
    if (pid) teacherDeptByProfile.set(pid, row.department ?? null);
  }

  const headById = new Map<string, DepartmentHeadSummary>();
  const staffOptions: DepartmentStaffOption[] = [];
  const staffDepartments: Array<string | null | undefined> = [];

  for (const profile of profiles) {
    const id = String(profile.id || "");
    if (!id) continue;
    if (!isEligibleDepartmentHeadRole(profile.role)) continue;

    const department =
      teacherDeptByProfile.get(id) || profile.department || null;
    const isTeacher = normalizeRole(profile.role) === "TEACHER";
    const label = formatDepartmentHeadLabel(profile);
    const roleLabel = roleDisplayLabel(profile.role);

    headById.set(id, {
      id,
      first_name: profile.first_name,
      last_name: profile.last_name,
      email: profile.email,
      role: profile.role,
      label,
    });

    // Prefer active staff for assignment dropdown (still include inactive for display).
    staffOptions.push({
      id,
      label: `${label}${roleLabel ? ` · ${roleLabel}` : ""}`,
      role: String(profile.role || ""),
      roleLabel,
      department,
      isTeacher,
    });

    if (isTeacher) {
      staffDepartments.push(department);
    }
  }

  staffOptions.sort((a, b) => a.label.localeCompare(b.label));

  const memberCounts = countMembersByDepartmentName(
    departmentsRaw.map((d) => d.name),
    staffDepartments,
  );

  const departments = enrichDepartments({
    departments: departmentsRaw,
    headById,
    memberCounts,
  });

  return {
    departments,
    staffOptions,
    stats: buildDepartmentsStats(departments, staffOptions.length),
  };
}

export async function GET(req: Request) {
  const access = await requireActorContext(
    {
      allowedRoles: [
        "PRINCIPAL",
        "DEPUTY_HEAD",
        "HR_ADMIN",
        "ACADEMIC_ADMIN",
        "SUPER_ADMIN",
      ],
      requireSchool: true,
    },
    req,
  );
  if (!access.ok) return access.response;

  try {
    const payload = await loadWorkspacePayload(access.context.schoolId!);
    return NextResponse.json({
      success: true,
      data: payload.departments,
      meta: {
        staffOptions: payload.staffOptions,
        stats: payload.stats,
      },
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: safeErrorMessage(err, "Failed to load departments") },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  const access = await requireActorContext(
    {
      allowedRoles: ["PRINCIPAL", "HR_ADMIN", "SUPER_ADMIN"],
      requireSchool: true,
    },
    req,
  );
  if (!access.ok) return access.response;
  const perm = await requireDepartmentWriteAccess(access.context, "create");
  if (!perm.ok) return perm.response;
  const domain = assertDomainAccess({
    domain: "people",
    role: access.context.role,
    action: "create",
  });
  if (!domain.ok)
    return NextResponse.json({ error: domain.error }, { status: 403 });

  try {
    const body = await parseJsonWithSchema(req, departmentSchema);
    const headCheck = await assertHeadInSchool(
      access.context.schoolId!,
      body.head_of_department,
    );
    if (!headCheck.ok) {
      return NextResponse.json({ error: headCheck.error }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("school_departments")
      .insert({
        school_id: access.context.schoolId,
        name: body.name.trim(),
        description: body.description?.trim() || null,
        head_of_department: body.head_of_department || null,
        is_default: false,
      })
      .select(DEPT_SELECT)
      .single();

    if (error) throw error;

    await createAuditLog({
      schoolId: access.context.schoolId,
      userId: access.context.userId,
      action: "department.created",
      entityType: "school_department",
      entityId: data.id,
      newData: { name: data.name },
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({ success: true, data });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: safeErrorMessage(err, "Failed to create department") },
      { status: 500 },
    );
  }
}

export async function PATCH(req: Request) {
  const access = await requireActorContext(
    {
      allowedRoles: ["PRINCIPAL", "HR_ADMIN", "SUPER_ADMIN"],
      requireSchool: true,
    },
    req,
  );
  if (!access.ok) return access.response;
  const perm = await requireDepartmentWriteAccess(access.context, "update");
  if (!perm.ok) return perm.response;
  const domain = assertDomainAccess({
    domain: "people",
    role: access.context.role,
    action: "update",
  });
  if (!domain.ok)
    return NextResponse.json({ error: domain.error }, { status: 403 });

  try {
    const body = await parseJsonWithSchema(req, updateDepartmentSchema);
    const { id, ...updates } = body;

    const { data: existing, error: existingError } = await supabaseAdmin
      .from("school_departments")
      .select("id, name, description, head_of_department, is_default")
      .eq("id", id)
      .eq("school_id", access.context.schoolId)
      .maybeSingle();

    if (existingError) throw existingError;
    if (!existing) {
      return NextResponse.json(
        { error: "Department not found" },
        { status: 404 },
      );
    }

    if (updates.head_of_department !== undefined) {
      const headCheck = await assertHeadInSchool(
        access.context.schoolId!,
        updates.head_of_department,
      );
      if (!headCheck.ok) {
        return NextResponse.json({ error: headCheck.error }, { status: 400 });
      }
    }

    const payload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (updates.name !== undefined) payload.name = updates.name.trim();
    if (updates.description !== undefined)
      payload.description = updates.description?.trim() || null;
    if (updates.head_of_department !== undefined)
      payload.head_of_department = updates.head_of_department || null;

    const { data, error } = await supabaseAdmin
      .from("school_departments")
      .update(payload)
      .eq("id", id)
      .eq("school_id", access.context.schoolId)
      .select(DEPT_SELECT)
      .single();

    if (error) throw error;

    await createAuditLog({
      schoolId: access.context.schoolId,
      userId: access.context.userId,
      action: "department.updated",
      entityType: "school_department",
      entityId: id,
      oldData: existing,
      newData: data,
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({ success: true, data });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: safeErrorMessage(err, "Failed to update department") },
      { status: 500 },
    );
  }
}

export async function DELETE(req: Request) {
  const access = await requireActorContext(
    {
      allowedRoles: ["PRINCIPAL", "HR_ADMIN", "SUPER_ADMIN"],
      requireSchool: true,
    },
    req,
  );
  if (!access.ok) return access.response;
  const perm = await requireDepartmentWriteAccess(access.context, "delete");
  if (!perm.ok) return perm.response;
  const domain = assertDomainAccess({
    domain: "people",
    role: access.context.role,
    action: "delete",
  });
  if (!domain.ok)
    return NextResponse.json({ error: domain.error }, { status: 403 });

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json(
        { error: "Department id is required" },
        { status: 400 },
      );
    }

    const { data: existing, error: existingError } = await supabaseAdmin
      .from("school_departments")
      .select("id, name, is_default")
      .eq("id", id)
      .eq("school_id", access.context.schoolId)
      .maybeSingle();

    if (existingError) throw existingError;
    if (!existing) {
      return NextResponse.json(
        { error: "Department not found" },
        { status: 404 },
      );
    }
    if (existing.is_default) {
      return NextResponse.json(
        { error: "Default departments cannot be deleted" },
        { status: 400 },
      );
    }

    const { error } = await supabaseAdmin
      .from("school_departments")
      .delete()
      .eq("id", id)
      .eq("school_id", access.context.schoolId);

    if (error) throw error;

    await createAuditLog({
      schoolId: access.context.schoolId,
      userId: access.context.userId,
      action: "department.deleted",
      entityType: "school_department",
      entityId: id,
      oldData: existing,
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: safeErrorMessage(err, "Failed to delete department") },
      { status: 500 },
    );
  }
}
