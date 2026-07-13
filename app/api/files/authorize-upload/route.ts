import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { validateFileUpload } from "@/lib/image-optimization";
import { buildKey } from "@/lib/r2-client";
import {
  applyPlatformRateLimit,
  platformRateLimitResponse,
} from "@/lib/platform-api-guard";
import { requireActorContext } from "@/lib/server-auth";
import { safeErrorMessage } from "@/lib/server-guards";

/** Profile pictures use POST /api/account/avatar (Supabase), not this route. */
const ALLOWED_ENTITY_TYPES = [
  "assignment",
  "submission",
  "announcement",
  "receipt",
  "message",
  "document",
] as const;

const authorizeUploadSchema = z.object({
  filename: z.string().trim().min(1).max(255),
  contentType: z.string().trim().min(1).max(150),
  size: z
    .number()
    .int()
    .positive()
    .max(5 * 1024 * 1024),
  entityType: z.enum(ALLOWED_ENTITY_TYPES),
});

export async function POST(req: NextRequest) {
  try {
    const access = await requireActorContext(
      {
        allowedRoles: ["TEACHER", "STUDENT", "PARENT", "PAYMENTS"],
        requireSchool: true,
      },
      req,
    );
    if (!access.ok) return access.response;

    const schoolId = access.context.schoolId;
    if (!schoolId) {
      return NextResponse.json(
        { error: "School access is required" },
        { status: 403 },
      );
    }

    const rate = await applyPlatformRateLimit({
      scope: "upload-authorize",
      schoolId,
      req,
      userId: access.context.userId,
      preset: "uploadAuthorize",
    });
    if (!rate.allowed) return platformRateLimitResponse(rate);

    const payload = authorizeUploadSchema.parse(await req.json());
    const validation = validateFileUpload({
      name: payload.filename,
      type: payload.contentType,
      size: payload.size,
    });

    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error || "Invalid file" },
        { status: 400 },
      );
    }

    const key = buildKey(
      schoolId,
      payload.entityType,
      access.context.userId,
      payload.filename,
    );

    return NextResponse.json({
      bucket: "uploads",
      key,
    });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: `Invalid upload metadata: ${error.issues.map((issue) => issue.message).join(", ")}`,
        },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to authorize upload") },
      { status: 500 },
    );
  }
}
