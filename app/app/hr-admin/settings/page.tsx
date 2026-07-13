import { AccountSettingsPage } from "@/components/account/AccountSettingsPage";

export default function HrAdminSettingsPage() {
  return (
    <AccountSettingsPage
      pageTitle="Account settings"
      intro="Manage your account, notifications, password, and two-factor authentication for your People desk."
      accent="slate"
      preferencesStorageKey="hr-admin-workspace-settings"
      sessionTitle="Your account"
      sessionBody="Email, role, and school for the signed-in account."
      eyebrow="People desk"
    />
  );
}
