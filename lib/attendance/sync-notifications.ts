import { buildAttendanceNotificationPayloads } from "./notifications";
import { loadParentProfileIdsByStudentRowId } from "./parent-recipients";
import type { AttendanceStatus } from "./status";
import { enqueueNotifications } from "@/lib/notification-enqueue";
import { supabaseAdmin } from "@/lib/supabase";

/** Parent-facing alerts: present is not useful noise for families. */
const PARENT_ALERT_STATUSES = new Set(["ABSENT", "LATE", "SICK", "EXCUSED"]);

type SyncAttendanceNotificationsInput = {
  schoolId: string;
  teacherId: string;
  lesson: {
    id: string;
    title?: string | null;
    start_time?: string | null;
    subjects?:
      | { name?: string | null; code?: string | null }
      | Array<{ name?: string | null; code?: string | null }>
      | null;
  };
  classRow: unknown;
  rosterRows: Array<{
    id: string;
    profile_id?: string | null;
    profile?: {
      first_name?: string | null;
      last_name?: string | null;
      email?: string | null;
    } | null;
  }>;
  statuses: Array<{ studentId: string; status: string; remarks?: string | null }>;
  date: string;
};

export async function syncAttendanceNotifications(
  input: SyncAttendanceNotificationsInput,
) {
  if (input.statuses.length === 0) {
    return { parentCount: 0, notificationCount: 0, pushAttempted: false };
  }

  const [
    teacherById,
    teacherByAuth,
    parentProfileIdsByStudentRowId,
  ] = await Promise.all([
    supabaseAdmin
      .from("profiles")
      .select("id, first_name, last_name, email")
      .eq("id", input.teacherId)
      .maybeSingle(),
    // teacherId from the route is often the auth uid - profiles may use a different id.
    supabaseAdmin
      .from("profiles")
      .select("id, first_name, last_name, email")
      .eq("auth_user_id", input.teacherId)
      .maybeSingle(),
    loadParentProfileIdsByStudentRowId({
      schoolId: input.schoolId,
      rosterRows: input.rosterRows,
    }),
  ]);

  if (teacherById.error && teacherByAuth.error) {
    throw teacherById.error || teacherByAuth.error;
  }
  const teacherProfile = teacherById.data || teacherByAuth.data || null;

  const studentById = new Map(input.rosterRows.map((row) => [row.id, row]));
  const teacherName = buildDisplayName(teacherProfile || undefined, "Teacher");
  const className = buildClassLabel(input.classRow);
  const lessonName =
    input.lesson.title ||
    getSubjectField(input.lesson.subjects, "name") ||
    "Lesson";
  const timeLabel = input.lesson.start_time || null;

  const payloads = input.statuses.flatMap((row) => {
    const status = String(row.status || "").toUpperCase();
    const parentProfileIds =
      parentProfileIdsByStudentRowId.get(row.studentId) || [];
    const student = studentById.get(row.studentId);
    const studentProfileId = student?.profile_id || null;

    // Parents only get concern marks (late/absent/sick/excused).
    // Students still get a session note when they have a profile.
    const parentsForAlert = PARENT_ALERT_STATUSES.has(status)
      ? parentProfileIds.map((id) => ({ id }))
      : [];

    // Previously: no student.profile_id ⇒ zero payloads (parents skipped too).
    // That was the main "parents got nothing" bug when links existed.
    if (!studentProfileId && parentsForAlert.length === 0) {
      return [];
    }

    return buildAttendanceNotificationPayloads({
      studentUserId: studentProfileId || "",
      studentId: row.studentId,
      lessonId: input.lesson.id,
      sessionTime: timeLabel,
      parents: parentsForAlert,
      studentName: buildDisplayName(student?.profile, "Student"),
      className,
      lessonName,
      teacherName,
      date: input.date,
      timeLabel,
      status: status as AttendanceStatus,
      // When no student profile, only fan out to parents (see notifications.ts).
      parentOnly: !studentProfileId,
    });
  });

  if (payloads.length === 0) {
    return {
      parentCount: 0,
      notificationCount: 0,
      pushAttempted: false,
      reason:
        "No parent alerts built — students may be unmarked as late/absent, unlinked from parents, or missing profile links.",
    };
  }

  await enqueueNotifications(input.schoolId, payloads);

  const notifiedParentIds = new Set(
    payloads
      .map((p) => p.user_id)
      .filter((id) => {
        // Parent recipients are those not equal to a student profile on the roster.
        const studentProfiles = new Set(
          input.rosterRows.map((r) => r.profile_id).filter(Boolean),
        );
        return !studentProfiles.has(id);
      }),
  );

  // Best-effort Expo lock-screen push (does not block save if push infra missing).
  let pushAttempted = false;
  try {
    pushAttempted = await fanOutAttendancePushes(input.schoolId, payloads);
  } catch (err) {
    console.error("[attendance] push fan-out failed:", err);
  }

  return {
    parentCount: notifiedParentIds.size,
    notificationCount: payloads.length,
    pushAttempted,
  };
}

