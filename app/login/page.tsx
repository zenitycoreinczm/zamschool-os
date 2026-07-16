"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { User } from "@supabase/supabase-js";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import {
  AlertCircle,
  CheckCircle2,
  BookOpenCheck,
  Building2,
  CalendarDays,
  Eye,
  EyeOff,
  GraduationCap,
  Loader2,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import * as z from "zod";
import { getAuthRateLimitState } from "@/lib/auth-rate-limit";
import { resolveOnboardingPath } from "@/lib/auth-routing";
import { applyCsrfHeader, captureCsrfFromResponse } from "@/lib/csrf-client";
import { buildLoginCooldown, getLoginCooldownState, clearLoginCooldown } from "@/lib/login-cooldown";
import { fetchProfileByIdentity } from "@/lib/profile-lookup";
import { supabase } from "@/lib/supabase";
import { clearClientAuthCaches } from "@/lib/workspace/clear-client-auth-caches";
import { AuthPageShell } from "@/components/auth/AuthPageShell";
import { cn } from "@/lib/utils";

const MFA_CHALLENGE_PATH = "/login/mfa";

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type LoginFormValues = z.infer<typeof loginSchema>;
const FIRST_LOGIN_PATH = "/first-login";
type ProfileSnapshot = {
  role: string | null;
  school_id: string | null;
  must_change_password?: boolean | null;
  temporary_password_issued_at?: string | null;
} | null;
type ExistingSessionState = {
  destination: string;
  email: string;
  hasSchool: boolean;
  role: string | null;
  mustChangePassword: boolean;
};

async function loadProfileSnapshot(user: User): Promise<ProfileSnapshot> {
  const { data: profile, error: profileError } = await fetchProfileByIdentity<{
    role?: string | null;
    school_id?: string | null;
    must_change_password?: boolean | null;
    temporary_password_issued_at?: string | null;
  }>(
    supabase as any,
    user.id,
    "role, school_id, must_change_password, temporary_password_issued_at",
    user.email
  );

  if (profileError) throw profileError;
  if (!profile) return null;

  return {
    role: profile.role ?? null,
    school_id: profile.school_id ?? null,
    must_change_password: profile.must_change_password ?? null,
    temporary_password_issued_at: profile.temporary_password_issued_at ?? null,
  };
}

function buildDestination(user: User, profile: ProfileSnapshot, redirectTo?: string | null) {
  const mustChangePassword = profile?.must_change_password === true;

  if (mustChangePassword) {
    return FIRST_LOGIN_PATH;
  }

  // Profile row never landed (registration step 3 was abandoned / 403'd).
  // Treat a verified user whose Supabase user_metadata.role is PRINCIPAL as
  // a half-finished registration and route them back to step 3.
  const metadataRole = (user.user_metadata as { role?: string } | undefined)?.role;
  if (
    !profile &&
    Boolean(user.email_confirmed_at) &&
    (metadataRole === "PRINCIPAL" || metadataRole === "ADMIN") // ADMIN = legacy, normalizes to Head Teacher
  ) {
    return `/register?resume=school&email=${encodeURIComponent(user.email ?? "")}&userId=${encodeURIComponent(user.id ?? "")}`;
  }

  return resolveOnboardingPath({
    role: profile?.role,
    emailVerified: Boolean(user.email_confirmed_at),
    hasSchool: Boolean(profile?.school_id),
    mustChangePassword: false,
    redirectTo,
  });
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <AuthPageShell>
        <section className="w-full max-w-[440px]">
          <div className="rounded-workspace-xl border border-slate-200 bg-white p-6 shadow-[0_24px_70px_rgba(15,23,42,0.12)]">
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
            </div>
          </div>
        </section>
      </AuthPageShell>
    }>
      <LoginContent />
    </Suspense>
  );
}

