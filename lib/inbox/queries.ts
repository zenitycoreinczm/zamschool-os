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
  // Canonical schema (baseline 00000000000000): notifications has user_id +
  // message columns only — no recipient_id / body variants. Single query keeps
  // PostgREST error rate clean and halves badge-poll request volume.
  const { data, error } = await supabaseAdmin
    .from("notifications")
    .select("id, title, message, type, is_read, created_at")
    .eq("school_id", schoolId)
    .in("user_id", ids)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data) return [];

  const byId = new Map<string, any>();
  for (const row of data) {
    const id = String(row?.id || "").trim();
    if (id && !byId.has(id)) byId.set(id, row);
  }

  return Array.from(byId.values()).slice(0, limit);
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

  // 1) Identity-scoped update on the canonical user_id column.
  const scoped = await supabaseAdmin
    .from("notifications")
    .update({ is_read: true })
    .eq("id", id)
    .eq("school_id", schoolId)
    .in("user_id", ids)
    .select("id")
    .maybeSingle();

  if (!scoped.error && scoped.data?.id) return true;

  // 2) Load row, verify ownership against expanded identities, then update by id.
  const loaded = await supabaseAdmin
    .from("notifications")
    .select("id, user_id, is_read")
    .eq("id", id)
    .eq("school_id", schoolId)
    .maybeSingle();

  let row: {
    id?: string;
    user_id?: string | null;
    is_read?: boolean | null;
  } | null = null;

  if (!loaded.error && loaded.data?.id) {
    row = loaded.data;
  }

  if (!row?.id) return false;
  if (row.is_read) return true;

  const ownerIds = uniqueIds([row.user_id]);
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

  const { data, error } = await supabaseAdmin
    .from("notifications")
    .update({ is_read: true })
    .eq("school_id", schoolId)
    .in("user_id", ids)
    .eq("is_read", false)
    .select("id");

  if (error || !Array.isArray(data)) return 0;

  const updatedIds = new Set<string>();
  for (const row of data) {
    if (row?.id) updatedIds.add(String(row.id));
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

  // Canonical user_id column only — recipient_id does not exist on
  // notifications (baseline schema). head:true returns the count without rows.
  const { count, error } = await supabaseAdmin
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("school_id", schoolId)
    .in("user_id", ids)
    .eq("is_read", false);

  if (error) return 0;
  return count || 0;
}
