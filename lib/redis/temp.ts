import {
  isRedisConfigured,
  redisGet,
  redisIncr,
  redisSet,
} from "@/lib/redis/client";
import {
  tempAccessCodeThrottleKey,
  tempOtpThrottleKey,
  tempTokenKey,
} from "@/lib/redis/keys";
import { REDIS_TTL } from "@/lib/redis/ttl";

/** Throttle OTP email sends per address (complements DB-stored hashed OTP). */
export async function checkOtpSendThrottle(
  email: string,
  maxPerHour = 5,
): Promise<boolean> {
  if (!isRedisConfigured()) return true;

  const key = tempOtpThrottleKey(email);
  const count = await redisIncr(key, REDIS_TTL.otpThrottleSec);
  if (count === null) return true;
  return count <= maxPerHour;
}

/**
 * Throttle access-code verification attempts per submitted code value
 * (brute-force friction on the 6-digit space; complements per-IP limits).
 */
export async function checkAccessCodeAttemptThrottle(
  code: string,
  maxPerWindow = 10,
): Promise<boolean> {
  if (!isRedisConfigured()) return true;

  const key = tempAccessCodeThrottleKey(code);
  const count = await redisIncr(key, REDIS_TTL.accessCodeThrottleSec);
  if (count === null) return true;
  return count <= maxPerWindow;
}

/** Store a short-lived verification or reset token payload (small JSON string). */
export async function storeTempToken(
  kind: "verify" | "reset" | "invite",
  id: string,
  payload: string,
  ttlSeconds: number = REDIS_TTL.tempTokenSec,
): Promise<boolean> {
  if (!isRedisConfigured()) return false;
  if (payload.length > 512) {
    console.warn("[Redis] Temp token payload too large - rejected");
    return false;
  }
  return redisSet(tempTokenKey(kind, id), payload, ttlSeconds);
}

export async function readTempToken(
  kind: "verify" | "reset" | "invite",
  id: string,
): Promise<string | null> {
  if (!isRedisConfigured()) return null;
  return redisGet(tempTokenKey(kind, id));
}

export async function clearTempToken(
  kind: "verify" | "reset" | "invite",
  id: string,
): Promise<void> {
  const { redisDel } = await import("@/lib/redis/client");
  await redisDel(tempTokenKey(kind, id));
}
