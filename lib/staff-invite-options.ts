import { getRoleDisplayLabel } from "./roles.ts";

/** Default staff invite role (first specialty after school leadership). */
export const DEFAULT_STAFF_INVITE_ROLE = "deputy_head" as const;

export type StaffInviteRoleValue =
  | "deputy_head"
  | "bursar"
  | "payments"
  | "guidance_office"
  | "academic_admin"
  | "hr_admin"
  | "ict_admin"
  | "discipline_admin"
  | "registrar"
  | "teacher";

export type StaffInviteRoleOption = {
  value: StaffInviteRoleValue;
  label: string;
  hint: string;
};

/**
 * Staff roles the Head Teacher can invite.
 * Head Teacher is created only at school registration.
 * Platform Super Admin is never invited from a school.
 * School Administrator (legacy `admin`) is not offered.
 */
export const STAFF_INVITE_ROLE_OPTIONS: StaffInviteRoleOption[] = [
  {
    value: "deputy_head",
    label: getRoleDisplayLabel("deputy_head"),
    hint: "Deputy Head operations hub, classes, attendance, and timetables.",
  },
  {
    value: "bursar",
    label: getRoleDisplayLabel("bursar"),
    hint: "Finance hub, fees, and payment oversight.",
  },
  {
    value: "hr_admin",
    label: getRoleDisplayLabel("hr_admin"),
    hint: "Staff records, employment data, and HR workflows.",
  },
  {
    value: "academic_admin",
    label: getRoleDisplayLabel("academic_admin"),
    hint: "Academic planning, classes, and curriculum oversight.",
  },
  {
    value: "ict_admin",
    label: getRoleDisplayLabel("ict_admin"),
    hint: "ICT systems, accounts recovery, and technical administration.",
  },
  {
    value: "discipline_admin",
    label: getRoleDisplayLabel("discipline_admin"),
    hint: "Discipline records and student conduct workflows.",
  },
  {
    value: "registrar",
    label: getRoleDisplayLabel("registrar"),
    hint: "Student admissions, parent registration, and transfers.",
  },
  {
    value: "guidance_office",
    label: getRoleDisplayLabel("guidance_office"),
    hint: "Student welfare, guidance, and counselling support.",
  },
  {
    value: "payments",
    label: getRoleDisplayLabel("payments"),
    hint: "Payment collection and student fee accounts.",
  },
  {
    value: "teacher",
    label: getRoleDisplayLabel("teacher"),
    hint: "Classroom teaching workspace. Prefer People → Teachers (Add) for full class setup.",
  },
];

/**
 * Role options for the Head Teacher staff invitation UI.
 * Excludes teacher - classroom teachers are created via People/Users → Teachers (Add + tabs).
 * Students and parents are also created there, not via staff invitations.
 */
export const PRINCIPAL_STAFF_INVITE_ROLE_OPTIONS: StaffInviteRoleOption[] =
  STAFF_INVITE_ROLE_OPTIONS.filter((option) => option.value !== "teacher");

/** @deprecated Use DEFAULT_STAFF_INVITE_ROLE. School Administrator invite removed. */
export const SCHOOL_ADMINISTRATOR_INVITE_ROLE = DEFAULT_STAFF_INVITE_ROLE;

export function getStaffInviteRoleLabel(
  role: string | null | undefined,
): string {
  const normalized = String(role || "")
    .trim()
    .toLowerCase();
  // Legacy invites stored as admin still display as Head Teacher
  if (normalized === "admin" || normalized === "administrator") {
    return getRoleDisplayLabel("principal");
  }
  const match = STAFF_INVITE_ROLE_OPTIONS.find(
    (option) => option.value === normalized,
  );
  return match?.label || getRoleDisplayLabel(role);
}
