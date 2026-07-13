"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Suspense, useState, useRef, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { AuthPageShell } from "@/components/auth/AuthPageShell";
import { cn } from "@/lib/utils";
import {
  normalizeZambianPhone,
  zambianPhoneValidationError,
} from "@/lib/zambia-localization";

// ── Zambian Provinces & Districts ────────────────────────────────────────────

const ZAMBIAN_PROVINCES = [
  "Central",
  "Copperbelt",
  "Eastern",
  "Luapula",
  "Lusaka",
  "Muchinga",
  "Northern",
  "North-Western",
  "Southern",
  "Western",
];

const ZAMBIAN_DISTRICTS: Record<string, string[]> = {
  Central: [
    "Chibombo",
    "Kabwe",
    "Kapiri Mposhi",
    "Mkushi",
    "Mumbwa",
    "Serenje",
    "Chisamba",
    "Itezhi-Tezhi",
    "Ngabwe",
  ],
  Copperbelt: [
    "Chililabombwe",
    "Chingola",
    "Kalulushi",
    "Kitwe",
    "Luanshya",
    "Lufwanyama",
    "Masaiti",
    "Mpongwe",
    "Mufulira",
    "Ndola",
  ],
  Eastern: [
    "Chadiza",
    "Chipata",
    "Katete",
    "Lundazi",
    "Mambwe",
    "Nyimba",
    "Petauke",
    "Sinda",
    "Vubwi",
    "Chipangali",
  ],
  Luapula: [
    "Chembe",
    "Chienge",
    "Kawambwa",
    "Lunga",
    "Mansa",
    "Milenge",
    "Mwansabombwe",
    "Mweru",
    "Nchelenge",
    "Samfya",
  ],
  Lusaka: [
    "Chilanga",
    "Chongwe",
    "Kafue",
    "Luangwa",
    "Lusaka",
    "Rufunsa",
    "Shibuyunji",
  ],
  Muchinga: [
    "Chama",
    "Chinsali",
    "Isoka",
    "Kanchibiya",
    "Lavushimanda",
    "Mafinga",
    "Mpika",
    "Nakonde",
    "Shiwang'andu",
  ],
  Northern: [
    "Chilubi",
    "Kaputa",
    "Kasama",
    "Lunte",
    "Luwingu",
    "Mbala",
    "Mporokoso",
    "Mpulungu",
    "Mungwi",
    "Nsama",
    "Senga",
  ],
  "North-Western": [
    "Chavuma",
    "Ikelenge",
    "Kabompo",
    "Kasempa",
    "Manyinga",
    "Mufumbwe",
    "Mwinilunga",
    "Solwezi",
    "Zambezi",
  ],
  Southern: [
    "Chikankata",
    "Choma",
    "Gwembe",
    "Itezhi-Tezhi",
    "Kalomo",
    "Kazungula",
    "Livingstone",
    "Mazabuka",
    "Monze",
    "Namwala",
    "Pemba",
    "Siavonga",
    "Sinazongwe",
  ],
  Western: [
    "Kalabo",
    "Kaoma",
    "Limulunga",
    "Luampa",
    "Lukulu",
    "Mongu",
    "Mulobezi",
    "Mwandi",
    "Nalolo",
    "Nkeyema",
    "Senanga",
    "Sesheke",
    "Shang'ombo",
    "Sikongo",
  ],
};

// ── Validation Schemas ────────────────────────────────────────────────────────

const codeSchema = z.object({
  accessCode: z
    .string()
    .length(6, "Code must be exactly 6 digits")
    .regex(/^\d{6}$/, "Code must contain only numbers"),
});

const accountSchema = z.object({
  headTeacherName: z
    .string()
    .min(2, "Head Teacher name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  phone: z
    .string()
    .trim()
    .min(1, "Phone number is required")
    .superRefine((value, ctx) => {
      const err = zambianPhoneValidationError(value, { required: true });
      if (err) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: err });
      }
    })
    .transform((value) => normalizeZambianPhone(value) || value),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Must contain at least one uppercase letter")
    .regex(/[0-9]/, "Must contain at least one number"),
});

