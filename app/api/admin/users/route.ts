import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import {
  applyRateLimit,
  getClientIp,
  parseJsonWithSchema,
  safeErrorMessage,
} from "@/lib/server-guards";
import { tenantActorRateLimitKey } from "@/lib/tenant/tenant-context";
import { requireAdminContext } from "@/lib/server-auth";
import { requireFeatureAccess } from "@/lib/feature-permissions";
import { auditDomainWrite } from "@/lib/audit-domain";
import { createAuditLog } from "@/lib/audit-log";
import {
  buildCreatedAuthUserMetadata,
  buildCreatedProfilePayload,
  generateTemporaryPassword,
} from "@/lib/account-state";
import { buildUserWritePlan } from "@/lib/admin-user-directory";
import { toProtectedAvatarUrl } from "@/lib/avatar-url";
import {
  invalidateActorCaches,
  invalidateActorCachesForProfile,
  invalidateSchoolDashboardCaches,
} from "@/lib/invalidate-actor-caches";
import {
  blockedRoleCreationMessage,
  canActorCreateSchoolRole,
} from "@/lib/account-create-policy";
import { sendAccountCredentialsEmail } from "@/lib/send-account-credentials";
import { createOrUpdateAuthUserWithTemporaryPassword } from "@/lib/auth-admin-users";
import {
  ROLE_VALUES,
  createUserSchema,
  updateUserSchema,
} from "./schemas";
import {
  normalizeOptionalZambianPhone,
  zambianPhoneValidationError,
} from "@/lib/zambia-localization";
import {
  assertClassInSchool,
  assertTeacherHasClassAssignments,
  buildParentDetail,
  buildStudentDetail,
  buildTeacherDetail,
  buildDisplayName,
  conflictResponse,
  deleteParentRecords,
  emptyTeacherAssignmentInput,
  findUserCreateConflict,
  loadParentRecord,
  loadPersonProfile,
  loadStudentRecord,
  loadTeacherRecord,
  loadUserDirectory,
  mapUniqueViolationToUserCreateConflict,
  normalizeRoleValue,
  safeInsert,
  safeInsertIfTableExists,
  safeUpdateScoped,
  sanitizeParentExtras,
  sanitizeProfileExtras,
  syncTeacherClassSubjectAssignments,
  syncTeacherSpecializationRows,
  syncTeacherSupervisedClasses,
  validateTeacherAssignmentInput,
} from "./helpers";

