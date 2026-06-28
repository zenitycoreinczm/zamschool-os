import { NextResponse } from "next/server";

import { applyEdgeCacheHeaders } from "@/lib/edge-cache";
import { safeErrorMessage } from "@/lib/server-guards";
import { requireActorContext } from "@/lib/server-auth";
import { supabaseAdmin } from "@/lib/supabase";
import { fetchProfileByIdentity } from "@/lib/profile-lookup";
import { toProtectedAvatarUrl } from "@/lib/avatar-url";
import { buildAcademicContextLabel } from "@/lib/live-schema-adapters";
import { getUnreadCountsForUser } from "@/lib/inbox/read-cache";
import {
  applyPlatformRateLimit,
  platformRateLimitResponse,
} from "@/lib/platform-api-guard";
import {
  isRedisConfigured,
  redisGetJson,
  redisSetJson,
} from "@/lib/redis/client";
import { shellCacheKey } from "@/lib/redis/keys";
import { REDIS_TTL } from "@/lib/redis/ttl";

const SHELL_ROLES = [
  "ADMIN",
  "PRINCIPAL",
  "TEACHER",
  "STUDENT",
  "PARENT",
  "PAYMENTS",
  "DEPUTY_HEAD",
  "BURSAR",
  "ACADEMIC_ADMIN",
  "HR_ADMIN",
  "ICT_ADMIN",
  "DISCIPLINE_ADMIN",
  "REGISTRAR",
  "GUIDANCE_OFFICE",
  "SUPER_ADMIN",
] as const;

type ShellPayload = {
  userId: string;
  email: string;
  emailConfirmed: boolean;
  role: string;
  workspaceRole: string;
  schoolId: string | null;
  displayName: string;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
  schoolName: string;
  yearTerm: string;
  unread: { messages: number; notifications: number };
  shell: Record<string, unknown>;
};

export async function GET(req: Request) {
  try {
    const access = await requireActorContext(
      {
        allowedRoles: [...SHELL_ROLES],
        requireSchool: false,
        allowMetadataRoleFallback: true,
      },
      req,
    );
    if (!access.ok) return access.response;

    const { userId, schoolId } = access.context;

    const rate = await applyPlatformRateLimit({
      scope: "account-shell",
      schoolId: schoolId ?? "",
      req,
      userId,
      preset: "workspaceContext",
    });
    if (!rate.allowed) return platformRateLimitResponse(rate);

    // Try Redis cache first
    const cacheKey = shellCacheKey(userId, schoolId);
    if (isRedisConfigured()) {
      const cached = await redisGetJson<ShellPayload>(cacheKey);
      if (cached) {
        const response = NextResponse.json({ success: true, data: cached });
        return applyEdgeCacheHeaders(response, "privateWorkspace");
      }
    }

    // Cache miss — build from Supabase
    const payload = await buildShellPayload(access.context);

    // Write to Redis (fire-and-forget)
    if (isRedisConfigured()) {
      void redisSetJson(cacheKey, payload, REDIS_TTL.shellSec);
    }

    const response = NextResponse.json({ success: true, data: payload });
    return applyEdgeCacheHeaders(response, "privateWorkspace");
  } catch (error: unknown) {
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to load shell") },
      { status: 500 },
    );
  }
}

async function buildShellPayload(actor: {
  userId: string;
  role: string;
  schoolId: string | null;
  profileId?: string | null;
}): Promise<ShellPayload> {
  const { userId, schoolId, role } = actor;

  // Auth metadata
  let email = "";
  let emailConfirmed = false;
  try {
    const { data } = await supabaseAdmin.auth.admin.getUserById(userId);
    email = data?.user?.email || "";
    emailConfirmed = Boolean(data?.user?.email_confirmed_at);
  } catch {
    // non-blocking
  }

  // Profile
  const { data: profile } = await fetchProfileByIdentity<{
    id?: string;
    role?: string | null;
    school_id?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    email?: string | null;
    avatar_url?: string | null;
  }>(
    supabaseAdmin as never,
    actor.profileId || userId,
    "id, role, school_id, first_name, last_name, email, avatar_url",
    email,
  );

  const profileRole = String(profile?.role || role || "").trim();
  const profileSchoolId = profile?.school_id || schoolId;
  const firstName = profile?.first_name?.trim() || null;
  const lastName = profile?.last_name?.trim() || null;
  const displayName =
    [firstName, lastName].filter(Boolean).join(" ").trim() ||
    profile?.email ||
    email ||
    "Your Account";

  // School + academic context
  let schoolName = "Your School";
  let yearTerm = "Academic Context";

  if (profileSchoolId) {
    const [schoolResult, yearResult, termResult] = await Promise.all([
      supabaseAdmin
        .from("schools")
        .select("name")
        .eq("id", profileSchoolId)
        .maybeSingle(),
      supabaseAdmin
        .from("academic_years")
        .select("name")
        .eq("school_id", profileSchoolId)
        .eq("is_active", true)
        .maybeSingle(),
      supabaseAdmin
        .from("terms")
        .select("name")
        .eq("school_id", profileSchoolId)
        .eq("is_active", true)
        .maybeSingle(),
    ]);

    if (schoolResult.data?.name) schoolName = schoolResult.data.name;
    yearTerm = buildAcademicContextLabel(
      yearResult.data?.name,
      termResult.data?.name,
    );
  }

  // Unread counts
  const unread = profileSchoolId
    ? await getUnreadCountsForUser({ userId, schoolId: profileSchoolId })
    : { messages: 0, notifications: 0 };

  // Role-specific shell data
  const shell = await loadRoleShell(
    profileRole,
    userId,
    profileSchoolId,
    profile?.id,
  );

  return {
    userId,
    email,
    emailConfirmed,
    role: profileRole,
    workspaceRole: profileRole.toLowerCase(),
    schoolId: profileSchoolId,
    displayName,
    firstName,
    lastName,
    avatarUrl:
      profileSchoolId && profile?.id
        ? toProtectedAvatarUrl(profile.avatar_url, {
            schoolId: profileSchoolId,
            userId: profile.id,
          })
        : null,
    schoolName,
    yearTerm,
    unread,
    shell,
  };
}

