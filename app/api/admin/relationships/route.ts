import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminContext } from "@/lib/server-auth";
import {
  applyRateLimit,
  getClientIp,
  parseJsonWithSchema,
  safeErrorMessage,
} from "@/lib/server-guards";
import { supabaseAdmin } from "@/lib/supabase";
import { createAuditLog } from "@/lib/audit-log";
import { auditDomainWrite } from "@/lib/audit-domain";
import { requireFeatureAccess } from "@/lib/feature-permissions";
import { assertDomainAccess } from "@/lib/domain-ownership";
import { authorizeWorkflowTransition } from "@/lib/workflow-states";
import { validateSupervisorAssignment } from "@/lib/teacher-assignment-contract";
import {
  validateParentLinkProfile,
  validateStudentClassAssignment,
} from "@/lib/admin-relationship-contract";
import {
  fetchTeacherAssignmentReferences,
  isMissingRelationError,
} from "@/lib/teacher-assignment-references";

const relationshipMutationSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("assign_student_class"),
    studentProfileId: z.string().min(1),
    classId: z.string().nullable().optional(),
  }),
  z.object({
    action: z.literal("assign_class_supervisor"),
    classId: z.string().min(1),
    supervisorId: z.string().nullable().optional(),
  }),
  z.object({
    action: z.literal("link_parent_student"),
    parentProfileId: z.string().min(1),
    studentProfileId: z.string().min(1),
  }),
  z.object({
    action: z.literal("unlink_parent_student"),
    parentProfileId: z.string().min(1),
    studentProfileId: z.string().min(1),
  }),
]);

