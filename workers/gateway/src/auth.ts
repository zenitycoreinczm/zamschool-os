import type { Env, SessionSnapshot } from "./types.ts";

type JwtHeader = { alg?: string; typ?: string; kid?: string };
type JwtPayload = {
  sub?: string;
  role?: string;
  email?: string;
  exp?: number;
  iss?: string;
  aud?: string | string[];
  user_metadata?: { school_id?: string; role?: string };
  app_metadata?: { school_id?: string; role?: string; provider?: string };
};

type Jwk = JsonWebKey & { kid?: string; alg?: string; kty?: string };

type JwksCache = {
  keys: Jwk[];
  fetchedAt: number;
  jwksUrl: string;
};

const JWKS_TTL_MS = 60 * 60 * 1000; // 1 hour
let jwksCache: JwksCache | null = null;

/**
 * Per-isolate auth memory cache (L1).
 *
 * KV is shared and durable but every SESSION_CACHE.get() is a billed op.
 * Parallel dashboard loads fire many gateway requests with the same Bearer
 * token; without L1 that becomes N KV GETs for one user session burst.
 *
 * Worker isolates are short-lived; 45s is long enough to collapse a page load
 * (8–20 API calls) to ~1 KV GET, short enough that logout / role changes
 * still re-resolve within a minute on this isolate.
 */
const AUTH_MEMORY_TTL_MS = 45_000;
const AUTH_MEMORY_MAX_ENTRIES = 2_000;

type AuthMemoryEntry = {
  session: SessionSnapshot;
  expiresAt: number;
};

const authMemoryCache = new Map<string, AuthMemoryEntry>();

function readAuthMemory(tokenHash: string): SessionSnapshot | null {
  const entry = authMemoryCache.get(tokenHash);
  if (!entry) return null;
  const now = Date.now();
  if (entry.expiresAt <= now || entry.session.exp * 1000 <= now) {
    authMemoryCache.delete(tokenHash);
    return null;
  }
  return entry.session;
}

function writeAuthMemory(tokenHash: string, session: SessionSnapshot): void {
  // Bound growth in long-lived isolates (dev / high traffic).
  if (authMemoryCache.size >= AUTH_MEMORY_MAX_ENTRIES) {
    const firstKey = authMemoryCache.keys().next().value;
    if (firstKey !== undefined) authMemoryCache.delete(firstKey);
  }
  const jwtMs = Math.max(0, session.exp * 1000 - Date.now());
  const ttlMs = Math.min(AUTH_MEMORY_TTL_MS, jwtMs || AUTH_MEMORY_TTL_MS);
  authMemoryCache.set(tokenHash, {
    session,
    expiresAt: Date.now() + ttlMs,
  });
}

/**
 * Validates the Authorization header.
 * Lookup order (hot path first):
 *   1. Worker isolate memory (45s) — no KV
 *   2. SESSION_CACHE KV — shared across isolates
 *   3. JWT verify (HS256 secret / ES256 JWKS), then write KV + memory
 * Local dev only: JWT_VERIFY_MODE=decode with ALLOW_INSECURE_JWT_DECODE=true skips signature check.
 */
export async function verifyAuth(req: Request, env: Env): Promise<SessionSnapshot | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) {
    return null;
  }

  const tokenHash = await sha256(token);

  // L1: same isolate, same token (dashboard fan-out).
  const fromMemory = readAuthMemory(tokenHash);
  if (fromMemory) {
    return fromMemory;
  }

  // L2: Cloudflare KV (shared; still costs a GET on miss of L1).
  const cached = await env.SESSION_CACHE?.get<SessionSnapshot>(tokenHash, {
    type: "json",
  });
  if (cached && cached.exp > Date.now() / 1000) {
    writeAuthMemory(tokenHash, cached);
    return cached;
  }

  const payload = await validateJwt(token, env);
  if (!payload) {
    return null;
  }

  const session = sessionFromPayload(payload);
  if (!session) {
    return null;
  }

  const ttlSec = Math.max(Math.floor(session.exp - Date.now() / 1000), 60);
  writeAuthMemory(tokenHash, session);
  // Fire-and-forget KV write would risk lost puts on isolate teardown; await
  // so the next isolate can hit KV without re-verifying crypto.
  await env.SESSION_CACHE?.put(tokenHash, JSON.stringify(session), {
    expirationTtl: ttlSec,
  });

  return session;
}