export async function GET(req: Request) {
  try {
    const access = await requireAdminContext(req);
    if (!access.ok) return access.response;
    const perm = await requireFeatureAccess(access.context, "users", "read");
    if (!perm.ok) return perm.response;
    const { schoolId } = access.context;
    if (!schoolId) {
      return NextResponse.json(
        { error: "No school linked to this admin account" },
        { status: 403 },
      );
    }

    const { searchParams } = new URL(req.url);
    const profileId = String(searchParams.get("profileId") || "").trim();
    const requestedRole = normalizeRoleValue(searchParams.get("role"));

    if (!profileId) {
      return NextResponse.json({
        success: true,
        data: await loadUserDirectory(schoolId),
      });
    }

    const profile = await loadPersonProfile(profileId, schoolId);
    if (!profile) {
      return NextResponse.json(
        { error: "User profile not found" },
        { status: 404 },
      );
    }

    const role = requestedRole || normalizeRoleValue(profile.role);
    const baseProfile = {
      profileId: profile.id,
      role,
      displayName: buildDisplayName(profile),
      email: profile.email || null,
      avatarUrl: toProtectedAvatarUrl(profile.avatar_url, {
        schoolId,
        userId: profile.id,
      }),
      status: profile.is_active === false ? "INACTIVE" : "ACTIVE",
      updatedAt: profile.updated_at || profile.created_at || null,
    };

    if (role === "student") {
      return NextResponse.json({
        success: true,
        data: await buildStudentDetail(baseProfile, schoolId),
      });
    }

    if (role === "teacher") {
      return NextResponse.json({
        success: true,
        data: await buildTeacherDetail(baseProfile, schoolId),
      });
    }

    if (role === "parent") {
      return NextResponse.json({
        success: true,
        data: await buildParentDetail(baseProfile, schoolId),
      });
    }

    return NextResponse.json({ success: true, data: baseProfile });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to load user details") },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const access = await requireAdminContext(req);
    if (!access.ok) return access.response;
    const perm = await requireFeatureAccess(access.context, "users", "create");
    if (!perm.ok) return perm.response;
    const { schoolId } = access.context;
    if (!schoolId) {
      return NextResponse.json(
        { error: "No school linked to this admin account" },
        { status: 403 },
      );
    }
    const ip = getClientIp(req);
    const rate = await applyRateLimit({
      key: tenantActorRateLimitKey({
        scope: "admin-users",
        schoolId,
        req,
        userId: access.context.userId,
      }),
      limit: 250,
      windowMs: 60_000,
      failOpen: true,
    });
    if (!rate.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again shortly." },
        {
          status: 429,
          headers: { "Retry-After": String(rate.retryAfterSec) },
        },
      );
    }

    const body = await parseJsonWithSchema(req, createUserSchema);

    const role = String(body.role || "")
      .trim()
      .toLowerCase() as (typeof ROLE_VALUES)[number];
    const firstName = String(body.firstName || "").trim();
    const lastName = String(body.lastName || "").trim();
    const email = String(body.email || "")
      .trim()
      .toLowerCase();
    const phoneRaw = body.phone ? String(body.phone).trim() : null;
    const phoneError = zambianPhoneValidationError(phoneRaw);
    if (phoneError) {
      return NextResponse.json({ error: phoneError }, { status: 400 });
    }
    const phone = normalizeOptionalZambianPhone(phoneRaw);
    const teacherAssignments =
      role === "teacher"
        ? await validateTeacherAssignmentInput({
            schoolId,
            specializationSubjectIds: body.specializationSubjectIds,
            teachingAssignments: body.teachingAssignments,
            supervisedClassIds: body.supervisedClassIds,
          })
        : emptyTeacherAssignmentInput();
    const profileExtras = sanitizeProfileExtras(role, {
      ...(body.profileExtras || {}),
      specialization:
        teacherAssignments.specializationSummary ||
        body.profileExtras?.specialization,
    });
    const parentExtras = sanitizeParentExtras(body.parentExtras);

    if (!ROLE_VALUES.includes(role) || !firstName || !lastName || !email) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    if (!canActorCreateSchoolRole(access.context.role, role)) {
      return NextResponse.json(
        {
          error: blockedRoleCreationMessage(role, access.context.role),
        },
        { status: 403 },
      );
    }

    if (role === "student") {
      const classId = String(profileExtras.class_id || "").trim();
      if (!classId) {
        return NextResponse.json(
          {
            error:
              "Every student must be assigned to a class before the account can be created.",
          },
          { status: 400 },
        );
      }
      try {
        await assertClassInSchool(schoolId, classId);
      } catch (error: unknown) {
        return NextResponse.json(
          { error: safeErrorMessage(error, "Invalid class assignment.") },
          { status: 400 },
        );
      }
    }

    if (role === "teacher") {
      const assignmentError = assertTeacherHasClassAssignments({
        teachingAssignments: teacherAssignments.teachingAssignments,
        supervisedClassIds: teacherAssignments.supervisedClassIds,
      });
      if (assignmentError) return assignmentError;
      try {
        for (const classId of [
          ...teacherAssignments.teachingAssignments.map((row) => row.classId),
          ...teacherAssignments.supervisedClassIds,
        ]) {
          await assertClassInSchool(schoolId, classId);
        }
      } catch (error: unknown) {
        return NextResponse.json(
          { error: safeErrorMessage(error, "Invalid class assignment.") },
          { status: 400 },
        );
      }
    }

    // Fail fast on email / student number / employee number collisions so we
    // do not create an auth user and then 500 on profiles or role-table inserts.
    const preflightConflict = await findUserCreateConflict({
      email,
      role,
      admissionNumber: profileExtras.admission_number,
      classNumber: profileExtras.class_number ?? null,
      classId: profileExtras.class_id ?? null,
      schoolId,
      employeeId: profileExtras.employee_id,
    });
    if (preflightConflict) return conflictResponse(preflightConflict);

    const tempPassword = generateTemporaryPassword();

    const authResult = await createOrUpdateAuthUserWithTemporaryPassword({
      email,
      temporaryPassword: tempPassword,
      userMetadata: buildCreatedAuthUserMetadata({
        firstName,
        lastName,
        role,
      }),
    });

    const authUserId = authResult.user.id;

    // Auth user exists but profile may already be linked (retry after a partial
    // failure, or email already used). Never treat that as a blank create.
    if (!authResult.created) {
      const { data: existingProfile } = await supabaseAdmin
        .from("profiles")
        .select("id, email, role")
        .eq("id", authUserId)
        .maybeSingle();
      if (existingProfile?.id) {
        return conflictResponse({
          status: 409,
          code: "duplicate_profile",
          field: "email",
          error:
            "A user with this email already exists. Open them in the directory to edit or reset their temporary password.",
        });
      }
    }

    const profilePayload = buildCreatedProfilePayload({
      authUserId,
      schoolId,
      role,
      firstName,
      lastName,
      email,
      phone,
      profileExtras,
    });

    let profileCreated = false;
    try {
      await safeInsert("profiles", profilePayload);
      profileCreated = true;
      await invalidateActorCaches(authUserId);
    } catch (profileErr) {
      if (authResult.created) {
        try {
          await supabaseAdmin.auth.admin.deleteUser(authUserId);
        } catch {
          // best-effort cleanup
        }
      }
      const conflict = mapUniqueViolationToUserCreateConflict(profileErr);
      if (conflict) return conflictResponse(conflict);
      throw profileErr;
    }

    const rollbackCreatedUser = async () => {
      try {
        if (profileCreated) {
          await supabaseAdmin.from("profiles").delete().eq("id", authUserId);
        }
      } catch {
        // best-effort cleanup
      }
      try {
        if (authResult.created) {
          await supabaseAdmin.auth.admin.deleteUser(authUserId);
        }
      } catch {
        // best-effort cleanup
      }
    };

    try {
      if (role === "parent") {
        const parentPayload: Record<string, any> = {
          profile_id: authUserId,
          school_id: schoolId,
          phone,
          ...parentExtras,
        };
        await safeInsertIfTableExists("parents", parentPayload);
      }

      if (role === "teacher") {
        await safeInsertIfTableExists("teachers", {
          profile_id: authUserId,
          school_id: schoolId,
          employee_number: profileExtras.employee_id || null,
          employee_id: profileExtras.employee_id || null,
          department: profileExtras.department || null,
          specialization:
            teacherAssignments.specializationSummary ||
            profileExtras.specialization ||
            null,
          hire_date: profileExtras.hire_date || null,
          phone,
          is_active: profileExtras.is_active ?? true,
        });
        await syncTeacherSpecializationRows({
          schoolId,
          teacherProfileId: authUserId,
          subjectIds: teacherAssignments.specializationSubjectIds,
        });
        await syncTeacherClassSubjectAssignments({
          schoolId,
          teacherProfileId: authUserId,
          teachingAssignments: teacherAssignments.teachingAssignments,
        });
        await syncTeacherSupervisedClasses({
          schoolId,
          teacherProfileId: authUserId,
          supervisedClassIds: teacherAssignments.supervisedClassIds,
        });
      }

      if (role === "student") {
        const admissionStatus = profileExtras.class_id
          ? "class_assigned"
          : "registered";
        await safeInsertIfTableExists("students", {
          profile_id: authUserId,
          school_id: schoolId,
          admission_number: profileExtras.admission_number || null,
          student_number: profileExtras.admission_number || null,
          class_number: profileExtras.class_number ?? null,
          class_id: profileExtras.class_id || null,
          enrollment_date: profileExtras.enrollment_date || null,
          admission_status: admissionStatus,
          is_active: profileExtras.is_active ?? true,
        });
      }
    } catch (roleErr) {
      await rollbackCreatedUser();
      const conflict = mapUniqueViolationToUserCreateConflict(roleErr);
      if (conflict) return conflictResponse(conflict);
      throw roleErr;
    }

    const emailResult = await sendAccountCredentialsEmail({
      to: email,
      firstName,
      role,
      temporaryPassword: tempPassword,
    });

    await createAuditLog({
      schoolId,
      userId: access.context.userId,
      action: `user.create.${role}`,
      entityType: "profile",
      entityId: authUserId,
      newData: { ...profilePayload, temporaryPassword: undefined },
      ipAddress: ip,
    });
    await invalidateSchoolDashboardCaches(schoolId);

    return NextResponse.json({
      success: true,
      userId: authUserId,
      email,
      temporaryPassword: tempPassword,
      credentialsEmailSent: emailResult.success,
    });
  } catch (error: unknown) {
    const conflict = mapUniqueViolationToUserCreateConflict(error);
    if (conflict) {
      console.warn("Admin users POST conflict", conflict.code, error);
      return conflictResponse(conflict);
    }
    console.error("Admin users POST error", error);
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to create user") },
      { status: 500 },
    );
  }
}