export async function GET(req: Request) {
  try {
    const access = await requireAdminContext(req);
    if (!access.ok) return access.response;
    const { schoolId } = access.context;

    if (!schoolId) {
      return NextResponse.json(
        { error: "No school linked to this admin account" },
        { status: 403 },
      );
    }

    const [
      studentProfiles,
      teacherProfiles,
      parentProfiles,
      studentRows,
      teacherRows,
      parentRows,
      classes,
      linksTable,
    ] = await Promise.all([
      fetchProfilesByRole(schoolId, ["student", "STUDENT"]),
      fetchProfilesByRole(schoolId, ["teacher", "TEACHER"]),
      fetchProfilesByRole(schoolId, ["parent", "PARENT"]),
      fetchStudentRows(schoolId),
      fetchTeacherRows(schoolId),
      fetchParentRows(schoolId),
      fetchClassRows(schoolId),
      resolveExistingTable(["parent_students", "parent_student_links"]),
    ]);

    const studentRowByProfileId = new Map(
      (studentRows || []).map((row: any) => [row.profile_id || row.id, row]),
    );
    const studentProfileIdByAnyId = new Map<string, string>();
    for (const row of studentRows || []) {
      if (row.id) studentProfileIdByAnyId.set(row.id, row.profile_id || row.id);
      if (row.profile_id)
        studentProfileIdByAnyId.set(row.profile_id, row.profile_id);
    }

    const teacherRowByProfileId = new Map(
      (teacherRows || []).map((row: any) => [row.profile_id || row.id, row]),
    );

    const classById = new Map((classes || []).map((row: any) => [row.id, row]));
    const parentProfileIdByAnyId = new Map<string, string>();
    for (const profile of parentProfiles || []) {
      if (profile.id) parentProfileIdByAnyId.set(profile.id, profile.id);
    }
    for (const row of parentRows || []) {
      if (row.id && row.profile_id)
        parentProfileIdByAnyId.set(row.id, row.profile_id);
      if (row.profile_id)
        parentProfileIdByAnyId.set(row.profile_id, row.profile_id);
    }

    let parentLinks: any[] = [];
    if (linksTable) {
      const parentIds = Array.from(parentProfileIdByAnyId.keys());
      if (parentIds.length > 0) {
        const { data, error } = await supabaseAdmin
          .from(linksTable)
          .select("parent_id, student_id, relationship")
          .in("parent_id", parentIds);

        if (error) throw error;
        parentLinks = data || [];
      }
    }

    const linkedStudentIdsByParentProfileId = new Map<string, string[]>();
    for (const link of parentLinks) {
      const parentProfileId = parentProfileIdByAnyId.get(link.parent_id || "");
      const studentProfileId =
        studentProfileIdByAnyId.get(link.student_id || "") ||
        link.student_id ||
        null;
      if (!parentProfileId || !studentProfileId) continue;

      const current =
        linkedStudentIdsByParentProfileId.get(parentProfileId) || [];
      if (!current.includes(studentProfileId)) {
        linkedStudentIdsByParentProfileId.set(parentProfileId, [
          ...current,
          studentProfileId,
        ]);
      }
    }

    const data = {
      students: (studentProfiles || []).map((profile: any) => {
        const studentRow = studentRowByProfileId.get(profile.id) || null;
        const classRow = studentRow?.class_id
          ? classById.get(studentRow.class_id)
          : null;
        return {
          profileId: profile.id,
          studentId: studentRow?.id || null,
          displayName: buildDisplayName(profile),
          email: profile.email || null,
          admissionNumber:
            studentRow?.admission_number || studentRow?.student_number || null,
          classId: studentRow?.class_id || null,
          className: buildClassLabel(classRow),
        };
      }),
      teachers: (teacherProfiles || []).map((profile: any) => {
        const teacherRow = teacherRowByProfileId.get(profile.id) || null;
        return {
          profileId: profile.id,
          teacherId: teacherRow?.id || null,
          displayName: buildDisplayName(profile),
          email: profile.email || null,
          employeeId:
            teacherRow?.employee_id || teacherRow?.employee_number || null,
        };
      }),
      parents: (parentProfiles || []).map((profile: any) => {
        const parentRow =
          (parentRows || []).find(
            (row: any) => row.profile_id === profile.id,
          ) || null;
        return {
          profileId: profile.id,
          parentId: parentRow?.id || null,
          displayName: buildDisplayName(profile),
          email: profile.email || null,
          relationType: parentRow?.relation_type || null,
          occupation: parentRow?.occupation || null,
          linkedStudentProfileIds:
            linkedStudentIdsByParentProfileId.get(profile.id) || [],
        };
      }),
      classes: (classes || []).map((row: any) => ({
        id: row.id,
        name: row.name || "Class",
        gradeLabel: buildGradeLabel(row),
        supervisorId: row.supervisor_id || null,
        supervisorName: buildDisplayName(row.profiles || null),
      })),
    };

    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        error: safeErrorMessage(error, "Failed to load relationship directory"),
      },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const access = await requireAdminContext(req);
    if (!access.ok) return access.response;
    const { schoolId } = access.context;

    if (!schoolId) {
      return NextResponse.json(
        { error: "No school linked to this admin account" },
        { status: 403 },
      );
    }

    const ip = getClientIp(req);
    const rate = await applyRateLimit({
      key: `admin-relationships:${ip}`,
      limit: 40,
      windowMs: 60_000,
    });
    if (!rate.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again shortly." },
        { status: 429, headers: { "Retry-After": String(rate.retryAfterSec) } },
      );
    }

    const body = await parseJsonWithSchema(req, relationshipMutationSchema);

    if (body.action === "assign_student_class") {
      const feature = await requireFeatureAccess(
        access.context,
        "classes",
        "update",
      );
      if (!feature.ok) return feature.response;
      // Class assignment is a registration operation.  Both the academic
      // domain owner (Academic Admin) and the registry domain owner
      // (Registrar) may assign students to existing classes.
      const academicDomain = assertDomainAccess({
        domain: "academic",
        role: access.context.role,
        action: "update",
      });
      const registryDomain = assertDomainAccess({
        domain: "registry",
        role: access.context.role,
        action: "update",
      });
      if (!academicDomain.ok && !registryDomain.ok) {
        return NextResponse.json(
          { error: academicDomain.error },
          { status: 403 },
        );
      }

      const student = await resolveStudentRecord(
        body.studentProfileId,
        schoolId,
      );
      if (!student) {
        return NextResponse.json(
          { error: "Student record not found" },
          { status: 404 },
        );
      }

      const classValidation = validateStudentClassAssignment({
        schoolId,
        classId: body.classId,
        classRow: body.classId
          ? await resolveClassRecord(body.classId, schoolId)
          : null,
      });
      if (!classValidation.ok) {
        return NextResponse.json(
          { error: classValidation.error },
          { status: classValidation.status },
        );
      }

      const { error } = await supabaseAdmin
        .from("students")
        .update({
          class_id: classValidation.data.classId,
          admission_status: "class_assigned",
          admission_status_updated_at: new Date().toISOString(),
          admission_status_updated_by: access.context.userId,
        })
        .eq("id", student.id)
        .eq("school_id", schoolId);

      if (error) throw error;

      await createAuditLog({
        schoolId,
        userId: access.context.userId,
        action: "admission.class_assigned",
        entityType: "student",
        entityId: student.id,
        newData: {
          classId: classValidation.data.classId,
          admissionStatus: "class_assigned",
        },
        ipAddress: getClientIp(req),
      });

      return NextResponse.json({ success: true });
    }

    if (body.action === "assign_class_supervisor") {
      const feature = await requireFeatureAccess(
        access.context,
        "classes",
        "update",
      );
      if (!feature.ok) return feature.response;
      // Assigning a class teacher is a registration operation.  Both the
      // academic domain owner (Academic Admin) and the registry domain
      // owner (Registrar) may assign supervisors to existing classes.
      const academicDomain = assertDomainAccess({
        domain: "academic",
        role: access.context.role,
        action: "update",
      });
      const registryDomain = assertDomainAccess({
        domain: "registry",
        role: access.context.role,
        action: "update",
      });
      if (!academicDomain.ok && !registryDomain.ok) {
        return NextResponse.json(
          { error: academicDomain.error },
          { status: 403 },
        );
      }

      const classRow = await resolveClassRecord(body.classId, schoolId);
      if (!classRow) {
        return NextResponse.json(
          { error: "Class not found in this school" },
          { status: 404 },
        );
      }

      const teacherReferences = await fetchTeacherAssignmentReferences(
        schoolId,
        body.supervisorId,
      );
      const supervisorValidation = validateSupervisorAssignment({
        schoolId,
        supervisorId: body.supervisorId,
        teacherProfiles: teacherReferences.teacherProfiles,
        teacherRows: teacherReferences.teacherRows,
      });
      if (!supervisorValidation.ok) {
        return NextResponse.json(
          { error: supervisorValidation.error },
          { status: supervisorValidation.status },
        );
      }

      const { error } = await supabaseAdmin
        .from("classes")
        .update({
          supervisor_id: supervisorValidation.data.supervisorProfileId,
        })
        .eq("id", body.classId)
        .eq("school_id", schoolId);

      if (error) throw error;

      await auditDomainWrite({
        schoolId,
        userId: access.context.userId,
        action: "classes.supervisor_assigned",
        entityType: "class",
        entityId: body.classId,
        newData: {
          supervisorId: supervisorValidation.data.supervisorProfileId,
        },
        ipAddress: getClientIp(req),
      });

      return NextResponse.json({ success: true });
    }

    const feature = await requireFeatureAccess(
      access.context,
      "users",
      "update",
    );
    if (!feature.ok) return feature.response;
    const domain = assertDomainAccess({
      domain: "registry",
      role: access.context.role,
      action: "update",
    });
    if (!domain.ok) {
      return NextResponse.json({ error: domain.error }, { status: 403 });
    }

    const parentsTable = await resolveExistingTable(["parents"]);
    const parentStudentsTable = await resolveExistingTable([
      "parent_students",
      "parent_student_links",
    ]);
    if (!parentsTable || !parentStudentsTable) {
      return NextResponse.json(
        {
          error: "Parent relationship tables are not available in this schema",
        },
        { status: 400 },
      );
    }

    const parentProfileValidation = validateParentLinkProfile({
      schoolId,
      parentProfile: await resolveProfileRecord(body.parentProfileId),
    });
    if (!parentProfileValidation.ok) {
      return NextResponse.json(
        { error: parentProfileValidation.error },
        { status: parentProfileValidation.status },
      );
    }

    const parentRecord = await ensureParentRecord(
      body.parentProfileId,
      schoolId,
      parentsTable,
    );
    const studentRecord = await resolveStudentRecord(
      body.studentProfileId,
      schoolId,
    );
    if (!parentRecord) {
      return NextResponse.json(
        { error: "Parent record not found" },
        { status: 404 },
      );
    }
    if (!studentRecord) {
      return NextResponse.json(
        { error: "Student record not found" },
        { status: 404 },
      );
    }

    if (body.action === "link_parent_student") {
      const existing = await supabaseAdmin
        .from(parentStudentsTable)
        .select("parent_id, student_id")
        .in("parent_id", [parentRecord.id, body.parentProfileId])
        .in("student_id", [studentRecord.id, body.studentProfileId])
        .limit(1);

      if (existing.error) throw existing.error;

      if ((existing.data || []).length === 0) {
        await safeInsertWithMissingColumnRetry(parentStudentsTable, {
          parent_id: parentRecord.id,
          student_id: studentRecord.id,
          school_id: schoolId,
          relationship: parentRecord.relation_type || null,
        });
      }

      await auditDomainWrite({
        schoolId,
        userId: access.context.userId,
        action: "registry.parent_student_linked",
        entityType: "parent_student_link",
        entityId: `${parentRecord.id}:${studentRecord.id}`,
        newData: {
          parentId: parentRecord.id,
          studentId: studentRecord.id,
          relationship: parentRecord.relation_type || null,
        },
        ipAddress: getClientIp(req),
      });

      return NextResponse.json({ success: true });
    }

    const { error } = await supabaseAdmin
      .from(parentStudentsTable)
      .delete()
      .in("parent_id", [parentRecord.id, body.parentProfileId])
      .in("student_id", [studentRecord.id, body.studentProfileId]);

    if (error) throw error;

    await auditDomainWrite({
      schoolId,
      userId: access.context.userId,
      action: "registry.parent_student_unlinked",
      entityType: "parent_student_link",
      entityId: `${parentRecord.id}:${studentRecord.id}`,
      oldData: {
        parentId: parentRecord.id,
        studentId: studentRecord.id,
      },
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to update relationships") },
      { status: 500 },
    );
  }
}

