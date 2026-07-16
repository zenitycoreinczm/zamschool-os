/**
 * Stateless, self-validating tokens using HMAC-SHA256.
 *
 * No Redis or database storage needed - the token carries its own
 * payload (userId + expiry) signed with a server-side secret.
 *
 * Used for password-reset links so custom SMTP works even when
 * Redis is unavailable.
 */
import crypto from "crypto";

/** Derive a stable HMAC secret from existing env vars. */
function getTokenSecret(): string {
  const seed =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SMTP_PASS ||
    process.env.RESET_TOKEN_SECRET;
  if (!seed) {
    throw new Error(
      "Security Error: Cannot mint reset token - no HMAC secret available. " +
        "Set SUPABASE_SERVICE_ROLE_KEY, SMTP_PASS, or RESET_TOKEN_SECRET.",
    );
  }
  return crypto.createHash("sha256").update(seed).digest("hex");
}

const TOKEN_TTL_MS = 10 * 60 * 1000; // 10 minutes

export interface ResetTokenPayload {
  userId: string;
}

/**
 * Create a stateless password-reset token.
 *
 * Format: base64url(userId:expiryTimestamp:hmac)
 *   - userId: the Supabase Auth user UUID
 *   - expiryTimestamp: epoch ms when the token expires
 *   - hmac: HMAC-SHA256(userId:expiryTimestamp, secret)
 */
export function createResetToken(userId: string): string {
  const expiry = Date.now() + TOKEN_TTL_MS;
  const payload = `${userId}:${expiry}`;
  const hmac = crypto
    .createHmac("sha256", getTokenSecret())
    .update(payload)
    .digest("hex");
  return Buffer.from(`${payload}:${hmac}`).toString("base64url");
}

/**
 * Verify a stateless password-reset token.
 *
 * Returns the payload on success, or null if the token is:
 * - Malformed
 * - Expired
 * - Tampered with (HMAC mismatch)
 */
export function verifyResetToken(token: string): ResetTokenPayload | null {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf-8");
    const parts = decoded.split(":");
    if (parts.length !== 3) return null;

    const [userId, expiryStr, receivedHmac] = parts;
    const expiry = parseInt(expiryStr, 10);

    // Check expiry
    if (Number.isNaN(expiry) || Date.now() > expiry) return null;

    // Verify HMAC
    const payload = `${userId}:${expiryStr}`;
    const expectedHmac = crypto
      .createHmac("sha256", getTokenSecret())
      .update(payload)
      .digest("hex");

    if (
      receivedHmac.length !== expectedHmac.length ||
      !crypto.timingSafeEqual(
        Buffer.from(receivedHmac),
        Buffer.from(expectedHmac),
      )
    ) {
      return null;
    }

    return { userId };
  } catch {
    return null;
  }
}