async function fanOutAttendancePushes(
  schoolId: string,
  payloads: Array<{ user_id: string; title: string; message: string; type: string }>,
): Promise<boolean> {
  const byUser = new Map<string, { title: string; body: string; type: string }>();
  for (const row of payloads) {
    if (!row.user_id) continue;
    // Prefer non-present titles for push when multiple rows exist.
    if (!byUser.has(row.user_id)) {
      byUser.set(row.user_id, {
        title: row.title,
        body: row.message,
        type: row.type || "attendance",
      });
    }
  }
  if (byUser.size === 0) return false;

  const userIds = Array.from(byUser.keys());

  // Map profile ids → auth ids so device tokens keyed either way still match.
  const { data: profiles } = await supabaseAdmin
    .from("profiles")
    .select("id, auth_user_id")
    .in("id", userIds);

  const lookupIds = new Set(userIds);
  for (const row of profiles || []) {
    if (row.auth_user_id) lookupIds.add(String(row.auth_user_id));
  }

  // Mobile registers as push_token; some installs used expo_push_token.
  let devices: Array<{ user_id?: string | null; push_token?: string | null; expo_push_token?: string | null }> | null =
    null;
  let deviceError: { message?: string } | null = null;

  const primary = await supabaseAdmin
    .from("user_devices")
    .select("user_id, push_token, expo_push_token")
    .in("user_id", Array.from(lookupIds));
  if (!primary.error) {
    devices = primary.data;
  } else {
    const fallback = await supabaseAdmin
      .from("user_devices")
      .select("user_id, push_token")
      .in("user_id", Array.from(lookupIds));
    if (!fallback.error) {
      devices = fallback.data;
    } else {
      const legacy = await supabaseAdmin
        .from("user_devices")
        .select("user_id, expo_push_token")
        .in("user_id", Array.from(lookupIds));
      devices = legacy.data;
      deviceError = legacy.error;
    }
  }

  if (deviceError) {
    // Table missing in some projects — log once-style soft fail.
    console.warn(
      "[attendance] user_devices unavailable for push:",
      deviceError.message,
    );
    return false;
  }

  const tokenByUser = new Map<string, string[]>();
  for (const device of devices || []) {
    const token = String(
      device.push_token || device.expo_push_token || "",
    ).trim();
    const uid = String(device.user_id || "").trim();
    if (!token || !uid) continue;
    const list = tokenByUser.get(uid) || [];
    list.push(token);
    tokenByUser.set(uid, list);
  }

  const messages: Array<Record<string, unknown>> = [];
  for (const [profileId, content] of byUser.entries()) {
    const tokens = new Set<string>([
      ...(tokenByUser.get(profileId) || []),
    ]);
    const profile = (profiles || []).find((p) => String(p.id) === profileId);
    if (profile?.auth_user_id) {
      for (const t of tokenByUser.get(String(profile.auth_user_id)) || []) {
        tokens.add(t);
      }
    }
    for (const token of tokens) {
      messages.push({
        to: token,
        title: content.title,
        body: content.body,
        sound: "default",
        priority: "high",
        channelId: "default",
        data: {
          type: content.type || "attendance",
          tab: "attendance",
          schoolId,
        },
      });
    }
  }

  if (messages.length === 0) {
    console.warn(
      "[attendance] no Expo tokens for parent/student recipients",
      { recipients: userIds.length },
    );
    return false;
  }

  // Direct Expo Push API (service role path — no edge function required).
  const chunkSize = 100;
  for (let i = 0; i < messages.length; i += chunkSize) {
    const chunk = messages.slice(i, i + chunkSize);
    const res = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(chunk),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("[attendance] Expo push failed:", res.status, text);
    }
  }

  return true;
}

function buildDisplayName(
  row:
    | {
        first_name?: string | null;
        last_name?: string | null;
        email?: string | null;
      }
    | null
    | undefined,
  fallback: string,
) {
  return (
    [row?.first_name, row?.last_name].filter(Boolean).join(" ").trim() ||
    row?.email ||
    fallback
  );
}

function buildClassLabel(classRow: any) {
  const className =
    typeof classRow?.name === "string" ? classRow.name.trim() : "";
  const gradeName =
    typeof classRow?.grades?.name === "string"
      ? classRow.grades.name.trim()
      : buildGradeLevelLabel(classRow?.grade_level);

  return (
    [gradeName, className].filter(Boolean).join(" - ") || className || "Class"
  );
}

function buildGradeLevelLabel(value: string | number | null | undefined) {
  const level = String(value || "").trim();
  return level ? `Grade ${level}` : "";
}

function getSubjectField(
  subject:
    | { name?: string | null; code?: string | null }
    | Array<{ name?: string | null; code?: string | null }>
    | null
    | undefined,
  field: "name" | "code",
) {
  if (Array.isArray(subject)) {
    return subject[0]?.[field] || null;
  }

  return subject?.[field] || null;
}
