import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

/**
 * Public, APPROVED reviews for the landing page + JSON-LD reviews markup.
 * Only the sanitized RPC projection is exposed - never ids or ip hashes.
 */
export async function GET() {
  try {
    const { data, error } = await getSupabaseAdmin().rpc(
      "get_site_reviews_public",
      { limit_count: 12 },
    );

    if (error || !Array.isArray(data)) {
      return NextResponse.json(
        { reviews: [] },
        {
          headers: {
            "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=600",
          },
        },
      );
    }

    const reviews = data.map((row: {
      rating: number;
      comment: string;
      name: string | null;
      school: string | null;
      created_at: string;
    }) => ({
      rating: Number(row.rating),
      comment: String(row.comment || ""),
      name: row.name || null,
      school: row.school || null,
      createdAt: row.created_at,
    }));

    return NextResponse.json(
      { reviews },
      {
        headers: {
          "Cache-Control":
            "public, max-age=60, s-maxage=300, stale-while-revalidate=600",
        },
      },
    );
  } catch {
    return NextResponse.json(
      { reviews: [] },
      {
        headers: {
          "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=600",
        },
      },
    );
  }
}
