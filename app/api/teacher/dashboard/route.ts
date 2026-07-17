import { NextResponse } from "next/server";

import { toProtectedAvatarUrl } from "@/lib/avatar-url";
import {
  buildDisplayName,
  isVisibleToRole,
  jsonWithPrivateCache,
} from "@/lib/teacher-route-common";
import { loadTeacherAccountDetail } from "@/lib/teacher-account-detail";
import { loadTeacherAssignmentScope } from "@/lib/teacher-assignment-scope-server";
import { requireTeacherContext } from "@/lib/server-auth";
import { getUnreadCountsForUser } from "@/lib/inbox/read-cache";
import {
  applyPlatformRateLimit,
  platformRateLimitResponse,
} from "@/lib/platform-api-guard";
import { safeErrorMessage } from "@/lib/server-guards";
import { supabaseAdmin } from "@/lib/supabase";
import { fetchProfileByIdentity } from "@/lib/profile-lookup";
import { withCache, CACHE_CONFIGS } from "@/lib/enhanced-cache";

export async function GET(req: Request) {
  try {
    const access = await requireTeacherContext(req);
    if (!access.ok) return access.response;
    if (!access.context.schoolId) {
      return NextResponse.json(
        { error: "No school linked to this account" },
        { status: 403 },
      );
    }

    const rate = await applyPlatformRateLimit({
      scope: "teacher-dashboard",
      schoolId: access.context.schoolId,
      req,
      userId: access.context.userId,
      preset: "teacherDashboard",
    });
    if (!rate.allowed) return platformRateLimitResponse(rate);

    const { data: profile, error: profileError } =
      await fetchProfileByIdentity<any>(
        supabaseAdmin as never,
        access.context.profileId || access.context.userId,
        "id, school_id, role, first_name, last_name, email, phone, avatar_url, is_active, updated_at, created_at",
      );

    if (profileError) throw profileError;
    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const profileId =
      profile.id || access.context.profileId || access.context.userId;

    const schoolId = access.context.schoolId;

    const dashboardData = await withCache(
      `teacher:${access.context.userId}:${schoolId}`,
      async () => {
        const assignmentScope = await loadTeacherAssignmentScope({
          schoolId,
          actorProfileId: profileId,
        });

        const assignments = await loadAssignmentsInScope(
          schoolId,
          assignmentScope,
        );

        const [teacher, unreadSummary, results, events] = await Promise.all([
          loadTeacherAccountDetail({
            schoolId,
            profileId,
            baseProfile: {
              profileId: profile.id,
              role: "teacher",
              displayName: buildDisplayName(profile),
              email: profile.email || null,
              avatarUrl: toProtectedAvatarUrl(profile.avatar_url, {
                schoolId,
                userId: profile.id,
              }),
              status: profile.is_active === false ? "INACTIVE" : "ACTIVE",
              updatedAt: profile.updated_at || profile.created_at || null,
            },
          }),
          getUnreadCountsForUser({
            userId: access.context.userId,
            schoolId,
          }),
          loadResultsInScope(schoolId, assignmentScope, assignments),
          loadUpcomingEvents(schoolId, access.context.role),
        ]);

        const pendingGrades = results.filter(
          (row: any) => row.created_at && row.score == null && !row.grade,
        ).length;
        const draftResults = results.filter((row: any) => !row.published_at).length;

        return {
          profile: {
            first_name: profile.first_name || "",
            last_name: profile.last_name || "",
            email: profile.email || "",
            phone: profile.phone || "",
            role: "TEACHER",
            status: profile.is_active === false ? "INACTIVE" : "ACTIVE",
          },
          teacher,
          workload: {
            unreadMessages: unreadSummary.messages,
            unreadNotifications: unreadSummary.notifications,
            pendingGrades,
            draftResults,
            upcomingEvents: events.length,
          },
          assignments: {
            total: assignments.length,
          },
          results: {
            total: results.length,
          },
          events: {
            total: events.length,
          },
        };
      },
      {
        ...CACHE_CONFIGS.teacher.dashboard,
        tags: ["dashboard"],
      }
    );

    return jsonWithPrivateCache(
      {
        success: true,
        data: dashboardData,
      },
      "dashboardRead",
    );
  } catch (error: unknown) {
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to load teacher dashboard") },
      { status: 500 },
    );
  }
}

async function loadAssignmentsInScope(
  schoolId: string,
  assignmentScope: { actorTeacherIds: string[]; allowedClassIds: string[] },
) {
  if (
    assignmentScope.actorTeacherIds.length === 0 ||
    assignmentScope.allowedClassIds.length === 0
  ) {
    return [];
  }

  const { data, error } = await supabaseAdmin
    .from("assignments")
    .select("id, class_id, subject_id, teacher_id, created_at")
    .eq("school_id", schoolId)
    .in("teacher_id", assignmentScope.actorTeacherIds)
    .in("class_id", assignmentScope.allowedClassIds);

  if (error) throw error;
  return data || [];
}

async function loadResultsInScope(
  schoolId: string,
  assignmentScope: { actorTeacherIds: string[]; allowedClassIds: string[] },
  assignments?: any[],
) {
  const resolvedAssignments =
    assignments ?? (await loadAssignmentsInScope(schoolId, assignmentScope));
  const assignmentIds = Array.from(
    new Set(resolvedAssignments.map((row: any) => row.id).filter(Boolean)),
  );
  if (assignmentIds.length === 0) return [];

  const { data, error } = await supabaseAdmin
    .from("results")
    .select("id, assignment_id, created_at, score, grade, published_at")
    .eq("school_id", schoolId)
    .in("assignment_id", assignmentIds);

  if (error) throw error;
  return data || [];
}

async function loadUpcomingEvents(schoolId: string, role: string) {
  const today = new Date().toISOString().slice(0, 10);

  const queryAttempts = [
    () =>
      supabaseAdmin
        .from("events")
        .select("id, target_role, event_date")
        .eq("school_id", schoolId)
        .gte("event_date", today),
    () =>
      supabaseAdmin
        .from("events")
        .select("id, event_date")
        .eq("school_id", schoolId)
        .gte("event_date", today),
  ];

  for (const runQuery of queryAttempts) {
    const result = await runQuery();
    if (!result.error) {
      return (result.data || []).filter((row: any) =>
        isVisibleToRole(row.target_role, role),
      );
    }
  }

  return [];
}
