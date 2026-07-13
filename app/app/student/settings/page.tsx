import { AccountSettingsPage } from "@/components/account/AccountSettingsPage";

export default function StudentSettingsPage() {
  return (
    <AccountSettingsPage
      pageTitle="Account settings"
      intro="Manage your account, notifications, password, and two-factor authentication."
      accent="slate"
      preferencesStorageKey="student-workspace-settings"
      sessionTitle="Your account"
      sessionBody="Email, role, and school for the signed-in account."
    />
  );
}
