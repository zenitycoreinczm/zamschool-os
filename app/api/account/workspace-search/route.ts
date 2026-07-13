import { NextResponse } from "next/server";

import {
  applyPlatformRateLimit,
  platformRateLimitResponse,
} from "@/lib/platform-api-guard";
import { requireActorContext } from "@/lib/server-auth";
import { safeErrorMessage } from "@/lib/server-guards";
import { runWorkspaceSearch } from "@/lib/workspace/search-server";
import { sanitizeWorkspaceSearchQuery } from "@/lib/workspace/search";

const WORKSPACE_ROLES = [
  "PRINCIPAL",
  "TEACHER",
  "STUDENT",
  "PARENT",
  "PAYMENTS",
  "DEPUTY_HEAD",
  "BURSAR",
  "ACADEMIC_ADMIN",
  "HR_ADMIN",
  "ICT_ADMIN",
  "DISCIPLINE_ADMIN",
  "REGISTRAR",
  "GUIDANCE_OFFICE",
  "SUPER_ADMIN",
] as const;

export async function GET(req: Request) {
  try {
    const access = await requireActorContext(
      {
        allowedRoles: [...WORKSPACE_ROLES],
        requireSchool: true,
        allowMetadataRoleFallback: true,
      },
      req,
    );
    if (!access.ok) return access.response;

    const schoolId = access.context.schoolId;
    if (!schoolId) {
      return NextResponse.json(
        { error: "No school linked to this account" },
        { status: 403 },
      );
    }

    const rate = await applyPlatformRateLimit({
      scope: "account-workspace-search",
      schoolId,
      req,
      userId: access.context.userId,
      preset: "workspaceContext",
    });
    if (!rate.allowed) return platformRateLimitResponse(rate);

    const { searchParams } = new URL(req.url);
    const query = sanitizeWorkspaceSearchQuery(searchParams.get("q") || "");

    if (query.length < 2) {
      return NextResponse.json({ success: true, data: [] });
    }

    const data = await runWorkspaceSearch(access.context, query);

    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to run workspace search") },
      { status: 500 },
    );
  }
}
