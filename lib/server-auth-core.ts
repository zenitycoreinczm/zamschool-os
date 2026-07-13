import {
  KNOWN_ROLES,
  isAdminRole,
  isFinancialRole,
  isSensitiveRole,
  normalizeRole,
  type KnownRole,
} from "./roles";

type UserLike = {
  id: string;
  user_metadata?: {
    role?: string | null;
  } | null;
} | null;

type ProfileLike = {
  id?: string | null;
  role?: string | null;
  school_id?: string | null;
} | null;

type ActorContextOptions = {
  user: UserLike;
  profile: ProfileLike;
  allowedRoles: KnownRole[];
  requireSchool: boolean;
  allowMetadataRoleFallback?: boolean;
};

type ActorContextFailure = {
  ok: false;
  status: 401 | 403;
  error: string;
};

type ActorContextSuccess = {
  ok: true;
  userId: string;
  profileId: string;
  schoolId: string | null;
  role: KnownRole;
};

export type ActorContextResult = ActorContextFailure | ActorContextSuccess;
export type ActorContext = ActorContextSuccess;

export function buildActorContext(
  options: ActorContextOptions,
): ActorContextResult {
  if (!options.user?.id) {
    return {
      ok: false,
      status: 401,
      error: "Unauthorized",
    };
  }

  const profileRole = normalizeRole(options.profile?.role);
  const role =
    profileRole ||
    (options.allowMetadataRoleFallback
      ? normalizeRole(options.user.user_metadata?.role)
      : null);

  if (!role || !options.allowedRoles.includes(role)) {
    return {
      ok: false,
      status: 403,
      error: "Forbidden",
    };
  }

  const schoolId = String(options.profile?.school_id || "").trim() || null;

  if (options.requireSchool && !schoolId) {
    return {
      ok: false,
      status: 403,
      // Keep in sync with lib/school-access-error.ts (NO_SCHOOL_LINKED_ERROR)
      error: "No school linked to this account",
    };
  }

  return {
    ok: true,
    userId: options.user.id,
    profileId: options.profile?.id || options.user.id,
    schoolId,
    role,
  };
}

export {
  KNOWN_ROLES,
  isAdminRole,
  isFinancialRole,
  isSensitiveRole,
  normalizeRole,
};
export type { KnownRole };
