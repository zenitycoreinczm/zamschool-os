import type { SupabaseClient } from "@supabase/supabase-js";

import { invalidateWorkspaceContext } from "./context-client";

/**
 * Leaves the workspace cleanly: clears cached context, signs out locally,
 * then performs a full navigation so shell UI cannot linger over /login.
 */
export async function performWorkspaceSignOut(
  supabase: Pick<SupabaseClient, "auth">
): Promise<void> {
  invalidateWorkspaceContext();

  try {
    await supabase.auth.signOut({ scope: "local" });
  } catch {
    // Still redirect — user intent is to leave the workspace.
  }

  if (typeof window !== "undefined") {
    window.location.replace("/login");
  }
}
