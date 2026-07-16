/**
 * Next.js instrumentation hook
 *
 * Automatically called once during server startup. Installs the global
 * Supabase fetch guard that rate-limits ALL *.supabase.co requests
 * at 25 req/s to stay within free-tier limits.
 *
 * Next.js 15+ auto-detects this file at the project root - no
 * experimental config flag needed.
 *
 * We export `register` (the original hook name) only. The [DEP0205]
 * deprecation warning about `module.register()` is emitted by Next.js
 * internals when loading custom loaders - it is not caused by this file
 * and cannot be suppressed here. It is a known cosmetic warning in
 * Next.js 16 on Node 22+ and does not affect runtime behaviour.
 */
async function setup() {
  // Only run on the server
  if (typeof window !== "undefined") return;

  try {
    // National / data-center production gates - warn loudly if misconfigured.
    const { evaluateProductionSecurityGates, isProductionServerMode } =
      await import("./lib/server-security-policy");
    if (isProductionServerMode()) {
      const failures = evaluateProductionSecurityGates();
      if (failures.length > 0) {
        console.error(
          "[Instrumentation] PRODUCTION SECURITY GATES FAILED:\n" +
            failures.map((f) => `  - ${f}`).join("\n"),
        );
        // Fail closed only when explicitly requested (data-center mode).
        if (process.env.ZAMSCHOOL_DC_STRICT === "true") {
          throw new Error(
            `Server security gates failed (${failures.length}). Refusing to start.`,
          );
        }
      } else {
        console.log(
          "[Instrumentation] Production security gates passed (Redis, Supabase, CORS, hosts).",
        );
      }
    }

    const { installSupabaseFetchGuard } = await import(
      "./lib/supabase-fetch-guard"
    );
    installSupabaseFetchGuard();

    const { checkSupabaseConnectivity } = await import(
      "./lib/supabase-connectivity"
    );
    const connectivity = await checkSupabaseConnectivity();
    if (!connectivity.ok) {
      console.error(
        `[Instrumentation] Supabase connectivity check failed for ${connectivity.hostname ?? "unknown host"}: ${connectivity.error}`,
      );
    } else {
      console.log(
        `[Instrumentation] Supabase reachable (${connectivity.hostname}, status ${connectivity.status}).`,
      );
    }

    // Redis is the origin shield for a multi-school data center.
    const { isRedisConfigured, redisPing } = await import("./lib/redis/client");
    if (isRedisConfigured()) {
      const pong = await redisPing();
      console.log(
        pong
          ? "[Instrumentation] Upstash Redis reachable - rate limits & lockouts active."
          : "[Instrumentation] Upstash Redis configured but PING failed.",
      );
    } else if (isProductionServerMode()) {
      console.error(
        "[Instrumentation] Upstash Redis NOT configured - login lockout & distributed rate limits degraded.",
      );
    }

    console.log("[Instrumentation] Supabase fetch guard installed - 25 req/s limit enforced.");
  } catch (error) {
    console.error(
      "[Instrumentation] Failed to install server security / Supabase guard:",
      error instanceof Error ? error.message : error
    );
    if (process.env.ZAMSCHOOL_DC_STRICT === "true") {
      throw error;
    }
  }
}

// `register` is the hook name recognised by Next.js 15/16.
export const register = setup;
