import { AccountSettingsPage } from "@/components/account/AccountSettingsPage";

export default function DisciplineAdminSettingsPage() {
  return (
    <AccountSettingsPage
      pageTitle="Account settings"
      intro="Manage your account, notifications, password, and two-factor authentication for your Conduct desk."
      accent="slate"
      preferencesStorageKey="discipline-admin-workspace-settings"
      sessionTitle="Your account"
      sessionBody="Email, role, and school for the signed-in account."
      eyebrow="Conduct desk"
    />
  );
}
