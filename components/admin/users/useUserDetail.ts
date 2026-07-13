"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import { adminApiJson } from "@/lib/admin-browser-api";
import {
  MANAGED_ACCOUNT_ROLES,
  type DirectoryUser,
  type NewCredentials,
  type TabKey,
  type UserDetailData,
} from "@/components/admin/users/types";
import { tabToManagedRole } from "@/components/admin/users/helpers";
import { useWorkspaceContext } from "@/components/workspace/workspace-context";

export type UserMfaStatus = {
  mfaEnabled: boolean;
  verifiedCount: number;
  factorCount: number;
};

type UseUserDetailArgs = {
  schoolId: string | null;
  activeTab: TabKey;
  onRefresh: () => Promise<void>;
  onCredentials: (credentials: NewCredentials) => void;
};

export function useUserDetail({
  schoolId,
  activeTab,
  onRefresh,
  onCredentials,
}: UseUserDetailArgs) {
  const workspace = useWorkspaceContext();
  const actorRole = String(
    workspace?.data?.workspaceRole || workspace?.data?.role || "",
  )
    .trim()
    .toLowerCase();

  const [detailTarget, setDetailTarget] = useState<DirectoryUser | null>(null);
  const [detailData, setDetailData] = useState<UserDetailData | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [resettingPassword, setResettingPassword] = useState<string | null>(
    null,
  );
  const [mfaStatus, setMfaStatus] = useState<UserMfaStatus | null>(null);
  const [mfaLoading, setMfaLoading] = useState(false);
  const [disablingMfa, setDisablingMfa] = useState<string | null>(null);

  const canManageUserMfa =
    actorRole === "ict_admin" ||
    actorRole === "principal" ||
    actorRole === "super_admin";

  const loadMfaStatus = useCallback(
    async (profileId: string) => {
      if (!canManageUserMfa || !profileId) {
        setMfaStatus(null);
        return;
      }
      setMfaLoading(true);
      try {
        const body = await adminApiJson<{
          data?: UserMfaStatus;
        }>(`/api/admin/users/mfa?profileId=${encodeURIComponent(profileId)}`);
        setMfaStatus(
          body?.data
            ? {
                mfaEnabled: Boolean(body.data.mfaEnabled),
                verifiedCount: Number(body.data.verifiedCount || 0),
                factorCount: Number(body.data.factorCount || 0),
              }
            : { mfaEnabled: false, verifiedCount: 0, factorCount: 0 },
        );
      } catch {
        // Actor may lack recovery rights on this deployment — hide quietly.
        setMfaStatus(null);
      } finally {
        setMfaLoading(false);
      }
    },
    [canManageUserMfa],
  );

  const openDetail = useCallback(
    async (row: DirectoryUser) => {
      const role = tabToManagedRole(activeTab);
      setDetailTarget(row);
      setDetailData(null);
      setDetailError(null);
      setMfaStatus(null);
      setDetailLoading(true);

      try {
        const body = await adminApiJson<{ data?: UserDetailData }>(
          `/api/admin/users?profileId=${encodeURIComponent(row.id)}&role=${encodeURIComponent(role)}`,
        );
        setDetailData(body?.data || null);
        void loadMfaStatus(row.id);
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "Failed to load user details";
        setDetailError(message);
      } finally {
        setDetailLoading(false);
      }
    },
    [activeTab, loadMfaStatus],
  );

  const closeDetail = useCallback(() => {
    setDetailTarget(null);
    setDetailData(null);
    setDetailError(null);
    setMfaStatus(null);
  }, []);

  const detailRole = String(
    detailData?.role ||
      detailTarget?.role ||
      tabToManagedRole(activeTab),
  )
    .trim()
    .toLowerCase();

  const canResetTemporaryPassword = Boolean(
    detailTarget && MANAGED_ACCOUNT_ROLES.has(detailRole),
  );

  const canDisableMfa = Boolean(
    canManageUserMfa &&
      detailTarget &&
      !mfaLoading &&
      mfaStatus?.mfaEnabled,
  );

  const resetTemporaryPassword = useCallback(
    async (row: DirectoryUser | null) => {
      if (!row?.id) return;

      setResettingPassword(row.id);
      const t = toast.loading("Resetting temporary password...");

      try {
        const body = await adminApiJson<{
          email?: string;
          temporaryPassword?: string;
        }>("/api/admin/users/reset-password", {
          method: "POST",
          body: JSON.stringify({ profileId: row.id }),
        });

        if (!body?.temporaryPassword) {
          throw new Error("Temporary password was not returned");
        }

        onCredentials({
          email: String(body.email || row.email || ""),
          password: String(body.temporaryPassword),
        });

        if (schoolId) await onRefresh();
        toast.success("Temporary password reset", { id: t });
      } catch (err: unknown) {
        const message =
          err instanceof Error
            ? err.message
            : "Failed to reset temporary password";
        toast.error(message, { id: t });
      } finally {
        setResettingPassword(null);
      }
    },
    [schoolId, onRefresh, onCredentials],
  );

  const disableUserMfa = useCallback(
    async (row: DirectoryUser | null) => {
      if (!row?.id || !canManageUserMfa) return;

      const confirmed = window.confirm(
        `Disable authenticator (2FA) for ${row.email || "this user"}?\n\n` +
          "They will be able to sign in with email and password only.\n" +
          "Ask them to re-enable two-factor authentication in Settings after they regain access.",
      );
      if (!confirmed) return;

      setDisablingMfa(row.id);
      const t = toast.loading("Disabling authenticator requirement…");

      try {
        const body = await adminApiJson<{
          data?: {
            removedCount?: number;
            message?: string;
          };
        }>("/api/admin/users/mfa", {
          method: "POST",
          body: JSON.stringify({ profileId: row.id }),
        });

        setMfaStatus({
          mfaEnabled: false,
          verifiedCount: 0,
          factorCount: 0,
        });

        toast.success(
          body?.data?.message ||
            "Authenticator requirement removed. User can sign in with email and password.",
          { id: t },
        );
      } catch (err: unknown) {
        const message =
          err instanceof Error
            ? err.message
            : "Failed to disable two-factor authentication";
        toast.error(message, { id: t });
      } finally {
        setDisablingMfa(null);
      }
    },
    [canManageUserMfa],
  );

  return {
    detailTarget,
    detailData,
    detailRole,
    detailLoading,
    detailError,
    canResetTemporaryPassword,
    canDisableMfa,
    canManageUserMfa,
    mfaStatus,
    mfaLoading,
    resettingPassword,
    disablingMfa,
    openDetail,
    closeDetail,
    resetTemporaryPassword,
    disableUserMfa,
  };
}
