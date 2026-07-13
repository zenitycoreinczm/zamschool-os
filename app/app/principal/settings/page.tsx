import { AccountSettingsPage } from "@/components/account/AccountSettingsPage";

export default function PrincipalSettingsPage() {
  return (
    <AccountSettingsPage
      pageTitle="Account settings"
      intro="Manage your account, notifications, password, and two-factor authentication for your Leadership desk."
      accent="slate"
      preferencesStorageKey="principal-workspace-settings"
      sessionTitle="Head Teacher account"
      sessionBody="Email, role, and school for your Leadership desk account."
      eyebrow="Leadership desk"
    />
  );
}
