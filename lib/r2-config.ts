import { normalizePublicBaseUrl } from "./r2-url";

const R2_ENDPOINT_HOST_PATTERN = /\.r2\.cloudflarestorage\.com$/i;
const R2_PUBLIC_DEV_HOST_PATTERN = /^pub-[a-z0-9]+\.r2\.dev$/i;

export function getConfiguredR2PublicUrl(): string {
  return normalizePublicBaseUrl(process.env.R2_PUBLIC_URL || "");
}

export function getConfiguredClientR2PublicUrl(): string {
  return normalizePublicBaseUrl(process.env.NEXT_PUBLIC_R2_PUBLIC_URL || "");
}

/** True when browser should load assets from R2/CDN, not the app proxy. */
export function isR2CdnConfigured(): boolean {
  return Boolean(getConfiguredR2PublicUrl());
}

/** Dev/local fallback only - production should set R2_PUBLIC_URL. */
export function shouldUseAssetsAppProxy(): boolean {
  return !isR2CdnConfigured();
}

export function isValidR2PublicBaseUrl(url: string): boolean {
  const base = normalizePublicBaseUrl(url);
  if (!base) return false;

  try {
    const parsed = new URL(base);
    if (parsed.protocol !== "https:") return false;
    if (R2_ENDPOINT_HOST_PATTERN.test(parsed.hostname)) return false;
    if (R2_PUBLIC_DEV_HOST_PATTERN.test(parsed.hostname)) {
      return true;
    }
    if (R2_ENDPOINT_HOST_PATTERN.test(parsed.hostname)) {
      return false;
    }
    return parsed.hostname.includes(".");
  } catch {
    return false;
  }
}

export type R2ConfigValidation = {
  ok: boolean;
  issues: string[];
  deliveryMode: "cdn" | "proxy" | "unconfigured";
};

export function validateR2CdnConfig(): R2ConfigValidation {
  const issues: string[] = [];
  const server = getConfiguredR2PublicUrl();
  const client = getConfiguredClientR2PublicUrl();

  if (!server && !client) {
    return { ok: true, issues: [], deliveryMode: "proxy" };
  }

  if (server && !isValidR2PublicBaseUrl(server)) {
    issues.push(
      "R2_PUBLIC_URL must be an https public bucket URL (e.g. https://pub-xxxx.r2.dev), not R2_ENDPOINT."
    );
  }

  if (client && !isValidR2PublicBaseUrl(client)) {
    issues.push("NEXT_PUBLIC_R2_PUBLIC_URL must match your public R2 bucket URL format.");
  }

  if (server && client && server !== client) {
    issues.push("R2_PUBLIC_URL and NEXT_PUBLIC_R2_PUBLIC_URL must be identical (no trailing slash).");
  }

  if (server && !client) {
    issues.push("Set NEXT_PUBLIC_R2_PUBLIC_URL to the same value as R2_PUBLIC_URL for next/image.");
  }

  if (!server && client) {
    issues.push("Set R2_PUBLIC_URL (server) to match NEXT_PUBLIC_R2_PUBLIC_URL.");
  }

  const deliveryMode: R2ConfigValidation["deliveryMode"] = server ? "cdn" : client ? "cdn" : "proxy";

  return {
    ok: issues.length === 0,
    issues,
    deliveryMode: server ? "cdn" : issues.length ? "unconfigured" : "proxy",
  };
}

/** Safe object-key pattern for public assets (school-scoped paths). */
export function isAllowedPublicAssetKey(key: string): boolean {
  const normalized = String(key || "").replace(/^\/+/, "").trim();
  if (!normalized || normalized.includes("..")) return false;
  if (normalized.length > 512) return false;
  return /^[a-zA-Z0-9][a-zA-Z0-9/_-]*\.[a-zA-Z0-9]{2,8}$/.test(normalized);
}