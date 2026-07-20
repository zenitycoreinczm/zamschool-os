import type { Env, SessionSnapshot } from "./types.ts";
import { verifyAuth } from "./auth.ts";
import { handleCachedProxy } from "./proxy.ts";
import { handleMutation, SchoolSyncQueue } from "./queue.ts";
import { matchGatewayRoute } from "./routes.ts";
import {
  checkGatewayRateLimit,
  rateLimitExceededResponse,
  rateLimitHeaders,
  resolveGatewayRateLimits,
  resolveRateLimitKey,
} from "./rate-limit.ts";

export { SchoolSyncQueue };

function corsHeaders(req: Request, env: Env) {
  const origin = req.headers.get("Origin") || "";
  const envOrigins = String(env.CORS_ALLOWED_ORIGINS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  // Fallback to dev-friendly origins when env var is unset;
  // in production, always set CORS_ALLOWED_ORIGINS to your specific frontend URLs.
  const allowedOrigins =
    envOrigins.length > 0
      ? envOrigins
      : ["http://localhost:3000", "http://localhost:5173"];

  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept, X-Requested-With, X-CSRF-Token",
    Vary: "Origin",
  };

  if (origin && allowedOrigins.includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }

  return headers;
}

const gatewayWorker = {
  async fetch(req: Request, env: Env): Promise<Response> {
    const cors = corsHeaders(req, env);

    if (req.method === "OPTIONS") {
      return new Response(null, { headers: cors });
    }

    const url = new URL(req.url);
    const route = matchGatewayRoute(url.pathname, req.method);

    if (route.kind === "not_found") {
      return new Response("Not Found", { status: 404, headers: cors });
    }

    try {
      const session = await verifyAuth(req, env);
      const limitKey = resolveRateLimitKey(req, session);
      const gatewayLimits = resolveGatewayRateLimits(env);

      const limitConfig =
        route.kind === "upload"
          ? gatewayLimits.upload
          : route.kind === "file_download" || route.kind === "cached_get_proxy" || route.kind === "get_proxy"
            ? gatewayLimits.read
            : session
              ? gatewayLimits.mutation
              : gatewayLimits.anonymous;

      const limitResult = await checkGatewayRateLimit(env, limitKey, limitConfig);
      if (!limitResult.allowed) {
        return rateLimitExceededResponse(limitResult, limitConfig, cors);
      }

      const limitHdrs = rateLimitHeaders(limitResult, limitConfig);

      if (route.kind === "upload") {
        const authHeader = req.headers.get("Authorization") || "";
        if (!authHeader.startsWith("Bearer ")) {
          return new Response("Unauthorized", { status: 401, headers: { ...cors, ...limitHdrs } });
        }

        const response = await handleUpload(req, env, authHeader);
        return withHeaders(response, cors, limitHdrs);
      }

      if (req.method !== "GET" && !session) {
        return new Response("Unauthorized", { status: 401, headers: { ...cors, ...limitHdrs } });
      }

      let response: Response;

      if (route.kind === "file_download") {
        if (!session) {
          return new Response("Unauthorized", { status: 401, headers: { ...cors, ...limitHdrs } });
        }
        response = await handleDownload(env, url, session);
      } else if (route.kind === "cached_get_proxy" || route.kind === "get_proxy") {
        if (!session) {
          return new Response("Unauthorized", { status: 401, headers: { ...cors, ...limitHdrs } });
        }
        response = await handleCachedProxy(req, env, url);
      } else if (session) {
        response = await handleMutation(req, env, url, session.userId, session.schoolId);
      } else {
        return new Response("Unauthorized", { status: 401, headers: { ...cors, ...limitHdrs } });
      }

      return withHeaders(response, cors, limitHdrs);
    } catch (err) {
      console.error(err);
      return new Response("Internal Error", { status: 500, headers: cors });
    }
  },
};

function withHeaders(response: Response, cors: Record<string, string>, extra: Record<string, string>) {
  const finalHeaders = new Headers(response.headers);
  for (const [k, v] of Object.entries({ ...cors, ...extra })) {
    finalHeaders.set(k, v);
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: finalHeaders,
  });
}

export default gatewayWorker;

async function handleUpload(req: Request, env: Env, authHeader: string): Promise<Response> {
  const formData = await req.formData();
  const file = formData.get("file");
  const entityType = String(formData.get("entityType") || "").trim();

  if (!(file instanceof File) || !entityType) {
    return Response.json({ error: "Missing file or entity type" }, { status: 400 });
  }

  const fetchImpl = env.fetch || fetch;
  const authorizeUrl = new URL("/api/files/authorize-upload", env.UPSTREAM_API);
  const authorization = await fetchImpl(
    new Request(authorizeUrl.toString(), {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        filename: file.name,
        contentType: file.type || "application/octet-stream",
        size: file.size,
        entityType,
      }),
    })
  );

  if (!authorization.ok) {
    return new Response(await authorization.text(), { status: authorization.status });
  }

  const authorizationBody = (await authorization.json()) as {
    bucket?: string;
    key?: string;
    url?: string;
    publicUrl?: string;
  };
  const key = String(authorizationBody.key || "").trim();
  if (!key) {
    return Response.json({ error: "Upload authorization did not include a storage key" }, { status: 502 });
  }

  const bucket = authorizationBody.bucket === "assets" ? env.ASSETS_BUCKET : env.UPLOADS_BUCKET;
  await bucket.put(key, await file.arrayBuffer(), {
    httpMetadata: {
      contentType: file.type || "application/octet-stream",
    },
  });

  return Response.json({
    key,
    bucket: authorizationBody.bucket || "uploads",
    url: authorizationBody.url || authorizationBody.publicUrl || null,
  });
}

async function handleDownload(env: Env, url: URL, session: SessionSnapshot): Promise<Response> {
  const key = normalizeUploadKey(url.pathname.replace("/api/files/", ""));
  if (!key) {
    return Response.json({ error: "Invalid file key" }, { status: 400 });
  }

  if (!session?.schoolId || !key.startsWith(`${session.schoolId}/`)) {
    return new Response("Forbidden", { status: 403 });
  }

  const object = await env.UPLOADS_BUCKET.get(key);
  if (!object) return new Response("Not Found", { status: 404 });
  return new Response(object.body, {
    headers: {
      "Content-Type": object.httpMetadata?.contentType || "application/octet-stream",
      "Cache-Control": "private, no-store, max-age=0, must-revalidate",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function normalizeUploadKey(rawPath: string): string | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(rawPath);
  } catch {
    return null;
  }

  const key = decoded.trim().replace(/^\/+/, "");
  if (!key || key.includes("..") || key.includes("\\") || /[\u0000-\u001f\u007f]/.test(key)) {
    return null;
  }

  return key;
}
