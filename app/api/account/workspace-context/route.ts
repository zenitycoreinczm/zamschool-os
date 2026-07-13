import { NextResponse } from "next/server";

import {
  applyPlatformRateLimit,
  platformRateLimitResponse,
} from "@/lib/platform-api-guard";
import { safeErrorMessage } from "@/lib/server-guards";
import { requireActorContext } from "@/lib/server-auth";
import { buildWorkspaceContextPayload } from "@/lib/workspace/context-server";
import { KNOWN_ROLES } from "@/lib/roles";

const WORKSPACE_ROLES = KNOWN_ROLES;


export async function GET(req: Request) {
  try {
    const access = await requireActorContext(
      {
        allowedRoles: [...WORKSPACE_ROLES],
        requireSchool: false,
        allowMetadataRoleFallback: true,
      },
      req,
    );
    if (!access.ok) return access.response;

    if (access.context.schoolId) {
      const rate = await applyPlatformRateLimit({
        scope: "account-workspace-context",
        schoolId: access.context.schoolId,
        req,
        userId: access.context.userId,
        preset: "workspaceContext",
      });
      if (!rate.allowed) return platformRateLimitResponse(rate);
    }

    const data = await buildWorkspaceContextPayload(access.context);

    const response = NextResponse.json({
      success: true,
      data,
    });

    const { applyEdgeCacheHeaders } = await import("@/lib/edge-cache");
    return applyEdgeCacheHeaders(response, "privateWorkspace");
  } catch (error: unknown) {
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to load workspace context") },
      { status: 500 },
    );
  }
}
