import { NextResponse } from "next/server";

import { requireParentContext } from "@/lib/server-auth";
import { safeErrorMessage } from "@/lib/server-guards";
import { applyEdgeCacheHeaders } from "@/lib/edge-cache";
import { applyPlatformRateLimit, platformRateLimitResponse } from "@/lib/platform-api-guard";
import { supabaseAdmin } from "@/lib/supabase";
import { getParentRecord, getLinkedStudents, buildDisplayName } from "@/lib/parent-route-utils";

export async function GET(req: Request) {
  try {
    const access = await requireParentContext(req);
    if (!access.ok) return access.response;
    const { userId, schoolId } = access.context;
    if (!schoolId) {
      return NextResponse.json({ error: "No school linked to this account" }, { status: 403 });
    }

    const rl = await applyPlatformRateLimit({ scope: "parent-read", schoolId, req, userId, preset: "heavyRead" });
    if (!rl.allowed) return platformRateLimitResponse(rl);

    const parentRecord = await getParentRecord({ profileId: userId, schoolId });
    if (!parentRecord) {
      return jsonResponse({ success: true, data: [] });
    }

    const linked = await getLinkedStudents({
      parentRecordId: parentRecord.id,
      parentProfileId: userId,
      schoolId,
    });

    if (linked.profileIds.length === 0) {
      return jsonResponse({ success: true, data: [] });
    }

    const classIds = Array.from(
      new Set(linked.profileIds.map((profileId) => linked.classIdByProfileId.get(profileId)).filter(Boolean))
    ) as string[];

    if (classIds.length === 0) {
      return jsonResponse({ success: true, data: [] });
    }

    const { data: lessons, error: lessonsError } = await supabaseAdmin
      .from("lessons")
      .select("teacher_id, class_id, subject_id")
      .eq("school_id", schoolId)
      .in("class_id", classIds);

    if (lessonsError) throw lessonsError;

    const teacherIds = Array.from(new Set((lessons || []).map((l: any) => l.teacher_id).filter(Boolean)));
    if (teacherIds.length === 0) {
      return jsonResponse({ success: true, data: [] });
    }

    const subjectIds = Array.from(new Set((lessons || []).map((l: any) => l.subject_id).filter(Boolean)));

    const [teachersResult, subjectsResult, classesResult] = await Promise.all([
      supabaseAdmin.from("teachers").select("id, profile_id").eq("school_id", schoolId).in("id", teacherIds),
      subjectIds.length > 0
        ? supabaseAdmin.from("subjects").select("id, name").eq("school_id", schoolId).in("id", subjectIds)
        : Promise.resolve({ data: [], error: null }),
      supabaseAdmin.from("classes").select("id, name").eq("school_id", schoolId).in("id", classIds),
    ]);

    if (teachersResult.error) throw teachersResult.error;
    if (subjectsResult.error) throw subjectsResult.error;
    if (classesResult.error) throw classesResult.error;

    const teacherProfileIds = Array.from(new Set((teachersResult.data || []).map((t: any) => t.profile_id).filter(Boolean)));
    const { data: teacherProfiles } = teacherProfileIds.length > 0
      ? await supabaseAdmin.from("profiles").select("id, first_name, last_name, email, phone").in("id", teacherProfileIds)
      : { data: [] };

    const profileById = new Map((teacherProfiles || []).map((p: any) => [p.id, p]));
    const teacherRowById = new Map((teachersResult.data || []).map((t: any) => [t.id, t]));
    const subjectById = new Map((subjectsResult.data || []).map((s: any) => [s.id, s]));
    const classById = new Map((classesResult.data || []).map((c: any) => [c.id, c]));

    const teacherMap = new Map<string, any>();

    for (const lesson of lessons || []) {
      const teacherRow = teacherRowById.get(lesson.teacher_id);
      if (!teacherRow) continue;
      const profile = profileById.get(teacherRow.profile_id || "");
      const subject = subjectById.get(lesson.subject_id);
      const classRow = classById.get(lesson.class_id);

      const existing = teacherMap.get(teacherRow.id);
      if (existing) {
        if (subject && !existing.subjects.some((s: any) => s.id === subject.id)) {
          existing.subjects.push({ id: subject.id, name: subject.name });
        }
        if (classRow && !existing.classes.some((c: any) => c.id === classRow.id)) {
          existing.classes.push({ id: classRow.id, name: classRow.name });
        }
      } else {
        teacherMap.set(teacherRow.id, {
          id: teacherRow.id,
          name: buildDisplayName(profile || {}),
          email: profile?.email || null,
          phone: profile?.phone || null,
          subjects: subject ? [{ id: subject.id, name: subject.name }] : [],
          classes: classRow ? [{ id: classRow.id, name: classRow.name }] : [],
        });
      }
    }

    return jsonResponse({ success: true, data: Array.from(teacherMap.values()) });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to load parent teachers") },
      { status: 500 }
    );
  }
}

function jsonResponse(payload: unknown) {
  return applyEdgeCacheHeaders(NextResponse.json(payload), "privateRead");
}
