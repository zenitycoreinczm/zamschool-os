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

/**
 * Dedicated HMAC secret for stateless tokens.
 *
 * SECURITY: this must NEVER fall back to service-role keys, SMTP credentials,
 * or any other shared secret. Reusing those would let anyone who leaks one
 * secret forge password-reset tokens for arbitrary accounts. Fail closed.
 */
function getTokenSecret(): string {
  const secret = process.env.RESET_TOKEN_SECRET;
  if (!secret || secret.trim().length < 32) {
    throw new Error(
      "Security Error: RESET_TOKEN_SECRET is missing or too short (< 32 chars). " +
        "Generate one with `openssl rand -base64 32` and set it in the environment.",
    );
  }
  return crypto.createHash("sha256").update(secret).digest("hex");
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
