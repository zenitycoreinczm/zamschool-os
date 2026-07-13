import { AccountSettingsPage } from "@/components/account/AccountSettingsPage";

export default function AppSettingsPage() {
  return (
    <AccountSettingsPage
      pageTitle="Account settings"
      intro="Manage your account, notifications, password, and two-factor authentication."
      accent="slate"
      preferencesStorageKey="workspace-account-settings"
      sessionTitle="Your account"
      sessionBody="Email, role, and school for the signed-in account."
      eyebrow="Workspace"
    />
  );
}
