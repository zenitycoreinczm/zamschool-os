"use client";

import { StaffInvitationsView } from "@/components/staff/StaffInvitationsView";
import { PRINCIPAL_STAFF_INVITE_ROLE_OPTIONS } from "@/lib/staff-invite-options";

export default function PrincipalStaffPage() {
  return (
    <StaffInvitationsView
      roleOptions={PRINCIPAL_STAFF_INVITE_ROLE_OPTIONS}
      title="Invite staff"
      description="Invite Deputy Head, Bursar, Registrar, and other office staff here. Students, parents, and classroom teachers are managed by the Registrar on their People desk - not on this page. Head Teacher is only created at school registration."
      accent="slate"
    />
  );
}
