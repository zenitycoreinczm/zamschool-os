import { supabaseAdmin } from "@/lib/supabase";

/**
 * Refresh materialized read models after authoritative writes.
 * No-op until migrations/031_materialized_read_models.sql is applied.
 */
export async function refreshSchoolReadModels(schoolId: string): Promise<void> {
  if (!schoolId) return;

  try {
    await supabaseAdmin.rpc("refresh_zamschool_read_models", { p_school_id: schoolId });
  } catch {
    // RPC not deployed yet - safe to ignore in V1 rollout
  }
}