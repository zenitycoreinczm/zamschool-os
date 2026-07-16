/**
 * User-facing API error messages for the browser.
 * Prefer clear school-admin language over technical status codes.
 */

import { OFFLINE_FETCH_ERROR_MESSAGE } from "./offline-support.ts";

export const SESSION_EXPIRED_MESSAGE =
  "Your session has expired. Please sign in again.";

export const PERMISSION_DENIED_MESSAGE =
  "You don't have permission for this action.";

export const SERVER_UNAVAILABLE_MESSAGE =
  "The server is temporarily unavailable. Please try again in a moment.";

export const NETWORK_ERROR_MESSAGE =
  "Could not reach ZamSchool. Check your connection and try again.";

export const TIMEOUT_ERROR_MESSAGE =
  "The request took too long. On a slow connection, wait a moment and try again.";

export const RATE_LIMIT_MESSAGE =
  "Too many requests. Please wait a few seconds and try again.";

export function humanizeHttpError(
  status: number,
  bodyError?: string | null,
): string {
  const trimmed = String(bodyError || "").trim();
  if (status === 401) return SESSION_EXPIRED_MESSAGE;
  if (status === 403) return trimmed || PERMISSION_DENIED_MESSAGE;
  if (status === 404) return trimmed || "The requested record was not found.";
  if (status === 409) return trimmed || "This conflicts with an existing record.";
  if (status === 422) return trimmed || "Some of the information provided is invalid.";
  if (status === 429) return RATE_LIMIT_MESSAGE;
  // Prefer a concrete server message when present so timetable/create failures
  // are not always masked as a generic outage.
  if (status >= 500) {
    if (
      trimmed &&
      trimmed.length < 220 &&
      !/internal server error|unexpected token|stack|exception/i.test(trimmed)
    ) {
      return trimmed;
    }
    return SERVER_UNAVAILABLE_MESSAGE;
  }
  return trimmed || "Something went wrong. Please try again.";
}

export function humanizeFetchFailure(error: unknown): string {
  if (error instanceof Error) {
    const msg = error.message || "";
    if (msg === OFFLINE_FETCH_ERROR_MESSAGE) return msg;
    if (error.name === "AbortError" || /aborted|timeout/i.test(msg)) {
      return TIMEOUT_ERROR_MESSAGE;
    }
    if (
      /failed to fetch|networkerror|network request failed|load failed|fetch/i.test(
        msg,
      )
    ) {
      return NETWORK_ERROR_MESSAGE;
    }
    if (msg.trim()) return msg;
  }
  return NETWORK_ERROR_MESSAGE;
}

export function isRetriableNetworkError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  if (error.name === "AbortError") return false;
  const msg = error.message || "";
  if (msg === OFFLINE_FETCH_ERROR_MESSAGE) return false;
  return /failed to fetch|networkerror|network request failed|load failed/i.test(
    msg,
  );
}
