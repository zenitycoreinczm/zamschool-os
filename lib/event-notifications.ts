import { loadParentProfileIdsByStudentRowId } from "@/lib/attendance/parent-recipients";
import { enqueueNotifications } from "@/lib/notification-enqueue";
import { dispatchExpoPushToUsers } from "@/lib/push-dispatch";
import { matchesRoleTarget } from "@/lib/role-audience-match";
import { normalizeRole, roleToStoredValue } from "@/lib/roles";
import { supabaseAdmin } from "@/lib/supabase";

type EventAudienceInput = {
  schoolId: string;
  eventId: string;
  title: string;
  description?: string | null;
  eventDate?: string | null;
  startTime?: string | null;
  location?: string | null;
  targetRole?: string | null;
  targetClassId?: string | null;
};

export type EventNotifyResult = {
  recipientCount: number;
  notificationsQueued: number;
  pushSent: number;
  audience: string;
  source?: string;
};

type AudienceKey = "all" | "parent" | "teacher" | "student" | "principal" | "leadership" | "other";

/**
 * Fan-out a school event into per-user notification rows + Expo push so
 * parents/teachers/students see it in the bell and on lock screen.
 *
 * Non-throwing: event create must still succeed if notify delivery fails.
 */
export async function notifySchoolEventAudience(
  input: EventAudienceInput,
): Promise<EventNotifyResult> {
  const audience = normalizeAudienceRole(String(input.targetRole || "").trim()) || "all";
  const empty: EventNotifyResult = {
    recipientCount: 0,
    notificationsQueued: 0,
    pushSent: 0,
    audience,
  };
  const schoolId = String(input.schoolId || "").trim();
  const eventId = String(input.eventId || "").trim();
  const title = String(input.title || "").trim() || "School event";
  if (!schoolId || !eventId) return empty;

  try {
    const { ids: recipients, source } = await resolveEventRecipientIds(input);
    if (recipients.length === 0) {
      console.warn("[event-notify] zero recipients", {
        schoolId,
        eventId,
        targetRole: input.targetRole,
        audience,
        targetClassId: input.targetClassId,
        source,
      });
      return { ...empty, source };
    }

    const when = formatEventWhen(input.eventDate, input.startTime);
    const where = String(input.location || "").trim();
    const summary = String(input.description || "").trim();
    const messageParts = [
      when ? `When: ${when}` : null,
      where ? `Where: ${where}` : null,
      summary || null,
    ].filter(Boolean);
    const message = messageParts.join("\n") || title;
    const notifTitle = `New event: ${title}`;

    // notifications.user_id FK → profiles.id (same as attendance fan-out).
    const payloads = recipients.map((userId) => ({
      user_id: userId,
      dedupe_key: `event:${eventId}:${userId}`,
      title: notifTitle,
      message,
      // Allowed by notifications_type_check
      type: "general" as const,
    }));

    await enqueueNotifications(schoolId, payloads);

    let pushSent = 0;
    try {
      const push = await dispatchExpoPushToUsers(
        schoolId,
        recipients.map((userId) => ({
          userId,
          title: notifTitle,
          body: message.replace(/\n/g, " ").slice(0, 180),
          type: "event",
          tab: "events",
          data: { eventId, type: "event" },
        })),
      );
      pushSent = push.sent;
    } catch (err) {
      console.warn("[event-notify] push fan-out failed", err);
    }

    console.info("[event-notify] delivered", {
      schoolId,
      eventId,
      audience,
      source,
      recipientCount: recipients.length,
      pushSent,
    });

    return {
      recipientCount: recipients.length,
      notificationsQueued: payloads.length,
      pushSent,
      audience,
      source,
    };
  } catch (error) {
    console.warn("Event notification fan-out failed", error);
    return empty;
  }
}

