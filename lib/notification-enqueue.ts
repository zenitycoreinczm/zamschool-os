import { supabaseAdmin } from "@/lib/supabase";

export type NotificationEnqueueInput = {
  schoolId: string;
  userId: string;
  title: string;
  message: string;
  type?: string;
  dedupeKey: string;
  href?: string | null;
};

export type NotificationPayloadSlice = {
  user_id: string;
  dedupe_key: string;
  title: string;
  message: string;
  type: string;
};

const BATCH_SIZE = 100;

/**
 * Upsert notification rows (charter delivery layer - domain write → notification row).
 */
export async function enqueueNotifications(
  schoolId: string,
  payloads: NotificationPayloadSlice[]
): Promise<void> {
  if (!schoolId || payloads.length === 0) {
    return;
  }

  const rows = payloads.map((payload) => ({
    school_id: schoolId,
    user_id: payload.user_id,
    dedupe_key: payload.dedupe_key,
    title: payload.title,
    message: payload.message,
    type: payload.type || "general",
    is_read: false,
  }));

  for (let offset = 0; offset < rows.length; offset += BATCH_SIZE) {
    const chunk = rows.slice(offset, offset + BATCH_SIZE);
    const { error } = await supabaseAdmin.from("notifications").upsert(chunk, {
      onConflict: "school_id,dedupe_key",
    });
    if (error) {
      throw error;
    }
  }
}

export async function enqueueNotification(input: NotificationEnqueueInput): Promise<void> {
  await enqueueNotifications(input.schoolId, [
    {
      user_id: input.userId,
      dedupe_key: input.dedupeKey,
      title: input.title,
      message: input.message,
      type: input.type || "general",
    },
  ]);
}