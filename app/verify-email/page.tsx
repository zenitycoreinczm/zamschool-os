"use client";

import { Suspense, useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Loader2, AlertCircle, Check } from "lucide-react";
import { AuthPageShell } from "@/components/auth/AuthPageShell";
import { cn } from "@/lib/utils";

export default function VerifyEmailPage() {
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
      <VerifyEmailContent />
    </Suspense>
  );
}

function VerifyEmailContent() {
  const [otp, setOtp] = useState<string[]>(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [email, setEmail] = useState<string>("");
  const [userId, setUserId] = useState<string>("");
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next");
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    const loadSession = async () => {
      setBootstrapping(true);
      try {
        const emailParam = searchParams.get("email");
        const userIdParam = searchParams.get("userId");

        if (emailParam && userIdParam) {
          setEmail(emailParam);
          setUserId(userIdParam);
          await sendOtp(emailParam, userIdParam);
        } else {
          const {
            data: { user },
          } = await supabase.auth.getUser();
          if (user?.email && user?.id) {
            setEmail(user.email);
            setUserId(user.id);
            await sendOtp(user.email, user.id);
          } else {
            router.replace("/login");
            return;
          }
        }

        setTimeout(() => inputRefs.current[0]?.focus(), 100);
      } finally {
        setBootstrapping(false);
      }
    };

    void loadSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount + query only
  }, [router, searchParams]);

  const sendOtp = async (targetEmail: string, targetUserId: string) => {
    setResendLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "same-origin",
        body: JSON.stringify({ email: targetEmail, userId: targetUserId }),
      });

      const result = await res.json();
      if (!res.ok)
        throw new Error(result.error || "Failed to send verification code");
      setCodeSent(true);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to send verification code",
      );
    } finally {
      setResendLoading(false);
    }
  };

  const handleResend = () => {
    if (email && userId) {
      setOtp(["", "", "", "", "", ""]);
      void sendOtp(email, userId);
    }
  };

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    if (index === 5 && value) {
      const fullOtp = [...newOtp.slice(0, 5), value].join("");
      if (fullOtp.length === 6) {
        void handleVerify(fullOtp);
      }
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, 6);
    if (pasted.length === 6) {
      const newOtp = pasted.split("");
      setOtp(newOtp);
      void handleVerify(pasted);
    }
  };

  const handleVerify = async (fullOtp: string) => {
    if (!email || !userId) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "same-origin",
        body: JSON.stringify({ email, userId, otpCode: fullOtp }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Verification failed");

      setSuccess(true);

      setTimeout(() => {
        const destination =
          nextPath && nextPath.startsWith("/") && !nextPath.startsWith("//")
            ? nextPath
            : "/login?verified=true";
        router.replace(destination);
      }, 1200);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Invalid verification code");
      setOtp(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <AuthPageShell contentClassName="py-8">
        <div className="w-full max-w-lg">
          <Header
            eyebrow="School registration"
            title="Email verified"
            description="Your account is confirmed. Continuing to the next step…"
          />
          <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
            <div className="flex flex-col items-center text-center">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-slate-900 text-white">
                <Check className="h-5 w-5" strokeWidth={2.5} aria-hidden />
              </div>
              <p className="text-sm text-slate-500">
                One moment while we open the next screen.
              </p>
              <Loader2 className="mt-5 h-4 w-4 animate-spin text-slate-400" />
            </div>
          </div>
        </div>
      </AuthPageShell>
    );
  }

  return (
    <AuthPageShell contentClassName="py-8">
      <div className="w-full max-w-lg">
        <Header
          eyebrow="School registration"
          title="Verify your email"
          description="Enter the 6-digit code we sent to confirm the Head Teacher account."
        />

        {/* Same step language as /register — verification sits after account creation */}
        <div className="mb-8 flex items-center justify-between gap-2">
          <MiniStep done label="Code" />
          <div className="h-px flex-1 bg-slate-900" />
          <MiniStep done label="Account" />
          <div className="h-px flex-1 bg-slate-900" />
          <MiniStep active label="Verify" />
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          {error ? (
            <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <p>{error}</p>
              </div>
            </div>
          ) : null}

          <div className="mb-6 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            {bootstrapping || (resendLoading && !codeSent) ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />
                Sending code…
              </span>
            ) : (
              <>
                Code sent to{" "}
                <span className="font-medium text-slate-900">
                  {email || "your email"}
                </span>
                . Check inbox and spam if it is not there yet.
              </>
            )}
          </div>

          <div className="space-y-6">
            <div className="space-y-3">
              <label className="block text-center text-sm font-medium text-slate-700">
                6-digit verification code
              </label>
              <div
                className="flex items-center justify-center gap-2 sm:gap-3"
                onPaste={handlePaste}
              >
                {otp.map((digit, index) => (
                  <input
                    key={index}
                    ref={(el) => {
                      inputRefs.current[index] = el;
                    }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleChange(index, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(index, e)}
                    disabled={loading || bootstrapping}
                    aria-label={`Digit ${index + 1}`}
                    className={cn(
                      "h-14 w-12 rounded-xl border-2 text-center text-xl font-bold tabular-nums transition-all duration-200 sm:h-16 sm:w-14 sm:text-2xl",
                      "focus:outline-none focus:ring-2 focus:ring-offset-1",
                      "disabled:cursor-not-allowed disabled:opacity-50",
                      error
                        ? "border-red-300 text-red-600 focus:ring-red-400"
                        : digit
                          ? "border-slate-900 bg-white text-slate-900 focus:ring-slate-400"
                          : "border-slate-200 text-slate-700 hover:border-slate-300 focus:ring-slate-400",
                    )}
                  />
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={() => void handleVerify(otp.join(""))}
              disabled={
                loading || bootstrapping || otp.join("").length !== 6
              }
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 py-3.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Verifying…
                </>
              ) : (
                "Continue"
              )}
            </button>

            <div className="flex flex-col items-center gap-3 border-t border-slate-100 pt-5">
              <button
                type="button"
                onClick={handleResend}
                disabled={resendLoading || bootstrapping || !email || !userId}
                className="text-sm font-medium text-slate-600 transition hover:text-slate-900 disabled:opacity-50"
              >
                {resendLoading ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Sending…
                  </span>
                ) : (
                  "Resend code"
                )}
              </button>
              <Link
                href="/login"
                className="text-sm text-slate-500 transition hover:text-slate-800"
              >
                Back to sign in
              </Link>
            </div>
          </div>
        </div>
      </div>
    </AuthPageShell>
  );
}

function Header({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="mb-8 text-center">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
        {eyebrow}
      </p>
      <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
        {title}
      </h1>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-500">
        {description}
      </p>
    </div>
  );
}

function MiniStep({
  label,
  active,
  done,
}: {
  label: string;
  active?: boolean;
  done?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <div
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold tabular-nums",
          done && "bg-slate-900 text-white",
          active && "bg-slate-900 text-white ring-4 ring-slate-200",
          !done && !active && "border border-slate-200 bg-white text-slate-400",
        )}
      >
        {done ? "✓" : active ? "3" : ""}
      </div>
      <span
        className={cn(
          "hidden text-sm font-medium sm:inline",
          active || done ? "text-slate-900" : "text-slate-400",
        )}
      >
        {label}
      </span>
    </div>
  );
}
