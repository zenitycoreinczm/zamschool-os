"use client";

import { AccountProfilePage } from "@/components/account/AccountProfilePage";

export default function TeacherProfilePage() {
  return (
    <AccountProfilePage
      accent="slate"
      eyebrow="Teacher workspace"
      pageTitle="Profile"
      intro="Update your personal information, manage your avatar, and review your teaching assignment details."
      securityTitle="Access guidance"
      securityNote="Profile fields here are editable by you. Role access and class assignments remain controlled by your Head Teacher."
      settingsCardTitle="Workspace settings"
      settingsCardBody="Use the settings page for your account, notifications, password, and two-factor authentication."
      settingsHref="/app/teacher/settings"
      settingsLinkLabel="Open settings"
      detailsTitle="School details"
      assignmentTitle="Teaching assignment"
      showTeacherDetails={true}
    />
  );
}
