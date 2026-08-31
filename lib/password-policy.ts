import { z } from "zod";

/**
 * Shared password policy (H-14).
 *
 * Applies to account creation, resets, and password changes. Kept in one
 * place so the server schema and the client UI hints can never drift.
 */
export const PASSWORD_MIN_LENGTH = 12;

export const passwordPolicyMessage =
  "Password must be at least 12 characters and include an uppercase letter and a number.";

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters`)
  .regex(/[A-Z]/, "Password must include at least one uppercase letter")
  .regex(/[0-9]/, "Password must include at least one number");

/** Client-friendly checklist for the password inputs. */
export const PASSWORD_RULES = [
  { label: "At least 12 characters", test: (v: string) => v.length >= PASSWORD_MIN_LENGTH },
  { label: "One uppercase letter", test: (v: string) => /[A-Z]/.test(v) },
  { label: "One number", test: (v: string) => /[0-9]/.test(v) },
] as const;
