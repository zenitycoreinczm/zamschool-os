"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { AuthPageShell } from "@/components/auth/AuthPageShell";

function AcceptInvitationContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";
  const [loading, setLoading] = useState(true);
  const [accepted, setAccepted] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError("Missing invitation token.");
      setLoading(false);
      return;
    }

    const accept = async () => {
      setLoading(true);
      try {
        const response = await fetch("/api/staff/invitations/accept", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(body?.error || "Unable to accept invitation");
        }

        setAccepted(true);
        setEmail(body.email || null);
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "Unable to accept invitation";
        setError(message);
        toast.error(message);
      } finally {
        setLoading(false);
      }
    };

    void accept();
  }, [token]);

  return (
    <AuthPageShell>
      <div className="w-full max-w-lg rounded-[28px] border border-slate-200 bg-white p-8 shadow-[0_24px_70px_rgba(15,23,42,0.12)]">
        <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
          <ShieldCheck className="h-7 w-7" />
        </div>

        {loading ? (
          <div className="flex items-center gap-3 text-slate-600">
            <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
            <span className="text-sm font-medium">Verifying invitation...</span>
          </div>
        ) : null}

        {!loading && accepted ? (
          <div>
            <div className="mb-3 flex items-center gap-2 text-emerald-600">
              <CheckCircle2 className="h-6 w-6" />
              <p className="text-lg font-bold">Invitation accepted</p>
            </div>
            <p className="text-sm leading-6 text-slate-600">
              {email ? (
                <>
                  Sign in as{" "}
                  <span className="font-semibold text-slate-800">{email}</span>{" "}
                  using the temporary password from your invitation email, then
                  complete first-login setup.
                </>
              ) : (
                "Sign in with your temporary password, then complete first-login setup."
              )}
            </p>
            <Link
              href="/login"
              className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-slate-800"
            >
              Go to sign in
            </Link>
          </div>
        ) : null}

        {!loading && error ? (
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-600">
              Error
            </div>
            <p className="text-base font-bold text-slate-900">
              Invitation could not be accepted
            </p>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              {error}
            </p>
            <Link
              href="/login"
              className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-slate-800"
            >
              Return to sign in
            </Link>
          </div>
        ) : null}
      </div>
    </AuthPageShell>
  );
}

export default function AcceptInvitationPage() {
  return (
    <Suspense
      fallback={
        <AuthPageShell>
          <div className="flex items-center gap-2 text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Loading...</span>
          </div>
        </AuthPageShell>
      }
    >
      <AcceptInvitationContent />
    </Suspense>
  );
}
