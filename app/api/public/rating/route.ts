import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createHash } from "crypto";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getClientIdentifier, rateLimitMiddleware } from "@/lib/rate-limit";

const ratingSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(500).optional(),
  // Internal paths only - never absolute URLs or scheme-relative values.
  page: z
    .string()
    .max(255)
    .refine((value) => value.startsWith("/") && !value.startsWith("//"), {
      message: "page must be an internal path",
    })
    .optional(),
});

// Burst guard on top of the per-IP DB dedupe below (Redis/KV/memory).
const RATING_RATE_LIMIT = {
  windowMs: 60 * 60 * 1000,
  maxRequests: 5,
  keyPrefix: "site-rating",
};

// Set RATING_IP_PEPPER in production; fallback keeps dedupe working in dev.
const IP_PEPPER = process.env.RATING_IP_PEPPER || "zamschool-site-rating-v1";

function hashIp(ip: string): string {
  return createHash("sha256").update(`${ip}:${IP_PEPPER}`).digest("hex");
}

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}

function summaryJson(
  body: { average: number; count: number },
  init?: ResponseInit,
) {
  const response = NextResponse.json(body, init);
  response.headers.set(
    "Cache-Control",
    "public, max-age=60, s-maxage=300, stale-while-revalidate=600",
  );
  return response;
}

export async function POST(request: NextRequest) {
  const limited = await rateLimitMiddleware(
    request,
    getClientIdentifier(request),
    RATING_RATE_LIMIT,
  );
  if (limited) return limited;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const parsed = ratingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const ipHash = hashIp(getClientIp(request));

  // One rating per IP per hour (pseudonymised hash, never the raw IP).
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { data: recentEntries, error: checkError } = await supabase
    .from("site_ratings")
    .select("id")
    .eq("ip_hash", ipHash)
    .gte("created_at", oneHourAgo)
    .limit(1);

  if (checkError) {
    return NextResponse.json({ error: "Failed to save rating" }, { status: 500 });
  }

  if (recentEntries && recentEntries.length > 0) {
    return NextResponse.json(
      { error: "Rate limited. Please wait before submitting again." },
      {
        status: 429,
        headers: { "Retry-After": String(60 * 60) },
      },
    );
  }

  const { data, error } = await supabase
    .from("site_ratings")
    .insert({
      rating: parsed.data.rating,
      comment: parsed.data.comment || null,
      page: parsed.data.page ?? null,
      ip_hash: ipHash,
    })
    .select("id")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Failed to save rating" }, { status: 500 });
  }

  return NextResponse.json(
    { success: true },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

export async function GET() {
  try {
    const { data, error } = await getSupabaseAdmin().rpc(
      "get_site_rating_summary",
    );

    if (error || !Array.isArray(data) || data.length === 0) {
      return summaryJson({ average: 0, count: 0 });
    }

    const row = data[0] as { count: number | null; average: number | null };
    const count = Number(row.count ?? 0);
    const average = count > 0 ? Number(row.average ?? 0) : 0;

    return summaryJson({ average, count });
  } catch {
    return summaryJson({ average: 0, count: 0 });
  }
}