export async function PUT(req: Request) {
  try {
    const access = await requireAdminContext(req);
    if (!access.ok) return access.response;
    const perm = await requireFeatureAccess(access.context, "users", "update");
    if (!perm.ok) return perm.response;
    const { schoolId } = access.context;
    if (!schoolId) {
      return NextResponse.json(
        { error: "No school linked to this admin account" },
        { status: 403 },
      );
    }
    const ip = getClientIp(req);
    const rate = await applyRateLimit({
      key: tenantActorRateLimitKey({
        scope: "admin-users-update",
        schoolId,
        req,
        userId: access.context.userId,
      }),
      limit: 30,
      windowMs: 60_000,
      failOpen: true,
    });
    if (!rate.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again shortly." },
        {
          status: 429,
          headers: { "Retry-After": String(rate.retryAfterSec) },
        },
      );
    }

    const body = await parseJsonWithSchema(req, updateUserSchema);
    const role = body.role;
    const phoneError = zambianPhoneValidationError(body.phone);
    if (phoneError) {
      return NextResponse.json({ error: phoneError }, { status: 400 });
    }
    const normalizedPhone = normalizeOptionalZambianPhone(body.phone);
    const profile = await loadPersonProfile(body.profileId, schoolId);
    if (!profile) {
      return NextResponse.json(
        { error: "User profile not found" },
        { status: 404 },
      );
    }
    const shouldSyncTeacherAssignments =
      role === "teacher" &&
      (body.specializationSubjectIds !== undefined ||
        body.teachingAssignments !== undefined ||
        body.supervisedClassIds !== undefined);
    const teacherAssignments = shouldSyncTeacherAssignments
      ? await validateTeacherAssignmentInput({
          schoolId,
          specializationSubjectIds: body.specializationSubjectIds,
          teachingAssignments: body.teachingAssignments,
          supervisedClassIds: body.supervisedClassIds,
        })
      : null;

    if (role === "student") {
      const classId = String(body.classId || "").trim();
      if (!classId) {
        return NextResponse.json(
          { error: "Every student must be assigned to a class." },
          { status: 400 },
        );
      }
      try {
        await assertClassInSchool(schoolId, classId);
      } catch (error: unknown) {
        return NextResponse.json(
          { error: safeErrorMessage(error, "Invalid class assignment.") },
          { status: 400 },
        );
      }
    }

    if (role === "teacher" && teacherAssignments) {
      const assignmentError = assertTeacherHasClassAssignments({
        teachingAssignments: teacherAssignments.teachingAssignments,
        supervisedClassIds: teacherAssignments.supervisedClassIds,
      });
      if (assignmentError) return assignmentError;
      try {
        for (const classId of [
          ...teacherAssignments.teachingAssignments.map((row) => row.classId),
          ...teacherAssignments.supervisedClassIds,
        ]) {
          await assertClassInSchool(schoolId, classId);
        }
      } catch (error: unknown) {
        return NextResponse.json(
          { error: safeErrorMessage(error, "Invalid class assignment.") },
          { status: 400 },
        );
      }
    }

    const writePlan = buildUserWritePlan({
      role,
      schoolId,
      profileId: body.profileId,
      form: {
        first_name: body.firstName,
        last_name: body.lastName,
        email: body.email,
        phone: normalizedPhone || "",
        gender: body.gender || "",
        status: body.status || "ACTIVE",
        admission_number: body.admissionNumber || "",
        class_number: body.classNumber ?? body.admissionNumber ?? "",
        class_id: body.classId || "",
        enrollment_date: body.enrollmentDate || "",
        employee_id: body.employeeId || "",
        department: body.department || "",
        specialization:
          teacherAssignments?.specializationSummary ||
          body.specialization ||
          "",
        hire_date: body.hireDate || "",
        relation_type: body.relationType || "",
        occupation: body.occupation || "",
      },
    });

    await safeUpdateScoped(
      "profiles",
      body.profileId,
      schoolId,
      writePlan.profile,
    );

    if (role === "student" && writePlan.roleRecord) {
      const existing = await loadStudentRecord(body.profileId, schoolId);
      if (existing?.id) {
        await safeUpdateScoped(
          "students",
          existing.id,
          schoolId,
          writePlan.roleRecord,
        );
      } else {
        await safeInsert("students", writePlan.roleRecord);
      }
    }

    if (role === "teacher" && writePlan.roleRecord) {
      const existing = await loadTeacherRecord(body.profileId, schoolId);
      if (existing?.id) {
        await safeUpdateScoped(
          "teachers",
          existing.id,
          schoolId,
          writePlan.roleRecord,
        );
      } else {
        await safeInsert("teachers", writePlan.roleRecord);
      }
      if (teacherAssignments) {
        await syncTeacherSpecializationRows({
          schoolId,
          teacherProfileId: body.profileId,
          subjectIds: teacherAssignments.specializationSubjectIds,
        });
        await syncTeacherClassSubjectAssignments({
          schoolId,
          teacherProfileId: body.profileId,
          teachingAssignments: teacherAssignments.teachingAssignments,
        });
        await syncTeacherSupervisedClasses({
          schoolId,
          teacherProfileId: body.profileId,
          supervisedClassIds: teacherAssignments.supervisedClassIds,
        });
      }
    }

    if (role === "parent" && writePlan.parentRecord) {
      const existing = await loadParentRecord(body.profileId, schoolId);
      if (existing?.id) {
        await safeUpdateScoped(
          "parents",
          existing.id,
          schoolId,
          writePlan.parentRecord,
        );
      } else {
        await safeInsert("parents", writePlan.parentRecord);
      }
    }

    await invalidateActorCachesForProfile(supabaseAdmin, body.profileId);

    await auditDomainWrite({
      schoolId,
      userId: access.context.userId,
      action: "user.updated",
      entityType: "profiles",
      entityId: body.profileId,
      oldData: {
        email: profile.email,
        role: profile.role,
        firstName: profile.first_name,
        lastName: profile.last_name,
      },
      newData: writePlan.profile,
      ipAddress: ip,
    });
    await invalidateSchoolDashboardCaches(schoolId);

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("Admin users PUT error", error);
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to update user") },
      { status: 500 },
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const access = await requireAdminContext(req);
    if (!access.ok) return access.response;
    const perm = await requireFeatureAccess(access.context, "users", "delete");
    if (!perm.ok) return perm.response;
    const { schoolId } = access.context;
    if (!schoolId) {
      return NextResponse.json(
        { error: "No school linked to this admin account" },
        { status: 403 },
      );
    }

    const { searchParams } = new URL(req.url);
    const profileId = String(searchParams.get("profileId") || "").trim();
    const role = normalizeRoleValue(searchParams.get("role"));

    if (!profileId) {
      return NextResponse.json(
        { error: "Profile ID is required" },
        { status: 400 },
      );
    }

    const profile = await loadPersonProfile(profileId, schoolId);
    if (!profile) {
      return NextResponse.json(
        { error: "User profile not found" },
        { status: 404 },
      );
    }

    const resolvedRole = role || normalizeRoleValue(profile.role);
    if (resolvedRole === "parent") {
      await deleteParentRecords(profileId, schoolId);
    } else if (resolvedRole === "student") {
      await supabaseAdmin
        .from("students")
        .delete()
        .eq("school_id", schoolId)
        .or(`profile_id.eq.${profileId},id.eq.${profileId}`);
    } else if (resolvedRole === "teacher") {
      await supabaseAdmin
        .from("teacher_subject_specializations")
        .delete()
        .eq("school_id", schoolId)
        .eq("teacher_profile_id", profileId);
      await supabaseAdmin
        .from("teacher_class_subject_assignments")
        .delete()
        .eq("school_id", schoolId)
        .eq("teacher_profile_id", profileId);
      await supabaseAdmin
        .from("classes")
        .update({ supervisor_id: null })
        .eq("school_id", schoolId)
        .eq("supervisor_id", profileId);
      await supabaseAdmin
        .from("teachers")
        .delete()
        .eq("school_id", schoolId)
        .or(`profile_id.eq.${profileId},id.eq.${profileId}`);
    }

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .delete()
      .eq("id", profileId)
      .eq("school_id", schoolId);

    if (profileError) throw profileError;

    await invalidateActorCachesForProfile(supabaseAdmin, profileId);

    const authDelete = await supabaseAdmin.auth.admin.deleteUser(profileId);
    if (
      authDelete.error &&
      !String(authDelete.error.message || "")
        .toLowerCase()
        .includes("not found")
    ) {
      throw authDelete.error;
    }

    await auditDomainWrite({
      schoolId,
      userId: access.context.userId,
      action: "user.deleted",
      entityType: "profiles",
      entityId: profileId,
      oldData: {
        email: profile.email,
        role: profile.role,
        firstName: profile.first_name,
        lastName: profile.last_name,
      },
      ipAddress: getClientIp(req),
    });
    await invalidateSchoolDashboardCaches(schoolId);

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("Admin users DELETE error", error);
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to delete user") },
      { status: 500 },
    );
  }
}

