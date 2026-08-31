import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { validateFileUpload } from "@/lib/image-optimization";
import { buildKey } from "@/lib/r2-client";
import {
  applyPlatformRateLimit,
  platformRateLimitResponse,
} from "@/lib/platform-api-guard";
import { requireActorContext } from "@/lib/server-auth";

/**
 * Shared upload authorization used by both /api/files/authorize-upload
 * (metadata pre-flight) and /api/files/upload (actual byte transfer).
 *
 * SECURITY (H-11): the upload route previously authorized itself via a
 * self-fetch to the authorize endpoint using req.url, which is
 * Host-header-sensitive and skipped re-validation on the real bytes.
 * Both routes now call this function directly.
 */

/** Profile pictures use POST /api/account/avatar (Supabase), not this route. */
export const ALLOWED_ENTITY_TYPES = [
  "assignment",
  "submission",
  "announcement",
  "receipt",
  "message",
  "document",
] as const;

export const authorizeUploadSchema = z.object({
  filename: z.string().trim().min(1).max(255),
  contentType: z.string().trim().min(1).max(150),
  size: z
    .number()
    .int()
    .positive()
    .max(5 * 1024 * 1024),
  entityType: z.enum(ALLOWED_ENTITY_TYPES),
});

export type AuthorizeUploadInput = z.infer<typeof authorizeUploadSchema>;

export type AuthorizeUploadResult =
  | { ok: true; key: string }
  | { ok: false; response: NextResponse };

/**
 * Authenticate the caller, enforce rate limits, validate upload metadata,
 * and mint a tenant-scoped storage key. Deterministic: the same
 * (school, entityType, user, filename) always maps to the same decision
 * path so the standalone authorize route and the upload route cannot
 * disagree about what is allowed.
 */
export async function authorizeUploadRequest(
  req: NextRequest,
  payload: AuthorizeUploadInput,
): Promise<AuthorizeUploadResult> {
  const access = await requireActorContext(
    {
      allowedRoles: ["TEACHER", "STUDENT", "PARENT", "PAYMENTS"],
      requireSchool: true,
    },
    req,
  );
  if (!access.ok) return { ok: false, response: access.response };

  const schoolId = access.context.schoolId;
  if (!schoolId) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "School access is required" },
        { status: 403 },
      ),
    };
  }

  const rate = await applyPlatformRateLimit({
    scope: "upload-authorize",
    schoolId,
    req,
    userId: access.context.userId,
    preset: "uploadAuthorize",
  });
  if (!rate.allowed) {
    return { ok: false, response: platformRateLimitResponse(rate) };
  }

  const validation = validateFileUpload({
    name: payload.filename,
    type: payload.contentType,
    size: payload.size,
  });

  if (!validation.valid) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: validation.error || "Invalid file" },
        { status: 400 },
      ),
    };
  }

  const key = buildKey(
    schoolId,
    payload.entityType,
    access.context.userId,
    payload.filename,
  );

  return { ok: true, key };
}
