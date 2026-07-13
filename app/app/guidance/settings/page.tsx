import { AccountSettingsPage } from "@/components/account/AccountSettingsPage";

export default function GuidanceSettingsPage() {
  return (
    <AccountSettingsPage
      pageTitle="Account settings"
      intro="Manage your account, notifications, password, and two-factor authentication for your Welfare desk."
      accent="slate"
      preferencesStorageKey="guidance-workspace-settings"
      sessionTitle="Your account"
      sessionBody="Email, role, and school for the signed-in account."
      eyebrow="Welfare desk"
    />
  );
}
