import { loadParentProfileIdsByStudentRowId } from "@/lib/attendance/parent-recipients";
import { enqueueNotifications } from "@/lib/notification-enqueue";
import { matchesRoleTarget } from "@/lib/role-audience-match";
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

/**
 * Fan-out a school event into per-user notification rows so every role's
 * top-nav bell / notifications shortcut can surface it.
 *
 * Non-throwing: event create must still succeed if notify delivery fails.
 */
export async function notifySchoolEventAudience(
  input: EventAudienceInput,
): Promise<number> {
  const schoolId = String(input.schoolId || "").trim();
  const eventId = String(input.eventId || "").trim();
  const title = String(input.title || "").trim() || "School event";
  if (!schoolId || !eventId) return 0;

  try {
    const recipients = await resolveEventRecipientIds(input);
    if (recipients.length === 0) return 0;

    const when = formatEventWhen(input.eventDate, input.startTime);
    const where = String(input.location || "").trim();
    const summary = String(input.description || "").trim();
    const messageParts = [
      when ? `When: ${when}` : null,
      where ? `Where: ${where}` : null,
      summary || null,
    ].filter(Boolean);

    const payloads = recipients.map((userId) => ({
      user_id: userId,
      dedupe_key: `event:${eventId}:${userId}`,
      title: `New event: ${title}`,
      message: messageParts.join("\n") || title,
      // Allowed by notifications_type_check
      type: "general",
    }));

    await enqueueNotifications(schoolId, payloads);
    return payloads.length;
  } catch (error) {
    console.warn("Event notification fan-out failed", error);
    return 0;
  }
}

async function resolveEventRecipientIds(
  input: EventAudienceInput,
): Promise<string[]> {
  const schoolId = input.schoolId;
  const targetClassId = String(input.targetClassId || "").trim();
  const targetRole = String(input.targetRole || "").trim();

  // Class-targeted events → students in that class (+ linked parents)
  if (targetClassId) {
    const { data: students } = await supabaseAdmin
      .from("students")
      .select("id, profile_id")
      .eq("school_id", schoolId)
      .eq("class_id", targetClassId)
      .eq("is_active", true);

    const rosterRows = (students || []).map(
      (row: { id?: string; profile_id?: string | null }) => ({
        id: String(row.id || ""),
        profile_id: row.profile_id || null,
      }),
    ).filter((row) => row.id);

    const studentProfileIds = Array.from(
      new Set(
        rosterRows
          .map((row) => String(row.profile_id || "").trim())
          .filter(Boolean),
      ),
    );

    if (studentProfileIds.length === 0) return [];

    const parentsByStudent = await loadParentProfileIdsByStudentRowId({
      schoolId,
      rosterRows,
    });
    const parentProfileIds = Array.from(parentsByStudent.values()).flat();

    return Array.from(new Set([...studentProfileIds, ...parentProfileIds]));
  }

  const { data: profiles, error } = await supabaseAdmin
    .from("profiles")
    .select("id, role, is_active")
    .eq("school_id", schoolId)
    .limit(5000);

  if (error) throw error;

  const ids: string[] = [];
  for (const profile of profiles || []) {
    if (profile.is_active === false) continue;
    const id = String(profile.id || "").trim();
    if (!id) continue;
    const role = String(profile.role || "").trim();
    if (role.toLowerCase() === "super_admin") continue;
    if (targetRole && !matchesRoleTarget(targetRole, role)) continue;
    ids.push(id);
  }

  return Array.from(new Set(ids));
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
