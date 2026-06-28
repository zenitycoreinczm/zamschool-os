"use client";

import { StaffInvitationsView } from "@/components/staff/StaffInvitationsView";
import { PRINCIPAL_STAFF_INVITE_ROLE_OPTIONS } from "@/lib/staff-invite-options";

export default function PrincipalStaffPage() {
  return (
    <StaffInvitationsView
      roleOptions={PRINCIPAL_STAFF_INVITE_ROLE_OPTIONS}
      title="Invite staff"
      description="Invite school administrators and support staff. Teachers, students, and parents are managed through their respective sections."
      accent="violet"
    />
  );
}
