"use client";

import { useEffect, useState } from "react";
import {
  Loader2,
  ShieldCheck,
  ShieldOff,
  Trash2,
  QrCode,
  KeyRound,
  Smartphone,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { safeErrorMessage } from "@/lib/safe-error";
import { Surface } from "@/components/workspace/Surface";
import { cn } from "@/lib/utils";
import { primaryButton, secondaryButton } from "@/lib/workspace/design";

type Factor = {
  id: string;
  factor_type: "totp" | "phone";
  status: "verified" | "unverified";
  friendly_name?: string;
};

type EnrollData = {
  factorId: string;
  qrCodeUrl: string;
  secret: string;
};

/**
 * Render a TOTP QR from Supabase (raw SVG markup or data:/http(s) URL).
 * next/image rejects large SVG data URLs that end with whitespace/control chars.
 */
function MfaQrCode({ qrCodeUrl }: { qrCodeUrl: string }) {
  const src = qrCodeUrl.trim();

  if (src.startsWith("<svg")) {
    return (
      <div
        className="h-48 w-48 [&_svg]:h-full [&_svg]:w-full"
        dangerouslySetInnerHTML={{ __html: src }}
      />
    );
  }

  // Ephemeral enroll QR - plain img avoids next/image src validation on data: URIs
  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      src={src}
      alt="Authenticator QR code"
      width={192}
      height={192}
      className="h-48 w-48"
    />
  );
}

/**
 * Shared two-factor authentication setup for every role’s Settings page.
 * Uses TOTP (Google Authenticator, Microsoft Authenticator, Authy, etc.).
 */
