"use client";

import { Suspense, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, CheckCircle2, Eye, EyeOff, Loader2 } from "lucide-react";

import { AuthPageShell } from "@/components/auth/AuthPageShell";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <AuthPageShell>
          <div className="flex items-center justify-center gap-2 text-slate-600">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading...
          </div>
        </AuthPageShell>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  );
}

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const resetToken = searchParams.get("token");
  const resetEmail = searchParams.get("email");

  const [mode, setMode] = useState<"supabase" | "token" | null>(null);
  const [ready, setReady] = useState(false);
  const [checking, setChecking] = useState(true);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    let active = true;

    const init = async () => {
      // ── Token-based flow (custom SMTP) ──────────────────────────
      if (resetToken && resetEmail) {
        setMode("token");
        setReady(true);
        setChecking(false);
        return;
      }

      // ── Supabase recovery flow (backward compat) ─────────────────
      setMode("supabase");

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!active) return;

      if (session?.user) {
        setReady(true);
        setChecking(false);
        return;
      }

      const { data: listener } = supabase.auth.onAuthStateChange(
        (event, nextSession) => {
          if (!active) return;
          if (event === "PASSWORD_RECOVERY" || nextSession?.user) {
            setReady(true);
            setChecking(false);
          }
        },
      );

      window.setTimeout(() => {
        if (!active) return;
        setChecking(false);
      }, 1500);

      return () => {
        listener.subscription.unsubscribe();
      };
    };

    void init();

    return () => {
      active = false;
    };
  }, [resetToken, resetEmail]);

  const onSubmitSupabase = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (!/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
      setError("Use at least one uppercase letter and one number.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });
      if (updateError) throw updateError;

      await supabase.auth.signOut();
      setSuccess(true);
      setTimeout(() => router.replace("/login?reset=success"), 2000);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to update password",
      );
    } finally {
      setLoading(false);
    }
  };

  const onSubmitToken = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (!/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
      setError("Use at least one uppercase letter and one number.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (!resetToken || !resetEmail) {
      setError("Missing reset information. Please request a new link.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: resetToken,
          email: resetEmail,
          password,
        }),
      });

      const result = await res.json();
      if (!res.ok) {
        // Token expired or Redis crashed mid-flight - redirect to
        // forgot-password which will now use Supabase fallback.
        const isExpired =
          res.status === 400 && result.error?.toLowerCase().includes("expired");
        if (isExpired && resetEmail) {
          router.replace(
            `/forgot-password?email=${encodeURIComponent(resetEmail)}&expired=true`,
          );
          return;
        }
        throw new Error(result.error || "Failed to reset password");
      }

      setSuccess(true);
      setTimeout(() => router.replace("/login?reset=success"), 2000);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to update password",
      );
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = mode === "token" ? onSubmitToken : onSubmitSupabase;

  if (checking) {
    return (
      <AuthPageShell>
        <div className="flex items-center justify-center gap-2 text-slate-600">
          <Loader2 className="h-5 w-5 animate-spin" />
          Preparing reset...
        </div>
      </AuthPageShell>
    );
  }

  if (!ready) {
    return (
      <AuthPageShell>
        <section className="w-full max-w-md rounded-[28px] border border-slate-200 bg-white p-8 text-center shadow-[0_24px_70px_rgba(15,23,42,0.12)]">
          <AlertCircle className="mx-auto mb-4 h-10 w-10 text-amber-500" />
          <h1 className="text-xl font-bold text-slate-950">
            Link expired or invalid
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Request a new password reset email and open the link from your
            inbox.
          </p>
          <Link
            href="/forgot-password"
            className="mt-6 inline-block text-sm font-semibold text-sky-600 hover:underline"
          >
            Request new link
          </Link>
        </section>
      </AuthPageShell>
    );
  }

  return (
    <AuthPageShell>
      <section className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 h-14 w-14 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
            <Image
              src="/icon.png"
              alt="ZamSchool OS"
              width={56}
              height={56}
              className="h-full w-full object-cover"
              priority
            />
          </div>
          <h1 className="text-2xl font-bold text-slate-950">
            Choose a new password
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Enter a strong password for your account.
          </p>
        </div>

        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_24px_70px_rgba(15,23,42,0.12)]">
          {error ? (
            <div className="mb-5 flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          ) : null}

          {success ? (
            <div className="flex items-start gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <span>Password updated. Redirecting to sign in...</span>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4">
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">
                  New password
                </span>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoFocus
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 pr-12 text-slate-950 focus:border-transparent focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-300"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
                    )}
                  </button>
                </div>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">
                  Confirm password
                </span>
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={cn(
                    "w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-950",
                    "focus:border-transparent focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-300",
                  )}
                  autoComplete="new-password"
                />
              </label>

              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 py-3 font-bold text-white hover:bg-slate-800 disabled:opacity-70"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Update password"
                )}
              </button>
            </form>
          )}
        </div>
      </section>
    </AuthPageShell>
  );
}
