import { NextResponse } from "next/server";

import { applyEdgeCacheHeaders } from "@/lib/edge-cache";
import {
  applyPlatformRateLimit,
  platformRateLimitResponse,
} from "@/lib/platform-api-guard";
import { requireActorContext } from "@/lib/server-auth";
import { safeErrorMessage } from "@/lib/server-guards";
import { KNOWN_ROLES } from "@/lib/roles";
import { buildWorkspaceContextPayload } from "@/lib/workspace/context-server";
import { buildWorkspaceSummary } from "@/lib/workspace/summary";
import type { KnownRole } from "@/lib/roles";

/**
 * Single cold-load endpoint: workspace shell fields + optional workspace metrics.
 * Cuts parallel /workspace-context + /workspace/summary + early unread fan-out.
 */
export async function GET(req: Request) {
  try {
    const access = await requireActorContext(
      {
        allowedRoles: [...KNOWN_ROLES],
        requireSchool: false,
        allowMetadataRoleFallback: true,
      },
      req,
    );
    if (!access.ok) return access.response;

    const { userId, schoolId, role } = access.context;

    const rate = await applyPlatformRateLimit({
      scope: "account-bootstrap",
      schoolId: schoolId ?? "platform",
      req,
      userId,
      preset: "workspaceContext",
    });
    if (!rate.allowed) return platformRateLimitResponse(rate);

    const url = new URL(req.url);
    const includeSummary = url.searchParams.get("summary") !== "0";
    const canSummarize =
      includeSummary &&
      Boolean(schoolId) &&
      role !== "SUPER_ADMIN";

    const workspacePromise = buildWorkspaceContextPayload(access.context);
    const summaryPromise = canSummarize
      ? buildWorkspaceSummary({
          schoolId: schoolId as string,
          role: role as KnownRole,
          userId,
        }).catch(() => null)
      : Promise.resolve(null);

    const [workspace, summary] = await Promise.all([
      workspacePromise,
      summaryPromise,
    ]);

    return applyEdgeCacheHeaders(
      NextResponse.json({
        success: true,
        data: {
          workspace,
          summary,
        },
      }),
      "privateWorkspace",
    );
  } catch (error: unknown) {
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to bootstrap workspace") },
      { status: 500 },
    );
  }
}
