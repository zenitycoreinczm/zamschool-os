"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Eye, EyeOff, Loader2, LockKeyhole } from "lucide-react";

import { resolveOnboardingPath } from "@/lib/auth-routing";
import { supabase } from "@/lib/supabase";
import { AuthPageShell } from "@/components/auth/AuthPageShell";
import { cn } from "@/lib/utils";
import { adminApiFetch } from "@/lib/admin-browser-api";

type AccountProfilePayload = {
  success?: boolean;
  data?: {
    profile?: {
      role?: string | null;
    } | null;
    firstLogin?: {
      mustChangePassword?: boolean;
      temporaryPasswordIssuedAt?: string | null;
    } | null;
  } | null;
  error?: string;
};

export default function FirstLoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [profileRole, setProfileRole] = useState<string | null>(null);
  const [temporaryPasswordIssuedAt, setTemporaryPasswordIssuedAt] = useState<
    string | null
  >(null);

  const helperText = useMemo(() => {
    if (!temporaryPasswordIssuedAt) {
      return "Set a new password to activate this account and continue to your workspace.";
    }

    const issuedAt = new Date(temporaryPasswordIssuedAt);
    return Number.isNaN(issuedAt.getTime())
      ? "Set a new password to activate this account and continue to your workspace."
      : `Your temporary password was issued on ${issuedAt.toLocaleString()}. Choose a new one now.`;
  }, [temporaryPasswordIssuedAt]);

  useEffect(() => {
    let active = true;

    const loadState = async () => {
      setLoading(true);
      setError("");

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!active) return;
        if (!session?.user) {
          router.replace("/login");
          return;
        }

        const response = await fetch("/api/account/profile", {
          cache: "no-store",
        });
        const payload = (await response.json()) as AccountProfilePayload;
        if (!active) return;

        if (!response.ok) {
          throw new Error(payload.error || "Failed to load account state");
        }

        const mustChangePassword =
          typeof payload.data?.firstLogin?.mustChangePassword === "boolean"
            ? payload.data.firstLogin.mustChangePassword === true
            : false;

        const resolvedRole =
          String(payload.data?.profile?.role || "").trim() || null;
        setProfileRole(resolvedRole);
        setTemporaryPasswordIssuedAt(
          payload.data?.firstLogin?.temporaryPasswordIssuedAt || null,
        );

        if (!mustChangePassword) {
          // Full navigation avoids a soft RSC race (replace + refresh aborts
          // the in-flight flight request → "Failed to fetch RSC payload").
          const destination = resolveOnboardingPath({
            role: resolvedRole,
            emailVerified: Boolean(session.user.email_confirmed_at),
            hasSchool: true,
            mustChangePassword: false,
          });
          window.location.assign(destination);
        }
      } catch (loadError: any) {
        if (!active) return;
        setError(loadError?.message || "Failed to load first-login state");
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadState();

    return () => {
      active = false;
    };
  }, [router]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (password.trim().length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Confirm password must match the new password.");
      return;
    }

    setSubmitting(true);

    try {
      const updateResult = await supabase.auth.updateUser({
        password,
      });
      if (updateResult.error) {
        throw updateResult.error;
      }

      const response = await adminApiFetch("/api/auth/complete-first-login", {
        method: "POST",
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to complete first login");
      }

      const refreshResult = await supabase.auth.refreshSession();
      if (refreshResult.error) {
        throw refreshResult.error;
      }

      const refreshedSession = refreshResult.data.session;

      // Hard navigation after password + session refresh so middleware and
      // workspace providers boot cleanly. Soft router.replace + router.refresh
      // races and aborts the RSC payload for the destination (e.g. /app/student).
      const destination = resolveOnboardingPath({
        role: profileRole,
        emailVerified: Boolean(refreshedSession?.user?.email_confirmed_at),
        hasSchool: true,
        mustChangePassword: false,
      });
      window.location.assign(destination);
    } catch (submitError: any) {
      setError(submitError?.message || "Failed to finish first-login setup");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <AuthPageShell>
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-6 py-5 text-sm text-slate-600 shadow-sm">
          <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
          <span>Preparing first-login setup...</span>
        </div>
      </AuthPageShell>
    );
  }

  return (
    <AuthPageShell contentClassName="py-10">
      <div className="w-full max-w-lg rounded-[28px] border border-slate-200 bg-white p-8 shadow-[0_24px_70px_rgba(15,23,42,0.12)]">
        <div className="flex items-start gap-4">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-sky-50 text-sky-700">
            <LockKeyhole className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-600">
              First login
            </p>
            <h1 className="mt-2 text-2xl font-bold text-slate-950">
              Activate your managed account
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-500">
              {helperText}
            </p>
          </div>
        </div>

        {error ? (
          <div className="mt-6 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}

        <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
          <PasswordField
            label="New password"
            value={password}
            onChange={setPassword}
            visible={showPassword}
            onToggle={() => setShowPassword((current) => !current)}
          />
          <PasswordField
            label="Confirm password"
            value={confirmPassword}
            onChange={setConfirmPassword}
            visible={showConfirmPassword}
            onToggle={() => setShowConfirmPassword((current) => !current)}
          />

          <button
            type="submit"
            disabled={submitting}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Finish first-login setup
          </button>
        </form>
      </div>
    </AuthPageShell>
  );
}

function PasswordField({
  label,
  value,
  onChange,
  visible,
  onToggle,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  visible: boolean;
  onToggle: () => void;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-slate-700">
        {label}
      </span>
      <div className="relative">
        <input
          type={visible ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={cn(
            "w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 pr-12 text-sm text-slate-950 outline-none transition focus:border-transparent focus:bg-white focus:ring-2 focus:ring-sky-300",
          )}
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-700"
        >
          {visible ? (
            <EyeOff className="h-4 w-4" />
          ) : (
            <Eye className="h-4 w-4" />
          )}
        </button>
      </div>
    </label>
  );
}