function LoginContent() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [continuingSession, setContinuingSession] = useState(false);
  const [switchingAccount, setSwitchingAccount] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [existingSession, setExistingSession] = useState<ExistingSessionState | null>(null);
  const [cooldown, setCooldown] = useState<{ email: string; until: number } | null>(null);
  const [cooldownNow, setCooldownNow] = useState(() => Date.now());
  /** Bot honeypot - humans never see or fill this. */
  const [honeypot, setHoneypot] = useState("");
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirectTo");

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  });
  const enteredEmail = String(watch("email") || "").trim().toLowerCase();
  const cooldownState =
    cooldown && cooldown.email === enteredEmail
      ? getLoginCooldownState(cooldown.until, cooldownNow)
      : { active: false, remainingSeconds: 0 };

  // Auto-focus email input on mount
  useEffect(() => {
    const emailInput = document.querySelector<HTMLInputElement>('input[type="email"]');
    if (emailInput && !existingSession) {
      emailInput.focus();
    }
  }, [existingSession]);

  useEffect(() => {
    if (!cooldown?.until) {
      return;
    }

    setCooldownNow(Date.now());
    const timer = window.setInterval(() => {
      setCooldownNow(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [cooldown?.until]);

  useEffect(() => {
    if (cooldown && !getLoginCooldownState(cooldown.until, cooldownNow).active) {
      setCooldown(null);
    }
  }, [cooldown, cooldownNow]);

  useEffect(() => {
    let active = true;

    const inspectExistingSession = async () => {
      setSessionLoading(true);

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!active) return;

        if (!session?.user) {
          setExistingSession(null);
          return;
        }

        const profile = await loadProfileSnapshot(session.user);
        if (!active) return;

        setExistingSession({
          destination: buildDestination(session.user, profile, redirectTo),
          email: session.user.email ?? "Signed-in user",
          hasSchool: Boolean(profile?.school_id),
          role: profile?.role ?? null,
          mustChangePassword: profile?.must_change_password === true,
        });
      } catch (sessionError: any) {
        if (!active) return;
        console.warn("[LoginPage.inspectExistingSession()] Session inspection failed", {
          message: sessionError?.message || "Unable to inspect current session",
        });
        setExistingSession(null);
      } finally {
        if (active) setSessionLoading(false);
      }
    };

    inspectExistingSession();

    return () => {
      active = false;
    };
  }, [redirectTo]);

  const continueToWorkspace = async () => {
    if (!existingSession?.destination) return;

    setContinuingSession(true);
    setError(null);

    try {
      window.location.assign(existingSession.destination);
    } finally {
      setContinuingSession(false);
    }
  };

  const handleUseAnotherAccount = async () => {
    setSwitchingAccount(true);
    setError(null);

    try {
      clearClientAuthCaches();
      await supabase.auth.signOut({ scope: "global" }).catch(async () => {
        await supabase.auth.signOut({ scope: "local" });
      });
      clearClientAuthCaches();
      setExistingSession(null);
    } catch (signOutError: any) {
      setError(signOutError?.message || "Unable to clear the current session");
    } finally {
      setSwitchingAccount(false);
    }
  };

  const callLoginGuard = async (
    email: string,
    outcome: "check" | "failure" | "success",
  ): Promise<{ locked: boolean; retryAfterSec: number; redis?: boolean } | null> => {
    try {
      const headers = new Headers({
        "Content-Type": "application/json",
        Accept: "application/json",
      });
      // Prefer CSRF when the cookie is present (login page usually has one).
      applyCsrfHeader(headers, "POST");

      const res = await fetch("/api/auth/login-guard", {
        method: "POST",
        credentials: "include",
        headers,
        body: JSON.stringify({
          email,
          outcome,
          // Always empty for real users; bots often auto-fill hidden fields.
          website: honeypot,
        }),
      });
      captureCsrfFromResponse(res);
      if (!res.ok) return null;
      const body = (await res.json()) as {
        locked?: boolean;
        retryAfterSec?: number;
        redis?: boolean;
      };
      return {
        locked: Boolean(body.locked),
        retryAfterSec: Number(body.retryAfterSec || 0),
        redis: body.redis,
      };
    } catch {
      return null;
    }
  };

  const onSubmit = async (data: LoginFormValues) => {
    setLoading(true);
    setError(null);

    try {
      if (cooldownState.active) {
        setError(`Too many login attempts. Try again in ${cooldownState.remainingSeconds} seconds.`);
        return;
      }

      // Honeypot: only block empty-password bot posts. Password managers sometimes
      // autofill hidden fields - never block a user who typed real credentials.
      if (honeypot.trim().length > 0 && !data.password.trim()) {
        await new Promise((r) => setTimeout(r, 800 + Math.random() * 400));
        setError("Invalid login credentials");
        return;
      }

      const email = data.email.trim().toLowerCase();
      // Trim ends only - copy/paste of temp passwords often adds a trailing space.
      const password = data.password.trim();
      if (!email || !password) {
        setError("Enter your email and password.");
        return;
      }

      // Server-side Redis lockout

      // Server-side Redis lockout (cannot be cleared by wiping localStorage).
      const guard = await callLoginGuard(email, "check");
      if (guard?.locked) {
        const cooldown = buildLoginCooldown(guard.retryAfterSec || 900);
        setCooldown({ email, until: cooldown.until });
        setError(
          `Too many login attempts. Try again in ${Math.max(1, guard.retryAfterSec || 900)} seconds.`,
        );
        return;
      }

      // Always drop previous role/workspace caches before a new sign-in so a
      // student → logout → teacher login cannot keep the student shell.
      clearClientAuthCaches();
      if (existingSession) {
        await supabase.auth.signOut({ scope: "global" }).catch(async () => {
          await supabase.auth.signOut({ scope: "local" });
        });
        clearClientAuthCaches();
        setExistingSession(null);
      }

      if (process.env.NODE_ENV === "development") {
        console.info("[LoginPage.onSubmit()] Attempting sign-in", {
          email,
        });
      }

      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        const afterFail = await callLoginGuard(email, "failure");
        if (afterFail?.locked) {
          const next = buildLoginCooldown(afterFail.retryAfterSec || 900);
          setCooldown({ email, until: next.until });
          setError(
            `Too many login attempts. Try again in ${Math.max(1, afterFail.retryAfterSec || 900)} seconds.`,
          );
          return;
        }
        // No soft 30s lock after a single bad password - staff often retry
        // immediately with the correct temporary password.
        throw authError;throw authError;
      }

      // Clear server + client cooldowns on successful login
      void callLoginGuard(email, "success");
      clearLoginCooldown();

      const emailVerified = Boolean(authData.user.email_confirmed_at);
      if (process.env.NODE_ENV === "development") {
        console.info("[LoginPage.onSubmit()] Sign-in succeeded", {
          userId: authData.user.id,
          emailVerified,
        });
      }

      if (!emailVerified) {
        if (process.env.NODE_ENV === "development") {
          console.info("[LoginPage.onSubmit()] Redirecting to email verification", {
            userId: authData.user.id,
          });
        }
        router.replace(`/verify-email?email=${encodeURIComponent(data.email)}&userId=${authData.user.id}`);
        router.refresh();
        return;
      }

      const resolvedProfile = await loadProfileSnapshot(authData.user);

      if (process.env.NODE_ENV === "development") {
        console.info("[LoginPage.onSubmit()] Loaded profile snapshot", {
          userId: authData.user.id,
          role: resolvedProfile?.role || null,
          hasSchoolId: Boolean(resolvedProfile?.school_id),
        });
      }

      const destination = buildDestination(authData.user, resolvedProfile, redirectTo);

      if (process.env.NODE_ENV === "development") {
        console.info("[LoginPage.onSubmit()] Resolved post-login destination", {
          userId: authData.user.id,
          role: resolvedProfile?.role || null,
          hasSchool: Boolean(resolvedProfile?.school_id),
          destination,
          redirectTo,
        });
      }

      // Check MFA enrollment before final redirect
      const mfaResponse = await fetch("/api/auth/mfa/factors");
      if (mfaResponse.ok) {
        const mfaJson = await mfaResponse.json();
        const factors: Array<{ status: string }> = mfaJson.data?.factors ?? [];
        const hasVerifiedMfa = factors.some((f) => f.status === "verified");

        if (hasVerifiedMfa) {
          const mfaUrl = new URL(MFA_CHALLENGE_PATH, window.location.origin);
          mfaUrl.searchParams.set("returnTo", destination);
          window.location.assign(mfaUrl.pathname + mfaUrl.search);
          return;
        }
      }

      // Drop any caches rehydrated during sign-in before the full navigation.
      clearClientAuthCaches();

      // Full page load after sign-in so session cookies + middleware settle.
      // Soft replace+refresh races and can abort the RSC flight for destinations
      // like /app/student ("Failed to fetch RSC payload").
      window.location.assign(destination);
    } catch (err: any) {
      const rateLimit = getAuthRateLimitState(err);
      if (rateLimit.isRateLimited) {
        const nextCooldown = buildLoginCooldown(rateLimit.retryAfterSeconds, Date.now());
        setCooldown({
          email: String(data.email || "").trim().toLowerCase(),
          until: nextCooldown.until,
        });
        setCooldownNow(Date.now());
        setError(rateLimit.message);
        return;
      }

      // Never surface raw Supabase/infra messages (schema, rate-limit internals).
      const raw = String(err?.message || "");
      const generic = "Invalid login credentials";
      const safe =
        /invalid login|invalid credentials|email not confirmed|too many requests|rate limit/i.test(
          raw,
        )
          ? raw.includes("rate") || raw.includes("Too many")
            ? "Too many login attempts. Please try again later."
            : raw.toLowerCase().includes("email not confirmed")
              ? "Please verify your email before signing in."
              : generic
          : generic;
      if (process.env.NODE_ENV !== "production") {
        console.warn("[LoginPage.onSubmit()] Sign-in failed");
      }
      setError(safe);
    } finally {
      setLoading(false);
    }
  };
  const cooldownMessage = cooldownState.active
    ? `Too many login attempts. Try again in ${cooldownState.remainingSeconds} seconds.`
    : null;
  const authMessage = cooldownMessage || error;
  const authSuccess =
    searchParams.get("verified") === "true"
      ? "Email verified. Sign in to continue."
      : searchParams.get("reset") === "success"
        ? "Password updated. Sign in with your new password."
        : null;

  return (
    <AuthPageShell>
        <section className="w-full max-w-[440px]">
          <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_24px_70px_rgba(15,23,42,0.12)]">

            <div className="mb-6 flex items-start gap-3.5">
              <div className="mt-0.5 h-12 w-12 shrink-0 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
                <Image
                  src="/icon.png"
                  alt="ZamSchool OS"
                  width={48}
                  height={48}
                  className="h-full w-full object-cover"
                  priority
                />
              </div>
              <div className="min-w-0 text-left">
                <h1 className="text-2xl font-bold tracking-normal text-slate-950">
                  Sign in
                </h1>
                <p className="mt-1.5 text-sm text-slate-500">
                  Use your school email and password.
                </p>
              </div>
            </div>

            {authSuccess ? (
              <div className="mb-6 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                <CheckCircle2 className="h-5 w-5 shrink-0" />
                <span>{authSuccess}</span>
              </div>
            ) : null}

            {authMessage && (
              <div className="mb-6 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700" role="alert">
                <AlertCircle className="h-5 w-5 shrink-0" />
                <span>{authMessage}</span>
              </div>
            )}

            {sessionLoading ? (
              <div className="mb-4 flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-medium text-slate-500">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-500" />
                <span>Checking for an active session...</span>
              </div>
            ) : existingSession ? (
              <div className="mb-6 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-slate-700">
                <p className="text-sm font-semibold text-sky-700">Active session detected</p>
                <p className="mt-2 text-sm">
                  {existingSession.email}
                  {existingSession.role ? ` is already signed in as ${existingSession.role.toLowerCase()}.` : " is already signed in."}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {existingSession.mustChangePassword
                    ? "This managed account must finish first-login setup before entering the workspace."
                    : existingSession.hasSchool
                    ? "Continue to workspace, or switch to another account first if you want to use teacher credentials created by an admin."
                    : "This account still needs onboarding. Continue to finish setup or switch accounts."}
                </p>
                <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={continueToWorkspace}
                    disabled={continuingSession || switchingAccount}
                    className="flex-1 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200 disabled:opacity-70"
                  >
                    {continuingSession ? "Opening workspace..." : "Continue to workspace"}
                  </button>
                  <button
                    type="button"
                    onClick={handleUseAnotherAccount}
                    disabled={continuingSession || switchingAccount}
                    className="flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200 disabled:opacity-70"
                  >
                    {switchingAccount ? "Clearing session..." : "Use another account"}
                  </button>
                </div>
              </div>
            ) : null}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" autoComplete="on">
              {/* Honeypot: obscure name so password managers do not autofill it */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -left-[9999px] h-0 w-0 overflow-hidden opacity-0"
              >
                <label htmlFor="zs-login-hp">Leave blank</label>
                <input
                  id="zs-login-hp"
                  name="zs_login_hp"
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                  data-1p-ignore="true"
                  data-lpignore="true"
                  data-form-type="other"
                  value={honeypot}
                  onChange={(e) => setHoneypot(e.target.value)}
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">Email</label>
                <input
                  {...register("email")}
                  type="email"
                  autoComplete="username"
                  className={cn(
                    "w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-950 placeholder:text-slate-400 transition-all focus:border-transparent focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-400",
                    errors.email && "border-red-400 focus:ring-red-400"
                  )}
                  placeholder="name@school.com"
                />
                {errors.email && <p className="mt-2 text-xs font-medium text-red-600">{errors.email.message}</p>}
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between gap-4">
                  <label className="block text-sm font-semibold text-slate-700">Password</label>
                  <Link
                    href={
                      enteredEmail
                        ? `/forgot-password?email=${encodeURIComponent(enteredEmail)}`
                        : "/forgot-password"
                    }
                    className="text-xs font-medium text-slate-500 transition hover:text-slate-800 hover:underline"
                  >
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <input
                    {...register("password")}
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    className={cn(
                      "w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 pr-12 text-slate-950 placeholder:text-slate-400 transition-all focus:border-transparent focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-400",
                      errors.password && "border-red-400 focus:ring-red-400"
                    )}
                    placeholder="Your password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-xl text-slate-400 transition-colors hover:bg-white hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
                {errors.password && <p className="mt-2 text-xs font-medium text-red-600">{errors.password.message}</p>}
              </div>

              <button
                type="submit"
                disabled={loading || switchingAccount || cooldownState.active}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 py-3.5 text-sm font-semibold text-white transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Signing in…
                  </>
                ) : (
                  "Sign in"
                )}
              </button>
            </form>

            <div className="mt-5 border-t border-slate-100 pt-4">
              <p className="text-center text-sm text-slate-500">
                New school setup?{" "}
                <Link
                  href="/register"
                  className="font-semibold text-slate-900 underline-offset-2 hover:underline"
                >
                  Register your school
                </Link>
              </p>
            </div>
          </div>
        </section>
    </AuthPageShell>
  );
}
