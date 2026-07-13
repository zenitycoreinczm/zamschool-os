import { NextResponse } from "next/server";

import { CSRF_TOKEN_COOKIE, generateCsrfToken } from "@/lib/csrf";
import { applyEdgeCacheHeaders } from "@/lib/edge-cache";

/**
 * Lightweight CSRF bootstrap for authenticated pages.
 * Always returns a readable double-submit token and sets the cookie
 * (httpOnly: false) so mutations can send X-CSRF-Token.
 */
export async function GET(req: Request) {
  const cookieHeader = req.headers.get("cookie") || "";
  const match = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${CSRF_TOKEN_COOKIE}=`));
  const existing = match
    ? decodeURIComponent(match.slice(CSRF_TOKEN_COOKIE.length + 1).trim())
    : "";
  const token = existing || generateCsrfToken();

  const url = new URL(req.url);
  const isHttps =
    req.headers.get("x-forwarded-proto") === "https" ||
    url.protocol === "https:";

  const response = NextResponse.json({
    success: true,
    data: { csrfToken: token },
  });

  response.cookies.set(CSRF_TOKEN_COOKIE, token, {
    httpOnly: false,
    secure: isHttps,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  response.headers.set("X-CSRF-Token", token);
  response.headers.append("Access-Control-Expose-Headers", "X-CSRF-Token");

  return applyEdgeCacheHeaders(response, "noStore");
}
