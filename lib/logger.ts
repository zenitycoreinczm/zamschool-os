/**
 * Structured logger for ZamSchool OS.
 *
 * Outputs JSON lines to stdout/stderr in production so that external log
 * aggregation (Datadog, CloudWatch, Vercel logs) can parse and filter them.
 * In development it falls back to readable console output with the same
 * structured fields attached.
 *
 * Usage:
 *   import { logger } from "@/lib/logger";
 *   logger.info("payment.recorded", { studentId, amount });
 *   logger.error("payment.failed", { studentId, error });
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogContext {
  [key: string]: unknown;
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  [key: string]: unknown;
}

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function getMinLevel(): LogLevel {
  return (
    (process.env.LOG_LEVEL as LogLevel) ||
    (process.env.NODE_ENV === "production" ? "info" : "debug")
  );
}

function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

function shouldLog(level: LogLevel): boolean {
  return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[getMinLevel()];
}

function sanitizeContext(ctx: LogContext): LogContext {
  const sanitized: LogContext = {};
  for (const [key, value] of Object.entries(ctx)) {
    // Redact obvious secrets and PII-bearing fields
    if (
      /secret|password|token|key|authorization|cookie|session|credential|private/i.test(
        key,
      )
    ) {
      sanitized[key] = "[REDACTED]";
    } else if (/email/i.test(key) && typeof value === "string") {
      const at = value.indexOf("@");
      sanitized[key] =
        at > 1 ? `${value[0]}***${value.slice(at)}` : "[REDACTED_EMAIL]";
    } else if (value instanceof Error) {
      sanitized[key] = String(value.message || value.name).slice(0, 500);
    } else if (typeof value === "string" && value.length > 500) {
      sanitized[key] = `${value.slice(0, 500)}…`;
    } else if (value !== undefined) {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

function emit(level: LogLevel, message: string, ctx: LogContext = {}): void {
  if (!shouldLog(level)) return;

  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...sanitizeContext(ctx),
  };

  if (isProduction()) {
    const json = JSON.stringify(entry);
    if (level === "error" || level === "warn") {
      process.stderr.write(json + "\n");
    } else {
      process.stdout.write(json + "\n");
    }
  } else {
    // Development: readable but still structured
    const ctxStr =
      Object.keys(entry).length > 3
        ? " " + JSON.stringify(sanitizeContext(ctx))
        : "";
    const prefix = `[${entry.timestamp}] ${level.toUpperCase()}`;
    const output = `${prefix} ${message}${ctxStr}`;
    if (level === "error") {
      console.error(output);
    } else if (level === "warn") {
      console.warn(output);
    } else {
      console.log(output);
    }
  }
}

export const logger = {
  debug(message: string, ctx?: LogContext) {
    emit("debug", message, ctx);
  },
  info(message: string, ctx?: LogContext) {
    emit("info", message, ctx);
  },
  warn(message: string, ctx?: LogContext) {
    emit("warn", message, ctx);
  },
  error(message: string, ctx?: LogContext) {
    emit("error", message, ctx);
  },
  /** Create a child logger with a fixed context (e.g. module, schoolId) */
  child(ctx: LogContext) {
    return {
      debug(message: string, childCtx?: LogContext) {
        emit("debug", message, { ...ctx, ...childCtx });
      },
      info(message: string, childCtx?: LogContext) {
        emit("info", message, { ...ctx, ...childCtx });
      },
      warn(message: string, childCtx?: LogContext) {
        emit("warn", message, { ...ctx, ...childCtx });
      },
      error(message: string, childCtx?: LogContext) {
        emit("error", message, { ...ctx, ...childCtx });
      },
    };
  },
};

export { shouldLog, sanitizeContext };
