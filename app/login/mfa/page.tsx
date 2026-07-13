"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, ShieldCheck, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { safeErrorMessage } from "@/lib/safe-error";
import { supabase } from "@/lib/supabase";

// Helper to get CSRF token from cookies
function getCsrfToken() {
  if (typeof document === "undefined") return null;
  const value = `; ${document.cookie}`;
  const parts = value.split("; csrf-token=");
  if (parts.length === 2) {
    return parts.pop()?.split(";").shift() || null;
  }
  return null;
}

type Factor = {
  id: string;
  factor_type: "totp" | "phone";
  status: "verified" | "unverified";
  friendly_name?: string;
};

export default function MfaChallengePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo") || "/app/dashboard";

  const [loading, setLoading] = useState(true);
  const [factors, setFactors] = useState<Factor[]>([]);
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [activeFactorId, setActiveFactorId] = useState<string | null>(null);

  const loadFactors = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/mfa/factors");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to load factors");
      }
      const json = await res.json();
      const all: Factor[] = json.data?.factors ?? [];
      const verified = all.filter((f) => f.status === "verified");
      if (verified.length === 0) {
        toast.error("No MFA factors configured. Contact your administrator.");
        router.push(returnTo);
        return;
      }
      setFactors(verified);
      if (verified.length === 1) {
        setActiveFactorId(verified[0].id);
      }
    } catch (error: unknown) {
      toast.error(safeErrorMessage(error, "Failed to load authentication options"));
    } finally {
      setLoading(false);
    }
  }, [router, returnTo]);

  useEffect(() => {
    void loadFactors();
  }, [loadFactors]);

  async function handleVerify() {
    if (!activeFactorId || !code) return;
    setVerifying(true);
    const csrfToken = getCsrfToken();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (csrfToken) {
      headers["X-CSRF-Token"] = csrfToken;
    }
    try {
      // First create challenge
      const challengeRes = await fetch("/api/auth/mfa/challenge", {
        method: "POST",
        headers,
        body: JSON.stringify({ factorId: activeFactorId }),
      });
      if (!challengeRes.ok) {
        const body = await challengeRes.json().catch(() => ({}));
        throw new Error(body.error || "Challenge failed");
      }
      const challengeJson = await challengeRes.json();
      const challengeId = challengeJson.data.challengeId;

      // Then verify
      const verifyRes = await fetch("/api/auth/mfa/verify", {
        method: "POST",
        headers,
        body: JSON.stringify({ factorId: activeFactorId, challengeId, code: code.trim() }),
      });
      if (!verifyRes.ok) {
        const body = await verifyRes.json().catch(() => ({}));
        throw new Error(body.error || "Invalid verification code");
      }
      await supabase.auth.refreshSession();
      toast.success("Verification successful");
      router.push(returnTo);
    } catch (error: unknown) {
      toast.error(safeErrorMessage(error, "Verification failed"));
      setCode("");
    } finally {
      setVerifying(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex items-center gap-2 text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading authentication...
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-sky-100">
            <ShieldCheck className="h-6 w-6 text-sky-600" />
          </div>
          <h1 className="text-xl font-bold text-slate-900">Two-factor authentication</h1>
          <p className="mt-1 text-sm text-slate-500">
            Enter the 6-digit code from your authenticator app to continue
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="space-y-4">
            {factors.length > 1 && (
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Authentication method
                </label>
                <select
                  value={activeFactorId ?? ""}
                  onChange={(e) => {
                    setActiveFactorId(e.target.value);

                    setCode("");
                  }}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-200"
                >
                  {factors.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.friendly_name || "Authenticator app"}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Verification code
              </label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                autoComplete="one-time-code"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                placeholder="000000"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-center text-lg tracking-widest outline-none focus:ring-2 focus:ring-sky-200"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && code.length === 6) {
                    handleVerify();
                  }
                }}
              />
            </div>
            <button
              onClick={handleVerify}
              disabled={verifying || !activeFactorId || code.length !== 6}
              className="w-full rounded-xl bg-sky-500 px-4 py-3 text-sm font-semibold text-white hover:bg-sky-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200 disabled:opacity-60"
            >
              {verifying ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Verifying...
                </span>
              ) : (
                "Verify"
              )}
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-left text-sm text-amber-950">
          <p className="font-semibold">Can’t open your authenticator app?</p>
          <p className="mt-1.5 leading-relaxed text-amber-900/90">
            If you cannot provide the codes from your authenticator app, you
            must contact the <strong>ICT admin at your school</strong>. They can
            turn off the authenticator step so you can sign in with your email
            and password only. After you regain access, re-enable two-factor
            authentication in Settings.
          </p>
        </div>

        <div className="text-center">
          <button
            onClick={async () => {
              await supabase.auth.signOut();
              router.push("/login");
            }}
            className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
          >
            <ArrowLeft className="h-3 w-3" />
            Back to sign in
          </button>
        </div>
      </div>
    </div>
  );
}