/**
 * Edge-safe profile role fetch (no enhanced-cache, no Redis).
 *
 * Uses a single query with an OR filter across id, auth_user_id, and email
 * instead of up to 3 sequential round-trips. Returns the first matching
 * role plus the activation state so sessions can refuse removed accounts.
 */
export type MiddlewareProfileAccess = {
  role: string | null;
  /** false when the profile was deactivated (removed from directory). */
  isActive: boolean;
};

export async function fetchMiddlewareProfileRole(
  client: any,
  userId: string,
  userEmail?: string | null
): Promise<MiddlewareProfileAccess> {
  // Build OR filter: always match by id and auth_user_id; add email when available.
  const orFilter = userEmail
    ? `id.eq.${userId},auth_user_id.eq.${userId},email.eq.${userEmail}`
    : `id.eq.${userId},auth_user_id.eq.${userId}`;

  const { data, error } = await client
    .from("profiles")
    .select("role, is_active")
    .or(orFilter)
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return { role: null, isActive: true };
  }
  return {
    role: data.role ?? null,
    // Missing column / null defaults to active: only an explicit false
    // (set by the directory removal flow) deactivates the account.
    isActive: data.is_active !== false,
  };
}
