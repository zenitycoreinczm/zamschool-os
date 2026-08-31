import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";

import { safeErrorMessage } from "@/lib/server-guards";
import {
  authorizeUploadRequest,
  authorizeUploadSchema,
} from "@/lib/upload-authorization";

export async function POST(req: NextRequest) {
  try {
    const payload = authorizeUploadSchema.parse(await req.json());

    const authorization = await authorizeUploadRequest(req, payload);
    if (!authorization.ok) return authorization.response;

    return NextResponse.json({
      bucket: "uploads",
      key: authorization.key,
    });
  } catch (error: unknown) {
    if (error instanceof ZodError) {
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
