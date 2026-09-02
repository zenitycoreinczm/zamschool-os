import { supabaseAdmin } from "@/lib/supabase";
import { fetchProfileByIdentity } from "@/lib/profile-lookup";
import { normalizeRole } from "@/lib/roles";

export type AccessCodeRow = {
  code: string;
  expires_at: string;
  used_at: string | null;
  max_uses: number | null;
  use_count: number | null;
  province: string | null;
  district: string | null;
  school_type: string | null;
  ownership_type: string | null;
  approval_status: string | null;
  created_by: string | null;
};

export type AccessCodeScope = {
  province: string | null;
  district: string | null;
  schoolType: string | null;
  ownershipType: string | null;
};

export type AccessCodeValidationResult =
  | { ok: true; row: AccessCodeRow; scope: AccessCodeScope }
  | { ok: false; status: 400 | 403 | 500; error: string };

const ACCESS_CODE_SELECT =
  "code, expires_at, used_at, max_uses, use_count, province, district, school_type, ownership_type, approval_status, created_by";

/**
 * Single generic failure message for every pre-auth access-code rejection.
 * Distinct messages ("already used", "expired", ...) would let a prober
 * enumerate valid-but-dead codes; all 400s must be indistinguishable.
 */
export const ACCESS_CODE_GENERIC_ERROR =
  "Access code could not be verified. Please check it and try again.";

export function matchesCodeScope(
  expected: string | null | undefined,
  actual: string | null | undefined
) {
  const expectedValue = String(expected || "").trim().toLowerCase();
  if (!expectedValue) return true;
  return expectedValue === String(actual || "").trim().toLowerCase();
}

export function accessCodeScopeFromRow(row: AccessCodeRow): AccessCodeScope {
  return {
    province: row.province || null,
    district: row.district || null,
    schoolType: row.school_type || null,
    ownershipType: row.ownership_type || null,
  };
}

function isCodeExhausted(row: AccessCodeRow) {
  const maxUses = Number(row.max_uses || 1);
  const useCount = Number(row.use_count || 0);
  return Boolean(row.used_at) || useCount >= maxUses;
}

function isCodeExpired(row: AccessCodeRow, now = new Date()) {
  return now > new Date(row.expires_at);
}

async function isSuperAdminIssuer(createdBy: string | null): Promise<boolean> {
  if (!createdBy) return false;

  const { data: creatorProfile } = await fetchProfileByIdentity<{
    role?: string | null;
  }>(supabaseAdmin as any, createdBy, "role");

  return normalizeRole(creatorProfile?.role) === "SUPER_ADMIN";
}

export async function fetchAccessCodeByValue(
  code: string
): Promise<{ row: AccessCodeRow | null; dbError: boolean }> {
  const { data, error } = await supabaseAdmin
    .from("access_codes")
    .select(ACCESS_CODE_SELECT)
    .eq("code", code)
    .maybeSingle();

  if (error) {
    console.error("[access-code] DB error:", error);
    return { row: null, dbError: true };
  }

  return { row: (data as AccessCodeRow | null) ?? null, dbError: false };
}

export async function validateSchoolAccessCode(
  code: string,
  options?: {
    schoolDetails?: {
      province?: string | null;
      district?: string | null;
      schoolType?: string | null;
      ownershipType?: string | null;
    };
  }
): Promise<AccessCodeValidationResult> {
  const { row, dbError } = await fetchAccessCodeByValue(code);

  if (dbError) {
    return {
      ok: false,
      status: 500,
      error: "Could not verify access code. Please try again.",
    };
  }

  if (!row || !(await isSuperAdminIssuer(row.created_by))) {
    return { ok: false, status: 400, error: ACCESS_CODE_GENERIC_ERROR };
  }

  if (isCodeExhausted(row)) {
    return { ok: false, status: 400, error: ACCESS_CODE_GENERIC_ERROR };
  }

  if (row.approval_status && row.approval_status !== "approved") {
    return { ok: false, status: 400, error: ACCESS_CODE_GENERIC_ERROR };
  }

  if (isCodeExpired(row)) {
    return { ok: false, status: 400, error: ACCESS_CODE_GENERIC_ERROR };
  }

  if (!accessCodeScopeMatches(row, options?.schoolDetails)) {
    return { ok: false, status: 400, error: ACCESS_CODE_GENERIC_ERROR };
  }

  return { ok: true, row, scope: accessCodeScopeFromRow(row) };
}

export type AccessCodeClaim = {
  priorUseCount: number;
  priorUsedAt: string | null;
};

