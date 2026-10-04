import { CACHE_CONFIGS, withCache } from "@/lib/enhanced-cache";
import { supabaseAdmin } from "@/lib/supabase";

export type AnnouncementRow = {
  id: string;
  title?: string | null;
  body?: string | null;
  content?: string | null;
  target_role?: string | null;
  created_at?: string | null;
  published_at?: string | null;
  [key: string]: unknown;
};

export async function loadSchoolAnnouncements(schoolId: string, limit: number) {
  const safeLimit = Math.min(Math.max(limit, 1), 100);

  return withCache(
    `school:${schoolId}:limit:${safeLimit}`,
    () => fetchSchoolAnnouncementsFromDb(schoolId, safeLimit),
    {
      ...CACHE_CONFIGS.shared.announcements,
      tags: ["announcements"],
    }
  );
}

export async function invalidateSchoolAnnouncementsCache() {
  const { invalidateByTag } = await import("@/lib/enhanced-cache");
  await invalidateByTag("announcements");
}

/**
 * Schema-aligned primary select. Baseline has `content` (not `body`).
 * Only fall back when PostgREST reports a missing column - never on
 * timeouts/network errors (those used to cascade into 4×10s waits).
 */
async function fetchSchoolAnnouncementsFromDb(schoolId: string, limit: number) {
  // Audience columns stay in every rung of the ladder: the account route decides
  // who may see a notice from target_audience/target_role, so a fallback select
  // that drops them would silently widen the audience.
  const selects = [
    // Matches public.announcements baseline (+ is_pinned, delivery and read counts).
    "id, title, content, target_role, target_audience, audience, target_class_id, expires_at, created_at, published_at, is_pinned, delivered_count, seen_count, created_by",
    // Older/partial installs without is_pinned.
    "id, title, content, target_role, target_audience, audience, target_class_id, expires_at, created_at, published_at",
    // Legacy installs that used body instead of content.
    "id, title, body, target_role, target_audience, created_at, published_at",
  ];

  for (let i = 0; i < selects.length; i++) {
    const result = await supabaseAdmin
      .from("announcements")
      .select(selects[i])
      .eq("school_id", schoolId)
      .order("published_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(limit);

    if (!result.error) {
      return (result.data || []) as unknown as AnnouncementRow[];
    }

    // Only try the next select shape on schema mismatch.
    if (!isMissingColumnError(result.error) || i === selects.length - 1) {
      console.error(
        "[announcements-server] fetch failed:",
        result.error.message || result.error,
      );
      return [];
    }
  }

  return [];
}

function isMissingColumnError(
  error: { code?: string | null; message?: string | null } | null | undefined,
) {
  const code = String(error?.code || "");
  const message = String(error?.message || "").toLowerCase();
  return (
    code === "42703" ||
    code === "PGRST204" ||
    message.includes("does not exist") ||
    message.includes("could not find")
  );
}