async function resolveEventRecipientIds(
  input: EventAudienceInput,
): Promise<{ ids: string[]; source: string }> {
  const schoolId = input.schoolId;
  const targetClassId = String(input.targetClassId || "").trim();
  const audience = normalizeAudienceRole(String(input.targetRole || "").trim());

  // Class-targeted events → students in that class (+ linked parents)
  if (targetClassId) {
    const ids = await resolveClassAudience(schoolId, targetClassId);
    return { ids, source: "class" };
  }

  // Multi-source resolution: role tables + profiles. Attendance works because
  // it uses parent_students; profiles alone often miss parents with null school_id
  // or odd role strings. Mirror that reliability for events.
  if (!audience || audience === "all") {
    const [parents, teachers, students, staffProfiles] = await Promise.all([
      loadParentProfileIdsForSchool(schoolId),
      loadTeacherProfileIdsForSchool(schoolId),
      loadStudentProfileIdsForSchool(schoolId),
      loadProfileIdsByAudience(schoolId, "all"),
    ]);
    const ids = unique([
      ...parents,
      ...teachers,
      ...students,
      ...staffProfiles,
    ]);
    return { ids, source: "all:tables+profiles" };
  }

  if (audience === "parent") {
    const [fromParentsTable, fromProfiles, fromLinks] = await Promise.all([
      loadParentProfileIdsForSchool(schoolId),
      loadProfileIdsByAudience(schoolId, "parent"),
      loadAllLinkedParentProfileIds(schoolId),
    ]);
    const ids = unique([...fromParentsTable, ...fromProfiles, ...fromLinks]);
    return { ids, source: "parent:tables+profiles+links" };
  }

  if (audience === "teacher") {
    const [fromTeachersTable, fromProfiles] = await Promise.all([
      loadTeacherProfileIdsForSchool(schoolId),
      loadProfileIdsByAudience(schoolId, "teacher"),
    ]);
    const ids = unique([...fromTeachersTable, ...fromProfiles]);
    return { ids, source: "teacher:table+profiles" };
  }

  if (audience === "student") {
    const [fromStudentsTable, fromProfiles] = await Promise.all([
      loadStudentProfileIdsForSchool(schoolId),
      loadProfileIdsByAudience(schoolId, "student"),
    ]);
    const ids = unique([...fromStudentsTable, ...fromProfiles]);
    return { ids, source: "student:table+profiles" };
  }

  if (audience === "principal" || audience === "leadership") {
    const ids = await loadProfileIdsByAudience(schoolId, audience);
    return { ids, source: `profiles:${audience}` };
  }

  // Unknown / custom role string — fall back to profile role matching.
  const ids = await loadProfileIdsByAudience(schoolId, audience);
  return { ids, source: `profiles:${audience}` };
}

async function resolveClassAudience(
  schoolId: string,
  targetClassId: string,
): Promise<string[]> {
  let students: Array<{ id?: string; profile_id?: string | null }> = [];
  const withActive = await supabaseAdmin
    .from("students")
    .select("id, profile_id")
    .eq("school_id", schoolId)
    .eq("class_id", targetClassId)
    .eq("is_active", true);
  if (!withActive.error) {
    students = withActive.data || [];
  } else {
    const plain = await supabaseAdmin
      .from("students")
      .select("id, profile_id")
      .eq("school_id", schoolId)
      .eq("class_id", targetClassId);
    if (plain.error) throw plain.error;
    students = plain.data || [];
  }

  const rosterRows = (students || [])
    .map((row) => ({
      id: String(row.id || ""),
      profile_id: row.profile_id || null,
    }))
    .filter((row) => row.id);

  const studentProfileIds = Array.from(
    new Set(
      rosterRows
        .map((row) => String(row.profile_id || "").trim())
        .filter(Boolean),
    ),
  );

  if (rosterRows.length === 0) return [];

  const parentsByStudent = await loadParentProfileIdsByStudentRowId({
    schoolId,
    rosterRows,
  });
  const parentProfileIds = Array.from(parentsByStudent.values()).flat();

  return unique([...studentProfileIds, ...parentProfileIds]);
}

/**
 * Profile-based audience filter. Retries without is_active if column missing.
 * Also accepts role aliases via isAudienceMatch.
 */
async function loadProfileIdsByAudience(
  schoolId: string,
  audience: string,
): Promise<string[]> {
  const profiles = await loadSchoolProfiles(schoolId);
  if (profiles.length === 0) return [];

  const ids: string[] = [];
  for (const profile of profiles) {
    if (profile.is_active === false) continue;
    const id = String(profile.id || "").trim();
    if (!id) continue;
    const role = String(profile.role || "").trim();
    const stored = roleToStoredValue(role) || role.toLowerCase();
    if (stored === "super_admin") continue;

    if (audience && audience !== "all" && !isAudienceMatch(audience, role)) {
      continue;
    }
    ids.push(id);
  }
  return unique(ids);
}

async function loadSchoolProfiles(schoolId: string) {
  const full = await supabaseAdmin
    .from("profiles")
    .select("id, role, is_active")
    .eq("school_id", schoolId)
    .limit(8000);

  if (!full.error) {
    return full.data || [];
  }

  // Column missing / schema drift — retry without is_active.
  const basic = await supabaseAdmin
    .from("profiles")
    .select("id, role")
    .eq("school_id", schoolId)
    .limit(8000);

  if (basic.error) throw basic.error;
  return (basic.data || []).map((row) => ({ ...row, is_active: true as const }));
}

async function loadParentProfileIdsForSchool(schoolId: string): Promise<string[]> {
  // parents.profile_id is the notifications.user_id target (profiles FK).
  const attempts = [
    () =>
      supabaseAdmin
        .from("parents")
        .select("id, profile_id")
        .eq("school_id", schoolId)
        .limit(5000),
    () =>
      supabaseAdmin
        .from("parents")
        .select("profile_id")
        .eq("school_id", schoolId)
        .limit(5000),
  ];

  for (const run of attempts) {
    const { data, error } = await run();
    if (error) continue;
    const fromTable = unique(
      (data || [])
        .map((row: { profile_id?: string | null }) =>
          String(row.profile_id || "").trim(),
        )
        .filter(Boolean),
    );
    if (fromTable.length > 0) return fromTable;
  }

  return [];
}

