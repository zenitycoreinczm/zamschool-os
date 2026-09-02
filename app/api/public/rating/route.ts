import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createHash } from "crypto";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getClientIdentifier, rateLimitMiddleware } from "@/lib/rate-limit";
import { emailService } from "@/lib/email";
import { wrapEmailHtml } from "@/lib/email-templates";

const ratingSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(500).optional(),
  name: z.string().trim().max(80).optional(),
  school: z.string().trim().max(120).optional(),
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

// Where review notifications are sent. Defaults to the executive desk.
const REVIEW_NOTIFY_EMAIL =
  process.env.REVIEW_NOTIFY_EMAIL || "zenitycoreinc@gmail.com";

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

/** Escape user text for safe interpolation into email HTML. */
function escapeHtml(value: string): string {
  return value.replace(/[<>&"]/g, (c) =>
    c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === '"' ? "&quot;" : "&amp;",
  );
}

/** Fire-and-forget admin email for new review comments (never blocks the save). */
function notifyReviewByEmail(entry: {
  rating: number;
  comment?: string;
  name?: string;
  school?: string;
  page?: string;
}) {
  if (!entry.comment) return;
  const who =
    [entry.name, entry.school]
      .filter((value): value is string => Boolean(value))
      .map(escapeHtml)
      .join(" — ") || "Anonymous visitor";
  const subject = `New ${entry.rating}-star review on zamschoolos.site`;
  const appOrigin =
    process.env.NEXT_PUBLIC_APP_ORIGIN || "https://www.zamschoolos.site";

  const html = wrapEmailHtml(
    `
      <p><strong>${entry.rating}/5</strong> from ${who}</p>
      <blockquote style="border-left:3px solid #0ea5e9;margin:12px 0;padding-left:12px;color:#0f172a">
        ${escapeHtml(entry.comment)}
      </blockquote>
      <p style="color:#64748b;font-size:13px">
        Approve or hide it in Super Admin &rarr; Reviews:<br />
        ${appOrigin}/app/super-admin/reviews
      </p>
    `,
    "New site review",
  );

  void emailService
    .sendEmail({
      to: REVIEW_NOTIFY_EMAIL,
      subject,
      html,
      text: `${entry.rating}/5 from ${who}\n\n${entry.comment}\n\nApprove: ${appOrigin}/app/super-admin/reviews`,
    })
    .catch(() => {
      // Notification failures must never surface to the visitor.
    });
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
      name: parsed.data.name || null,
      school: parsed.data.school || null,
      page: parsed.data.page ?? null,
      ip_hash: ipHash,
    })
    .select("id")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Failed to save rating" }, { status: 500 });
  }

  // Email the executive desk about comments (fire-and-forget).
  notifyReviewByEmail({
    rating: parsed.data.rating,
    comment: parsed.data.comment,
    name: parsed.data.name,
    school: parsed.data.school,
    page: parsed.data.page,
  });

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
