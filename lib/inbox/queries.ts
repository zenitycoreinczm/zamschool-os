import { supabaseAdmin } from "@/lib/supabase";

export async function loadNotificationsForUser(input: {
  userId: string;
  schoolId: string;
  limit: number;
  identityIds?: string[];
}) {
  const { userId, schoolId, limit } = input;
  const ids = Array.from(
    new Set(
      [userId, ...(input.identityIds || [])]
        .map((value) => String(value || "").trim())
        .filter(Boolean),
    ),
  );
  const queryAttempts = [
    () =>
      supabaseAdmin
        .from("notifications")
        .select("id, title, message, type, is_read, created_at")
        .eq("school_id", schoolId)
        .in("user_id", ids)
        .order("created_at", { ascending: false })
        .limit(limit),
    () =>
      supabaseAdmin
        .from("notifications")
        .select("id, title, body, type, is_read, created_at")
        .eq("school_id", schoolId)
        .in("user_id", ids)
        .order("created_at", { ascending: false })
        .limit(limit),
    () =>
      supabaseAdmin
        .from("notifications")
        .select("id, title, message, type, is_read, created_at")
        .eq("school_id", schoolId)
        .in("recipient_id", ids)
        .order("created_at", { ascending: false })
        .limit(limit),
  ];

  for (const runQuery of queryAttempts) {
    const result = await runQuery();
    if (!result.error) {
      return result.data || [];
    }
  }

  return [];
}

export async function markNotificationReadForUser(input: {
  id: string;
  userId: string;
  schoolId: string;
  identityIds?: string[];
}) {
  const { id, userId, schoolId } = input;
  const ids = Array.from(
    new Set(
      [userId, ...(input.identityIds || [])]
        .map((value) => String(value || "").trim())
        .filter(Boolean),
    ),
  );
  const mutationAttempts = [
    () =>
      supabaseAdmin
        .from("notifications")
        .update({ is_read: true })
        .eq("id", id)
        .eq("school_id", schoolId)
        .in("user_id", ids)
        .select("id")
        .maybeSingle(),
    () =>
      supabaseAdmin
        .from("notifications")
        .update({ is_read: true })
        .eq("id", id)
        .eq("school_id", schoolId)
        .in("recipient_id", ids)
        .select("id")
        .maybeSingle(),
  ];

  for (const runMutation of mutationAttempts) {
    const result = await runMutation();
    if (!result.error) {
      return Boolean(result.data?.id);
    }
  }

  return false;
}

export async function markAllNotificationsReadForUser(input: {
  userId: string;
  schoolId: string;
  identityIds?: string[];
}) {
  const { userId, schoolId } = input;
  const ids = Array.from(
    new Set(
      [userId, ...(input.identityIds || [])]
        .map((value) => String(value || "").trim())
        .filter(Boolean),
    ),
  );
  const mutationAttempts = [
    () =>
      supabaseAdmin
        .from("notifications")
        .update({ is_read: true })
        .eq("school_id", schoolId)
        .in("user_id", ids)
        .eq("is_read", false)
        .select("id"),
    () =>
      supabaseAdmin
        .from("notifications")
        .update({ is_read: true })
        .eq("school_id", schoolId)
        .in("recipient_id", ids)
        .eq("is_read", false)
        .select("id"),
  ];

  for (const runMutation of mutationAttempts) {
    const result = await runMutation();
    if (!result.error) {
      return Array.isArray(result.data) ? result.data.length : 0;
    }
  }

  return 0;
}

export async function countUnreadNotificationsForUser(input: {
  userId: string;
  schoolId: string;
  /** Optional expanded auth/profile ids for this actor. */
  identityIds?: string[];
}) {
  const { userId, schoolId } = input;
  const ids = Array.from(
    new Set(
      [userId, ...(input.identityIds || [])]
        .map((value) => String(value || "").trim())
        .filter(Boolean),
    ),
  );
  if (ids.length === 0) return 0;

  // Run both column variants in parallel - whichever succeeds wins.
  // This avoids sequential round-trips when the schema uses recipient_id instead of user_id.
  const [byUserId, byRecipientId] = await Promise.all([
    supabaseAdmin
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("school_id", schoolId)
      .in("user_id", ids)
      .eq("is_read", false),
    supabaseAdmin
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("school_id", schoolId)
      .in("recipient_id", ids)
      .eq("is_read", false),
  ]);

  if (!byUserId.error) return byUserId.count || 0;
  if (!byRecipientId.error) return byRecipientId.count || 0;
  return 0;
}
