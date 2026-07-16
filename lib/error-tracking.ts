/**
 * Error tracking for ZamSchool OS.
 *
 * Provides a lightweight captureError() function that:
 * 1. Logs the error through the structured logger (always)
 * 2. Forwards to Sentry when SENTRY_DSN is set (production only)
 *
 * This avoids adding @sentry/node as a hard dependency - it only activates
 * when configured. In development, errors are logged but not forwarded.
 *
 * Usage:
 *   import { captureError } from "@/lib/error-tracking";
 *   catch (error) {
 *     captureError(error, { module: "payments", schoolId });
 *     return NextResponse.json({ error: "Internal server error" }, { status: 500 });
 *   }
 */

import { logger } from "@/lib/logger";
import type { LogContext } from "@/lib/logger";

export interface ErrorTrackingContext extends LogContext {
  module?: string;
  schoolId?: string;
  userId?: string;
  route?: string;
}

let sentryHub: { captureException: (err: unknown, ctx?: Record<string, unknown>) => void } | null = null;
let sentryInitialized = false;

async function getSentryHub() {
  if (sentryInitialized) return sentryHub;
  sentryInitialized = true;

  const dsn = process.env.SENTRY_DSN;
  if (!dsn || process.env.NODE_ENV !== "production") {
    return null;
  }

  try {
    // Dynamic import - only loaded when SENTRY_DSN is set.
    // @sentry/node is an optional dependency (not in package.json) - the
    // catch block below handles the case where it is not installed.
    // @ts-expect-error - module is optional and may not be installed
    const Sentry = await import("@sentry/node");
    Sentry.init({
      dsn,
      environment: process.env.NODE_ENV,
      tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE || "0.1"),
    });
    sentryHub = {
      captureException(err: unknown, ctx?: Record<string, unknown>) {
        Sentry.captureException(err, {
          tags: ctx,
        });
      },
    };
    return sentryHub;
  } catch {
    // @sentry/node not installed - silently fall back to logger only
    return null;
  }
}

/**
 * Capture an error: log it through the structured logger and optionally
 * forward to Sentry when configured.
 *
 * Always non-throwing - safe to call in catch blocks.
 */
export function captureError(error: unknown, context: ErrorTrackingContext = {}): void {
  logger.error("error.captured", {
    error,
    ...context,
  });

  // Fire-and-forget Sentry forwarding
  if (process.env.NODE_ENV === "production" && process.env.SENTRY_DSN) {
    void getSentryHub().then((hub) => {
      if (hub) {
        hub.captureException(error, context);
      }
    });
  }
}

/**
 * Capture a message at info level (for non-error events you want to track).
 */
export function captureMessage(message: string, context: ErrorTrackingContext = {}): void {
  logger.info(message, context);

  if (process.env.NODE_ENV === "production" && process.env.SENTRY_DSN) {
    void getSentryHub().then((hub) => {
      if (hub) {
        // @ts-expect-error - captureMessage is optional on our hub interface
        hub.captureMessage?.(message, context);
      }
    });
  }
}

export { getSentryHub };
