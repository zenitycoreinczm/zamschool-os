import { NextResponse } from "next/server";

import { applyEdgeCacheHeaders } from "@/lib/edge-cache";
import { safeErrorMessage } from "@/lib/server-guards";
import { requireActorContext } from "@/lib/server-auth";
import { supabaseAdmin } from "@/lib/supabase";
import { buildWorkspaceContextPayload } from "@/lib/workspace/context-server";
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
      // Platform super_admin has no school — share the "platform" bucket, not "".
      schoolId: schoolId ?? "platform",
      req,
      userId,
      preset: "workspaceContext",
    });
    if (!rate.allowed) return platformRateLimitResponse(rate);

    // Try Redis cache first
    const cacheKey = shellCacheKey(userId, schoolId);
    if (isRedisConfigured()) {
      try {
        const cached = await redisGetJson<ShellPayload>(cacheKey);
        if (cached?.userId) {
          const response = NextResponse.json({ success: true, data: cached });
          return applyEdgeCacheHeaders(response, "privateWorkspace");
        }
      } catch {
        // Redis miss/errors must not take shell down.
      }
    }

    // Cache miss — build from Supabase
    const payload = await buildShellPayload(access.context);

    // Write to Redis (fire-and-forget)
    if (isRedisConfigured()) {
      void redisSetJson(cacheKey, payload, REDIS_TTL.shellSec).catch(() => {});
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
  // Reuse workspace context builder (Redis + hot-read caches) and load
  // role-specific shell extras in parallel instead of re-querying profile/auth.
  const basePromise = buildWorkspaceContextPayload({
    ok: true,
    userId: actor.userId,
    profileId: actor.profileId || actor.userId,
    schoolId: actor.schoolId,
    role: actor.role as never,
  });
  const shellPromise = loadRoleShell(
    actor.role,
    actor.userId,
    actor.schoolId,
    actor.profileId || actor.userId,
  );

  const [base, shell] = await Promise.all([basePromise, shellPromise]);

  // If role-specific shell needed the resolved school from profile, retry once
  // when actor.schoolId was null but base resolved a school.
  let roleShell = shell;
  const needsRoleShell =
    ["teacher", "parent", "student"].includes(
      String(base.role || actor.role).toLowerCase(),
    ) && Object.keys(shell).length === 0;

  if (needsRoleShell && base.schoolId) {
    roleShell = await loadRoleShell(
      base.role || actor.role,
      actor.userId,
      base.schoolId,
      actor.profileId || actor.userId,
    );
  }

  return {
    ...base,
    shell: roleShell,
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
    .select("class_id, grade_id, admission_number, student_number, class_number")
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

  const classNumber =
    typeof profile?.class_number === "number"
      ? profile.class_number
      : parsePositiveInt(profile?.student_number) ??
        parsePositiveInt(profile?.admission_number);

  return {
    classId,
    className,
    gradeLabel,
    classNumber,
    admissionNumber: profile?.admission_number || profile?.student_number || null,
  };
}

function parsePositiveInt(value: unknown): number | null {
  const raw = String(value ?? "").trim();
  if (!/^\d{1,5}$/.test(raw)) return null;
  const n = Number.parseInt(raw, 10);
  return n > 0 ? n : null;
}

async function loadTeacherShell(
  _userId: string,
  schoolId: string,
  profileId: string,
) {
  const today = new Date().toISOString().slice(0, 10);

  // Head counts only — never pull full result rows for shell badges.
  const [attendanceResult, assignmentCountResult, assignmentRows] =
    await Promise.all([
      supabaseAdmin
        .from("attendance")
        .select("id", { count: "exact", head: true })
        .eq("school_id", schoolId)
        .eq("date", today),
      supabaseAdmin
        .from("assignments")
        .select("id", { count: "exact", head: true })
        .eq("school_id", schoolId)
        .eq("teacher_id", profileId),
      supabaseAdmin
        .from("assignments")
        .select("id")
        .eq("school_id", schoolId)
        .eq("teacher_id", profileId)
        .limit(80),
    ]);

  const assignmentIds = (assignmentRows.data || [])
    .map((a: { id?: string }) => a.id)
    .filter(Boolean) as string[];

  let pendingGrades = 0;
  let draftResults = 0;

  if (assignmentIds.length > 0) {
    const [pendingCount, draftCount] = await Promise.all([
      supabaseAdmin
        .from("results")
        .select("id", { count: "exact", head: true })
        .eq("school_id", schoolId)
        .in("assignment_id", assignmentIds)
        .is("score", null)
        .is("grade", null),
      supabaseAdmin
        .from("results")
        .select("id", { count: "exact", head: true })
        .eq("school_id", schoolId)
        .in("assignment_id", assignmentIds)
        .is("published_at", null),
    ]);
    pendingGrades = pendingCount.count || 0;
    draftResults = draftCount.count || 0;
  }

  return {
    todayAttendanceMarked: (attendanceResult.count || 0) > 0,
    totalAssignments: assignmentCountResult.count || assignmentIds.length,
    pendingGrades,
    draftResults,
  };
}
