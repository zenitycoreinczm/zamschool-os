import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { normalizePublicBaseUrl } from "./r2-url.ts";

export { normalizePublicBaseUrl } from "./r2-url.ts";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  GetObjectCommand as GetPresignedCommand,
  PutObjectCommand as PutPresignedCommand,
} from "@aws-sdk/client-s3";

const R2_ENDPOINT = process.env.R2_ENDPOINT || "";
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID || "";
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY || "";
const R2_ASSETS_BUCKET = process.env.R2_ASSETS_BUCKET || "zamschool-assets";
const R2_UPLOADS_BUCKET = process.env.R2_UPLOADS_BUCKET || "zamschool-uploads";
const R2_PUBLIC_URL = (process.env.R2_PUBLIC_URL || "").trim();

const MISSING_ASSETS_PUBLIC_URL_MESSAGE =
  "R2_PUBLIC_URL is not configured and no app origin fallback is available. Set R2_PUBLIC_URL to your R2 public bucket URL (https://pub-<hash>.r2.dev), or set NEXT_PUBLIC_WEBAPP_ORIGIN for /api/public/assets proxy delivery.";

let client: S3Client | null = null;

function getClient(): S3Client {
  if (!client) {
    if (!R2_ENDPOINT || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
      throw new Error(
        "R2 credentials not configured. Set R2_ENDPOINT, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY.",
      );
    }
    client = new S3Client({
      region: "auto",
      endpoint: R2_ENDPOINT,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
      },
    });
  }
  return client;
}

function getBucketName(bucket: "assets" | "uploads"): string {
  return bucket === "uploads" ? R2_UPLOADS_BUCKET : R2_ASSETS_BUCKET;
}

export function buildKey(
  schoolId: string,
  entityType: string,
  userId: string,
  filename: string,
): string {
  const sanitized = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${schoolId}/${entityType}/${userId}/${Date.now()}-${sanitized}`;
}

/** Encodes each path segment of an object key for use in a public URL. */
export function encodeObjectKeyForUrl(key: string): string {
  const normalized = key.replace(/^\/+/, "");
  return normalized
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

/** App-origin proxy when R2_PUBLIC_URL is unset (relative URLs are not valid here). */
export function getAssetsProxyBaseUrl(): string | null {
  const origin = normalizePublicBaseUrl(
    process.env.R2_PUBLIC_FALLBACK_ORIGIN ||
      process.env.NEXT_PUBLIC_WEBAPP_ORIGIN ||
      process.env.NEXT_PUBLIC_APP_ORIGIN ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "") ||
      (process.env.NODE_ENV === "development" ? "http://localhost:3000" : ""),
  );
  return origin ? `${origin}/api/public/assets` : null;
}

/** Absolute public base for the assets bucket. Never uses R2_ENDPOINT. */
export function getAssetsPublicBaseUrl(): string {
  const r2Public = normalizePublicBaseUrl(R2_PUBLIC_URL);
  if (r2Public) {
    return r2Public;
  }

  const proxy = getAssetsProxyBaseUrl();
  if (proxy) {
    return proxy;
  }

  throw new Error(MISSING_ASSETS_PUBLIC_URL_MESSAGE);
}

/** Strips query string and hash from a URL (for normalizing stored avatar URLs). */
export function stripUrlQueryParams(url: string): string {
  const trimmed = String(url || "").trim();
  if (!trimmed) return trimmed;
  if (trimmed.startsWith("/")) {
    return trimmed.split("#")[0].split("?")[0];
  }
  try {
    const parsed = new URL(trimmed);
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return trimmed.split("#")[0].split("?")[0];
  }
}

/** Appends a cache-bust query param to a public asset URL (strips any existing query first). */
export function appendCacheBustQuery(
  url: string,
  updatedAt: number = Date.now(),
): string {
  const base = stripUrlQueryParams(url);
  return `${base}?updated=${updatedAt}`;
}

/**
 * Browser-loadable URL for objects on the public assets bucket.
 * Never returns the private S3 API endpoint (R2_ENDPOINT).
 */
export function getPublicUrl(
  key: string,
  bucket: "assets" | "uploads" = "assets",
): string {
  if (bucket !== "assets") {
    throw new Error(
      'Public URLs are not available for the uploads bucket. Use getPresignedDownloadUrl(key, "uploads") instead.',
    );
  }

  const encodedKey = encodeObjectKeyForUrl(key);
  const r2Public = normalizePublicBaseUrl(R2_PUBLIC_URL);

  if (r2Public) {
    return `${r2Public}/${encodedKey}`;
  }

  // Same-origin proxy - works with next/image without extra remotePatterns
  return `/api/public/assets/${encodedKey}`;
}

export async function uploadFile(
  key: string,
  body: Buffer | Uint8Array | string,
  options?: { bucket?: "assets" | "uploads"; contentType?: string },
): Promise<{ url?: string; key: string }> {
  const bucket = getBucketName(options?.bucket || "assets");
  await getClient().send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: options?.contentType,
    }),
  );
  const bucketType = options?.bucket || "assets";
  const url = bucketType === "assets" ? getPublicUrl(key, "assets") : undefined;
  return { url, key };
}

export async function deleteFile(
  key: string,
  bucket: "assets" | "uploads" = "assets",
): Promise<void> {
  await getClient().send(
    new DeleteObjectCommand({ Bucket: getBucketName(bucket), Key: key }),
  );
}

export async function getFileBuffer(
  key: string,
  bucket: "assets" | "uploads" = "assets",
): Promise<Buffer> {
  const response = await getClient().send(
    new GetObjectCommand({
      Bucket: getBucketName(bucket),
      Key: key,
    }),
  );
  return Buffer.from(await response.Body!.transformToByteArray());
}

export async function listFiles(
  prefix: string,
  bucket: "assets" | "uploads" = "assets",
): Promise<string[]> {
  const response = await getClient().send(
    new ListObjectsV2Command({
      Bucket: getBucketName(bucket),
      Prefix: prefix,
    }),
  );
  return (response.Contents || []).map((obj) => obj.Key!).filter(Boolean);
}

export async function getPresignedUploadUrl(
  key: string,
  contentType: string,
  bucket: "assets" | "uploads" = "uploads",
  expiresIn = 900,
): Promise<string> {
  const command = new PutPresignedCommand({
    Bucket: getBucketName(bucket),
    Key: key,
    ContentType: contentType,
  });
  return getSignedUrl(getClient(), command, { expiresIn });
}

export async function getPresignedDownloadUrl(
  key: string,
  bucket: "assets" | "uploads" = "uploads",
  expiresIn = 3600,
): Promise<string> {
  const command = new GetPresignedCommand({
    Bucket: getBucketName(bucket),
    Key: key,
  });
  return getSignedUrl(getClient(), command, { expiresIn });
}
