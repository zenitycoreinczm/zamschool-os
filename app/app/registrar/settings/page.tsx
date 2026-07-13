import { AccountSettingsPage } from "@/components/account/AccountSettingsPage";

export default function RegistrarSettingsPage() {
  return (
    <AccountSettingsPage
      pageTitle="Account settings"
      intro="Manage your account, notifications, password, and two-factor authentication for your Admissions desk."
      accent="slate"
      preferencesStorageKey="registrar-workspace-settings"
      sessionTitle="Your account"
      sessionBody="Email, role, and school for the signed-in account."
      eyebrow="Admissions desk"
    />
  );
}
