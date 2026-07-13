"use client";

import { AccountProfilePage } from "@/components/account/AccountProfilePage";

export default function AppProfilePage() {
  return (
    <AccountProfilePage
      accent="slate"
      eyebrow="Workspace"
      pageTitle="Profile"
      intro="Welcome to your profile hub — update your personal details, manage your avatar, and keep your workspace identity polished and professional."
      securityTitle="Access guidance"
      securityNote="Profile fields here are editable by you. Role access and school-managed assignments remain controlled by your Head Teacher."
      settingsCardTitle="Workspace settings"
      settingsCardBody="Use the settings page for your account, notifications, password, and two-factor authentication."
      settingsHref="/app/settings"
      settingsLinkLabel="Open settings"
    />
  );
}