export function MfaSetup() {
  const [factors, setFactors] = useState<Factor[]>([]);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [enrollData, setEnrollData] = useState<EnrollData | null>(null);
  const [verifyCode, setVerifyCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  useEffect(() => {
    void loadFactors();
  }, []);

  async function loadFactors() {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/mfa/factors");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to load MFA factors");
      }
      const json = await res.json();
      setFactors(json.data?.factors ?? []);
    } catch (error: unknown) {
      toast.error(safeErrorMessage(error, "Failed to load MFA factors"));
    } finally {
      setLoading(false);
    }
  }

  async function startEnroll() {
    setEnrolling(true);
    setEnrollData(null);
    setVerifyCode("");
    try {
      const res = await fetch("/api/auth/mfa/enroll", { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to start MFA enrollment");
      }
      const json = await res.json();
      setEnrollData(json.data);
    } catch (error: unknown) {
      toast.error(safeErrorMessage(error, "Failed to start MFA enrollment"));
    } finally {
      setEnrolling(false);
    }
  }

  async function confirmEnroll() {
    if (!enrollData || !verifyCode) return;
    setVerifying(true);
    try {
      const challengeRes = await fetch("/api/auth/mfa/challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ factorId: enrollData.factorId }),
      });
      if (!challengeRes.ok) {
        const body = await challengeRes.json().catch(() => ({}));
        throw new Error(body.error || "Failed to create challenge");
      }
      const challengeJson = await challengeRes.json();

      const verifyRes = await fetch("/api/auth/mfa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          factorId: enrollData.factorId,
          challengeId: challengeJson.data.challengeId,
          code: verifyCode,
        }),
      });
      if (!verifyRes.ok) {
        const body = await verifyRes.json().catch(() => ({}));
        throw new Error(body.error || "Invalid verification code");
      }

      toast.success("Two-factor authentication enabled");
      setEnrollData(null);
      setVerifyCode("");
      await loadFactors();
    } catch (error: unknown) {
      toast.error(safeErrorMessage(error, "Verification failed"));
    } finally {
      setVerifying(false);
    }
  }

  async function removeFactor(factorId: string) {
    const confirmed = window.confirm(
      "Remove two-factor authentication from this account?\n\nYou will only need your email and password to sign in until you enable it again.",
    );
    if (!confirmed) return;

    setRemoving(factorId);
    try {
      const res = await fetch(
        `/api/auth/mfa/factors?factorId=${encodeURIComponent(factorId)}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to remove MFA factor");
      }
      toast.success("Two-factor authentication removed");
      await loadFactors();
    } catch (error: unknown) {
      toast.error(safeErrorMessage(error, "Failed to remove MFA factor"));
    } finally {
      setRemoving(null);
    }
  }

  function cancelEnroll() {
    setEnrollData(null);
    setVerifyCode("");
  }

  const hasVerifiedFactor = factors.some((f) => f.status === "verified");

  return (
    <Surface variant="default" className="space-y-5 p-5 md:p-6">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-workspace-lg bg-slate-100 text-slate-700 ring-1 ring-slate-200">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold text-slate-900">
            Two-factor authentication
          </h2>
          <p className="mt-1 text-sm text-workspace-muted">
            Add an extra sign-in step with any authenticator app (Google
            Authenticator, Microsoft Authenticator, Authy, 1Password, and
            similar). After setup, enter a 6-digit code from the app after your
            password.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading security status…
        </div>
      ) : (
        <>
          {hasVerifiedFactor ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                <ShieldCheck className="h-4 w-4 shrink-0 text-slate-600" />
                <span>
                  Your account is protected with two-factor authentication
                </span>
              </div>
              {factors
                .filter((f) => f.status === "verified")
                .map((factor) => (
                  <div
                    key={factor.id}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <KeyRound className="h-4 w-4 shrink-0 text-slate-400" />
                      <span className="truncate text-sm text-slate-700">
                        {factor.friendly_name || "Authenticator app"}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => void removeFactor(factor.id)}
                      disabled={removing === factor.id}
                      className="inline-flex shrink-0 items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-60"
                    >
                      {removing === factor.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Trash2 className="h-3 w-3" />
                      )}
                      Remove
                    </button>
                  </div>
                ))}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                <ShieldOff className="h-4 w-4 shrink-0" />
                <span>Two-factor authentication is not enabled yet</span>
              </div>

              {enrollData ? (
                <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                  <ol className="list-decimal space-y-2 pl-5 text-sm text-slate-700">
                    <li>
                      Open your authenticator app on your phone (any app that
                      supports time-based codes).
                    </li>
                    <li>Choose “Add account” or “Scan QR code”.</li>
                    <li>
                      Scan the QR code below, or type the secret key in
                      manually.
                    </li>
                    <li>
                      Enter the 6-digit code the app shows to finish setup.
                    </li>
                  </ol>

                  <div className="space-y-2">
                    <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                      <QrCode className="h-4 w-4" />
                      Scan this QR code
                    </p>
                    <div className="mx-auto w-fit rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                      <MfaQrCode qrCodeUrl={enrollData.qrCodeUrl} />
                    </div>
                    <p className="text-xs leading-relaxed text-slate-600">
                      Can’t scan? Enter this secret key manually in your app:{" "}
                      <code className="mt-1 block break-all rounded-lg border border-slate-200 bg-white px-2 py-1.5 font-mono text-[11px] text-slate-900 sm:mt-0 sm:inline sm:break-normal">
                        {enrollData.secret}
                      </code>
                    </p>
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                    <div className="min-w-0 flex-1">
                      <label className="mb-1 block text-xs font-medium text-slate-600">
                        6-digit code from your app
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        autoComplete="one-time-code"
                        value={verifyCode}
                        onChange={(e) =>
                          setVerifyCode(e.target.value.replace(/\D/g, ""))
                        }
                        placeholder="000000"
                        className="w-full rounded-workspace-lg border border-workspace-border bg-white px-3 py-2 text-center text-lg tracking-widest text-slate-900 shadow-workspace-xs outline-none focus:border-brand/40 focus:ring-2 focus:ring-brand/15"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => void confirmEnroll()}
                        disabled={verifying || verifyCode.length < 6}
                        className={cn(primaryButton(), "flex-1 sm:flex-none")}
                      >
                        {verifying ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Smartphone className="h-4 w-4" />
                        )}
                        Verify & enable
                      </button>
                      <button
                        type="button"
                        onClick={cancelEnroll}
                        className={secondaryButton()}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => void startEnroll()}
                  disabled={enrolling}
                  className={primaryButton()}
                >
                  {enrolling ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <QrCode className="h-4 w-4" />
                  )}
                  Enable with authenticator app
                </button>
              )}
            </div>
          )}

          <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3">
            <div className="flex gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
              <div className="space-y-1.5 text-sm text-slate-700">
                <p className="font-semibold text-slate-900">
                  Lost access to your authenticator app?
                </p>
                <p className="leading-relaxed text-slate-600">
                  If you cannot provide the 6-digit codes from your authenticator
                  app (for example you changed phones, uninstalled the app, or
                  lost the device), you{" "}
                  <strong className="font-semibold text-slate-800">
                    must contact the ICT admin at your school
                  </strong>
                  . They can turn off the authenticator requirement so you can
                  sign in again with your email and password. After you get back
                  in, re-enable two-factor authentication here with a new app
                  setup.
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </Surface>
  );
}
