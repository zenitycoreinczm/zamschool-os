import { supabaseAdmin } from "@/lib/supabase";

export interface TenantCacheInvalidationPayload {
  schoolId: string;
  domain?: string;
  table?: string;
  recordId?: string;
  action?: "insert" | "update" | "delete" | "invalidate";
  timestamp?: number;
}

/**
 * Broadcasts a Realtime cache-invalidation event to all connected devices in the tenant channel.
 * Mobile devices listening on `tenant:${schoolId}` immediately invalidate in-memory caches
 * and trigger WatermelonDB pulls so web and mobile stay synchronized without waiting for polling.
 */
export async function broadcastTenantCacheInvalidation(
  event: TenantCacheInvalidationPayload,
): Promise<void> {
  const schoolId = String(event.schoolId || "").trim();
  if (!schoolId || !supabaseAdmin) return;

  try {
    const channel = supabaseAdmin.channel(`tenant:${schoolId}`);
    await channel.send({
      type: "broadcast",
      event: "cache:invalidate",
      payload: {
        ...event,
        timestamp: event.timestamp || Date.now(),
      },
    });
  } catch (err) {
    // Non-blocking telemetry warning - write mutations should not fail if broadcast fails
    console.warn(`[realtime-broadcast] Failed to broadcast on tenant:${schoolId}`, err);
  }
}
