import { NextResponse } from "next/server";

import { requireParentContext } from "@/lib/server-auth";
import { safeErrorMessage } from "@/lib/server-guards";
import { applyEdgeCacheHeaders } from "@/lib/edge-cache";
import { applyPlatformRateLimit, platformRateLimitResponse } from "@/lib/platform-api-guard";
import { supabaseAdmin } from "@/lib/supabase";
import { getParentRecord, getLinkedStudents, buildClassLabel, buildDisplayName } from "@/lib/parent-route-utils";

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
      .select("id, title, class_id, subject_id, teacher_id, day_of_week, start_time, end_time, room")
      .eq("school_id", schoolId)
      .in("class_id", classIds)
      .order("day_of_week", { ascending: true })
      .order("start_time", { ascending: true });

    if (lessonsError) throw lessonsError;

    const teacherIds = Array.from(new Set((lessons || []).map((l: any) => l.teacher_id).filter(Boolean)));
    const subjectIds = Array.from(new Set((lessons || []).map((l: any) => l.subject_id).filter(Boolean)));

    const [teachersResult, subjectsResult, classesResult] = await Promise.all([
      teacherIds.length > 0
        ? supabaseAdmin.from("teachers").select("id, profile_id").eq("school_id", schoolId).in("id", teacherIds)
        : Promise.resolve({ data: [], error: null }),
      subjectIds.length > 0
        ? supabaseAdmin.from("subjects").select("id, name, code").eq("school_id", schoolId).in("id", subjectIds)
        : Promise.resolve({ data: [], error: null }),
      classIds.length > 0
        ? supabaseAdmin.from("classes").select("id, name").eq("school_id", schoolId).in("id", classIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (teachersResult.error) throw teachersResult.error;
    if (subjectsResult.error) throw subjectsResult.error;
    if (classesResult.error) throw classesResult.error;

    const teacherProfileIds = Array.from(new Set((teachersResult.data || []).map((t: any) => t.profile_id).filter(Boolean)));
    const { data: teacherProfiles } = teacherProfileIds.length > 0
      ? await supabaseAdmin.from("profiles").select("id, first_name, last_name").in("id", teacherProfileIds)
      : { data: [] };

    const teacherProfileById = new Map((teacherProfiles || []).map((p: any) => [p.id, p]));
    const teacherRowByTeacherId = new Map((teachersResult.data || []).map((t: any) => [t.id, t]));
    const subjectById = new Map((subjectsResult.data || []).map((s: any) => [s.id, s]));
    const classById = new Map((classesResult.data || []).map((c: any) => [c.id, c]));

    const data = (lessons || []).map((lesson: any) => {
      const teacherRow = teacherRowByTeacherId.get(lesson.teacher_id);
      const teacherProfile = teacherProfileById.get(teacherRow?.profile_id || "");
      const subject = subjectById.get(lesson.subject_id);
      const classRow = classById.get(lesson.class_id);

      return {
        id: lesson.id,
        title: lesson.title || subject?.name || "Lesson",
        classId: lesson.class_id,
        className: classRow?.name || "Class",
        subjectId: lesson.subject_id,
        subjectName: subject?.name || "Subject",
        subjectCode: subject?.code || null,
        teacherId: lesson.teacher_id,
        teacherName: buildDisplayName(teacherProfile || {}),
        dayOfWeek: lesson.day_of_week,
        startTime: lesson.start_time,
        endTime: lesson.end_time,
        room: lesson.room || null,
      };
    });

    return jsonResponse({ success: true, data });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to load parent timetable") },
      { status: 500 }
    );
  }
}

function jsonResponse(payload: unknown) {
  return applyEdgeCacheHeaders(NextResponse.json(payload), "privateRead");
}
