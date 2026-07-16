import {
  isRedisConfigured,
  redisGet,
  redisIncr,
  redisSet,
} from "@/lib/redis/client";
import { tempOtpThrottleKey, tempTokenKey } from "@/lib/redis/keys";
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
