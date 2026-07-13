/**
 * Safe error extraction and public-facing sanitization.
 *
 * Rule: never send internal infrastructure details, SQL, stack traces,
 * file paths, tokens, or schema names to the browser.
 */

const DEFAULT_FALLBACK = "An unexpected error occurred";

/** Patterns that indicate an internal/infrastructure message must not leave the server. */
const LEAKY_MESSAGE_PATTERNS: RegExp[] = [
  // Credential material — not user-facing validation like "Password is required"
  /\bpassword\s*[:=]/i,
  /\bpassword\s+(authentication|hash|salt|store|digest)\b/i,
  /\bsecret\s*[:=]/i,
  /\btoken\s*[:=]/i,
  /\bapi[_-]?key\s*[:=]?\s*[A-Za-z0-9_-]{8,}/i,
  /\bauthorization\s*[:=]/i,
  /\bbearer\s+[a-z0-9._-]+/i,
  /\bsupabase\b/i,
  /\bpostgres(?:ql)?\b/i,
  /\bpostgrest\b/i,
  /\bpgrst\d+/i,
  /\bpg_\w+/i,
  /\bjwt\b/i,
  /\brelation\s+["'`]/i,
  /\bcolumn\s+["'`]/i,
  /\btable\s+["'`]/i,
  /\bviolates\s+(unique|foreign|check|not[- ]null)/i,
  /\bduplicate key\b/i,
  /\bpermission denied\b/i,
  /\brow[- ]level security\b/i,
  /\brls\b/i,
  /\beconnrefused\b/i,
  /\betimedout\b/i,
  /\benotfound\b/i,
  /\benetunreach\b/i,
  /\bdatabase connection\b/i,
  /\bconnection refused\b/i,
  /\bconnection string\b/i,
  /\bstack\b/i,
  /\bat\s+\S+\s+\(/, // stack frames
  /\/[A-Za-z]:\\/, // Windows paths
  /\/(?:home|var|usr|tmp|app|opt)\//i,
  /\bselect\s+.+\s+from\b/i,
  /\binsert\s+into\b/i,
  /\bupdate\s+\w+\s+set\b/i,
  /\bdelete\s+from\b/i,
  /\bdrop\s+(table|schema|database)\b/i,
  /\bnull value in column\b/i,
  /\binvalid input syntax\b/i,
  /\bforeign key constraint\b/i,
  /\bunique constraint\b/i,
  /service[_-]?role/i,
  /\bupstash\b/i,
  /\bredis\b/i,
  /\bcloudflare\b/i,
  /\bwrangler\b/i,
  /-----BEGIN/i,
  /\bprivate[_-]?key\b/i,
];

/** Explicit PublicError instances are always safe to show (user-facing validation). */
export class PublicError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(message: string, options?: { status?: number; code?: string }) {
    super(message);
    this.name = "PublicError";
    this.status = options?.status ?? 400;
    this.code = options?.code;
  }
}

function extractRawMessage(err: unknown): string | null {
  if (err instanceof Error && err.message) {
    return err.message;
  }
  // Supabase/PostgREST errors are plain objects with { message, code, details, hint }.
  if (
    err &&
    typeof err === "object" &&
    typeof (err as { message?: unknown }).message === "string" &&
    (err as { message?: string }).message
  ) {
    return (err as { message: string }).message;
  }
  return null;
}

export function looksLikeLeakyErrorMessage(message: string): boolean {
  const text = String(message || "").trim();
  if (!text) return true;
  if (text.length > 280) return true;
  // Multi-line stack dumps
  if (text.includes("\n    at ") || text.split("\n").length > 4) return true;
  return LEAKY_MESSAGE_PATTERNS.some((re) => re.test(text));
}

/**
 * Sanitize a message for the browser. Returns fallback when the text looks internal.
 */
export function sanitizePublicErrorMessage(
  message: string | null | undefined,
  fallback = DEFAULT_FALLBACK,
): string {
  const text = String(message || "").trim();
  if (!text) return fallback;
  if (looksLikeLeakyErrorMessage(text)) return fallback;
  // Collapse whitespace; never return control characters
  return text.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, 200) || fallback;
}

/**
 * Safely extract a human-readable error message for API/UI responses.
 * PublicError always passes through (sanitized length only).
 * Internal / DB / stack messages become the fallback.
 */
export function safeErrorMessage(
  err: unknown,
  fallback = DEFAULT_FALLBACK,
): string {
  if (err instanceof PublicError && err.message) {
    return sanitizePublicErrorMessage(err.message, fallback);
  }

  const raw = extractRawMessage(err);
  if (!raw) return fallback;
  return sanitizePublicErrorMessage(raw, fallback);
}

/**
 * Full message for server logs only — still redacts obvious secrets in-place.
 */
export function serverErrorMessage(err: unknown, fallback = "Unknown error"): string {
  const raw = extractRawMessage(err) || fallback;
  return redactSecretsInText(raw).slice(0, 2000);
}

export function redactSecretsInText(input: string): string {
  let text = String(input || "");
  text = text.replace(
    /\b(Bearer\s+)[A-Za-z0-9\-._~+/]+=*/gi,
    "$1[REDACTED]",
  );
  text = text.replace(
    /\b(eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,})/g,
    "[REDACTED_JWT]",
  );
  text = text.replace(
    /\b(sk|pk|rk|api)[_-][A-Za-z0-9]{16,}\b/gi,
    "[REDACTED_KEY]",
  );
  text = text.replace(
    /(password|secret|token|api[_-]?key|authorization)\s*[:=]\s*["']?[^"'\s,;]+/gi,
    "$1=[REDACTED]",
  );
  return text;
}

/**
 * Log full error server-side; never log secrets in plain form.
 */
export function logServerError(
  scope: string,
  err: unknown,
  extra?: Record<string, unknown>,
): void {
  const payload: Record<string, unknown> = {
    scope,
    message: serverErrorMessage(err),
    ...extra,
  };

  if (err instanceof Error && err.stack) {
    payload.stack = redactSecretsInText(err.stack).slice(0, 4000);
  }
  if (err && typeof err === "object") {
    const code = (err as { code?: unknown }).code;
    if (typeof code === "string" || typeof code === "number") {
      payload.code = code;
    }
  }

  // Avoid dumping raw objects that may hold tokens.
  console.error(`[${scope}]`, JSON.stringify(payload));
}

/**
 * Build a JSON-safe API error body for the client.
 */
export function publicErrorBody(
  err: unknown,
  fallback: string,
): { error: string; code?: string } {
  if (err instanceof PublicError) {
    const body: { error: string; code?: string } = {
      error: sanitizePublicErrorMessage(err.message, fallback),
    };
    if (err.code) body.code = err.code;
    return body;
  }
  return { error: safeErrorMessage(err, fallback) };
}