async function loadRoleShell(
  role: string,
  userId: string,
  schoolId: string | null,
  profileId?: string | null,
): Promise<Record<string, unknown>> {
  const normalized = role.toLowerCase();

  if (normalized === "parent" && schoolId) {
    return loadParentShell(userId, schoolId);
  }
  if (normalized === "student" && schoolId) {
    return loadStudentShell(userId, schoolId);
  }
  if (normalized === "teacher" && schoolId) {
    return loadTeacherShell(userId, schoolId, profileId || userId);
  }
  return {};
}

async function loadParentShell(userId: string, schoolId: string) {
  const { data: parentRecord } = await supabaseAdmin
    .from("parents")
    .select("id")
    .eq("profile_id", userId)
    .eq("school_id", schoolId)
    .maybeSingle();

  if (!parentRecord) return { childrenCount: 0 };

  const { count } = await supabaseAdmin
    .from("parent_students")
    .select("id", { count: "exact", head: true })
    .eq("parent_id", parentRecord.id);

  return { childrenCount: count || 0 };
}

async function loadStudentShell(userId: string, schoolId: string) {
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("class_id, grade_id, admission_number")
    .eq("id", userId)
    .eq("school_id", schoolId)
    .maybeSingle();

  const classId = profile?.class_id || null;
  let className = null;
  let gradeLabel = null;

  if (classId) {
    const { data: classRow } = await supabaseAdmin
      .from("classes")
      .select("id, name, grade_level")
      .eq("id", classId)
      .eq("school_id", schoolId)
      .maybeSingle();

    className = classRow?.name || null;
    gradeLabel = classRow?.grade_level ? `Grade ${classRow.grade_level}` : null;
  }

  return {
    classId,
    className,
    gradeLabel,
    admissionNumber: profile?.admission_number || null,
  };
}

async function loadTeacherShell(
  userId: string,
  schoolId: string,
  profileId: string,
) {
  const today = new Date().toISOString().slice(0, 10);

  const [attendanceResult, assignmentsResult] = await Promise.all([
    supabaseAdmin
      .from("attendance")
      .select("id", { count: "exact", head: true })
      .eq("school_id", schoolId)
      .eq("date", today),
    supabaseAdmin
      .from("assignments")
      .select("id, teacher_id, created_at, class_id")
      .eq("school_id", schoolId)
      .eq("teacher_id", profileId),
  ]);

  const assignmentIds = (assignmentsResult.data || [])
    .map((a: any) => a.id)
    .filter(Boolean);
  let pendingGrades = 0;
  let draftResults = 0;

  if (assignmentIds.length > 0) {
    const [pendingResult, draftResult] = await Promise.all([
      supabaseAdmin
        .from("results")
        .select("id, created_at, score, grade")
        .eq("school_id", schoolId)
        .in("assignment_id", assignmentIds),
      supabaseAdmin
        .from("results")
        .select("id, published_at")
        .eq("school_id", schoolId)
        .in("assignment_id", assignmentIds),
    ]);

    pendingGrades = (pendingResult.data || []).filter(
      (r: any) => r.created_at && r.score == null && !r.grade,
    ).length;
    draftResults = (draftResult.data || []).filter(
      (r: any) => !r.published_at,
    ).length;
  }

  return {
    todayAttendanceMarked: (attendanceResult.count || 0) > 0,
    totalAssignments: assignmentIds.length,
    pendingGrades,
    draftResults,
  };
}