async function fetchProfilesByRole(schoolId: string, roles: string[]) {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id, first_name, last_name, email")
    .eq("school_id", schoolId)
    .in("role", roles)
    .order("first_name", { ascending: true });

  if (error) throw error;
  return data || [];
}

async function fetchStudentRows(schoolId: string) {
  const { data, error } = await supabaseAdmin
    .from("students")
    .select("id, profile_id, class_id, admission_number, student_number")
    .eq("school_id", schoolId);

  if (error) return [];
  return data || [];
}

async function fetchTeacherRows(schoolId: string) {
  const modern = await supabaseAdmin
    .from("teachers")
    .select("id, profile_id, employee_id, employee_number")
    .eq("school_id", schoolId);

  if (!modern.error) return modern.data || [];

  const fallback = await supabaseAdmin
    .from("teachers")
    .select("id, profile_id, employee_number")
    .eq("school_id", schoolId);

  if (fallback.error) return [];
  return (fallback.data || []).map((row: any) => ({
    ...row,
    employee_id: row.employee_number || null,
  }));
}

async function fetchParentRows(schoolId: string) {
  const { data, error } = await supabaseAdmin
    .from("parents")
    .select("id, profile_id, relation_type, occupation")
    .eq("school_id", schoolId);

  if (error) return [];
  return data || [];
}

