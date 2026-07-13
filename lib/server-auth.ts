import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase";
import { fetchProfileByIdentity } from "@/lib/profile-lookup";
import {
  resolveVerifiedAuthUser,
  resolveVerifiedBearerUser,
} from "@/lib/supabase-auth-verify";
import {
  buildActorContext,
  type ActorContext,
  type KnownRole,
} from "@/lib/server-auth-core";
import { normalizeRole } from "@/lib/roles";
import {
  getCachedActorSnapshot,
  setCachedActorSnapshot,
} from "@/lib/redis/role-cache";
import { touchActiveSession } from "@/lib/redis/session";

export {
  buildActorContext,
  normalizeRole,
  isAdminRole,
  isSensitiveRole,
  isFinancialRole,
} from "@/lib/server-auth-core";

function readBearerToken(req?: Request) {
  const header =
    req?.headers.get("authorization") || req?.headers.get("Authorization");
  if (!header) return null;

  const [scheme, token] = header.split(" ");
  if (!/^Bearer$/i.test(scheme || "") || !token) {
    return "";
  }

  return token.trim();
}

async function getAuthenticatedUser(req?: Request) {
  const bearerToken = readBearerToken(req);
  if (bearerToken !== null) {
    if (!bearerToken) {
      return {
        user: null,
        authError: new Error("Invalid authorization header"),
      };
    }

    const { user, error } = await resolveVerifiedBearerUser(
      supabaseAdmin.auth,
      bearerToken,
    );
    return {
      user,
      authError: error,
    };
  }

  const supabase = await createClient();
  const { user, error } = await resolveVerifiedAuthUser(supabase);

  return {
    user,
    authError: error,
  };
}

function jsonError(result: { status: 401 | 403; error: string }) {
  return NextResponse.json({ error: result.error }, { status: result.status });
}

export async function requireActorContext(
  options: {
    allowedRoles: KnownRole[];
    requireSchool: boolean;
    allowMetadataRoleFallback?: boolean;
  },
  req?: Request,
): Promise<
  | {
      ok: false;
      response: NextResponse;
    }
  | {
      ok: true;
      context: ActorContext;
    }
> {
  const { user, authError } = await getAuthenticatedUser(req);

  if (authError || !user) {
    return {
      ok: false as const,
      response: jsonError({
        status: 401,
        error: "Unauthorized",
      }),
    };
  }

  // L1 memory + Redis. Super_admin with schoolId:null is a valid cached snapshot.
  const cached = await getCachedActorSnapshot(user.id);
  const cacheUsable = Boolean(cached?.profileId);

  let profile: {
    id?: string | null;
    role?: string | null;
    school_id?: string | null;
  } | null = cacheUsable
    ? {
        id: cached!.profileId,
        role: cached!.role,
        // Stored roles are KnownRole enums; buildActorContext normalizes either form.
        school_id: cached!.schoolId,
      }
    : null;

  if (!cacheUsable) {
    const lookup = await fetchProfileByIdentity<{
      id?: string | null;
      role?: string | null;
      school_id?: string | null;
    }>(supabaseAdmin as any, user.id, "id, role, school_id", user.email);
    profile = lookup.data;
    const profileRole = normalizeRole(profile?.role);
    const schoolId = String(profile?.school_id || "").trim() || null;
    const profileId = profile?.id ?? null;

    // Only persist complete snapshots. Caching { schoolId: null } for school
    // roles caused multi-minute false "no school" failures; SUPER_ADMIN is OK.
    if (profileId && (schoolId || profileRole === "SUPER_ADMIN")) {
      // Await so the next parallel route in the same tick can L1-hit.
      await setCachedActorSnapshot(user.id, {
        role: profileRole,
        schoolId,
        profileId,
      });
    }
  }

  // Session touch is best-effort telemetry — never block the request path.
  void touchActiveSession({
    userId: user.id,
    lastSeenAt: Date.now(),
    schoolId: profile?.school_id ?? null,
    role: normalizeRole(profile?.role) ?? null,
  });

  const result = buildActorContext({
    user,
    profile,
    allowedRoles: options.allowedRoles,
    requireSchool: options.requireSchool,
    allowMetadataRoleFallback: options.allowMetadataRoleFallback,
  });

  if (!result.ok) {
    return {
      ok: false as const,
      response: jsonError(result),
    };
  }

  return {
    ok: true as const,
    context: result,
  };
}

export async function requireAdminContext(req?: Request) {
  return requireActorContext(
    {
      allowedRoles: [
        "PRINCIPAL",
        "DEPUTY_HEAD",
        "BURSAR",
        "GUIDANCE_OFFICE",
        "ACADEMIC_ADMIN",
        "HR_ADMIN",
        "ICT_ADMIN",
        "DISCIPLINE_ADMIN",
        "REGISTRAR",
        "SUPER_ADMIN",
      ],
      requireSchool: true,
    },
    req,
  );
}

export async function requireAdminSetupContext(req?: Request) {
  return requireActorContext(
    {
      allowedRoles: [
        "PRINCIPAL",
        "DEPUTY_HEAD",
        "BURSAR",
        "ACADEMIC_ADMIN",
        "HR_ADMIN",
        "ICT_ADMIN",
        "DISCIPLINE_ADMIN",
        "GUIDANCE_OFFICE",
        "REGISTRAR",
        "SUPER_ADMIN",
      ],
      requireSchool: false,
      allowMetadataRoleFallback: true,
    },
    req,
  );
}

