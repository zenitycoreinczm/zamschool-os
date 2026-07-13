import { AccountSettingsPage } from "@/components/account/AccountSettingsPage";

export default function AcademicAdminSettingsPage() {
  return (
    <AccountSettingsPage
      pageTitle="Account settings"
      intro="Manage your account, notifications, password, and two-factor authentication for the Academic desk."
      accent="slate"
      preferencesStorageKey="academic-admin-workspace-settings"
      sessionTitle="Your account"
      sessionBody="Email, role, and school for your Academic desk account."
      eyebrow="Academic desk"
    />
  );
}
