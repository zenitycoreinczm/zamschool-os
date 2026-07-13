import { AccountSettingsPage } from "@/components/account/AccountSettingsPage";

export default function PaymentsSettingsPage() {
  return (
    <AccountSettingsPage
      pageTitle="Account settings"
      intro="Manage your account, notifications, password, and two-factor authentication for payments."
      accent="slate"
      preferencesStorageKey="payments-workspace-settings"
      sessionTitle="Your account"
      sessionBody="Email, role, and school for the signed-in account."
      eyebrow="Payments workspace"
    />
  );
}
