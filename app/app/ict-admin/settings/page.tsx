import { AccountSettingsPage } from "@/components/account/AccountSettingsPage";

export default function IctAdminSettingsPage() {
  return (
    <AccountSettingsPage
      pageTitle="Account settings"
      intro="Manage your account, notifications, password, and two-factor authentication for your Technical desk."
      accent="slate"
      preferencesStorageKey="ict-admin-workspace-settings"
      sessionTitle="Your account"
      sessionBody="Email, role, and school for the signed-in account."
      eyebrow="Technical desk"
    />
  );
}
