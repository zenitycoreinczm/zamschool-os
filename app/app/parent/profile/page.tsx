import { AccountProfilePage } from "@/components/account/AccountProfilePage";

export default function ParentProfilePage() {
  return (
    <AccountProfilePage
      accent="slate"
      eyebrow="Parent account"
      pageTitle="Parent Profile"
      intro="Update your personal details, manage your avatar, and review the information linked to your parent account."
      securityTitle="School-managed access"
      securityNote="Linked children, school relationships, and role access are managed by the school. Use this page for personal details and your avatar."
      settingsCardTitle="Parent settings"
      settingsCardBody="Use the settings page for your account, notifications, password, and two-factor authentication."
      settingsHref="/app/parent/settings"
      settingsLinkLabel="Open settings"
    />
  );
}
