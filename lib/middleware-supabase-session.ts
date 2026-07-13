import { createServerClient } from "@supabase/ssr";
import type { NextRequest, NextResponse } from "next/server";

import {
  resolveSessionAal,
  resolveSessionMustChangePassword,
} from "@/lib/middleware-auth-session";
import { resolveMiddlewareProfileRole } from "@/lib/middleware-profile-cache";
import { normalizeRole } from "@/lib/roles";
import {
  isAuthSessionMissingError,
  resolveVerifiedAuthUser,
} from "@/lib/supabase-auth-verify";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";

/** Clear Supabase auth cookies when the refresh token is gone/invalid. */
function clearSupabaseAuthCookies(
  request: NextRequest,
  response: NextResponse,
) {
  for (const cookie of request.cookies.getAll()) {
    const name = cookie.name;
    if (
      name.startsWith("sb-") &&
      (name.includes("-auth-token") ||
        name.endsWith("-auth-token") ||
        name.includes("code-verifier"))
    ) {
      request.cookies.set(name, "");
      response.cookies.set(name, "", {
        path: "/",
        maxAge: 0,
        httpOnly: true,
        sameSite: "lax",
      });
    }
  }
}

export type VerifiedMiddlewareSession = {
  userId: string;
  /** From `profiles.role` only — never from user_metadata. */
  role: ReturnType<typeof normalizeRole>;
  mustChangePassword: boolean;
  aal: string | null;
  mfaEnrolled: boolean;
};

export function createMiddlewareSupabaseClient(
  request: NextRequest,
  response: NextResponse
) {
  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
    // Middleware runs on every navigation. Disabling auto-refresh avoids
    // hammering /auth/v1/token when DNS/network is down; refresh happens
    // on the client and dedicated auth routes instead.
    auth: {
      autoRefreshToken: false,
    },
  });
}

/**
 * Validates the session (getSession + local JWT when possible, else getUser) and
 * resolves role from profiles only. Never trusts cookie JSON or user_metadata for authorization.
 */
export async function resolveVerifiedMiddlewareSession(
  request: NextRequest,
  response: NextResponse
): Promise<VerifiedMiddlewareSession | null> {
  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  const supabase = createMiddlewareSupabaseClient(request, response);

  let user: Awaited<ReturnType<typeof resolveVerifiedAuthUser>>["user"] = null;
  let session: Awaited<ReturnType<typeof resolveVerifiedAuthUser>>["session"] =
    null;
  let error: Error | null = null;

  try {
    const resolved = await resolveVerifiedAuthUser(supabase);
    user = resolved.user;
    session = resolved.session;
    error = resolved.error;
  } catch (thrown: unknown) {
    // Supabase may throw AuthApiError for dead refresh tokens.
    if (isAuthSessionMissingError(thrown)) {
      clearSupabaseAuthCookies(request, response);
      return null;
    }
    if (
      thrown &&
      typeof thrown === "object" &&
      "message" in thrown &&
      String((thrown as { message?: string }).message || "")
        .toLowerCase()
        .includes("refresh token")
    ) {
      clearSupabaseAuthCookies(request, response);
      return null;
    }
    return null;
  }

  if (error || !user?.id) {
    if (error && isAuthSessionMissingError(error)) {
      clearSupabaseAuthCookies(request, response);
    }
    return null;
  }

  const role = await resolveMiddlewareProfileRole(user.id, user.email);

  const appMetadata = user.app_metadata || {};
  const mfaEnrolled =
    appMetadata.mfa_enrolled === true ||
    (user as { user_metadata?: { mfa_enrolled?: boolean } }).user_metadata?.mfa_enrolled ===
      true;

  return {
    userId: user.id,
    role,
    mustChangePassword:
      appMetadata.must_change_password === true ||
      resolveSessionMustChangePassword({
        user: {
          app_metadata: appMetadata,
          user_metadata: {},
        },
      }),
    aal: resolveSessionAal(
      session
        ? {
            access_token: session.access_token,
          }
        : null
    ),
    mfaEnrolled,
  };
}