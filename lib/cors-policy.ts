function normalizeOrigin(origin: string | null | undefined): string | null {
  const value = String(origin || "").trim().replace(/\/+$/, "");
  if (!value) return null;

  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function splitOrigins(value: string | undefined): string[] {
  return String(value || "")
    .split(",")
    .map((entry) => normalizeOrigin(entry))
    .filter((entry): entry is string => Boolean(entry));
}

export function isLoopbackOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    const hostname = String(url.hostname || "").trim().toLowerCase();
    return hostname === "127.0.0.1" || hostname === "localhost" || hostname === "[::1]" || hostname === "::1";
  } catch {
    return false;
  }
}

export function isProductionCorsMode(): boolean {
  return (
    process.env.NODE_ENV === "production" ||
    process.env.VERCEL_ENV === "production" ||
    process.env.CORS_STRICT === "true"
  );
}

/** Origins allowed to call /api/* with browser CORS. */
export function collectConfiguredApiOrigins(): string[] {
  const strict = isProductionCorsMode();
  const sources = strict
    ? [
        process.env.CORS_ALLOWED_ORIGINS,
        process.env.NEXT_PUBLIC_APP_ORIGIN,
        process.env.NEXT_PUBLIC_WEBAPP_ORIGIN,
      ]
    : [
        process.env.CORS_ALLOWED_ORIGINS,
        process.env.NEXT_PUBLIC_APP_ORIGIN,
        process.env.NEXT_PUBLIC_WEB_ORIGIN,
        process.env.NEXT_PUBLIC_WEBAPP_ORIGIN,
        process.env.NEXT_PUBLIC_WEBAPP_PREVIEW_ORIGIN,
        process.env.EXPO_PUBLIC_WEBAPP_ORIGIN,
        process.env.EXPO_PUBLIC_WEBAPP_PREVIEW_ORIGIN,
      ];

  const origins = [...new Set(sources.flatMap((value) => splitOrigins(value)))];

  // SECURITY (H-03/H-17): loopback origins must never be echoed in
  // production strict mode, even if someone pastes one into the env config.
  // Local malware pages could otherwise call authenticated APIs.
  if (strict) {
    return origins.filter((origin) => !isLoopbackOrigin(origin));
  }

  return origins;
}

export function resolveAllowedApiOrigin(requestOrigin: string | null): string | null {
  const normalized = normalizeOrigin(requestOrigin);
  if (!normalized) return null;

  // Loopback auto-allow is a development convenience only. In production
  // strict mode the origin must be explicitly configured.
  if (!isProductionCorsMode() && isLoopbackOrigin(normalized)) {
    return normalized;
  }

  const configuredOrigins = collectConfiguredApiOrigins();
  return configuredOrigins.includes(normalized) ? normalized : null;
}