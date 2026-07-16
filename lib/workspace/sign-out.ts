import type { SupabaseClient } from "@supabase/supabase-js";

import { clearClientAuthCaches } from "./clear-client-auth-caches";

/**
 * Leaves the workspace cleanly: clears cached context, signs out locally,
 * then performs a full navigation so shell UI cannot linger over /login.
 */
export async function performWorkspaceSignOut(
  supabase: Pick<SupabaseClient, "auth">
): Promise<void> {
  clearClientAuthCaches();

  try {
    // Prefer global so other tabs drop the session; fall back to local.
    await supabase.auth.signOut({ scope: "global" }).catch(async () => {
      await supabase.auth.signOut({ scope: "local" });
    });
  } catch {
    // Still redirect - user intent is to leave the workspace.
  }

  // Clear again after signOut in case auth listeners re-populated caches.
  clearClientAuthCaches();

  if (typeof window !== "undefined") {
    window.location.replace("/login");
  }
}
