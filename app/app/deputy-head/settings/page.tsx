import { AccountSettingsPage } from "@/components/account/AccountSettingsPage";

export default function DeputyHeadSettingsPage() {
  return (
    <AccountSettingsPage
      pageTitle="Account settings"
      intro="Manage your account, notifications, password, and two-factor authentication for your Oversight desk."
      accent="slate"
      preferencesStorageKey="deputy-head-workspace-settings"
      sessionTitle="Your account"
      sessionBody="Email, role, and school for the signed-in account."
      eyebrow="Oversight desk"
    />
  );
}
