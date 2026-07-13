import { Loader2, ShieldOff, UserCheck } from "lucide-react";
import { getDisplayName } from "@/lib/profile-utils";
import { secondaryButton } from "@/lib/workspace/design";
import { UserDetailDashboard } from "./UserDetailDashboard";
import { UsersModalShell } from "./UsersModalShell";
import type { DirectoryUser, TabKey, UserDetailData } from "./types";
import type { UserMfaStatus } from "./useUserDetail";

type UserDetailModalProps = {
  activeTab: TabKey;
  detailTarget: DirectoryUser;
  detailData: UserDetailData | null;
  detailRole: string;
  detailLoading: boolean;
  detailError: string | null;
  canResetTemporaryPassword: boolean;
  canDisableMfa?: boolean;
  canManageUserMfa?: boolean;
  mfaStatus?: UserMfaStatus | null;
  mfaLoading?: boolean;
  resettingPasswordId: string | null;
  disablingMfaId?: string | null;
  onResetPassword: () => void;
  onDisableMfa?: () => void;
  onEdit: () => void;
  onClose: () => void;
};

export function UserDetailModal({
  activeTab,
  detailTarget,
  detailData,
  detailRole,
  detailLoading,
  detailError,
  canResetTemporaryPassword,
  canDisableMfa = false,
  canManageUserMfa = false,
  mfaStatus = null,
  mfaLoading = false,
  resettingPasswordId,
  disablingMfaId = null,
  onResetPassword,
  onDisableMfa,
  onEdit,
  onClose,
}: UserDetailModalProps) {
  const displayName =
    detailData?.displayName || getDisplayName(detailTarget);

  return (
    <UsersModalShell
      size="5xl"
      title={activeTab === "teachers" ? "Teacher oversight" : "User details"}
      description={displayName}
      onClose={onClose}
      headerActions={
        <div className="flex flex-wrap items-center gap-2">
          {canManageUserMfa && !detailLoading ? (
            mfaLoading ? (
              <span className="inline-flex items-center gap-2 rounded-workspace-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-500">
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                Checking 2FA…
              </span>
            ) : mfaStatus?.mfaEnabled ? (
              <button
                type="button"
                onClick={onDisableMfa}
                disabled={
                  !canDisableMfa || disablingMfaId === detailTarget?.id
                }
                className="inline-flex items-center gap-2 rounded-workspace-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-900 transition-colors hover:bg-rose-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300 disabled:opacity-60"
                title="Remove authenticator requirement so the user can sign in with email and password"
              >
                {disablingMfaId === detailTarget?.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <ShieldOff className="h-4 w-4" aria-hidden />
                )}
                Disable authenticator (2FA)
              </button>
            ) : (
              <span className="inline-flex items-center gap-2 rounded-workspace-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600">
                2FA not enabled
              </span>
            )
          ) : null}
          {canResetTemporaryPassword ? (
            <button
              type="button"
              onClick={onResetPassword}
              disabled={resettingPasswordId === detailTarget?.id}
              className="inline-flex items-center gap-2 rounded-workspace-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900 transition-colors hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 disabled:opacity-60"
            >
              {resettingPasswordId === detailTarget?.id ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <UserCheck className="h-4 w-4" aria-hidden />
              )}
              Reset temporary password
            </button>
          ) : null}
        </div>
      }
      footer={
        <button type="button" onClick={onClose} className={secondaryButton()}>
          Close
        </button>
      }
    >
      {detailLoading ? (
        <div
          className="flex items-center justify-center gap-3 rounded-workspace-xl border border-workspace-border bg-slate-50 px-4 py-12"
          role="status"
          aria-live="polite"
        >
          <Loader2 className="h-5 w-5 animate-spin text-slate-500" aria-hidden />
          <span className="text-sm text-workspace-muted">
            Loading user details…
          </span>
        </div>
      ) : detailError ? (
        <div
          className="rounded-workspace-xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700"
          role="alert"
        >
          {detailError}
        </div>
      ) : detailData ? (
        <div className="space-y-4">
          {canManageUserMfa ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              <p className="font-semibold text-slate-900">
                Authenticator recovery
              </p>
              <p className="mt-1 leading-relaxed text-slate-600">
                If this user lost their phone or authenticator app, use{" "}
                <strong>Disable authenticator (2FA)</strong> so they can sign
                in with email and password only. Tell them to open{" "}
                <strong>Settings → Two-factor authentication</strong> and set
                up a new authenticator app afterward.
              </p>
              {mfaStatus ? (
                <p className="mt-2 text-xs font-medium text-slate-500">
                  Status:{" "}
                  {mfaStatus.mfaEnabled
                    ? `Enabled (${mfaStatus.verifiedCount} verified factor${mfaStatus.verifiedCount === 1 ? "" : "s"})`
                    : "Not enabled"}
                </p>
              ) : null}
            </div>
          ) : null}
          <UserDetailDashboard
            detailData={detailData}
            detailTarget={detailTarget}
            detailRole={detailRole}
            onEdit={onEdit}
          />
        </div>
      ) : null}
    </UsersModalShell>
  );
}
