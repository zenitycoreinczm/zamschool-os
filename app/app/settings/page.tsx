"use client";

import { Settings as SettingsIcon } from "lucide-react";

import { AccountSettingsPage } from "@/components/account/AccountSettingsPage";
import { MfaSetup } from "@/components/account/MfaSetup";
import { PageHeader } from "@/components/workspace/PageHeader";

export default function AppSettingsPage() {
  return (
    <div className="space-y-4">
      <PageHeader
        accent="slate"
        icon={SettingsIcon}
        eyebrow="Workspace"
        title="Settings"
        description="Session details, notification preferences, password controls, and multi-factor authentication for your workspace account."
      />
      <AccountSettingsPage
        hideHeader
        preferencesStorageKey="workspace-account-settings"
        sessionTitle="Session"
        sessionBody="Signed-in account on this device."
      />
      <MfaSetup />
    </div>
  );
}
