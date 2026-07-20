import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase";

export type IdempotencyLookup = {
  routeKey: string;
  schoolId: string;
  scopeKey: string;
  idempotencyKey: string;
};

export function extractIdempotencyKey(req: Request, body?: Record<string, unknown> | null): string | null {
  const header =
    req.headers.get("idempotency-key") ||
    req.headers.get("Idempotency-Key") ||
    req.headers.get("x-idempotency-key");
  if (header && String(header).trim()) return String(header).trim().slice(0, 128);

  const fromBody =
    body && typeof body === "object"
      ? body.idempotencyKey || body.idempotency_key
      : null;
  if (fromBody && String(fromBody).trim()) return String(fromBody).trim().slice(0, 128);
  return null;
}

export function hashRequestPayload(payload: unknown): string {
  return createHash("sha256").update(JSON.stringify(payload ?? {})).digest("hex");
}

/**
 * Return a previously stored response for this key, or null if first time.
 * Service-role client bypasses RLS on idempotency_keys.
 */
export async function loadIdempotentResponse(
  lookup: IdempotencyLookup,
): Promise<NextResponse | null> {
  if (!lookup.schoolId) return null;

  const { data, error } = await supabaseAdmin
    .from("idempotency_keys")
    .select("response_json, status_code")
    .eq("route_key", lookup.routeKey)
    .eq("school_id", lookup.schoolId)
    .eq("scope_key", lookup.scopeKey)
    .eq("idempotency_key", lookup.idempotencyKey)
    .maybeSingle();

  if (error || !data) return null;

  return NextResponse.json(data.response_json ?? { success: true }, {
    status: Number(data.status_code) || 200,
    headers: { "X-Idempotent-Replay": "true" },
  });
}

export async function storeIdempotentResponse(
  lookup: IdempotencyLookup,
  requestHash: string,
  statusCode: number,
  responseJson: unknown,
): Promise<void> {
  if (!lookup.schoolId) {
    console.warn("[idempotency] store skipped: missing schoolId");
    return;
  }

  const { error } = await supabaseAdmin.from("idempotency_keys").upsert(
    {
      route_key: lookup.routeKey,
      school_id: lookup.schoolId,
      scope_key: lookup.scopeKey,
      idempotency_key: lookup.idempotencyKey,
      request_hash: requestHash,
      response_json: responseJson as Record<string, unknown>,
      status_code: statusCode,
    },
    { onConflict: "route_key,scope_key,idempotency_key" },
  );

  if (error) {
    // Soft-fail — payment already applied; replay protection is best-effort.
    console.warn("[idempotency] store failed:", error.message);
  }
}

/** Mint a server-authoritative receipt number (CSPRNG; never trust client RNG). */
export function mintReceiptNumber(now = new Date()): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  const suffix = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
  return `RCP-${y}${m}${d}-${suffix}`;
}
