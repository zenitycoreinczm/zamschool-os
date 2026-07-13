import { normalizeRole, roleToStoredValue } from "./roles.ts";

/**
 * Roles that must never be created from the school UI.
 * - principal: only via school registration
 * - super_admin: platform only
 * - admin: removed (legacy School Administrator collapsed into Head Teacher)
 */
const BLOCKED_TARGET_ROLES = new Set([
  "principal",
  "super_admin",
  // Legacy value — also blocked if any client still posts it raw before normalize.
  "admin",
]);

/**
 * Head Teacher and platform Super Admin can provision school staff roles
 * (Deputy Head, bursar, registrar, teachers, …) — not another Head Teacher.
 */
export function canActorCreateSchoolRole(
  actorRole: string | null | undefined,
  targetRole: string | null | undefined,
): boolean {
  const actor = normalizeRole(actorRole);
  const target = roleToStoredValue(targetRole);
  if (!actor || !target || BLOCKED_TARGET_ROLES.has(target)) {
    return false;
  }

  // normalizeRole maps legacy admin → PRINCIPAL
  if (actor === "PRINCIPAL" || actor === "SUPER_ADMIN") {
    return true;
  }

  if (actor === "ICT_ADMIN") {
    // ICT manages system accounts only — not finance ownership roles.
    const ictAllowedTargets = new Set([
      "teacher",
      "student",
      "parent",
      "payments",
      "deputy_head",
      "guidance_office",
      "academic_admin",
      "hr_admin",
      "ict_admin",
      "discipline_admin",
      "registrar",
    ]);
    return ictAllowedTargets.has(target);
  }

  // HR maintains existing staff records only — never provisions accounts.
  // Head Teacher invites office staff; Registrar (or Head Teacher) creates
  // students/parents/teachers as appropriate.
  if (actor === "HR_ADMIN") {
    return false;
  }

  if (actor === "REGISTRAR") {
    return target === "student" || target === "parent" || target === "teacher";
  }

  return false;
}

export function blockedRoleCreationMessage(
  targetRole: string | null | undefined,
  actorRole?: string | null,
): string {
  const actor = normalizeRole(actorRole);
  if (actor === "HR_ADMIN") {
    return "HR does not create accounts. The Head Teacher invites office staff; you maintain employment records for people already on the system.";
  }

  const target = roleToStoredValue(targetRole);
  const raw = String(targetRole || "")
    .trim()
    .toLowerCase();
  if (target === "principal" || raw === "admin" || raw === "administrator") {
    return "Head Teacher accounts are created only when the school is registered. School Administrator is no longer a separate role.";
  }
  if (target === "super_admin") {
    return "Platform super admin accounts cannot be created from a school workspace.";
  }
  return "You do not have permission to create this account type.";
}
