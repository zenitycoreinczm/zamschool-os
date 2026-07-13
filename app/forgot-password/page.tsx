"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { AlertCircle, Check, Loader2 } from "lucide-react";

import { AuthPageShell } from "@/components/auth/AuthPageShell";

export default function ForgotPasswordPage() {
  return (
    <Suspense
      fallback={
        <AuthPageShell>
          <div className="flex w-full max-w-lg items-center justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
          </div>
        </AuthPageShell>
      }
    >
      <ForgotPasswordContent />
    </Suspense>
  );
}

function ForgotPasswordContent() {
  const searchParams = useSearchParams();
  const prefillEmail = searchParams.get("email") || "";
  const isExpired = searchParams.get("expired") === "true";

  const [email, setEmail] = useState(prefillEmail);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    const normalized = email.trim().toLowerCase();
    if (!normalized) {
      setError("Enter your email.");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ email: normalized }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed to send reset link");
      setSuccess(
        result.message ||
          "If an account exists for that email, a reset link is on the way.",
      );
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to send reset link",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthPageShell contentClassName="py-8">
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
                Forgot password
              </h1>
              <p className="mt-1.5 text-sm text-slate-500">
                Enter your school email and we will send a reset link.
              </p>
            </div>
          </div>

          {isExpired ? (
            <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <p>
                  Your previous reset link has expired. Request a new one below.
                </p>
              </div>
            </div>
          ) : null}

          {error ? (
            <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <p>{error}</p>
              </div>
            </div>
          ) : null}

          {success ? (
            <div className="mb-5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              <div className="flex items-start gap-2.5">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-900 text-white">
                  <Check className="h-3 w-3" strokeWidth={2.5} aria-hidden />
                </span>
                <p>{success}</p>
              </div>
            </div>
          ) : null}

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="forgot-email"
                className="mb-2 block text-sm font-semibold text-slate-700"
              >
                Email
              </label>
              <input
                id="forgot-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoFocus
                autoComplete="username"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-950 placeholder:text-slate-400 transition-all focus:border-transparent focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-400"
                placeholder="name@school.com"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 py-3 text-base font-bold text-white transition hover:bg-slate-800 disabled:opacity-70"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Sending…
                </>
              ) : (
                "Send reset link"
              )}
            </button>
          </form>

          <div className="mt-5 border-t border-slate-100 pt-4 text-center">
            <Link
              href="/login"
              className="text-sm font-medium text-slate-600 transition hover:text-slate-900"
            >
              Back to sign in
            </Link>
          </div>
        </div>
      </section>
    </AuthPageShell>
  );
}
