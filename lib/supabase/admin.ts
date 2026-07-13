import { createClient } from "@supabase/supabase-js";

let supabaseAdminInstance: ReturnType<typeof createClient<any>> | null = null;

export function getSupabaseAdmin() {
  if (supabaseAdminInstance) return supabaseAdminInstance;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || "";

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error(
      "Supabase admin client misconfigured: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required"
    );
  }

  supabaseAdminInstance = createClient<any>(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      // 20s budget: instrumentation may wait up to ~5s for the per-process
      // Supabase rate guard before the real HTTP call starts. A hard 10s
      // abort was racing that wait and cascading timeouts on dashboard load.
      fetch: (url, options = {}) => {
        const TIMEOUT_MS = 20_000;
        const controller = new AbortController();
        const external = options.signal;
        if (external) {
          if (external.aborted) {
            controller.abort();
          } else {
            external.addEventListener("abort", () => controller.abort(), {
              once: true,
            });
          }
        }
        const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
        return fetch(url, { ...options, signal: controller.signal }).finally(
          () => clearTimeout(timeoutId),
        );
      },
    },
  });

  return supabaseAdminInstance;
}

// For backward compatibility, export a getter that throws if accessed before initialization (use getSupabaseAdmin() instead)
export const supabaseAdmin = new Proxy({} as ReturnType<typeof createClient<any>>, {
  get(_target, prop) {
    return getSupabaseAdmin()[prop as keyof ReturnType<typeof createClient<any>>];
  },
});