import { NextRequest, NextResponse } from "next/server";

import { requireFeatureAccess } from "@/lib/feature-permissions";
import { requireActorContext } from "@/lib/server-auth";
import { safeErrorMessage } from "@/lib/server-guards";
import { deleteFile } from "@/lib/r2-client";

export async function POST(req: NextRequest) {
  try {
    const access = await requireActorContext(
      { allowedRoles: ["TEACHER", "PAYMENTS"], requireSchool: true },
      req,
    );
    if (!access.ok) return access.response;
    const perm = await requireFeatureAccess(access.context, "files", "delete");
    if (!perm.ok) return perm.response;

    const { key, bucket } = await req.json();

    if (!key || typeof key !== "string") {
      return NextResponse.json(
        { error: "File key is required" },
        { status: 400 },
      );
    }

    if (bucket !== "uploads") {
      return NextResponse.json(
        { error: "Only private uploads can be deleted through this route" },
        { status: 400 },
      );
    }

    const normalizedKey = key.trim().replace(/^\/+/, "");
    if (
      !normalizedKey ||
      normalizedKey.includes("..") ||
      !normalizedKey.startsWith(`${access.context.schoolId}/`)
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await deleteFile(normalizedKey, "uploads");

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to delete file") },
      { status: 500 },
    );
  }
}
