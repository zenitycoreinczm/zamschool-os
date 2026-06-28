// Staff invitations view — shared by admin and principal pages.
"use client";

import { StaffInvitePanel } from "@/components/admin/StaffInvitePanel";
import {
  STAFF_INVITE_ROLE_OPTIONS,
  type StaffInviteRoleOption,
} from "@/lib/staff-invite-options";

type StaffInviteAccent =
  | "sky"
  | "teal"
  | "indigo"
  | "amber"
  | "emerald"
  | "violet"
  | "rose"
  | "slate"
  | "green";

export function StaffInvitationsView({
  roleOptions = STAFF_INVITE_ROLE_OPTIONS,
  title = "Staff invitations",
  description = "Invite leadership and staff without sharing passwords manually. New users complete first-login setup before gaining full access.",
  accent = "emerald",
}: {
  roleOptions?: StaffInviteRoleOption[];
  title?: string;
  description?: string;
  accent?: StaffInviteAccent;
}) {
  return (
    <StaffInvitePanel
      roleOptions={roleOptions}
      accent={accent}
      eyebrow="Staff access"
      title={title}
      description={description}
      primaryInviteLabel="Invite School Administrator"
      secondaryInviteLabel="Invite other staff"
    />
  );
}