const schoolSchema = z.object({
  schoolName: z.string().min(2, "School name must be at least 2 characters"),
  schoolCode: z
    .string()
    .min(4, "School code must be at least 4 characters")
    .max(12, "School code must be at most 12 characters")
    .regex(
      /^[A-Za-z0-9]+$/,
      "School code must contain only letters and numbers",
    ),
  address: z.string().min(1, "Address is required"),
  emisCode: z.string().min(1, "EMIS code is required"),
  province: z.string().min(1, "Province is required"),
  district: z.string().min(1, "District is required"),
  schoolType: z.string().min(1, "School type is required"),
  ownershipType: z.string().min(1, "Ownership type is required"),
});

type CodeFormValues = z.infer<typeof codeSchema>;
type AccountFormValues = z.infer<typeof accountSchema>;
type SchoolFormValues = z.infer<typeof schoolSchema>;

type PersistedAccountData = Omit<AccountFormValues, "password">;

const REGISTER_DRAFT_KEY = "zamschool_register_draft";

type RegisterDraft = {
  verifiedCode: string;
  codeScope: VerifiedCodeScope | null;
  accountData: PersistedAccountData;
  createdUserId: string;
};

type VerifiedCodeScope = {
  province: string | null;
  district: string | null;
  schoolType: string | null;
  ownershipType: string | null;
};

// ── Helper: Password strength ──────────────────────────────────────────────────

function getPasswordStrength(password: string): {
  score: number; // 0-4
  label: string;
  color: string;
  width: string;
} {
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password) && /[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  const levels = [
    { score: 0, label: "Very weak", color: "bg-red-400", width: "w-1/5" },
    { score: 1, label: "Weak", color: "bg-orange-400", width: "w-2/5" },
    { score: 2, label: "Fair", color: "bg-amber-400", width: "w-3/5" },
    { score: 3, label: "Good", color: "bg-lime-400", width: "w-4/5" },
    { score: 4, label: "Strong", color: "bg-emerald-400", width: "w-full" },
  ];
  return levels[Math.min(score, 4)];
}

// ── Helper Components ─────────────────────────────────────────────────────────

const baseInput =
  "w-full rounded-xl border bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 transition-all duration-200 focus:border-transparent focus:outline-none focus:ring-2";
const inputClass = (err?: string) =>
  cn(
    baseInput,
    err
      ? "border-red-300 focus:ring-red-400"
      : "border-slate-200 focus:ring-slate-400 hover:border-slate-300",
  );

const readOnlyInputClass =
  "w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 cursor-not-allowed";

// ── OTP Input for Access Code ─────────────────────────────────────────────────

function OtpInput({
  value,
  onChange,
  error,
}: {
  value: string;
  onChange: (val: string) => void;
  error?: string;
}) {
  const r0 = useRef<HTMLInputElement>(null);
  const r1 = useRef<HTMLInputElement>(null);
  const r2 = useRef<HTMLInputElement>(null);
  const r3 = useRef<HTMLInputElement>(null);
  const r4 = useRef<HTMLInputElement>(null);
  const r5 = useRef<HTMLInputElement>(null);
  const inputs = [r0, r1, r2, r3, r4, r5];

  const handleChange = (
    index: number,
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const digit = e.target.value.replace(/\D/g, "").slice(-1);
    const chars = value.split("");
    chars[index] = digit;
    onChange(chars.join("").padEnd(6, "").slice(0, 6));

    const next = inputs[index + 1]?.current;
    if (digit && next) {
      next.focus();
      next.select();
    }
  };

  const handleKeyDown = (
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (e.key === "Backspace" && !value[index] && index > 0) {
      const prev = inputs[index - 1]?.current;
      if (prev) {
        prev.focus();
        prev.select();
      }
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, 6);
    onChange(pasted.padEnd(6, ""));
    const focusIdx = Math.min(pasted.length, 5);
    inputs[focusIdx]?.current?.focus();
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        className="flex items-center justify-center gap-2 sm:gap-3"
        onPaste={handlePaste}
      >
        {Array.from({ length: 6 }).map((_, i) => (
          <input
            key={i}
            ref={inputs[i]}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={value[i] || ""}
            onChange={(e) => handleChange(i, e)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            className={cn(
              "h-14 w-12 sm:h-16 sm:w-14 rounded-xl border-2 text-center text-xl sm:text-2xl font-bold transition-all duration-200",
              "focus:outline-none focus:ring-2 focus:ring-offset-1",
              error
                ? "border-red-300 focus:ring-red-400 text-red-600"
                : value[i]
                  ? "border-slate-900 bg-white text-slate-900 focus:ring-slate-400"
                  : "border-slate-200 text-slate-700 hover:border-slate-300 focus:ring-slate-400",
            )}
          />
        ))}
      </div>
      {error ? (
        <p className="text-xs font-medium text-red-600">{error}</p>
      ) : null}
    </div>
  );
}

// ── Step Indicator ────────────────────────────────────────────────────────────

function StepIndicator({
  step,
  current,
  label,
}: {
  step: number;
  current: number;
  label: string;
}) {
  const done = current > step;
  const active = current === step;

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
        {done ? "✓" : step}
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

// ── Page ───────────────────────────────────────────────────────────────────────

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <AuthPageShell>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
          </div>
        </AuthPageShell>
      }
    >
      <RegisterContent />
    </Suspense>
  );
}

