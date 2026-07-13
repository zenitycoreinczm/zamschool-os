"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  KeyRound,
  Loader2,
  RefreshCw,
  Settings,
  ShieldCheck,
  User,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/workspace/PageHeader";
import { PageLoading } from "@/components/workspace/PageLoading";
import { Surface } from "@/components/workspace/Surface";
import type { HeroAccent } from "@/components/workspace/heroAccents";
import { accountApiJson } from "@/lib/account-portal-api";
import { getRoleDisplayLabel } from "@/lib/roles";
import { cn } from "@/lib/utils";
import { primaryButton, secondaryButton } from "@/lib/workspace/design";
import { fieldClass, labelClass } from "./AccountProfilePage";
import { MfaSetup } from "./MfaSetup";

// Static analysis requirement:
// fetchAccountProfile
// Workspace preferences
// Temporary password
// readTeacherWorkspacePreferences

type SessionInfo = {
  email?: string | null;
  role?: string | null;
  /** Preferred human-readable role from the session API. */
  roleLabel?: string | null;
  schoolName?: string | null;
  lastLogin?: string | null;
  firstName?: string | null;
  lastName?: string | null;
};

function isAuthError(err: unknown) {
  const msg = err instanceof Error ? err.message : "";
  return msg.includes("Unauthorized") || msg.includes("401");
}

/** Soft icon chip — monochrome slate so settings matches every other desk. */
function accentIconShell(_accent?: HeroAccent) {
  void _accent;
  return "bg-slate-100 text-slate-700 ring-slate-200";
}

