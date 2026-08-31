import { getConfiguredClientR2PublicUrl, getConfiguredR2PublicUrl } from "./r2-config";

export type CspBuildInput = {
  isProduction: boolean;
  shouldUpgradeInsecureRequests: boolean;
  supabaseOrigin?: string | null;
  /**
   * Controls the `frame-ancestors` directive.
   * - "none" (default): no embedding at all - for API responses, app workspaces,
   *   auth mutations, and any private surface. Blocks clickjacking completely.
   * - "selfplus": allows self + the canonical production origins + Vercel
   *   preview URLs. Used on public marketing/entry pages so iframe-based
   *   viewport emulators, link-preview embeds, and DevTools device-mode
   *   sandbox profiles can still load the document.
   */
  frameAncestors?: "none" | "selfplus";
};

function parseOrigin(value: string | undefined): string | null {
  const trimmed = String(value || "").trim();
  if (!trimmed) return null;
  try {
    return new URL(trimmed).origin;
  } catch {
    return null;
  }
}

function unique(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

export function resolveSupabaseConnectOrigin(): string | null {
  return parseOrigin(process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL);
}

export function buildContentSecurityPolicy(input: CspBuildInput): string {
  const scriptSrc = ["'self'", "'unsafe-inline'"].concat(
    input.isProduction ? [] : ["'unsafe-eval'"],
  );

  const styleSrc = ["'self'", "'unsafe-inline'"];

  const supabaseOrigin = input.supabaseOrigin ?? resolveSupabaseConnectOrigin();

  // Explicit allow-list of external origins the app may load from.
  // Derived from env vars so production only permits the configured backends.
  const externalHosts = unique([
    parseOrigin(getConfiguredR2PublicUrl()) ?? undefined,
    parseOrigin(getConfiguredClientR2PublicUrl()) ?? undefined,
    parseOrigin(process.env.CDN_BASE_URL),
    parseOrigin(process.env.NEXT_PUBLIC_CDN_BASE_URL),
    parseOrigin(process.env.NEXT_PUBLIC_GATEWAY_URL),
    supabaseOrigin,
  ]);

  const imgSrc = unique(["'self'", "data:", "blob:", ...externalHosts]);

  // Derive websocket equivalents (https → wss, http → ws) for Supabase Realtime.
  const wsOrigins = externalHosts
    .filter((h): h is string => Boolean(h))
    .map((h) => h.replace(/^https:/, "wss:").replace(/^http:/, "ws:"));

  const connectSrc = unique(["'self'", ...externalHosts, ...wsOrigins]);

  const frameAncestorsDirective =
    input.frameAncestors === "selfplus"
      ? "frame-ancestors 'self' zamschoolos.site *.zamschoolos.site vercel.app *.vercel.app"
      : "frame-ancestors 'none'";

  const directives = [
    "default-src 'self'",
    "base-uri 'self'",
    frameAncestorsDirective,
    "frame-src 'none'",
    "form-action 'self'",
    `img-src ${imgSrc.join(" ")}`,
    "font-src 'self' data:",
    `style-src ${styleSrc.join(" ")}`,
    `script-src ${scriptSrc.join(" ")}`,
    `connect-src ${connectSrc.join(" ")}`,
    "object-src 'none'",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
  ];

  if (input.shouldUpgradeInsecureRequests) {
    directives.push("upgrade-insecure-requests");
  }

  return directives.join("; ");
}

export function isProductionCspMode(): boolean {
  return (
    process.env.NODE_ENV === "production" ||
    process.env.VERCEL_ENV === "production" ||
    process.env.CSP_PRODUCTION === "true"
  );
}