async function validateJwt(token: string, env: Env): Promise<JwtPayload | null> {
  const parts = token.split(".");
  if (parts.length !== 3) {
    return null;
  }

  const [headerPart, payloadPart, signaturePart] = parts;

  let header: JwtHeader;
  let payload: JwtPayload;

  try {
    header = JSON.parse(decodeBase64Url(headerPart)) as JwtHeader;
    payload = JSON.parse(decodeBase64Url(payloadPart)) as JwtPayload;
  } catch {
    return null;
  }

  if (!payload.sub || !payload.exp || payload.exp <= Date.now() / 1000) {
    return null;
  }

  if (env.SUPABASE_JWT_ISSUER && payload.iss !== env.SUPABASE_JWT_ISSUER) {
    return null;
  }

  if (env.SUPABASE_JWT_AUDIENCE) {
    const expectedAud = env.SUPABASE_JWT_AUDIENCE;
    const audMatches = Array.isArray(payload.aud)
      ? payload.aud.includes(expectedAud)
      : payload.aud === expectedAud;
    if (!audMatches) {
      return null;
    }
  }

  const signedContent = `${headerPart}.${payloadPart}`;
  const alg = String(header.alg || "").toUpperCase();
  const secret = String(env.SUPABASE_JWT_SECRET || "").trim();
  const verifyMode = String(env.JWT_VERIFY_MODE || "signature").toLowerCase();

  if (alg === "ES256") {
    const ok = await verifyEs256WithJwks(env, header, signedContent, signaturePart);
    return ok ? payload : null;
  }

  if (alg === "HS256") {
    if (secret) {
      const valid = await verifyHs256Signature(secret, signedContent, signaturePart);
      return valid ? payload : null;
    }
  } else {
    // Unknown algorithm - do not accept unless insecure decode is explicitly allowed.
    if (
      verifyMode !== "decode" ||
      String(env.ALLOW_INSECURE_JWT_DECODE || "").toLowerCase() !== "true"
    ) {
      return null;
    }
  }

  if (
    verifyMode === "decode" &&
    String(env.ALLOW_INSECURE_JWT_DECODE || "").toLowerCase() === "true"
  ) {
    if (env.NODE_ENV === "production" || env.VERCEL_ENV === "production") {
      console.error(
        "[auth] CRITICAL: ALLOW_INSECURE_JWT_DECODE is enabled in production - refusing",
      );
      return null;
    }
    console.warn("[auth] ALLOW_INSECURE_JWT_DECODE enabled - signature not verified");
    return payload;
  }

  return null;
}

function resolveJwksUrl(env: Env): string | null {
  const explicit = String(env.SUPABASE_JWKS_URL || "").trim();
  if (explicit) return explicit;

  const issuer = String(env.SUPABASE_JWT_ISSUER || "").trim().replace(/\/$/, "");
  if (issuer) {
    return `${issuer}/.well-known/jwks.json`;
  }

  const supabaseUrl = String(env.SUPABASE_URL || "").trim().replace(/\/$/, "");
  if (supabaseUrl) {
    return `${supabaseUrl}/auth/v1/.well-known/jwks.json`;
  }

  return null;
}