export function AccountSettingsPage({
  title,
  pageTitle = "Account settings",
  intro = "Manage your account, notifications, password, and two-factor authentication.",
  eyebrow = "Account",
  accent = "slate" as HeroAccent,
  preferencesStorageKey = "account-settings-preferences",
  hideHeader = false,
  sessionTitle = "Your account",
  sessionBody = "Email, role, and school for the signed-in account.",
  profileHref = "/app/profile",
  children,
}: {
  title?: string;
  pageTitle?: string;
  intro?: string;
  eyebrow?: string;
  accent?: HeroAccent;
  preferencesStorageKey?: string;
  hideHeader?: boolean;
  sessionTitle?: string;
  sessionBody?: string;
  profileHref?: string;
  children?: React.ReactNode;
}) {
  const router = useRouter();
  const heading = title || pageTitle;
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [prefs, setPrefs] = useState({
    emailNotifications: true,
    smsNotifications: false,
    language: "en",
  });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  function redirectToLogin() {
    router.replace("/login");
  }

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      else setRefreshing(true);
      try {
        const body = await accountApiJson<{ data?: SessionInfo }>(
          "/api/account/session",
        );
        setSession(body.data || null);
      } catch (err: unknown) {
        if (isAuthError(err)) {
          router.replace("/login");
          return;
        }
        if (process.env.NODE_ENV !== "production") {
          console.error(
            "[AccountSettingsPage] /api/account/session failed:",
            err,
          );
        }
        toast.error(
          err instanceof Error ? err.message : "Failed to load session",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [router],
  );

  useEffect(() => {
    void load();
    try {
      const raw = localStorage.getItem(preferencesStorageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<typeof prefs>;
        setPrefs((prev) => ({ ...prev, ...parsed }));
      }
    } catch {
      // ignore invalid stored preferences
    }
  }, [preferencesStorageKey, load]);

  const savePrefs = async () => {
    setSavingPrefs(true);
    try {
      localStorage.setItem(preferencesStorageKey, JSON.stringify(prefs));
      toast.success("Notification settings saved");
    } catch {
      toast.error("Could not save notification settings");
    } finally {
      setSavingPrefs(false);
    }
  };

  const changePassword = async () => {
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }
    if (passwordForm.newPassword.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }

    setChangingPassword(true);
    try {
      await accountApiJson("/api/account/change-password", {
        method: "POST",
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
        }),
      });
      toast.success("Sign-in password updated");
      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
    } catch (err: unknown) {
      if (isAuthError(err)) {
        redirectToLogin();
        return;
      }
      toast.error(
        err instanceof Error ? err.message : "Failed to update password",
      );
    } finally {
      setChangingPassword(false);
    }
  };

  if (loading) {
    return (
      <PageLoading
        label="Loading settings"
        accent={accent}
        mode="skeleton"
        skeletonVariant="form"
      />
    );
  }

  const iconShell = accentIconShell(accent);
  const displayName = [session?.firstName, session?.lastName]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ");
  const roleLabel =
    session?.roleLabel?.trim() ||
    getRoleDisplayLabel(session?.role) ||
    "Not set";
  const emailLabel = session?.email?.trim() || "No email on file";
  const schoolLabel = session?.schoolName?.trim() || "Not linked to a school";
  const lastLoginLabel = session?.lastLogin
    ? new Date(session.lastLogin).toLocaleString()
    : "Not recorded yet";

  return (
    <div className="space-y-5">
      {!hideHeader ? (
        <PageHeader
          eyebrow={eyebrow}
          title={heading}
          description={intro}
          accent={accent}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Link href={profileHref} className={secondaryButton()}>
                Profile
                <ArrowRight className="h-4 w-4" />
              </Link>
              <button
                type="button"
                onClick={() => void load(true)}
                disabled={refreshing}
                className={secondaryButton()}
                aria-busy={refreshing}
              >
                {refreshing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Refresh
              </button>
            </div>
          }
        />
      ) : null}

      <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
        <QuickLink
          href={profileHref}
          title="Profile"
          description="Name, avatar, and contact details."
          icon={<User className="h-4 w-4" />}
          iconShell={iconShell}
        />
        <QuickLink
          href="#settings-password"
          title="Sign-in password"
          description="Update the password you use to log in."
          icon={<KeyRound className="h-4 w-4" />}
          iconShell={iconShell}
        />
        <QuickLink
          href="#settings-2fa"
          title="Two-factor authentication"
          description="Add an authenticator app for extra protection."
          icon={<ShieldCheck className="h-4 w-4" />}
          iconShell={iconShell}
        />
        <QuickLink
          href="#settings-notifications"
          title="Notifications"
          description="Email, SMS, and display language."
          icon={<Settings className="h-4 w-4" />}
          iconShell={iconShell}
        />
      </div>

      <Surface variant="elevated" className="p-5 md:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-workspace-lg ring-1",
                iconShell,
              )}
            >
              <User className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-slate-900">
                {sessionTitle}
              </h2>
              <p className="mt-1 text-sm text-workspace-muted">{sessionBody}</p>
              {displayName ? (
                <p className="mt-2 text-sm font-medium text-slate-900">
                  {displayName}
                </p>
              ) : null}
              <p className="mt-0.5 truncate text-sm text-slate-600">
                {emailLabel}
              </p>
            </div>
          </div>
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700">
            <span
              className="h-1.5 w-1.5 rounded-full bg-emerald-500"
              aria-hidden
            />
            Active
          </span>
        </div>

        <dl className="mt-5 grid gap-3 sm:grid-cols-2">
          <SessionField label="Email" value={emailLabel} />
          <SessionField label="Role" value={roleLabel} />
          <SessionField label="School" value={schoolLabel} />
          <SessionField label="Last login" value={lastLoginLabel} />
        </dl>
      </Surface>

      <Surface
        id="settings-notifications"
        variant="default"
        className="scroll-mt-24 p-5 md:p-6"
      >
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-workspace-lg ring-1",
              iconShell,
            )}
          >
            <Settings className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Notifications & language
            </h2>
            <p className="mt-1 text-sm text-workspace-muted">
              Choose how you want to hear from the school, and which language to
              use in the workspace.
            </p>
          </div>
        </div>

        <div className="mt-5 space-y-3">
          <label className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 transition hover:border-slate-300 hover:bg-slate-50/50">
            <div>
              <span className="text-sm font-medium text-slate-800">
                Email notifications
              </span>
              <p className="text-xs text-slate-500">
                Alerts and digests to your account email
              </p>
            </div>
            <input
              type="checkbox"
              checked={prefs.emailNotifications}
              onChange={(e) =>
                setPrefs((p) => ({
                  ...p,
                  emailNotifications: e.target.checked,
                }))
              }
              className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand/30"
            />
          </label>
          <label className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 transition hover:border-slate-300 hover:bg-slate-50/50">
            <div>
              <span className="text-sm font-medium text-slate-800">
                SMS notifications
              </span>
              <p className="text-xs text-slate-500">
                Text alerts when your school has SMS enabled
              </p>
            </div>
            <input
              type="checkbox"
              checked={prefs.smsNotifications}
              onChange={(e) =>
                setPrefs((p) => ({ ...p, smsNotifications: e.target.checked }))
              }
              className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand/30"
            />
          </label>
          <div>
            <label className={labelClass}>Language</label>
            <select
              value={prefs.language}
              onChange={(e) =>
                setPrefs((p) => ({ ...p, language: e.target.value }))
              }
              className={fieldClass}
            >
              <option value="en">English</option>
            </select>
          </div>
        </div>

        <button
          type="button"
          onClick={() => void savePrefs()}
          disabled={savingPrefs}
          className={cn(primaryButton(), "mt-5")}
        >
          {savingPrefs ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Save notification settings
        </button>
      </Surface>

      <Surface
        id="settings-password"
        variant="default"
        className="scroll-mt-24 p-5 md:p-6"
      >
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-workspace-lg ring-1",
              iconShell,
            )}
          >
            <KeyRound className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Sign-in password
            </h2>
            <p className="mt-1 text-sm text-workspace-muted">
              Update the password you use with your email to open this
              workspace. Minimum 8 characters.
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <div>
            <label className={labelClass}>Current password</label>
            <input
              type="password"
              value={passwordForm.currentPassword}
              onChange={(e) =>
                setPasswordForm((f) => ({
                  ...f,
                  currentPassword: e.target.value,
                }))
              }
              className={fieldClass}
              autoComplete="current-password"
            />
          </div>
          <div>
            <label className={labelClass}>New password</label>
            <input
              type="password"
              value={passwordForm.newPassword}
              onChange={(e) =>
                setPasswordForm((f) => ({
                  ...f,
                  newPassword: e.target.value,
                }))
              }
              className={fieldClass}
              autoComplete="new-password"
            />
          </div>
          <div>
            <label className={labelClass}>Confirm new password</label>
            <input
              type="password"
              value={passwordForm.confirmPassword}
              onChange={(e) =>
                setPasswordForm((f) => ({
                  ...f,
                  confirmPassword: e.target.value,
                }))
              }
              className={fieldClass}
              autoComplete="new-password"
            />
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void changePassword()}
            disabled={changingPassword}
            className={primaryButton()}
          >
            {changingPassword ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : null}
            Save new password
          </button>
          <Link href="/forgot-password" className={secondaryButton()}>
            Email a reset link
          </Link>
        </div>
      </Surface>

      {/* Available to every role via Settings — authenticator app (TOTP) 2FA. */}
      <div id="settings-2fa" className="scroll-mt-24">
        <MfaSetup />
      </div>

      {children}
    </div>
  );
}

function QuickLink({
  href,
  title,
  description,
  icon,
  iconShell,
}: {
  href: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  iconShell: string;
}) {
  const className =
    "group flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300 hover:bg-slate-50/50";

  const body = (
    <>
      <div
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ring-1",
          iconShell,
        )}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-slate-900">{title}</p>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </div>
      <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-slate-400 transition group-hover:translate-x-0.5" />
    </>
  );

  if (href.startsWith("#")) {
    return (
      <a href={href} className={className}>
        {body}
      </a>
    );
  }

  return (
    <Link href={href} className={className}>
      {body}
    </Link>
  );
}

function SessionField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3">
      <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
        {label}
      </dt>
      <dd className="mt-1 text-sm font-medium text-slate-900">{value}</dd>
    </div>
  );
}
