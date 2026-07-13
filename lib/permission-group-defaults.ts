import { normalizeRole, type KnownRole } from "@/lib/roles";

export type PermissionFeatureSeed = {
  feature_key: string;
  can_create: boolean;
  can_read: boolean;
  can_update: boolean;
  can_delete: boolean;
  scope: string;
};

export type PermissionGroupSeed = {
  name: string;
  description: string;
  roles: string[];
  features: PermissionFeatureSeed[];
};

/**
 * Canonical permission group seeds written to permission_groups /
 * permission_group_roles / permission_features during school initialization.
 */
export const DEFAULT_PERMISSION_GROUPS: PermissionGroupSeed[] = [
  {
    name: "Head Teacher Authority",
    description:
      "Full school leadership access for setup, daily operations, approvals, audit review, and workflow escalation authority.",
    roles: ["PRINCIPAL"],
    features: [
      full("users"),
      full("classes"),
      full("subjects"),
      full("attendance", false),
      full("grades"),
      full("assignments"),
      full("timetable"),
      full("grading_scales", false),
      full("academic_years", false),
      full("terms", false),
      writable("settings"),
      writable("announcements"),
      writable("messages"),
      writable("notifications"),
      full("finance"),
      full("payments"),
      full("audit"),
      full("overrides"),
    ],
  },
  {
    name: "Deputy Head Authority",
    description: "Academic quality control — review and validate, not create.",
    roles: ["DEPUTY_HEAD"],
    features: [
      readOnly("users"),
      readOnly("classes"),
      readOnly("subjects"),
      writable("attendance"),
      writable("grades"),
      readOnly("timetable"),
      readOnly("grading_scales"),
      readOnly("academic_years"),
      readOnly("terms"),
      writable("announcements"),
      writable("messages"),
      writable("notifications"),
    ],
  },
  {
    name: "Finance Office",
    description: "Separated financial access for bursars and payments staff",
    roles: ["BURSAR", "PAYMENTS"],
    features: [writable("finance"), writable("payments"), readOnly("users")],
  },
  {
    name: "Guidance Office",
    description: "Student welfare, counseling, and privacy-focused oversight",
    roles: ["GUIDANCE_OFFICE"],
    features: [
      readOnly("users"),
      readOnly("attendance"),
      writable("discipline"),
      writable("messages"),
    ],
  },
  {
    name: "Discipline Management",
    description: "Student conduct administration — no academic data access.",
    roles: ["DISCIPLINE_ADMIN"],
    features: [
      readOnly("users"),
      readOnly("attendance"),
      writable("discipline"),
      writable("messages"),
    ],
  },
  {
    name: "ICT Administration",
    description:
      "Technical support, user recovery (including authenticator reset), and audit. No academic data access. Session console is not shipped yet.",
    roles: ["ICT_ADMIN"],
    features: [
      writable("users"),
      writable("settings"),
      readOnly("audit"),
      writable("messages"),
      writable("notifications"),
    ],
  },
  {
    name: "Admissions & Registrar",
    description:
      "Student admissions, parent registration, transfers, and biodata management. No finance, grading, or HR access.",
    roles: ["REGISTRAR"],
    features: [
      writable("users"),
      writable("classes"),
      readOnly("attendance"),
      readOnly("grades"),
      readOnly("announcements"),
      writable("messages"),
      writable("notifications"),
    ],
  },
  {
    name: "Academic Administration",
    description:
      "Academic structure, grades, assignments, timetables, and academic calendar.",
    roles: ["ACADEMIC_ADMIN"],
    features: [
      readOnly("users"),
      readOnly("classes"),
      writable("subjects"),
      readOnly("attendance"),
      writable("grades"),
      writable("assignments"),
      writable("timetable"),
      writable("grading_scales"),
      writable("academic_years"),
      writable("terms"),
    ],
  },
  {
    name: "Human Resources",
    description:
      "Maintain existing staff employment records and departments. Does not create accounts or send invitations (Head Teacher).",
    roles: ["HR_ADMIN"],
    features: [
      // Read + update staff profiles only — no create/delete accounts.
      readUpdate("users"),
      // Class/subject labels needed when viewing teacher employment assignments.
      readOnly("classes"),
      readOnly("subjects"),
      readOnly("attendance"),
      // Full department structure (custom depts can be deleted; defaults blocked in API).
      full("department"),
    ],
  },
  {
    name: "Teaching",
    description: "Teacher access scoped to assigned classes and departments",
    roles: ["TEACHER"],
    features: [
      writable("attendance", "own"),
      writable("grades", "own"),
      writable("assignments", "own"),
      readOnly("users", "department"),
    ],
  },
];

export type FeaturePerms = {
  can_create: boolean;
  can_read: boolean;
  can_update: boolean;
  can_delete: boolean;
  scope: string;
};

function full(
  featureKey: string,
  canDelete = true,
  scope = "school",
): PermissionFeatureSeed {
  return {
    feature_key: featureKey,
    can_create: true,
    can_read: true,
    can_update: true,
    can_delete: canDelete,
    scope,
  };
}

function writable(featureKey: string, scope = "school"): PermissionFeatureSeed {
  return {
    feature_key: featureKey,
    can_create: true,
    can_read: true,
    can_update: true,
    can_delete: false,
    scope,
  };
}

function readOnly(featureKey: string, scope = "school"): PermissionFeatureSeed {
  return {
    feature_key: featureKey,
    can_create: false,
    can_read: true,
    can_update: false,
    can_delete: false,
    scope,
  };
}

function readUpdate(
  featureKey: string,
  scope = "school",
): PermissionFeatureSeed {
  return {
    feature_key: featureKey,
    can_create: false,
    can_read: true,
    can_update: true,
    can_delete: false,
    scope,
  };
}

export function mergeFeaturePermission(
  existing: FeaturePerms | undefined,
  incoming: FeaturePerms,
): FeaturePerms {
  if (!existing) return incoming;
  return {
    can_create: existing.can_create || incoming.can_create,
    can_read: existing.can_read || incoming.can_read,
    can_update: existing.can_update || incoming.can_update,
    can_delete: existing.can_delete || incoming.can_delete,
    scope: incoming.scope,
  };
}

/**
 * Pre-computed role → feature map from DEFAULT_PERMISSION_GROUPS.
 * Used only when a school has not yet been seeded with permission_features rows.
 */
export function buildRolePermissionFallback(): Partial<
  Record<KnownRole, Record<string, FeaturePerms>>
> {
  const result: Partial<Record<KnownRole, Record<string, FeaturePerms>>> = {};

  for (const group of DEFAULT_PERMISSION_GROUPS) {
    for (const role of group.roles) {
      const normalizedRole = normalizeRole(role);
      if (!normalizedRole) continue;

      const roleMap = result[normalizedRole] || {};
      for (const feature of group.features) {
        const perms: FeaturePerms = {
          can_create: feature.can_create,
          can_read: feature.can_read,
          can_update: feature.can_update,
          can_delete: feature.can_delete,
          scope: feature.scope,
        };
        roleMap[feature.feature_key] = mergeFeaturePermission(
          roleMap[feature.feature_key],
          perms,
        );
      }
      result[normalizedRole] = roleMap;
    }
  }

  return result;
}
