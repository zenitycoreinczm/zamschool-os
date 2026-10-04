import { resolveAudienceRecipients } from "@/lib/event-notifications";
import { enqueueNotifications } from "@/lib/notification-enqueue";
import { parseTargetAudience } from "@/lib/target-audience";
import { supabaseAdmin } from "@/lib/supabase";
import { dispatchExpoPushToUsers } from "@/lib/push-dispatch";

/**
 * Announcements reach people through this file and nothing else.
 *
 * It used to live in the phone: `announcementService.createAnnouncement` posted
 * the row, then asked an edge function to work out the audience and push. A head
 * teacher publishing from the web therefore notified nobody, and the same
 * announcement produced different delivery depending on which client was held -
 * the one-announcement fan-out the product promises (web + mobile + push from one
 * record) existed only as a side effect of a mobile build. Recipients are
 * resolved from the verified actor's school here, so a client cannot aim a notice
 * at another school or a role it does not belong to.
 */

export type AnnouncementDelivery = {
  audience: string;
  recipientCount: number;
  notificationsQueued: number;
  pushSent: number;
  pushAttempted: boolean;
  recipientSource: string;
  reason?: string;
};

export function announcementNotificationKey(
  announcementId: string,
  profileId: string,
) {
  // Same shape the send-push edge function writes, so an older mobile build that
  // still fans out locally cannot create a second bell row for one notice.
  return `announcement:${announcementId}:${profileId}`.slice(0, 250);
}

export async function notifyAnnouncementAudience(input: {
  schoolId: string;
  announcementId: string;
  title: string;
  content: string;
  targetAudience?: string | null;
  targetRole?: string | null;
  targetClassId?: string | null;
  publisherId?: string | null;
}): Promise<AnnouncementDelivery> {
  const schoolId = String(input.schoolId || "").trim();
  const announcementId = String(input.announcementId || "").trim();
  const title = String(input.title || "").trim() || "School announcement";

  const audience =
    String(input.targetAudience || "").trim() ||
    String(input.targetRole || "").trim() ||
    "all";

  const base: AnnouncementDelivery = {
    audience,
    recipientCount: 0,
    notificationsQueued: 0,
    pushSent: 0,
    pushAttempted: false,
    recipientSource: "none",
  };

  if (!schoolId || !announcementId) return { ...base, reason: "Missing school or announcement id." };

  // The announcement row stores one encoding (class:<uuid> or a role key); the
  // resolver wants the decoded pair. Parse so a class notice reaches the class,
  // not the whole school.
  const decoded = parseTargetAudience(input.targetAudience);
  const scope = {
    schoolId,
    targetRole: decoded.targetRole ?? input.targetRole ?? null,
    targetClassId: decoded.targetClassId ?? input.targetClassId ?? null,
  };

  // The row is already saved by the time this runs, so a resolution failure has
  // to degrade to "nobody notified, here is why" rather than a failed publish.
  let ids: string[] = [];
  let source = "failed";
  try {
    const resolved = await resolveAudienceRecipients(scope);
    ids = resolved.ids;
    source = resolved.source;
  } catch (error) {
    console.warn("[announcements] audience resolution failed", error);
    return {
      ...base,
      recipientSource: source,
      reason: "Could not work out who the notice was for, so nobody was notified.",
    };
  }

  const publisher = String(input.publisherId || "").trim();
  const recipients = ids.filter((id) => id && id !== publisher);

  if (recipients.length === 0) {
    return {
      ...base,
      recipientSource: source,
      reason:
        ids.length === 0
          ? "No accounts matched this audience, so nobody was notified."
          : "The only account in this audience is the publisher.",
    };
  }

  const preview = String(input.content || "").trim().replace(/\s+/g, " ");
  const body =
    preview.length > 180 ? `${preview.slice(0, 177).trimEnd()}...` : preview;

  let enqueueError: string | null = null;
  const queued = await enqueueNotifications(
    schoolId,
    recipients.map((userId) => ({
      user_id: userId,
      dedupe_key: announcementNotificationKey(announcementId, userId),
      title,
      message: body || title,
      // notifications_type_check admits 'announcement' (verified against the
      // live constraint, not assumed).
      type: "announcement",
      metadata: { referenceId: announcementId, announcementId },
    })),
  )
    .then(() => recipients.length)
    .catch((error) => {
      enqueueError = error instanceof Error ? error.message : "enqueue failed";
      return 0;
    });

  const push = await dispatchExpoPushToUsers(
    schoolId,
    recipients.map((userId) => ({
      userId,
      title,
      body: body || "A new school announcement is available.",
      type: "announcement",
      // tab + referenceId are the deep link: tapping the lock-screen alert opens
      // this notice on both clients rather than a generic list.
      tab: "announcements",
      data: { type: "announcement", announcementId },
    })),
  ).catch((error) => {
    console.warn("[announcements] push fan-out failed", error);
    return { sent: 0, tokenCount: 0 };
  });

  // delivered_count was declared in the baseline and never written: the product
  // asks for delivery tracking, and this is the only number that can back it.
  const tracked = await supabaseAdmin
    .from("announcements")
    .update({
      delivered_count: recipients.length,
      published_at: new Date().toISOString(),
      status: "live",
    })
    .eq("id", announcementId)
    .eq("school_id", schoolId);

  if (tracked.error) {
    console.warn("[announcements] delivery tracking write failed:", tracked.error.message);
  }

  return {
    audience,
    recipientCount: recipients.length,
    notificationsQueued: queued,
    pushSent: push.sent,
    pushAttempted: push.tokenCount > 0,
    recipientSource: source,
    reason: enqueueError
      ? `In-app notification save had an issue: ${enqueueError}`
      : push.tokenCount === 0
        ? "Notified in-app. No registered device tokens for those accounts."
        : undefined,
  };
}