export async function requirePrincipalContext(req?: Request) {
  return requireActorContext(
    {
      allowedRoles: ["PRINCIPAL"],
      requireSchool: true,
    },
    req,
  );
}

/**
 * Head Teacher override gate — for operations that only the Head Teacher
 * can perform (e.g. unpublishing results, overriding discipline records).
 */
export async function requirePrincipalOverrideContext(req?: Request) {
  return requireActorContext(
    {
      allowedRoles: ["PRINCIPAL"],
      requireSchool: true,
    },
    req,
  );
}

export async function requireDeputyHeadContext(req?: Request) {
  return requireActorContext(
    {
      allowedRoles: ["DEPUTY_HEAD"],
      requireSchool: true,
    },
    req,
  );
}

export async function requireTeacherContext(req?: Request) {
  return requireActorContext(
    {
      allowedRoles: ["TEACHER"],
      requireSchool: true,
    },
    req,
  );
}

export async function requireStudentContext(req?: Request) {
  return requireActorContext(
    {
      allowedRoles: ["STUDENT"],
      requireSchool: true,
    },
    req,
  );
}

export async function requireParentContext(req?: Request) {
  return requireActorContext(
    {
      allowedRoles: ["PARENT"],
      requireSchool: true,
    },
    req,
  );
}

/**
 * Payments context for dedicated finance staff, plus PRINCIPAL/ADMIN so the
 * head teacher can oversee payments, fees, and summaries. Feature-level
 * permissions (requireFeatureAccess) still gate the actual read/write.
 */
export async function requirePaymentsContext(req?: Request) {
  return requireActorContext(
    {
      allowedRoles: ["PAYMENTS", "BURSAR", "PRINCIPAL"],
      requireSchool: true,
    },
    req,
  );
}

export async function requireBursarContext(req?: Request) {
  return requireActorContext(
    {
      allowedRoles: ["BURSAR"],
      requireSchool: true,
    },
    req,
  );
}

export async function requireSuperAdminContext(req?: Request) {
  return requireActorContext(
    {
      allowedRoles: ["SUPER_ADMIN"],
      requireSchool: false,
    },
    req,
  );
}

export async function requireGuidanceOfficeContext(req?: Request) {
  return requireActorContext(
    {
      allowedRoles: ["GUIDANCE_OFFICE"],
      requireSchool: true,
    },
    req,
  );
}

export async function requireICTAdminContext(req?: Request) {
  return requireActorContext(
    {
      allowedRoles: ["ICT_ADMIN"],
      requireSchool: true,
    },
    req,
  );
}

export async function requireSchoolStaffContext(req?: Request) {
  return requireActorContext(
    {
      allowedRoles: [
        "PRINCIPAL",
        "DEPUTY_HEAD",
        "BURSAR",
        "ACADEMIC_ADMIN",
        "HR_ADMIN",
        "ICT_ADMIN",
        "DISCIPLINE_ADMIN",
        "TEACHER",
        "PAYMENTS",
        "GUIDANCE_OFFICE",
      ],
      requireSchool: true,
    },
    req,
  );
}

export async function requireTeacherOrParentContext(req?: Request) {
  return requireActorContext(
    {
      allowedRoles: ["TEACHER", "PARENT"],
      requireSchool: true,
    },
    req,
  );
}

const FINANCIAL_ROLES: KnownRole[] = ["BURSAR", "PAYMENTS", "SUPER_ADMIN"];
const FINANCIAL_DELEGATED_READ_ROLES: KnownRole[] = ["PRINCIPAL"];
/** Single auth pass for chart/list reads — avoids double getUser for principals. */
const FINANCIAL_READ_ROLES: KnownRole[] = [
  ...FINANCIAL_ROLES,
  ...FINANCIAL_DELEGATED_READ_ROLES,
];

export async function requireFinancialContext(req?: Request) {
  return requireActorContext(
    {
      allowedRoles: FINANCIAL_ROLES,
      requireSchool: true,
    },
    req,
  );
}

/**
 * Financial read access for dedicated finance staff, plus PRINCIPAL when the
 * route also checks requireFeatureAccess (explicit permission grant).
 * Uses one auth pass (combined roles) so dashboard chart loads do not pay
 * double JWT/profile verification under request storms.
 */
export async function requireFinancialReadContext(req?: Request) {
  return requireActorContext(
    {
      allowedRoles: FINANCIAL_READ_ROLES,
      requireSchool: true,
    },
    req,
  );
}

/**
 * Write gate for finance mutations. Dedicated to BURSAR, but PRINCIPAL and
 * ADMIN are allowed so the head teacher can manage finance entries.
 * Feature-level permissions (requireFeatureAccess) still gate the actual write.
 */
export async function requireFinancialWriteContext(req?: Request) {
  return requireActorContext(
    {
      allowedRoles: ["BURSAR", "SUPER_ADMIN", "PRINCIPAL"],
      requireSchool: true,
    },
    req,
  );
}
