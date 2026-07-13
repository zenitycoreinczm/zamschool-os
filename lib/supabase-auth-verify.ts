import type { Session, SupabaseClient, User } from "@supabase/supabase-js";

import { isSupabaseNetworkError } from "@/lib/supabase-connectivity";

type AuthClient = Pick<SupabaseClient["auth"], "getSession" | "getUser"> & {
  getClaims?: SupabaseClient["auth"]["getClaims"];
};

function resolveAuthClient(client: AuthClient | SupabaseClient): AuthClient {
  return "auth" in client ? client.auth : client;
}

/**
 * Stale/revoked refresh tokens are common after cookie expiry, logout on another
 * device, or env project switches. Treat as signed-out rather than a hard error.
 */
export function isAuthSessionMissingError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const err = error as { code?: string | null; message?: string | null; status?: number | null };
  const code = String(err.code || "").toLowerCase();
  const message = String(err.message || "").toLowerCase();
  return (
    code === "refresh_token_not_found" ||
    code === "session_not_found" ||
    code === "bad_jwt" ||
    message.includes("refresh token not found") ||
    message.includes("invalid refresh token") ||
    message.includes("session from session_id claim in jwt does not exist")
  );
}

/**
 * Resolves the current user without calling /auth/v1/user when the access token
 * can be verified locally (asymmetric JWT + JWKS). Falls back to getUser() only
 * when needed.
 */
export async function resolveVerifiedAuthUser(
  client: AuthClient | SupabaseClient
): Promise<{ user: User | null; session: Session | null; error: Error | null }> {
  const auth = resolveAuthClient(client);
  let session: Session | null = null;
  let sessionError: Error | null = null;

  try {
    const result = await auth.getSession();
    session = result.data?.session ?? null;
    sessionError = result.error ?? null;
  } catch (error: unknown) {
    if (isSupabaseNetworkError(error) || isAuthSessionMissingError(error)) {
      return { user: null, session: null, error: null };
    }
    return {
      user: null,
      session: null,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }

  if (sessionError) {
    if (isSupabaseNetworkError(sessionError) || isAuthSessionMissingError(sessionError)) {
      return { user: null, session: null, error: null };
    }
    return { user: null, session: null, error: sessionError };
  }

  const accessToken = session?.access_token;
  if (!accessToken) {
    return { user: null, session: null, error: null };
  }

  const { data: claimsData, error: claimsError } = auth.getClaims
    ? await auth.getClaims(accessToken)
    : { data: null, error: new Error("getClaims unavailable") };

  if (!claimsError && claimsData?.claims?.sub) {
    const sub = String(claimsData.claims.sub);
    const email =
      typeof claimsData.claims.email === "string" ? claimsData.claims.email : undefined;
    return {
      user: { id: sub, email } as User,
      session,
      error: null,
    };
  }

  try {
    const {
      data: { user },
      error: userError,
    } = await auth.getUser();

    if (userError && isAuthSessionMissingError(userError)) {
      return { user: null, session: null, error: null };
    }

    return {
      user: user ?? null,
      session: user ? session : null,
      error: userError ?? null,
    };
  } catch (error: unknown) {
    if (isSupabaseNetworkError(error) || isAuthSessionMissingError(error)) {
      return { user: null, session: null, error: null };
    }
    return {
      user: null,
      session: null,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}

/**
 * Validates a bearer access token. Tries local JWT verification first.
 */
export async function resolveVerifiedBearerUser(
  client: AuthClient | SupabaseClient,
  bearerToken: string
): Promise<{ user: User | null; error: Error | null }> {
  const auth = resolveAuthClient(client);
  const token = bearerToken.trim();
  if (!token) {
    return { user: null, error: new Error("Missing bearer token") };
  }

  if (auth.getClaims) {
    const { data: claimsData, error: claimsError } = await auth.getClaims(token);
    if (!claimsError && claimsData?.claims?.sub) {
      const email =
        typeof claimsData.claims.email === "string" ? claimsData.claims.email : undefined;
      return {
        user: { id: String(claimsData.claims.sub), email } as User,
        error: null,
      };
    }
  }

  const { data, error } = await auth.getUser(token);
  return {
    user: data.user ?? null,
    error: error ?? null,
  };
}