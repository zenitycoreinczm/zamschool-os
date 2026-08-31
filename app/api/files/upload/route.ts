import { NextRequest, NextResponse } from "next/server";

import { validateBufferMagicBytes } from "@/lib/image-optimization";
import { uploadFile } from "@/lib/r2-client";
import { safeErrorMessage } from "@/lib/server-guards";
import {
  authorizeUploadRequest,
  authorizeUploadSchema,
} from "@/lib/upload-authorization";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");
    const entityType = String(formData.get("entityType") || "").trim();

    if (!(file instanceof File) || !entityType) {
      return NextResponse.json(
        { error: "Invalid request. Provide a file and a valid entityType." },
        { status: 400 },
      );
    }

    // SECURITY (H-11): authorize inline instead of self-fetching the
    // authorize endpoint. The request object is used directly, so no
    // Host-header reinterpretation is possible, and the tenant-scoped key
    // is minted by the same shared code path.
    const payload = authorizeUploadSchema.parse({
      filename: file.name,
      contentType: file.type || "application/octet-stream",
      size: file.size,
      entityType,
    });

    const authorization = await authorizeUploadRequest(req, payload);
    if (!authorization.ok) return authorization.response;
    const key = authorization.key;

    const buffer = Buffer.from(await file.arrayBuffer());

    // SECURITY (H-02): re-validate the actual bytes. The declared
    // Content-Type is client-controlled; magic bytes must corroborate it.
    const magic = validateBufferMagicBytes(buffer, file.type || "application/octet-stream");
    if (!magic.valid) {
      return NextResponse.json(
        { error: magic.error || "File contents failed validation." },
        { status: 400 },
      );
    }

    // SECURITY: uploadFile derives the stored ContentType from the key's
    // extension allow-list and forces Content-Disposition: attachment on
    // the uploads bucket - never trust the client-declared type.
    const result = await uploadFile(key, buffer, {
      bucket: "uploads",
    });

    return NextResponse.json({
      bucket: "uploads" as const,
      key: result.key,
      url: result.url || null,
      size: file.size,
      mimeType: file.type,
      originalName: file.name,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to upload file") },
      { status: 500 },
    );
  }
}
