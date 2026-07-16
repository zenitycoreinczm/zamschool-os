import {
  HOT_READ_TTL,
  hotReadKey,
  invalidateInboxHotReads,
  withHotReadCache,
} from "@/lib/hot-read-cache";
import { expandMessagingIdentityIds } from "@/lib/messages/participants";
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

/** Short TTL cache - safe for header badges; invalidated on read/mark actions. */
export async function getUnreadCountsForUser(input: {
  userId: string;
  schoolId: string;
}): Promise<UnreadCounts> {
  const key = hotReadKey([
    "unread",
    `school:${input.schoolId}`,
    `user:${input.userId}`,
  ]);

  return withHotReadCache(key, HOT_READ_TTL.unreadCounts, () =>
    fetchUnreadCountsFromDb(input)
  );
}

export { invalidateInboxHotReads };
