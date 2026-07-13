/**
 * Canonical school-link errors.
 * Keep copy stable so clients can detect and recover consistently.
 */

export const NO_SCHOOL_LINKED_ERROR = "No school linked to this account";

export const NO_SCHOOL_LINKED_ADMIN_ERROR =
  "No school linked to this admin account";

export function isNoSchoolLinkedError(message: unknown): boolean {
  const text = String(message || "").toLowerCase();
  return (
    text.includes("no school linked") ||
    text.includes("school access is required") ||
    text.includes("not linked to a school")
  );
}

/** User-facing recovery guidance for intermittent / cache false positives. */
export function schoolLinkUserMessage(): string {
  return "Your account is not linked to a school yet. Sign out and back in, or ask the Head Teacher to check your profile.";
}
