import { AccountSettingsPage } from "@/components/account/AccountSettingsPage";

export default function BursarSettingsPage() {
  return (
    <AccountSettingsPage
      pageTitle="Account settings"
      intro="Manage your account, notifications, password, and two-factor authentication for your Finance desk."
      accent="slate"
      preferencesStorageKey="bursar-workspace-settings"
      sessionTitle="Your account"
      sessionBody="Email, role, and school for the signed-in account."
      eyebrow="Finance desk"
    />
  );
}
