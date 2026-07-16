/**
 * Edge-safe (middleware) helpers - no Node-only APIs.
 * Mirrors the critical checks from server-security-policy for the request edge.
 */

const DISALLOWED_METHODS = new Set(["TRACE", "TRACK"]);

const MAX_API_BODY_BYTES = 1_048_576;
const MAX_UPLOAD_BODY_BYTES = 25 * 1_048_576;

export function isProductionEdgeMode(): boolean {
  return (
    process.env.NODE_ENV === "production" ||
    process.env.VERCEL_ENV === "production" ||
    process.env.ZAMSCHOOL_DC_MODE === "true"
  );
}

function parseHost(raw: string | null | undefined): string {
  return String(raw || "")
    .trim()
    .toLowerCase()
    .split(",")[0]
    ?.trim()
    .replace(/^https?:\/\//, "")
    .split("/")[0]
    ?.split(":")[0] || "";
}

export function collectEdgeAllowedHosts(): string[] {
  const hosts = new Set<string>();
  const add = (value: string | undefined) => {
    if (!value) return;
    for (const part of value.split(",")) {
      const h = parseHost(part);
      if (h) hosts.add(h);
    }
  };

  add(process.env.ALLOWED_HOSTS);
  add(process.env.NEXT_PUBLIC_APP_ORIGIN);
  add(process.env.NEXT_PUBLIC_WEBAPP_ORIGIN);
  add(process.env.NEXT_PUBLIC_APP_URL);
  add(process.env.NEXT_PUBLIC_WEB_ORIGIN);
  add(process.env.VERCEL_URL);

  hosts.add("localhost");
  hosts.add("127.0.0.1");
  hosts.add("0.0.0.0");

  return [...hosts];
}

export function isAllowedEdgeHost(hostHeader: string | null): boolean {
  const host = parseHost(hostHeader);
  if (!host) return !isProductionEdgeMode();

  const allowed = collectEdgeAllowedHosts();
  if (!isProductionEdgeMode() && allowed.every((h) =>
    ["localhost", "127.0.0.1", "0.0.0.0"].includes(h) || !h
  )) {
    return true;
  }
  // Dev: if no public hosts configured, allow any host
  if (!isProductionEdgeMode()) {
    const publicHosts = allowed.filter(
      (h) => !["localhost", "127.0.0.1", "0.0.0.0"].includes(h),
    );
    if (publicHosts.length === 0) return true;
  }

  if (allowed.includes(host)) return true;
  if (
    process.env.ALLOW_VERCEL_PREVIEW_HOSTS === "true" &&
    host.endsWith(".vercel.app")
  ) {
    return true;
  }
  return false;
}

export function isDisallowedEdgeMethod(method: string): boolean {
  return DISALLOWED_METHODS.has(String(method || "").toUpperCase());
}

export function isEdgeContentLengthAllowed(
  contentLength: string | null,
  pathname: string,
): boolean {
  if (!contentLength) return true;
  const n = Number(contentLength);
  if (!Number.isFinite(n) || n < 0) return false;
  const path = pathname.split("?")[0] || pathname;
  const max =
    path.startsWith("/api/files/") ||
    path.startsWith("/api/upload/") ||
    path.includes("/avatar") ||
    path.includes("/import")
      ? MAX_UPLOAD_BODY_BYTES
      : MAX_API_BODY_BYTES;
  return n <= max;
}

export function isOnStaticIpBlocklist(ip: string): boolean {
  const list = String(process.env.SECURITY_BLOCKED_IPS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (!list.length) return false;
  return list.includes(String(ip || "").trim());
}