export type AccessCodeClaimResult =
  | {
      ok: true;
      row: AccessCodeRow;
      scope: AccessCodeScope;
      claim: AccessCodeClaim;
    }
  | { ok: false; status: 400 | 500; error: string };

function accessCodeScopeMatches(
  row: AccessCodeRow,
  details?: {
    province?: string | null;
    district?: string | null;
    schoolType?: string | null;
    ownershipType?: string | null;
  }
): boolean {
  if (!details) return true;
  return (
    matchesCodeScope(row.province, details.province) &&
    matchesCodeScope(row.district, details.district) &&
    matchesCodeScope(row.school_type, details.schoolType) &&
    matchesCodeScope(row.ownership_type, details.ownershipType)
  );
}

/**
 * Atomically claim an access code for use (pre-auth school registration).
 *
 * Runs the same checks as validateSchoolAccessCode, then performs a
 * compare-and-swap increment (`use_count` guarded by its current value,
 * `used_at` null, `use_count < max_uses`). Two concurrent requests with the
 * same single-use code cannot both win: PostgREST re-evaluates the WHERE
 * guard against the committed row, so only one update matches.
 *
 * Callers must create the school only after a successful claim and call
 * releaseAccessCodeClaim() if creation subsequently fails.
 */
export async function claimAccessCode(
  code: string,
  options?: {
    claimerEmail?: string;
    schoolDetails?: {
      province?: string | null;
      district?: string | null;
      schoolType?: string | null;
      ownershipType?: string | null;
    };
  }
): Promise<AccessCodeClaimResult> {
  const { row, dbError } = await fetchAccessCodeByValue(code);

  if (dbError) {
    return { ok: false, status: 500, error: ACCESS_CODE_GENERIC_ERROR };
  }

  if (!row || !(await isSuperAdminIssuer(row.created_by))) {
    return { ok: false, status: 400, error: ACCESS_CODE_GENERIC_ERROR };
  }

  if (row.approval_status && row.approval_status !== "approved") {
    return { ok: false, status: 400, error: ACCESS_CODE_GENERIC_ERROR };
  }

  if (isCodeExpired(row)) {
    return { ok: false, status: 400, error: ACCESS_CODE_GENERIC_ERROR };
  }

  if (!accessCodeScopeMatches(row, options?.schoolDetails)) {
    return { ok: false, status: 400, error: ACCESS_CODE_GENERIC_ERROR };
  }

  // Compare-and-swap loop: guards make the increment atomic. On a lost race
  // (0 rows matched) re-read and retry; never write a count derived from a
  // stale read without the matching guard.
  const maxAttempts = 3;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const current =
      attempt === 0 ? row : (await fetchAccessCodeByValue(code)).row;

    if (!current || isCodeExhausted(current) || isCodeExpired(current)) {
      return { ok: false, status: 400, error: ACCESS_CODE_GENERIC_ERROR };
    }

    const maxUses = Number(current.max_uses || 1);
    const priorUseCount = Number(current.use_count || 0);
    const nextCount = priorUseCount + 1;
    const closeCode = nextCount >= maxUses;

    const { count, error } = await supabaseAdmin
      .from("access_codes")
      .update(
        {
          use_count: nextCount,
          used_at: closeCode ? new Date().toISOString() : null,
          used_by_email: options?.claimerEmail || null,
        },
        { count: "exact" },
      )
      .eq("code", code)
      .is("used_at", null)
      .eq("use_count", priorUseCount)
      .lt("use_count", maxUses);

    if (error) {
      console.error("[access-code] claim update error:", error);
      return { ok: false, status: 500, error: ACCESS_CODE_GENERIC_ERROR };
    }

    if (count === 1) {
      return {
        ok: true,
        row: current,
        scope: accessCodeScopeFromRow(current),
        claim: { priorUseCount, priorUsedAt: current.used_at },
      };
    }
  }

  return { ok: false, status: 400, error: ACCESS_CODE_GENERIC_ERROR };
}

/**
 * Best-effort rollback for a claim whose registration subsequently failed.
 * CAS-guarded on the post-claim count so it only reverts our own claim;
 * if it loses that race or errors, the code stays consumed (fail-closed).
 */
export async function releaseAccessCodeClaim(
  code: string,
  claim: AccessCodeClaim
): Promise<void> {
  try {
    await supabaseAdmin
      .from("access_codes")
      .update({
        use_count: claim.priorUseCount,
        used_at: claim.priorUsedAt,
      })
      .eq("code", code)
      .eq("use_count", claim.priorUseCount + 1);
  } catch (err) {
    console.error(
      "[access-code] claim release failed (code stays consumed):",
      err,
    );
  }
}
