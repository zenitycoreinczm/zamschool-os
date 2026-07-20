import { supabaseAdmin } from "@/lib/supabase";

function uniqueIds(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(
      values
        .map((value) => String(value || "").trim())
        .filter(Boolean),
    ),
  );
}

export async function loadNotificationsForUser(input: {
  userId: string;
  schoolId: string;
  limit: number;
  identityIds?: string[];
}) {
  const { userId, schoolId, limit } = input;
  const ids = uniqueIds([userId, ...(input.identityIds || [])]);
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

  const byId = new Map<string, any>();
  for (const runQuery of queryAttempts) {
    const result = await runQuery();
    if (!result.error) {
      for (const row of result.data || []) {
        const id = String(row?.id || "").trim();
        if (id && !byId.has(id)) byId.set(id, row);
      }
    }
  }

  return Array.from(byId.values())
    .sort(
      (left, right) =>
        Date.parse(String(right.created_at || "")) -
        Date.parse(String(left.created_at || "")),
    )
    .slice(0, limit);
}

/**
 * Persist is_read=true so the item stays read across close, logout, and login.
 * Tries identity-scoped updates first, then ownership-verified update-by-id.
 */
export async function markNotificationReadForUser(input: {
  id: string;
  userId: string;
  schoolId: string;
  identityIds?: string[];
}) {
  const { id, userId, schoolId } = input;
  const ids = uniqueIds([userId, ...(input.identityIds || [])]);
  if (!id || !schoolId || ids.length === 0) return false;

  // 1) Standard identity-scoped updates. Do not stop on "0 rows" — try next column.
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
    if (result.error) continue;
    if (result.data?.id) return true;
  }

  // 2) Load row, verify ownership against expanded identities, then update by id.
  // Handles schema/identity mismatches that left items stuck as unread.
  const loadAttempts = [
    () =>
      supabaseAdmin
        .from("notifications")
        .select("id, user_id, recipient_id, is_read")
        .eq("id", id)
        .eq("school_id", schoolId)
        .maybeSingle(),
    () =>
      supabaseAdmin
        .from("notifications")
        .select("id, user_id, is_read")
        .eq("id", id)
        .eq("school_id", schoolId)
        .maybeSingle(),
  ];

  let row: {
    id?: string;
    user_id?: string | null;
    recipient_id?: string | null;
    is_read?: boolean | null;
  } | null = null;

  for (const runLoad of loadAttempts) {
    const result = await runLoad();
    if (!result.error && result.data?.id) {
      row = result.data;
      break;
    }
  }

  if (!row?.id) return false;
  if (row.is_read) return true;

  const ownerIds = uniqueIds([row.user_id, row.recipient_id]);
  const owns =
    ownerIds.length === 0 || ownerIds.some((ownerId) => ids.includes(ownerId));
  if (!owns) return false;

  const { data, error } = await supabaseAdmin
    .from("notifications")
    .update({ is_read: true })
    .eq("id", id)
    .eq("school_id", schoolId)
    .select("id")
    .maybeSingle();

  if (error) return false;
  return Boolean(data?.id);
}

export async function markAllNotificationsReadForUser(input: {
  userId: string;
  schoolId: string;
  identityIds?: string[];
}) {
  const { userId, schoolId } = input;
  const ids = uniqueIds([userId, ...(input.identityIds || [])]);
  if (!schoolId || ids.length === 0) return 0;

  const updatedIds = new Set<string>();
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
    if (result.error) continue;
    if (Array.isArray(result.data) && result.data.length > 0) {
      for (const row of result.data) {
        if (row?.id) updatedIds.add(String(row.id));
      }
    }
  }

  return updatedIds.size;
}

export async function countUnreadNotificationsForUser(input: {
  userId: string;
  schoolId: string;
  /** Optional expanded auth/profile ids for this actor. */
  identityIds?: string[];
}) {
  const { userId, schoolId } = input;
  const ids = uniqueIds([userId, ...(input.identityIds || [])]);
  if (ids.length === 0) return 0;

  // Count unique ids across both column variants. Mixed schema/data can store
  // some rows in user_id and others in recipient_id; max() under-counts that.
  const [byUserId, byRecipientId] = await Promise.all([
    supabaseAdmin
      .from("notifications")
      .select("id")
      .eq("school_id", schoolId)
      .in("user_id", ids)
      .eq("is_read", false),
    supabaseAdmin
      .from("notifications")
      .select("id")
      .eq("school_id", schoolId)
      .in("recipient_id", ids)
      .eq("is_read", false),
  ]);

  const unreadIds = new Set<string>();
  if (!byUserId.error) {
    for (const row of byUserId.data || []) {
      if (row?.id) unreadIds.add(String(row.id));
    }
  }
  if (!byRecipientId.error) {
    for (const row of byRecipientId.data || []) {
      if (row?.id) unreadIds.add(String(row.id));
    }
  }
  return unreadIds.size;
}
