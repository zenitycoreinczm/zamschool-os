/**
 * Client-side file upload helper.
 *
 * Strategy (see docs/ARCHITECTURE.md → "What runs where"):
 *   1. When `NEXT_PUBLIC_GATEWAY_URL` is set, POST the FormData to the Worker's
 *      native /api/upload route. The Worker authorizes via Next.js (validates
 *      key, rate-limits, derives the storage key) and PUTs the byte stream
 *      directly into R2 - Vercel function bandwidth is never touched.
 *   2. When the gateway isn't configured, POST to /api/files/upload on Vercel
 *      (legacy fallback, slower, and slated for eventual removal once the
 *      gateway path is universal).
 *
 * Callers only need to construct their FormData with `file` and `entityType`;
 * no other changes required.
 */
import {
  isGatewayConfigured,
  uploadViaGateway,
} from "@/lib/gateway-read-client";
import { fetchWithOfflineSupport } from "@/lib/offline-fetch";

export type UploadEntityType =
  | "assignment"
  | "submission"
  | "announcement"
  | "receipt"
  | "message"
  | "document";

export type UploadResult = {
  key: string;
  bucket: "uploads" | "assets";
  url?: string | null;
};

export class UploadError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "UploadError";
  }
}

async function parseUploadError(response: Response): Promise<string> {
  let body: { error?: string } | null = null;
  try {
    body = (await response.json()) as { error?: string };
  } catch {
    body = null;
  }
  return (
    body?.error || response.statusText || `Upload failed (${response.status})`
  );
}

export async function uploadFile(formData: FormData): Promise<UploadResult> {
  // Branch on whether the gateway is configured - keeps the file bytes OFF
  // Vercel's function bandwidth whenever the Worker is in front.
  if (isGatewayConfigured()) {
    try {
      const response = await uploadViaGateway(formData);
      if (!response.ok) {
        throw new UploadError(
          await parseUploadError(response),
          response.status,
        );
      }
      const body = (await response.json()) as {
        key?: string;
        bucket?: "uploads" | "assets";
        url?: string | null;
      };
      if (!body.key) {
        throw new UploadError("Upload response missing key", 502);
      }
      return {
        key: body.key,
        bucket: body.bucket === "assets" ? "assets" : "uploads",
        url: body.url ?? null,
      };
    } catch (err) {
      if (err instanceof UploadError) throw err;
      // Network error talking to the Worker - let the caller retry; we
      // intentionally do NOT auto-fall-back to /api/files/upload here
      // because the Vercel route is exactly the bottleneck we're avoiding.
      throw new UploadError(
        err instanceof Error ? err.message : "Upload failed",
        0,
      );
    }
  }

  // Legacy Vercel-mediated upload fallback - only used when the gateway URL
  // is unset. Keep callers migrating toward the Worker path rather than adding
  // new dependencies on this route.
  const response = await fetchWithOfflineSupport("/api/files/upload", {
    method: "POST",
    body: formData,
    credentials: "same-origin",
  });
  if (!response.ok) {
    throw new UploadError(await parseUploadError(response), response.status);
  }
  return (await response.json()) as UploadResult;
}

export function buildUploadFormData(file: File, entityType: UploadEntityType) {
  const form = new FormData();
  form.append("file", file);
  form.append("entityType", entityType);
  return form;
}
