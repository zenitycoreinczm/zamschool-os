import { supabaseAdmin } from "@/lib/supabase";

export async function loadNotificationsForUser(input: {
  userId: string;
  schoolId: string;
  limit: number;
}) {
  const { userId, schoolId, limit } = input;
  const queryAttempts = [
    () =>
      supabaseAdmin
        .from("notifications")
        .select("id, title, message, type, is_read, created_at")
        .eq("school_id", schoolId)
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(limit),
    () =>
      supabaseAdmin
        .from("notifications")
        .select("id, title, body, type, is_read, created_at")
        .eq("school_id", schoolId)
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(limit),
    () =>
      supabaseAdmin
        .from("notifications")
        .select("id, title, message, type, is_read, created_at")
        .eq("school_id", schoolId)
        .eq("recipient_id", userId)
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
}) {
  const { id, userId, schoolId } = input;
  const mutationAttempts = [
    () =>
      supabaseAdmin
        .from("notifications")
        .update({ is_read: true })
        .eq("id", id)
        .eq("school_id", schoolId)
        .eq("user_id", userId)
        .select("id")
        .maybeSingle(),
    () =>
      supabaseAdmin
        .from("notifications")
        .update({ is_read: true })
        .eq("id", id)
        .eq("school_id", schoolId)
        .eq("recipient_id", userId)
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
}) {
  const { userId, schoolId } = input;
  const mutationAttempts = [
    () =>
      supabaseAdmin
        .from("notifications")
        .update({ is_read: true })
        .eq("school_id", schoolId)
        .eq("user_id", userId)
        .eq("is_read", false)
        .select("id"),
    () =>
      supabaseAdmin
        .from("notifications")
        .update({ is_read: true })
        .eq("school_id", schoolId)
        .eq("recipient_id", userId)
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
}) {
  const { userId, schoolId } = input;
  const queryAttempts = [
    () =>
      supabaseAdmin
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("school_id", schoolId)
        .eq("user_id", userId)
        .eq("is_read", false),
    () =>
      supabaseAdmin
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("school_id", schoolId)
        .eq("recipient_id", userId)
        .eq("is_read", false),
  ];

  for (const runQuery of queryAttempts) {
    const result = await runQuery();
    if (!result.error) {
      return result.count || 0;
    }
  }

  return 0;
}
