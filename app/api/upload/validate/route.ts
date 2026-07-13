import { NextResponse } from "next/server";
import {
  validateFileUpload,
  optimizeImage,
  generateOptimizedFilename,
} from "@/lib/image-optimization";
import {
  applyPlatformRateLimit,
  platformRateLimitResponse,
} from "@/lib/platform-api-guard";
import { requireActorContext } from "@/lib/server-auth";
import { supabaseAdmin } from "@/lib/supabase";

const MAX_UPLOADS_PER_HOUR = 50;
/** Profile pictures: POST /api/account/avatar (Supabase). This route is for other uploads only. */
const ALLOWED_UPLOAD_TYPES = new Set(["general", "document"]);

/**
 * Validate and process file upload
 * POST /api/upload/validate
 */
export async function POST(req: Request) {
  try {
    const access = await requireActorContext(
      {
        allowedRoles: ["TEACHER", "STUDENT", "PARENT"],
        requireSchool: true,
      },
      req,
    );
    if (!access.ok) return access.response;

    const rate = await applyPlatformRateLimit({
      scope: "upload-validate",
      schoolId: access.context.schoolId ?? "",
      req,
      userId: access.context.userId,
      preset: "uploadValidate",
    });
    if (!rate.allowed) return platformRateLimitResponse(rate);

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const type = normalizeUploadType(formData.get("type"));

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!ALLOWED_UPLOAD_TYPES.has(type)) {
      return NextResponse.json(
        { error: "Unsupported upload type" },
        { status: 400 },
      );
    }

    // Validate file
    const validation = validateFileUpload({
      name: file.name,
      type: file.type,
      size: file.size,
    });

    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    // Convert to buffer
    const buffer: Buffer<ArrayBufferLike> = Buffer.from(
      await file.arrayBuffer(),
    );

    let processedBuffer: Buffer<ArrayBufferLike> = buffer;
    let metadata = { size: buffer.length, format: file.type };
    let optimizedFilename = buildScopedFilename(file.name);

    // Optimize images
    if (file.type.startsWith("image/")) {
      const optimization = await optimizeImage(buffer, {
        maxWidth: 1200,
        maxHeight: 1200,
        quality: 80,
        maxSizeKB: 200,
      });

      processedBuffer = optimization.buffer;
      metadata = optimization.metadata;
      optimizedFilename = generateOptimizedFilename(file.name);
    }

    // Generate upload URL (presigned)
    const bucket = "uploads";
    const path = `${access.context.schoolId}/${access.context.userId}/${type}/${optimizedFilename}`;

    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from(bucket)
      .createSignedUploadUrl(path);

    if (uploadError) {
      throw uploadError;
    }

    return NextResponse.json({
      valid: true,
      uploadUrl: uploadData?.signedUrl,
      path,
      bucket,
      filename: optimizedFilename,
      originalSize: file.size,
      optimizedSize: processedBuffer.length,
      compressionRatio: Math.round(
        (1 - processedBuffer.length / file.size) * 100,
      ),
      metadata,
      maxFileSize: file.type.startsWith("image/")
        ? 2 * 1024 * 1024
        : 5 * 1024 * 1024,
    });
  } catch (error: unknown) {
    console.error("[Upload] Error:", error);
    return NextResponse.json(
      { error: "Failed to process upload" },
      { status: 500 },
    );
  }
}

/**
 * Get upload policy and limits
 * GET /api/upload/validate
 */
export async function GET(req: Request) {
  try {
    const access = await requireActorContext(
      {
        allowedRoles: ["TEACHER", "STUDENT", "PARENT"],
        requireSchool: true,
      },
      req,
    );
    if (!access.ok) return access.response;

    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type") || "general";

    const policies = {
      general: {
        maxSize: 5 * 1024 * 1024,
        optimizedMaxSize: 200 * 1024,
        allowedTypes: [
          "image/jpeg",
          "image/png",
          "image/webp",
          "application/pdf",
        ],
        format: "webp",
      },
      document: {
        maxSize: 1 * 1024 * 1024,
        optimizedMaxSize: 500 * 1024,
        allowedTypes: ["application/pdf"],
      },
    };

    return NextResponse.json({
      policy: policies[type as keyof typeof policies] || policies.general,
      blockedTypes: ["video/", "audio/", "application/x-msvideo"],
      maxUploadsPerHour: MAX_UPLOADS_PER_HOUR,
    });
  } catch (error: unknown) {
    console.error("[Upload] GET Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch upload policy" },
      { status: 500 },
    );
  }
}

function normalizeUploadType(value: FormDataEntryValue | null) {
  return (
    String(value || "general")
      .trim()
      .toLowerCase() || "general"
  );
}

function buildScopedFilename(originalName: string) {
  const extension =
    String(originalName || "")
      .split(".")
      .pop()
      ?.toLowerCase()
      .replace(/[^a-z0-9]/g, "") || "bin";

  return `${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${extension}`;
}
