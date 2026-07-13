import type { SupabaseClient } from "@supabase/supabase-js";
import { redisGet, redisSet, redisDel } from "@/lib/redis/client";
import { isRedisConfigured } from "@/lib/redis/client";
import { tempEmailVerifiedKey } from "@/lib/redis/keys";

/**
 * Single source of truth for "the user's email is verified" is
 * `auth.users.email_confirmed_at`. The legacy `email_verifications` table is
 * no longer used.
 */

/** How long we trust the post-OTP "verified" attestation in Redis. */
const OTP_VERIFIED_ATTEST_TTL_SEC = 60 * 60; // 1h

/** Returns true when `auth.users.email_confirmed_at` is set for `userId`. */
export async function isPrincipalEmailVerified(
  admin: SupabaseClient,
  userId: string,
  _email: string,
): Promise<boolean> {
  const authUser = await admin.auth.admin.getUserById(userId);
  return Boolean(authUser.data.user?.email_confirmed_at);
}

/**
 * Set `auth.users.email_confirmed_at` via the Supabase Admin API.
 * Throws if the admin update fails so the caller can surface a real error
 * instead of silently leaving the user in an unverified state.
 */
export async function confirmEmailViaAdmin(
  admin: SupabaseClient,
  userId: string,
): Promise<void> {
  const { error } = await admin.auth.admin.updateUserById(userId, {
    email_confirm: true,
  });
  if (error) {
    console.error(
      "[principal-email-verified] email_confirm update failed:",
      error.message,
    );
    throw new Error(
      `Failed to confirm email for user ${userId}: ${error.message}`,
    );
  }
}

/**
 * Records that `userId` has just successfully proved control of their email
 * by completing the OTP flow. Consumed (and deleted) by the registration
 * step that needs to lift the `email_confirmed_at` flag. Provides a small
 * attestation window so a transient admin-API hiccup doesn't strand the
 * new user with a green checkmark and an unverified Supabase row.
 */
export async function markOtpVerificationAttested(
  userId: string,
  ttlSeconds: number = OTP_VERIFIED_ATTEST_TTL_SEC,
): Promise<void> {
  if (!isRedisConfigured()) return;
  await redisSet(
    tempEmailVerifiedKey(userId),
    new Date().toISOString(),
    ttlSeconds,
  );
}

/** True if the user has a fresh "OTP verified" attestation in Redis. */
export async function hasOtpVerificationAttestation(
  userId: string,
): Promise<boolean> {
  if (!isRedisConfigured()) return false;
  const value = await redisGet(tempEmailVerifiedKey(userId));
  return Boolean(value);
}

/** Consume the one-shot attestation so it can't be replayed. */
export async function consumeOtpVerificationAttestation(
  userId: string,
): Promise<void> {
  if (!isRedisConfigured()) return;
  await redisDel(tempEmailVerifiedKey(userId));
}