async function loadJwks(env: Env): Promise<Jwk[] | null> {
  const jwksUrl = resolveJwksUrl(env);
  if (!jwksUrl) {
    console.error("[auth] ES256 JWT but no SUPABASE_JWT_ISSUER / SUPABASE_JWKS_URL / SUPABASE_URL");
    return null;
  }

  const now = Date.now();
  if (
    jwksCache &&
    jwksCache.jwksUrl === jwksUrl &&
    now - jwksCache.fetchedAt < JWKS_TTL_MS
  ) {
    return jwksCache.keys;
  }

  try {
    const fetchImpl = env.fetch || fetch;
    const res = await fetchImpl(jwksUrl, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      console.error("[auth] JWKS fetch failed", res.status, jwksUrl);
      return jwksCache?.jwksUrl === jwksUrl ? jwksCache.keys : null;
    }
    const body = (await res.json()) as { keys?: Jwk[] };
    const keys = Array.isArray(body.keys) ? body.keys : [];
    jwksCache = { keys, fetchedAt: now, jwksUrl };
    return keys;
  } catch (err) {
    console.error("[auth] JWKS fetch error", err);
    return jwksCache?.jwksUrl === jwksUrl ? jwksCache.keys : null;
  }
}

async function verifyEs256WithJwks(
  env: Env,
  header: JwtHeader,
  signedContent: string,
  signaturePart: string,
): Promise<boolean> {
  const keys = await loadJwks(env);
  if (!keys?.length) return false;

  const candidates = header.kid
    ? keys.filter((k) => k.kid === header.kid)
    : keys.filter((k) => (k.alg || "ES256") === "ES256" || k.kty === "EC");

  const tryKeys = candidates.length > 0 ? candidates : keys;

  // Web Crypto ECDSA expects IEEE P-1363 (raw r||s), which is what JWT uses.
  const signature = base64UrlToBytes(signaturePart);
  const data = new TextEncoder().encode(signedContent);

  for (const jwk of tryKeys) {
    try {
      const key = await crypto.subtle.importKey(
        "jwk",
        jwk,
        { name: "ECDSA", namedCurve: "P-256" },
        false,
        ["verify"],
      );
      const ok = await crypto.subtle.verify(
        { name: "ECDSA", hash: "SHA-256" },
        key,
        signature as BufferSource,
        data,
      );
      if (ok) return true;
    } catch {
      // try next key
    }
  }

  return false;
}

function sessionFromPayload(payload: JwtPayload): SessionSnapshot | null {
  if (!payload.sub) {
    return null;
  }

  const role =
    payload.app_metadata?.role ||
    payload.user_metadata?.role ||
    payload.role ||
    "authenticated";

  const schoolId =
    payload.app_metadata?.school_id ||
    payload.user_metadata?.school_id ||
    "unknown";

  return {
    userId: payload.sub,
    role,
    schoolId,
    email: payload.email || "",
    exp: payload.exp || Math.floor(Date.now() / 1000) + 86400,
  };
}

async function verifyHs256Signature(
  secret: string,
  signedContent: string,
  signaturePart: string,
): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );

  const signature = new Uint8Array(base64UrlToBytes(signaturePart));
  return crypto.subtle.verify("HMAC", key, signature, encoder.encode(signedContent));
}

function decodeBase64Url(input: string): string {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padLength = (4 - (normalized.length % 4)) % 4;
  return atob(normalized + "=".repeat(padLength));
}

function base64UrlToBytes(input: string): Uint8Array {
  const binary = decodeBase64Url(input);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function sha256(message: string) {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Test helper: build a signed HS256 JWT for unit tests. */
export async function signTestJwt(
  secret: string,
  payload: Record<string, unknown>,
  header: Record<string, unknown> = { alg: "HS256", typ: "JWT" },
): Promise<string> {
  const encoder = new TextEncoder();
  const headerPart = bytesToBase64Url(encoder.encode(JSON.stringify(header)));
  const payloadPart = bytesToBase64Url(encoder.encode(JSON.stringify(payload)));
  const signedContent = `${headerPart}.${payloadPart}`;

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(signedContent));
  return `${signedContent}.${bytesToBase64Url(new Uint8Array(signature))}`;
}

/** Test helper: reset JWKS in-memory cache between tests. */
export function resetJwksCacheForTests() {
  jwksCache = null;
}

/** Test helper: clear isolate auth memory between tests. */
export function resetAuthMemoryCacheForTests() {
  authMemoryCache.clear();
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
