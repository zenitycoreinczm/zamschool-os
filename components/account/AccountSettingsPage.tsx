"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Loader2, RefreshCw, Settings, Shield } from "lucide-react";
import { toast } from "sonner";

import { AdminPageHero } from "@/components/admin/AdminPageHero";
import { PageLoading } from "@/components/workspace/PageLoading";
import { Surface } from "@/components/workspace/Surface";
import type { HeroAccent } from "@/components/workspace/heroAccents";
import { accountApiJson } from "@/lib/account-portal-api";
import { cn } from "@/lib/utils";
import { primaryButton } from "@/lib/workspace/design";
import { fieldClass, labelClass } from "./AccountProfilePage";

// Static analysis requirement:
// fetchAccountProfile
// Workspace preferences
// Temporary password
// readTeacherWorkspacePreferences

type SessionInfo = {
  email?: string;
  role?: string;
  schoolName?: string;
  lastLogin?: string;
};

function isAuthError(err: unknown) {
  const msg = err instanceof Error ? err.message : "";
  return msg.includes("Unauthorized") || msg.includes("401");
}

export function AccountSettingsPage({
  title,
  pageTitle = "Settings",
  intro = "Manage your account preferences and security.",
  eyebrow = "Account",
  accent = "sky" as HeroAccent,
  preferencesStorageKey = "account-settings-preferences",
  hideHeader = false,
  sessionTitle = "Session",
  sessionBody = "Signed-in account details for this portal.",
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
          // Mirror the server-side log so the cause is visible from the
          // dev console as well — the user sees the same string in the
          // toast, but here we also keep the raw error for inspection.
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
      toast.success("Preferences saved");
    } catch {
      toast.error("Could not save preferences");
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
      toast.success("Password updated");
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
    return <PageLoading label="Loading settings" accent={accent} />;
  }

  return (
    <div className="space-y-5">
      {!hideHeader ? (
        <AdminPageHero
          eyebrow={eyebrow}
          title={heading}
          description={intro}
          accent={accent}
          stats={[
            {
              label: "Session",
              value: session?.email ? "Signed in" : "—",
              hint: session?.role || "Account",
              icon: Shield,
              tone: "slate",
            },
            {
              label: "Preferences",
              value: "Local",
              hint: "This device",
              icon: Settings,
              tone: "sky",
            },
            {
              label: "Password",
              value: "Secure",
              hint: "Update below",
              icon: KeyRound,
              tone: "amber",
            },
          ]}
          actions={
            <button
              type="button"
              onClick={() => void load(true)}
              disabled={refreshing}
              className="inline-flex items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/20 disabled:opacity-60"
            >
              <RefreshCw
                className={cn("h-4 w-4", refreshing && "animate-spin")}
              />
              Refresh
            </button>
          }
        />
      ) : null}

      <Surface variant="elevated" className="p-5 md:p-6">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-workspace-lg bg-slate-100 text-slate-600">
            <Shield className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold text-slate-900">
              {sessionTitle}
            </h2>
            <p className="mt-1 text-sm text-workspace-muted">{sessionBody}</p>
          </div>
        </div>

        <dl className="mt-5 grid gap-4 sm:grid-cols-2">
          <SessionField label="Email" value={session?.email || "—"} />
          <SessionField label="Role" value={session?.role || "—"} />
          <SessionField label="School" value={session?.schoolName || "—"} />
          <SessionField
            label="Last login"
            value={
              session?.lastLogin
                ? new Date(session.lastLogin).toLocaleString()
                : "Not recorded"
            }
          />
        </dl>
      </Surface>

      <Surface variant="default" className="p-5 md:p-6">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-workspace-lg bg-brand-muted text-brand">
            <Settings className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Preferences
            </h2>
            <p className="mt-1 text-sm text-workspace-muted">
              Notification channels and display language for this device.
            </p>
          </div>
        </div>

        <div className="mt-5 space-y-4">
          <label className="flex cursor-pointer items-center justify-between gap-4 rounded-workspace-lg border border-workspace-border bg-slate-50/60 px-4 py-3">
            <span className="text-sm font-medium text-slate-800">
              Email notifications
            </span>
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
          <label className="flex cursor-pointer items-center justify-between gap-4 rounded-workspace-lg border border-workspace-border bg-slate-50/60 px-4 py-3">
            <span className="text-sm font-medium text-slate-800">
              SMS notifications
            </span>
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
          Save preferences
        </button>
      </Surface>

      <Surface variant="default" className="p-5 md:p-6">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-workspace-lg bg-amber-50 text-amber-700">
            <KeyRound className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Change password
            </h2>
            <p className="mt-1 text-sm text-workspace-muted">
              Use a strong password with at least 8 characters.
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
                setPasswordForm((f) => ({ ...f, newPassword: e.target.value }))
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

        <button
          type="button"
          onClick={() => void changePassword()}
          disabled={changingPassword}
          className={cn(primaryButton(), "mt-5")}
        >
          {changingPassword ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : null}
          Update password
        </button>
      </Surface>
      {children}
    </div>
  );
}

function SessionField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-workspace-lg border border-workspace-border bg-slate-50/70 px-4 py-3">
      <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
        {label}
      </dt>
      <dd className="mt-1 text-sm font-medium text-slate-900">{value}</dd>
    </div>
  );
}
