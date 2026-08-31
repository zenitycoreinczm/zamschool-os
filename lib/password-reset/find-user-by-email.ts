type ProfileRow = { id: string; first_name: string | null };

type AuthUser = {
  id: string;
  email?: string;
  user_metadata?: Record<string, unknown>;
};

export type SupabaseAdminLike = {
  from(table: string): {
    select(columns: string): {
      eq(column: string, value: string): {
        maybeSingle(): PromiseLike<{ data: ProfileRow | null }>;
      };
    };
  };
  auth: {
    admin: {
      listUsers(params: {
        page?: number;
        perPage?: number;
      }): PromiseLike<{ data: { users: AuthUser[] } | null }>;
    };
  };
};

export type ResolvedUser = { id: string; firstName: string };

const AUTH_USERS_PER_PAGE = 1000;
// Hard cap on fallback scan so a huge tenant cannot stall the request.
const AUTH_USERS_MAX_PAGES = 10;

/** Look up a user by email for password reset.
 *  Profiles table first (indexed), then a fallback scan of auth.users
 *  for auth-only accounts. */
export async function findUserByEmail(
  supabase: SupabaseAdminLike,
  normalizedEmail: string,
): Promise<ResolvedUser | null> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, first_name")
    .eq("email", normalizedEmail)
    .maybeSingle();

  if (profile) {
    return { id: profile.id, firstName: profile.first_name ?? "" };
  }

  for (let page = 1; page <= AUTH_USERS_MAX_PAGES; page++) {
    const { data } = await supabase.auth.admin.listUsers({
      page,
      perPage: AUTH_USERS_PER_PAGE,
    });

    const users = data?.users ?? [];
    const match = users.find(
      (u) => u.email?.toLowerCase() === normalizedEmail,
    );

    if (match) {
      return {
        id: match.id,
        firstName: (match.user_metadata?.first_name as string) ?? "",
      };
    }

    if (users.length < AUTH_USERS_PER_PAGE) break;
  }

  return null;
}