async function fetchClassRows(schoolId: string) {
  const modern = await supabaseAdmin
    .from("classes")
    .select(
      "id, name, grade_id, grade_level, supervisor_id, grades(name, level), profiles:supervisor_id(first_name, last_name, email)",
    )
    .eq("school_id", schoolId)
    .order("name", { ascending: true });

  if (!modern.error) return modern.data || [];

  const legacy = await supabaseAdmin
    .from("classes")
    .select(
      "id, name, grade_level, supervisor_id, profiles:supervisor_id(first_name, last_name, email)",
    )
    .eq("school_id", schoolId)
    .order("name", { ascending: true });

  if (legacy.error) throw legacy.error;
  return legacy.data || [];
}

async function resolveExistingTable(candidates: string[]) {
  for (const table of candidates) {
    const { error } = await supabaseAdmin.from(table).select("id").limit(1);
    if (!error) return table;

    const code = String(error.code || "");
    const message = String(error.message || "").toLowerCase();
    if (
      code === "42P01" ||
      code === "PGRST205" ||
      message.includes("does not exist")
    ) {
      continue;
    }
  }
  return null;
}

async function resolveStudentRecord(
  studentProfileId: string,
  schoolId: string,
) {
  const { data, error } = await supabaseAdmin
    .from("students")
    .select("id, profile_id, school_id")
    .eq("school_id", schoolId)
    .or(`profile_id.eq.${studentProfileId},id.eq.${studentProfileId}`)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function resolveClassRecord(classId: string, schoolId: string) {
  const { data, error } = await supabaseAdmin
    .from("classes")
    .select("id, school_id")
    .eq("id", classId)
    .eq("school_id", schoolId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function resolveProfileRecord(profileId: string) {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id, school_id, role")
    .eq("id", profileId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function ensureParentRecord(
  parentProfileId: string,
  schoolId: string,
  parentsTable: string,
) {
  const existing = await supabaseAdmin
    .from(parentsTable)
    .select("id, profile_id, relation_type")
    .eq("school_id", schoolId)
    .eq("profile_id", parentProfileId)
    .maybeSingle();

  if (existing.error) throw existing.error;
  if (existing.data) return existing.data;

  return safeInsertWithMissingColumnRetry(parentsTable, {
    profile_id: parentProfileId,
    school_id: schoolId,
    relation_type: null,
  });
}

async function safeInsertWithMissingColumnRetry(
  table: string,
  payload: Record<string, any>,
) {
  let working = { ...payload };
  for (let index = 0; index < 10; index += 1) {
    const result = await supabaseAdmin
      .from(table)
      .insert(working)
      .select()
      .single();
    if (!result.error) return result.data;

    const missingColumn = extractMissingColumn(result.error.message);
    if (!missingColumn || !(missingColumn in working)) {
      throw result.error;
    }
    delete working[missingColumn];
  }

  throw new Error(`Failed to insert ${table}`);
}

function extractMissingColumn(message?: string) {
  if (!message) return null;
  const match = message.match(
    /column ([^.]+\.)?([a-zA-Z0-9_]+) does not exist/i,
  );
  if (match?.[2]) return match[2];
  const missing = message.match(/Could not find the '([^']+)' column/i);
  return missing?.[1] || null;
}



function buildDisplayName(profile: any) {
  return (
    [profile?.first_name, profile?.last_name]
      .filter(Boolean)
      .join(" ")
      .trim() ||
    profile?.email ||
    "User"
  );
}

function buildClassLabel(classRow: any) {
  if (!classRow) return "Unassigned class";
  const gradeLabel = buildGradeLabel(classRow);
  return [gradeLabel, classRow.name].filter(Boolean).join(" - ");
}

function buildGradeLabel(classRow: any) {
  if (!classRow) return "";
  const modern = String(classRow?.grades?.name || "").trim();
  if (modern) return modern;
  const level = String(
    classRow?.grades?.level || classRow?.grade_level || "",
  ).trim();
  return level ? `Grade ${level}` : "";
}
