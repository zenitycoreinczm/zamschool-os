/**
 * Next.js instrumentation hook
 *
 * Automatically called once during server startup. Installs the global
 * Supabase fetch guard that rate-limits ALL *.supabase.co requests
 * at 25 req/s to stay within free-tier limits.
 *
 * Next.js 15+ auto-detects this file at the project root — no
 * experimental config flag needed.
 *
 * We export `register` (the original hook name) only. The [DEP0205]
 * deprecation warning about `module.register()` is emitted by Next.js
 * internals when loading custom loaders — it is not caused by this file
 * and cannot be suppressed here. It is a known cosmetic warning in
 * Next.js 16 on Node 22+ and does not affect runtime behaviour.
 */
async function setup() {
  // Only run on the server
  if (typeof window !== "undefined") return;

  try {
    const { installSupabaseFetchGuard } = await import(
      "./lib/supabase-fetch-guard"
    );
    installSupabaseFetchGuard();

    console.log("[Instrumentation] Supabase fetch guard installed — 25 req/s limit enforced.");
  } catch (error) {
    console.error(
      "[Instrumentation] Failed to install Supabase fetch guard:",
      error instanceof Error ? error.message : error
    );
  }
}

// `register` is the hook name recognised by Next.js 15/16.
export const register = setup;