/**
 * Read state for one viewer. announcement_seen is the single store: profiles.id
 * and auth.uid() are the same key in this schema (all 81 profiles satisfy
 * profiles.id = auth.users.id), which is why the server can write the row itself
 * instead of trusting a client-supplied viewer.
 */
export async function loadAnnouncementSeenIds(
  schoolId: string,
  profileId: string,
  announcementIds: string[],
): Promise<Set<string>> {
  if (!schoolId || !profileId || announcementIds.length === 0) return new Set();

  const { data, error } = await supabaseAdmin
    .from("announcement_seen")
    .select("announcement_id")
    .eq("profile_id", profileId)
    .in("announcement_id", announcementIds);

  if (error) {
    console.warn("[announcements] seen lookup failed:", error.message);
    return new Set();
  }

  const inSchool = await supabaseAdmin
    .from("announcements")
    .select("id")
    .eq("school_id", schoolId)
    .in("id", announcementIds);
  const schoolScoped = new Set(
    (inSchool.data || []).map((row: { id: string }) => String(row.id)),
  );

  return new Set(
    (data || [])
      .map((row: { announcement_id?: string | null }) => String(row.announcement_id || ""))
      .filter((id) => id && schoolScoped.has(id)),
  );
}

export async function recordAnnouncementSeen(input: {
  schoolId: string;
  profileId: string;
  announcementId: string;
}) {
  const schoolId = String(input.schoolId || "").trim();
  const profileId = String(input.profileId || "").trim();
  const announcementId = String(input.announcementId || "").trim();

  if (!schoolId || !profileId || !announcementId) {
    return { ok: false as const, error: "missing-arguments" as const };
  }

  const announcement = await supabaseAdmin
    .from("announcements")
    .select("id")
    .eq("id", announcementId)
    .eq("school_id", schoolId)
    .maybeSingle();
  if (announcement.error) return { ok: false as const, error: "lookup-failed" as const };
  if (!announcement.data) return { ok: false as const, error: "not-in-school" as const };

  const saved = await supabaseAdmin
    .from("announcement_seen")
    .upsert(
      { announcement_id: announcementId, profile_id: profileId, seen_at: new Date().toISOString() },
      { onConflict: "announcement_id,profile_id" },
    )
    .select("id")
    .maybeSingle();
  if (saved.error) {
    console.warn("[announcements] seen write failed:", saved.error.message);
    return { ok: false as const, error: "write-failed" as const };
  }

  const counted = await supabaseAdmin
    .from("announcement_seen")
    .select("id", { count: "exact", head: true })
    .eq("announcement_id", announcementId);

  if (!counted.error) {
    await supabaseAdmin
      .from("announcements")
      .update({ seen_count: Number(counted.count || 0) })
      .eq("id", announcementId)
      .eq("school_id", schoolId);
  }

  // The bell and the notices list must agree: reading the notice clears its
  // notification, so one fact is not shown as two different states.
  const read = await supabaseAdmin
    .from("notifications")
    .update({ is_read: true })
    .eq("school_id", schoolId)
    .eq("user_id", profileId)
    .eq("dedupe_key", announcementNotificationKey(announcementId, profileId));
  if (read.error) {
    console.warn("[announcements] notification read sync failed:", read.error.message);
  }

  return { ok: true as const, seenCount: Number(counted.count || 0) };
}