/**
 * Walk every student in the school → parent_students → parent profile ids.
 * Same link-resolution path that makes attendance push work.
 */
async function loadAllLinkedParentProfileIds(schoolId: string): Promise<string[]> {
  let students: Array<{ id?: string; profile_id?: string | null }> = [];
  const withActive = await supabaseAdmin
    .from("students")
    .select("id, profile_id")
    .eq("school_id", schoolId)
    .eq("is_active", true)
    .limit(5000);
  if (!withActive.error) {
    students = withActive.data || [];
  } else {
    const plain = await supabaseAdmin
      .from("students")
      .select("id, profile_id")
      .eq("school_id", schoolId)
      .limit(5000);
    if (plain.error) {
      console.warn("[event-notify] students load failed", plain.error.message);
      return [];
    }
    students = plain.data || [];
  }

  const rosterRows = (students || [])
    .map((row) => ({
      id: String(row.id || ""),
      profile_id: row.profile_id || null,
    }))
    .filter((row) => row.id);

  if (rosterRows.length === 0) return [];

  try {
    const parentsByStudent = await loadParentProfileIdsByStudentRowId({
      schoolId,
      rosterRows,
    });
    return unique(Array.from(parentsByStudent.values()).flat());
  } catch (err) {
    console.warn("[event-notify] parent link resolution failed", err);
    return [];
  }
}

async function loadTeacherProfileIdsForSchool(schoolId: string): Promise<string[]> {
  const attempts = [
    () =>
      supabaseAdmin
        .from("teachers")
        .select("id, profile_id")
        .eq("school_id", schoolId)
        .limit(5000),
    () =>
      supabaseAdmin
        .from("teachers")
        .select("profile_id")
        .eq("school_id", schoolId)
        .limit(5000),
  ];

  for (const run of attempts) {
    const { data, error } = await run();
    if (error) continue;
    return unique(
      (data || [])
        .map((row: { profile_id?: string | null }) =>
          String(row.profile_id || "").trim(),
        )
        .filter(Boolean),
    );
  }
  return [];
}

async function loadStudentProfileIdsForSchool(schoolId: string): Promise<string[]> {
  const attempts = [
    () =>
      supabaseAdmin
        .from("students")
        .select("id, profile_id")
        .eq("school_id", schoolId)
        .eq("is_active", true)
        .limit(5000),
    () =>
      supabaseAdmin
        .from("students")
        .select("id, profile_id")
        .eq("school_id", schoolId)
        .limit(5000),
  ];

  for (const run of attempts) {
    const { data, error } = await run();
    if (error) continue;
    return unique(
      (data || [])
        .map((row: { profile_id?: string | null }) =>
          String(row.profile_id || "").trim(),
        )
        .filter(Boolean),
    );
  }
  return [];
}

/** Normalize UI values: PARENTS, parents, Parent, PARENT → parent */
function normalizeAudienceRole(value: string): AudienceKey | string {
  const key = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  if (!key || key === "all" || key === "general" || key === "entire_school") {
    return "all";
  }
  if (key === "parents" || key === "parent" || key === "guardians") return "parent";
  if (key === "teachers" || key === "teacher") return "teacher";
  if (key === "students" || key === "student") return "student";
  if (
    key === "principal" ||
    key === "head_teacher" ||
    key === "admin" ||
    key === "admins" ||
    key === "administrator"
  ) {
    return "principal";
  }
  if (key === "leadership" || key === "school_leadership") return "leadership";
  return roleToStoredValue(value) || key;
}

function isAudienceMatch(target: string, viewerRole: string): boolean {
  if (!target || target === "all") return true;
  if (matchesRoleTarget(target, viewerRole)) return true;
  if (matchesRoleTarget(`${target}s`, viewerRole)) return true;
  if (target.endsWith("s") && matchesRoleTarget(target.slice(0, -1), viewerRole)) {
    return true;
  }
  const viewer = roleToStoredValue(viewerRole) || String(viewerRole || "").toLowerCase();
  const targetStored = roleToStoredValue(target) || target;
  if (viewer && targetStored && viewer === targetStored) return true;
  const viewerCanon = normalizeRole(viewerRole);
  const targetCanon = normalizeRole(target);
  return Boolean(viewerCanon && targetCanon && viewerCanon === targetCanon);
}

function formatEventWhen(
  eventDate?: string | null,
  startTime?: string | null,
): string {
  const date = String(eventDate || "").trim();
  if (!date) return "";
  const time = String(startTime || "").trim();
  if (!time) return date;
  try {
    const parsed = new Date(`${date}T${time}`);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
    }
  } catch {
    // fall through
  }
  return `${date} ${time}`;
}

function unique(ids: string[]): string[] {
  return Array.from(new Set(ids.map((id) => String(id || "").trim()).filter(Boolean)));
}
