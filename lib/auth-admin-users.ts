import { supabaseAdmin } from "@/lib/supabase";

type SupabaseAuthUser = NonNullable<
  Awaited<
    ReturnType<typeof supabaseAdmin.auth.admin.getUserById>
  >["data"]["user"]
>;

async function findAuthUserByNormalizedEmail(
  normalizedEmail: string,
): Promise<SupabaseAuthUser | null> {
  let page = 1;
  const perPage = 200;
  const maxPages = 5;

  while (page <= maxPages) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage,
    });
    if (error || !data?.users?.length) break;

    const match = data.users.find(
      (user) => user.email?.trim().toLowerCase() === normalizedEmail,
    );
    if (match) return match as SupabaseAuthUser;

    if (data.users.length < perPage) break;
    page += 1;
  }

  return null;
}

export async function findAuthUserByEmail(
  email: string,
): Promise<SupabaseAuthUser | null> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;
  return findAuthUserByNormalizedEmail(normalized);
}

/** Resolve an auth user id by email (Supabase admin API has no getUserByEmail). */
export async function findAuthUserIdByEmail(
  email: string,
  schoolId: string,
): Promise<string | null> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("school_id", schoolId)
    .ilike("email", normalized)
    .limit(1)
    .maybeSingle();

  if (profile?.id) return profile.id;

  const authUser = await findAuthUserByNormalizedEmail(normalized);
  return authUser?.id || null;
}

export async function createOrUpdateAuthUserWithTemporaryPassword(input: {
  email: string;
  temporaryPassword: string;
  userMetadata: Record<string, unknown>;
  authUserId?: string | null;
}): Promise<{ user: SupabaseAuthUser; created: boolean }> {
  const email = input.email.trim().toLowerCase();
  const temporaryPassword = String(input.temporaryPassword || "");
  if (!email) throw new Error("Auth user email is required");
  if (!temporaryPassword) throw new Error("Temporary password is required");

  const existingById = input.authUserId
    ? await supabaseAdmin.auth.admin.getUserById(input.authUserId)
    : null;
  const existingUser =
    existingById?.data.user || (await findAuthUserByNormalizedEmail(email));

  if (existingUser?.id) {
    // Only pass email when it differs so we don't trigger an unnecessary
    // email-change flow that may interfere with sign-in.
    const currentEmail = String(existingUser.email || "")
      .trim()
      .toLowerCase();
    const updatePayload: Record<string, unknown> = {
      password: temporaryPassword,
      // Always confirm so staff can sign in immediately with the temp password.
      email_confirm: true,
      ban_duration: "none",
      user_metadata: {
        ...(existingUser.user_metadata || {}),
        ...input.userMetadata,
      },
    };
    if (currentEmail && currentEmail !== email) {
      updatePayload.email = email;
    }
    const updateAuth = await supabaseAdmin.auth.admin.updateUserById(
      existingUser.id,
      updatePayload,
    );

    if (updateAuth.error || !updateAuth.data.user) {
      throw (
        updateAuth.error || new Error("Failed to update temporary password")
      );
    }

    await assertTemporaryPasswordWorks(email, temporaryPassword);

    return { user: updateAuth.data.user as SupabaseAuthUser, created: false };
  }

  const createAuth = await supabaseAdmin.auth.admin.createUser({
    ...(input.authUserId ? { id: input.authUserId } : {}),
    email,
    password: temporaryPassword,
    email_confirm: true,
    user_metadata: input.userMetadata,
  });

  if (createAuth.error || !createAuth.data.user) {
    throw createAuth.error || new Error("Failed to create auth user");
  }

  // Some projects race email-confirm / password apply - force a confirmed
  // password write, then prove sign-in works before we show the password in UI.
  const ensure = await supabaseAdmin.auth.admin.updateUserById(
    createAuth.data.user.id,
    {
      password: temporaryPassword,
      email_confirm: true,
      ban_duration: "none",
    },
  );
  if (ensure.error) {
    throw ensure.error;
  }

  await assertTemporaryPasswordWorks(email, temporaryPassword);

  return {
    user: (ensure.data.user || createAuth.data.user) as SupabaseAuthUser,
    created: true,
  };
}

/**
 * Prove the temporary password is actually accepted by Supabase Auth before
 * we return it to the inviter. Retries once with a hard password rewrite.
 */
async function assertTemporaryPasswordWorks(
  email: string,
  temporaryPassword: string,
): Promise<void> {
  const { createClient } = await import("@supabase/supabase-js");
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    "";
  if (!supabaseUrl || !anonKey) {
    // Cannot verify without anon client - rely on admin write alone.
    return;
  }

  const probe = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const first = await probe.auth.signInWithPassword({
    email,
    password: temporaryPassword,
  });
  if (!first.error && first.data.user) {
    await probe.auth.signOut().catch(() => {});
    return;
  }

  // One repair attempt: rewrite password + confirm email.
  const user = await findAuthUserByNormalizedEmail(email);
  if (!user?.id) {
    throw first.error || new Error("Auth user missing after create");
  }

  const repair = await supabaseAdmin.auth.admin.updateUserById(user.id, {
    password: temporaryPassword,
    email_confirm: true,
    ban_duration: "none",
  });
  if (repair.error) throw repair.error;

  const second = await probe.auth.signInWithPassword({
    email,
    password: temporaryPassword,
  });
  if (second.error || !second.data.user) {
    throw (
      second.error ||
      new Error(
        "Temporary password was saved but sign-in still failed. Try reset password from the staff list.",
      )
    );
  }
  await probe.auth.signOut().catch(() => {});
}
