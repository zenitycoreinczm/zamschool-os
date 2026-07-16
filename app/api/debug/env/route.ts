import { NextResponse } from "next/server";
import { requireUnsafeLocalDevRoute } from "@/lib/dev-route-guard";

export async function GET(req: Request) {
  const blocked = requireUnsafeLocalDevRoute(req);
  if (blocked) {
    return blocked;
  }

  const env: Record<string, string> = {};
  for (const key in process.env) {
    if (key.includes("SUPABASE") || key.includes("DATABASE") || key.includes("URL")) {
      // Only indicate whether the value is set - never leak partial secrets,
      // even in dev. A 5-char prefix is enough to assist brute-force attacks.
      env[key] = process.env[key] ? "<set>" : "<missing>";
    }
  }
  return NextResponse.json(env);
}
