type AuthProviderEvent =
  | "INITIAL_SESSION"
  | "SIGNED_IN"
  | "SIGNED_OUT"
  | "TOKEN_REFRESHED"
  | "PASSWORD_RECOVERY"
  | "USER_UPDATED"
  | "MFA_CHALLENGE_VERIFIED";

interface ApplyAuthProviderEventArgs {
  event: AuthProviderEvent;
  session: unknown;
  setLoading: (loading: boolean) => void;
  refresh: () => void;
  replace: (href: string) => void;
  signOut: () => Promise<unknown>;
}

export async function applyAuthProviderEvent({
  event,
  session,
  setLoading,
  replace,
  signOut,
}: ApplyAuthProviderEventArgs): Promise<void> {
  const clearCaches = async () => {
    try {
      const { clearClientAuthCaches } = await import(
        "@/lib/workspace/clear-client-auth-caches"
      );
      clearClientAuthCaches();
    } catch {
      // non-browser tests / chunk load failures should not block auth routing
    }
  };

  if (event === "TOKEN_REFRESHED" && !session) {
    await clearCaches();
    await signOut();
  }

  // Do not call router.refresh() on SIGNED_IN / TOKEN_REFRESHED here.
  // That revalidates the full RSC tree on every auth tick and causes chart remounts,
  // Fast Refresh storms, and visible UI thrash. Login / first-login pages refresh
  // explicitly after a successful sign-in.

  if (event === "SIGNED_OUT") {
    await clearCaches();
    replace("/login");
  }

  if (event === "PASSWORD_RECOVERY") {
    replace("/reset-password");
  }

  setLoading(false);
}
