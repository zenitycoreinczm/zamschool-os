import {
  HOT_READ_TTL,
  hotReadKey,
  invalidateInboxHotReads,
  withHotReadCache,
} from "@/lib/hot-read-cache";
import { expandMessagingIdentityIds } from "@/lib/messages/participants";
import { shellCacheKey, workspaceCacheKey } from "@/lib/redis/keys";
import { countUnreadNotificationsForUser } from "./queries";
import { supabaseAdmin } from "@/lib/supabase";

export type UnreadCounts = {
  messages: number;
  notifications: number;
};

async function fetchUnreadCountsFromDb(input: {
  userId: string;
  schoolId: string;
}): Promise<UnreadCounts> {
  // Messages may store recipient as auth uid or profile id - count both.
  const recipientIds = await expandMessagingIdentityIds(
    [input.userId],
    input.schoolId,
  );
  const ids = recipientIds.length > 0 ? recipientIds : [input.userId];

  const [messagesResult, notifications] = await Promise.all([
    supabaseAdmin
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("school_id", input.schoolId)
      .in("recipient_id", ids)
      .eq("is_read", false),
    countUnreadNotificationsForUser({
      userId: input.userId,
      schoolId: input.schoolId,
      identityIds: ids,
    }),
  ]);

  if (messagesResult.error) {
    throw messagesResult.error;
  }

  return {
    messages: messagesResult.count || 0,
    notifications,
  };
}

/**
 * Unread badge counts.
 * Keep process-local TTL very short: serverless instances do not share memory,
 * so a longer cache after mark-as-read on another instance resurrects "new"
 * badges for messages/notifications the user already cleared.
 */
export async function getUnreadCountsForUser(input: {
  userId: string;
  schoolId: string;
}): Promise<UnreadCounts> {
  const key = hotReadKey([
    "unread",
    `school:${input.schoolId}`,
    `user:${input.userId}`,
  ]);

  // 2s is only stampede protection for concurrent badge polls - not a real cache.
  const stampedeTtlSec = Math.min(HOT_READ_TTL.unreadCounts, 2);
  return withHotReadCache(key, stampedeTtlSec, () =>
    fetchUnreadCountsFromDb(input),
  );
}

/**
 * Call after mark-as-read so shell/bootstrap Redis cannot resurrect old
 * unread badges when the user navigates away and back.
 */
export async function invalidateUnreadRelatedCaches(
  userId: string,
  schoolId?: string | null,
): Promise<void> {
  const id = String(userId || "").trim();
  if (!id) return;
  const school = String(schoolId || "").trim() || null;

  invalidateInboxHotReads(id, school);

  try {
    const { isRedisConfigured, redisDel } = await import("@/lib/redis/client");
    if (!isRedisConfigured()) return;
    const keys = [shellCacheKey(id, null), workspaceCacheKey(id, null)];
    if (school) {
      keys.push(shellCacheKey(id, school), workspaceCacheKey(id, school));
    }
    await Promise.all(keys.map((key) => redisDel(key)));
  } catch {
    // Never block mark-read on cache errors.
  }
}

export { invalidateInboxHotReads };
