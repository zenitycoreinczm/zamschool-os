import { enqueueNotifications } from "@/lib/notification-enqueue";
import { LATE_TEACHER_ALERT_MINUTES } from "@/lib/attendance/window";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * Notify Head Teacher (principal) that a teacher has not started roll call
 * 10+ minutes after the lesson start. Deduped per lesson/day.
 */
export async function notifyHeadTeacherOfLateRollCall(input: {
  schoolId: string;
  lessonId: string;
  date: string;
  teacherName: string;
  className: string;
  subjectName: string;
  startTime: string;
  minutesLate: number;
}): Promise<{ notified: number }> {
  const principalIds = await loadPrincipalProfileIds(input.schoolId);
  if (principalIds.length === 0) {
    return { notified: 0 };
  }

  const timeLabel = String(input.startTime || "").slice(0, 5);
  const title = `Late roll call: ${input.subjectName}`;
  const message = [
    `${input.teacherName} has not submitted roll call for ${input.subjectName}`,
    input.className ? `(${input.className})` : "",
    `scheduled at ${timeLabel}.`,
    `Currently ${input.minutesLate} minutes past start`,
    `(alert threshold ${LATE_TEACHER_ALERT_MINUTES} min).`,
  ]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  const payloads = principalIds.map((principalId) => ({
    user_id: principalId,
    dedupe_key: `late-rollcall:${input.schoolId}:${input.lessonId}:${input.date}`,
    title,
    message,
    type: "general" as const,
  }));

  await enqueueNotifications(input.schoolId, payloads);
  return { notified: payloads.length };
}

async function loadPrincipalProfileIds(schoolId: string): Promise<string[]> {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id, role")
    .eq("school_id", schoolId)
    .in("role", [
      "principal",
      "PRINCIPAL",
      "head_teacher",
      "HEAD_TEACHER",
      "admin",
      "ADMIN",
    ]);

  if (error) {
    // Soft-fail — never block roll call load/save on HT lookup.
    console.warn("[late-rollcall] principal lookup failed:", error.message);
    return [];
  }

  return Array.from(
    new Set(
      (data || [])
        .map((row) => String(row.id || "").trim())
        .filter(Boolean),
    ),
  );
}
