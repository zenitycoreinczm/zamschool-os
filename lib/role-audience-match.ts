import { parseTargetAudience } from "./target-audience.ts";
import { normalizeRole, roleToStoredValue } from "./roles.ts";

/** Stored profile role used for audience matching (e.g. principal, admin). */
export function resolveStoredRole(role: string | null | undefined): string | null {
  return roleToStoredValue(role) || String(role || "").trim().toLowerCase() || null;
}

/**
 * Whether content targeted at `targetRole` should be visible to the viewer.
 * Leadership audience = Head Teacher + Deputy Head.
 * Legacy "admin" targets resolve to Head Teacher (principal).
 */
export function matchesRoleTarget(
  targetRole: string | null | undefined,
  viewerRole: string | null | undefined,
  options?: { viewerClassId?: string | null }
): boolean {
  const rawTarget = String(targetRole || "").trim();
  if (!rawTarget || rawTarget === "all" || rawTarget === "general") {
    return true;
  }

  const parsed = parseTargetAudience(rawTarget);
  if (parsed.targetClassId) {
    const viewerClass = String(options?.viewerClassId || "").trim();
    return Boolean(viewerClass && viewerClass === parsed.targetClassId);
  }

  const target = parsed.targetRole || parsed.audience;
  const viewer = resolveStoredRole(viewerRole);
  if (!viewer) {
    return false;
  }

  // Legacy admin → principal for both target and viewer.
  const targetStored = roleToStoredValue(target) || target;
  const viewerStored =
    viewer === "admin" ? "principal" : viewer;

  if (targetStored === viewerStored) {
    return true;
  }
  // Old announcements targeted at "admin" should reach Head Teacher.
  if (
    (targetStored === "admin" || target === "admin") &&
    viewerStored === "principal"
  ) {
    return true;
  }

  const leadershipTargets = new Set([
    "leadership",
    "school_leadership",
    "school_leadership_team",
    "head_teacher_authority",
  ]);

  if (
    leadershipTargets.has(String(targetStored)) &&
    (viewerStored === "principal" || viewerStored === "deputy_head")
  ) {
    return true;
  }

  const targetCanonical = normalizeRole(target);
  const viewerCanonical = normalizeRole(viewer);
  if (targetCanonical && viewerCanonical && targetCanonical === viewerCanonical) {
    return true;
  }

  return false;
}