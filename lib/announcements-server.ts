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
  const selects = [
    // Matches public.announcements baseline (+ is_pinned).
    "id, title, content, target_role, created_at, published_at, is_pinned",
    // Older/partial installs without is_pinned.
    "id, title, content, target_role, created_at, published_at",
    // Legacy installs that used body instead of content.
    "id, title, body, target_role, created_at, published_at",
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