function RegisterContent() {
  const [step, setStep] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [selectedProvince, setSelectedProvince] = useState("");
  const [stepTransition, setStepTransition] = useState(false);

  // Data carried across steps
  const [verifiedCode, setVerifiedCode] = useState("");
  const [codeScope, setCodeScope] = useState<VerifiedCodeScope | null>(null);
  const [accountData, setAccountData] = useState<PersistedAccountData | null>(
    null,
  );
  const [createdUserId, setCreatedUserId] = useState<string | null>(null);

  const router = useRouter();
  const searchParams = useSearchParams();

  // ── Step 1 form ──
  const codeForm = useForm<CodeFormValues>({
    resolver: zodResolver(codeSchema),
    defaultValues: { accessCode: "" },
  });
  const codeValue = codeForm.watch("accessCode");

  // ── Step 2 form ──
  const accountForm = useForm<AccountFormValues>({
    resolver: zodResolver(accountSchema),
  });
  const accountPassword = accountForm.watch("password") || "";
  const passwordStrength = getPasswordStrength(accountPassword);

  // ── Step 3 form ──
  const schoolForm = useForm<SchoolFormValues>({
    resolver: zodResolver(schoolSchema),
  });

  useEffect(() => {
    if (searchParams.get("resume") !== "school") return;

    // Hydrate from URL params first — used when the login page redirects a
    // half-finished principal back here (user already exists but profile row
    // never landed). sessionStorage may or may not exist for these users.
    const queryEmail = searchParams.get("email");
    const queryUserId = searchParams.get("userId");
    if (queryEmail && queryUserId) {
      void (async () => {
        const { data } = await supabase.auth.getUser();
        const meta = (data?.user?.user_metadata ?? {}) as {
          head_teacher_name?: string;
          admin_name?: string;
          first_name?: string;
          last_name?: string;
        };
        const headTeacherName =
          meta.head_teacher_name ||
          meta.admin_name ||
          [meta.first_name, meta.last_name].filter(Boolean).join(" ").trim() ||
          "";
        setAccountData({
          headTeacherName,
          email: queryEmail,
          phone: (data?.user?.phone ?? "") as string,
        });
        setCreatedUserId(queryUserId);
        setError(
          "Your account is verified but the school was not created yet. Enter your access code to finish school setup.",
        );
        setStep(1);
      })();
      return;
    }

    try {
      const raw = sessionStorage.getItem(REGISTER_DRAFT_KEY);
      if (!raw) return;

      const draft = JSON.parse(raw) as RegisterDraft;
      if (!draft?.accountData || !draft.createdUserId || !draft.verifiedCode)
        return;

      setVerifiedCode(draft.verifiedCode);
      setCodeScope(draft.codeScope);
      setAccountData(draft.accountData);
      setCreatedUserId(draft.createdUserId);
      if (draft.codeScope?.province) {
        setSelectedProvince(draft.codeScope.province);
        schoolForm.setValue("province", draft.codeScope.province);
      }
      if (draft.codeScope?.district)
        schoolForm.setValue("district", draft.codeScope.district);
      if (draft.codeScope?.schoolType)
        schoolForm.setValue("schoolType", draft.codeScope.schoolType);
      if (draft.codeScope?.ownershipType) {
        schoolForm.setValue("ownershipType", draft.codeScope.ownershipType);
      }
      setStep(3);
    } catch {
      // ignore corrupt draft
    }
  }, [searchParams, schoolForm]);

  // ── Step 1: Verify access code ───────────────────────────────────────────────
  const onVerifyCode = async (data: CodeFormValues) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/verify-access-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: data.accessCode }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Verification failed");
      setVerifiedCode(data.accessCode);
      const scope = (result.data || null) as VerifiedCodeScope | null;
      setCodeScope(scope);
      if (scope?.province) {
        setSelectedProvince(scope.province);
        schoolForm.setValue("province", scope.province);
      }
      if (scope?.district) schoolForm.setValue("district", scope.district);
      if (scope?.schoolType)
        schoolForm.setValue("schoolType", scope.schoolType);
      if (scope?.ownershipType)
        schoolForm.setValue("ownershipType", scope.ownershipType);
      setStepTransition(true);
      setTimeout(() => {
        setStep(2);
        setStepTransition(false);
      }, 150);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setLoading(false);
    }
  };

  // ── Step 2: Create principal auth account ────────────────────────────────────
  const onCreateAccount = async (data: AccountFormValues) => {
    setLoading(true);
    setError(null);
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: {
            first_name:
              data.headTeacherName.split(" ").slice(0, -1).join(" ") ||
              data.headTeacherName,
            last_name:
              data.headTeacherName.split(" ").slice(-1).join(" ") || "",
            role: "principal",
          },
        },
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error("Failed to create account");

      setAccountData({
        headTeacherName: data.headTeacherName,
        email: data.email,
        phone: data.phone,
      });
      setCreatedUserId(authData.user.id);

      const draft: RegisterDraft = {
        verifiedCode,
        codeScope,
        accountData: {
          headTeacherName: data.headTeacherName,
          email: data.email,
          phone: data.phone,
        },
        createdUserId: authData.user.id,
      };
      sessionStorage.setItem(REGISTER_DRAFT_KEY, JSON.stringify(draft));

      const verifyNext = encodeURIComponent("/register?resume=school");
      router.replace(
        `/verify-email?email=${encodeURIComponent(data.email)}&userId=${authData.user.id}&next=${verifyNext}`,
      );
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Account creation failed";
      if (
        msg.toLowerCase().includes("already registered") ||
        msg.toLowerCase().includes("user already")
      ) {
        setError(
          "An account with this email already exists. Please sign in instead.",
        );
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Step 3: Register school ───────────────────────────────────────────────────
  const onRegisterSchool = async (data: SchoolFormValues) => {
    if (!accountData || !createdUserId) {
      setError("Session data lost. Please start again from step 1.");
      setStep(1);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/register-school", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "same-origin",
        body: JSON.stringify({
          email: accountData.email,
          headTeacherName: accountData.headTeacherName,
          phone: accountData.phone,
          schoolName: data.schoolName,
          schoolCode: data.schoolCode,
          address: data.address,
          emisCode: data.emisCode,
          province: data.province,
          district: data.district,
          schoolType: data.schoolType,
          ownershipType: data.ownershipType,
          accessCode: verifiedCode,
        }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Registration failed");

      sessionStorage.removeItem(REGISTER_DRAFT_KEY);
      await supabase.auth.refreshSession();
      router.replace("/app/principal");
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Registration failed";
      if (msg.includes("session expired") || msg.includes("Session expired")) {
        setError(
          "Your session expired. Please sign in again to complete registration.",
        );
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <AuthPageShell contentClassName="py-8">
      <div className="w-full max-w-lg">
        <div className="mb-8 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
            School registration
          </p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            {step === 1 && "Access code"}
            {step === 2 && "Head Teacher account"}
            {step === 3 && "School details"}
          </h1>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-500">
            {step === 1 &&
              "Enter the 6-digit code from your ZamSchool Super Admin to open registration."}
            {step === 2 &&
              "Create the Head Teacher login. You will invite staff after the school is set up."}
            {step === 3 &&
              "Add the school’s official details. You can finish setup inside the app later."}
          </p>
        </div>

        <div className="mb-8 flex items-center justify-between gap-2">
          <StepIndicator step={1} current={step} label="Code" />
          <div
            className={cn(
              "h-px flex-1",
              step > 1 ? "bg-slate-900" : "bg-slate-200",
            )}
          />
          <StepIndicator step={2} current={step} label="Account" />
          <div
            className={cn(
              "h-px flex-1",
              step > 2 ? "bg-slate-900" : "bg-slate-200",
            )}
          />
          <StepIndicator step={3} current={step} label="School" />
        </div>

        <div
          className={cn(
            "rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8",
            stepTransition ? "opacity-0" : "opacity-100",
          )}
        >
          {error ? (
            <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              <div className="flex items-start justify-between gap-3">
                <p>{error}</p>
                <button
                  type="button"
                  onClick={() => setError(null)}
                  className="shrink-0 text-red-500 hover:text-red-700"
                  aria-label="Dismiss error"
                >
                  ×
                </button>
              </div>
            </div>
          ) : null}

          {step === 1 && (
            <form
              onSubmit={codeForm.handleSubmit(onVerifyCode)}
              className="space-y-6"
            >
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                Only schools with a Super Admin access code can register. Parents
                and students are added later by the Head Teacher.
              </div>

              <div className="space-y-3">
                <label className="block text-center text-sm font-medium text-slate-700">
                  6-digit access code
                </label>
                <OtpInput
                  value={codeValue}
                  onChange={(val) => codeForm.setValue("accessCode", val)}
                  error={codeForm.formState.errors.accessCode?.message}
                />
              </div>

              <button
                type="submit"
                disabled={loading || codeValue.length !== 6}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 py-3.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Verifying…
                  </>
                ) : (
                  "Continue"
                )}
              </button>

              <p className="text-center text-xs text-slate-500">
                No code? Ask your ZamSchool Super Admin to issue one.
              </p>
            </form>
          )}

          {step === 2 && (
            <form
              onSubmit={accountForm.handleSubmit(onCreateAccount)}
              className="space-y-5"
            >
              <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                Code{" "}
                <span className="font-mono font-semibold tracking-wider text-slate-900">
                  {verifiedCode}
                </span>{" "}
                verified. Create the Head Teacher account for this school.
              </p>

              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="headTeacherName"
                    className="mb-1.5 block text-sm font-medium text-slate-700"
                  >
                    Full name
                  </label>
                  <input
                    {...accountForm.register("headTeacherName")}
                    className={inputClass(
                      accountForm.formState.errors.headTeacherName?.message,
                    )}
                    placeholder="e.g. John Bwalya"
                    id="headTeacherName"
                    autoComplete="name"
                    autoFocus
                  />
                  {accountForm.formState.errors.headTeacherName ? (
                    <p className="mt-1.5 text-xs text-red-600">
                      {accountForm.formState.errors.headTeacherName.message}
                    </p>
                  ) : null}
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="email"
                      className="mb-1.5 block text-sm font-medium text-slate-700"
                    >
                      Email
                    </label>
                    <input
                      {...accountForm.register("email")}
                      type="email"
                      className={inputClass(
                        accountForm.formState.errors.email?.message,
                      )}
                      placeholder="headteacher@school.edu.zm"
                      id="email"
                      autoComplete="email"
                    />
                    <p className="mt-1 text-xs text-slate-400">
                      Used to sign in
                    </p>
                    {accountForm.formState.errors.email ? (
                      <p className="mt-1.5 text-xs text-red-600">
                        {accountForm.formState.errors.email.message}
                      </p>
                    ) : null}
                  </div>

                  <div>
                    <label
                      htmlFor="phone"
                      className="mb-1.5 block text-sm font-medium text-slate-700"
                    >
                      Phone
                    </label>
                    <input
                      {...accountForm.register("phone")}
                      type="tel"
                      className={inputClass(
                        accountForm.formState.errors.phone?.message,
                      )}
                      placeholder="0770 234 564"
                      id="phone"
                      autoComplete="tel"
                      inputMode="tel"
                    />
                    <p className="mt-1 text-xs text-slate-400">
                      Airtel 097/077 · MTN 096/076 · Zamtel 095/075
                    </p>
                    {accountForm.formState.errors.phone ? (
                      <p className="mt-1.5 text-xs text-red-600">
                        {accountForm.formState.errors.phone.message}
                      </p>
                    ) : null}
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="password"
                    className="mb-1.5 block text-sm font-medium text-slate-700"
                  >
                    Password
                  </label>
                  <div className="relative">
                    <input
                      {...accountForm.register("password")}
                      type={showPassword ? "text" : "password"}
                      className={cn(
                        inputClass(
                          accountForm.formState.errors.password?.message,
                        ),
                        "pr-12",
                      )}
                      placeholder="Min. 8 characters, 1 capital, 1 number"
                      id="password"
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                      aria-label={
                        showPassword ? "Hide password" : "Show password"
                      }
                      tabIndex={-1}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>

                  {accountPassword ? (
                    <div className="mt-2">
                      <div className="mb-1 flex items-center gap-2">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all",
                              passwordStrength.color,
                              passwordStrength.width,
                            )}
                          />
                        </div>
                        <span className="text-xs text-slate-500">
                          {passwordStrength.label}
                        </span>
                      </div>
                    </div>
                  ) : null}

                  <div className="mt-2 space-y-1">
                    <PasswordRule
                      met={accountPassword.length >= 8}
                      label="At least 8 characters"
                    />
                    <PasswordRule
                      met={/[A-Z]/.test(accountPassword)}
                      label="One uppercase letter"
                    />
                    <PasswordRule
                      met={/[0-9]/.test(accountPassword)}
                      label="One number"
                    />
                  </div>
                  {accountForm.formState.errors.password ? (
                    <p className="mt-1.5 text-xs text-red-600">
                      {accountForm.formState.errors.password.message}
                    </p>
                  ) : null}
                </div>
              </div>

              <p className="text-xs leading-relaxed text-slate-500">
                Use a real email — you will verify it before the school is
                created.
              </p>

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setStep(1);
                    setError(null);
                  }}
                  className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-medium text-slate-600 hover:bg-slate-50"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-slate-900 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Creating…
                    </>
                  ) : (
                    "Continue"
                  )}
                </button>
              </div>
            </form>
          )}

          {step === 3 && (
            <form
              onSubmit={schoolForm.handleSubmit(onRegisterSchool)}
              className="space-y-5"
            >
              <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                Enter the school&apos;s official details. Fields locked by the
                access code cannot be changed here.
              </p>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="School name"
                  error={schoolForm.formState.errors.schoolName?.message}
                  hint="Official registered name"
                >
                  <input
                    {...schoolForm.register("schoolName")}
                    className={inputClass(
                      schoolForm.formState.errors.schoolName?.message,
                    )}
                    placeholder="Mongu Basic School"
                    id="schoolName"
                  />
                </Field>

                <Field
                  label="School code"
                  error={schoolForm.formState.errors.schoolCode?.message}
                  hint="4–12 letters/numbers, unique (e.g. MONGU1)"
                >
                  <input
                    {...schoolForm.register("schoolCode")}
                    className={inputClass(
                      schoolForm.formState.errors.schoolCode?.message,
                    )}
                    placeholder="MONGU1"
                    id="schoolCode"
                  />
                </Field>

                <Field
                  label="Address"
                  error={schoolForm.formState.errors.address?.message}
                  fullWidth
                >
                  <input
                    {...schoolForm.register("address")}
                    className={inputClass(
                      schoolForm.formState.errors.address?.message,
                    )}
                    placeholder="Physical location"
                    id="address"
                  />
                </Field>

                <Field
                  label="EMIS code"
                  error={schoolForm.formState.errors.emisCode?.message}
                  hint="Ministry identifier"
                >
                  <input
                    {...schoolForm.register("emisCode")}
                    className={inputClass(
                      schoolForm.formState.errors.emisCode?.message,
                    )}
                    placeholder="EMIS-12345"
                    id="emisCode"
                  />
                </Field>

                <Field
                  label="Province"
                  error={schoolForm.formState.errors.province?.message}
                >
                  {codeScope?.province ? (
                    <div className={readOnlyInputClass}>
                      {codeScope.province}
                    </div>
                  ) : (
                    <select
                      {...schoolForm.register("province")}
                      onChange={(e) => {
                        schoolForm.register("province").onChange(e);
                        setSelectedProvince(e.target.value);
                        schoolForm.setValue("district", "");
                      }}
                      className={inputClass(
                        schoolForm.formState.errors.province?.message,
                      )}
                      id="province"
                    >
                      <option value="">Select province…</option>
                      {ZAMBIAN_PROVINCES.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  )}
                </Field>

                <Field
                  label="District"
                  error={schoolForm.formState.errors.district?.message}
                >
                  {codeScope?.district ? (
                    <div className={readOnlyInputClass}>
                      {codeScope.district}
                    </div>
                  ) : (
                    <select
                      {...schoolForm.register("district")}
                      disabled={!selectedProvince}
                      className={cn(
                        inputClass(
                          schoolForm.formState.errors.district?.message,
                        ),
                        "disabled:cursor-not-allowed disabled:opacity-50",
                      )}
                      id="district"
                    >
                      <option value="">
                        {selectedProvince
                          ? "Select district…"
                          : "Select province first"}
                      </option>
                      {selectedProvince &&
                        ZAMBIAN_DISTRICTS[selectedProvince]?.map((d) => (
                          <option key={d} value={d}>
                            {d}
                          </option>
                        ))}
                    </select>
                  )}
                </Field>

                <Field
                  label="School type"
                  error={schoolForm.formState.errors.schoolType?.message}
                >
                  {codeScope?.schoolType ? (
                    <div className={readOnlyInputClass}>
                      {codeScope.schoolType}
                    </div>
                  ) : (
                    <select
                      {...schoolForm.register("schoolType")}
                      className={inputClass(
                        schoolForm.formState.errors.schoolType?.message,
                      )}
                      id="schoolType"
                    >
                      <option value="">Select type…</option>
                      <option value="Primary">Primary</option>
                      <option value="Secondary">Secondary</option>
                      <option value="High School">High School</option>
                      <option value="Combined">Combined</option>
                    </select>
                  )}
                </Field>

                <Field
                  label="Ownership"
                  error={schoolForm.formState.errors.ownershipType?.message}
                >
                  {codeScope?.ownershipType ? (
                    <div className={readOnlyInputClass}>
                      {codeScope.ownershipType}
                    </div>
                  ) : (
                    <select
                      {...schoolForm.register("ownershipType")}
                      className={inputClass(
                        schoolForm.formState.errors.ownershipType?.message,
                      )}
                      id="ownershipType"
                    >
                      <option value="">Select…</option>
                      <option value="Government">Government</option>
                      <option value="Private">Private</option>
                      <option value="Grant Aided">Grant Aided</option>
                      <option value="Faith-Based">Faith-Based</option>
                    </select>
                  )}
                </Field>
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setStep(2);
                    setError(null);
                  }}
                  className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-medium text-slate-600 hover:bg-slate-50"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-slate-900 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Registering…
                    </>
                  ) : (
                    "Complete registration"
                  )}
                </button>
              </div>
            </form>
          )}
        </div>

        <div className="mt-6 text-center">
          <p className="text-sm text-slate-500">
            Already have an account?{" "}
            <Link
              href="/login"
              className="font-semibold text-slate-900 underline-offset-2 hover:underline"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </AuthPageShell>
  );
}

// ── Reusable Components ────────────────────────────────────────────────────────

function PasswordRule({ met, label }: { met: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span
        className={cn(
          "inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
          met ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-400",
        )}
      >
        {met ? "✓" : ""}
      </span>
      <span className={cn(met ? "text-slate-700" : "text-slate-400")}>
        {label}
      </span>
    </div>
  );
}

function Field({
  label,
  error,
  hint,
  children,
  fullWidth,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
  fullWidth?: boolean;
}) {
  return (
    <div className={cn(fullWidth && "sm:col-span-2")}>
      <label className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}
      </label>
      {children}
      {hint && !error ? (
        <p className="mt-1 text-xs text-slate-400">{hint}</p>
      ) : null}
      {error ? <p className="mt-1.5 text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
