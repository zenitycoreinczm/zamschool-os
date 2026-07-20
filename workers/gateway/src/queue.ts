import type { Env, QueuedMutation } from "./types.ts";
import { isQueuableMutationPath } from "./types.ts";

/**
 * Durable Object acting as an offline mutation queue for a school.
 */
export class SchoolSyncQueue {
  state: DurableObjectState;
  env: Env;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request: Request) {
    const url = new URL(request.url);

    if (request.method === "POST" && url.pathname === "/enqueue") {
      try {
        const payload = (await request.json()) as QueuedMutation;
        const queue = (await this.state.storage.get<QueuedMutation[]>("queue")) || [];
        
        queue.push(payload);
        await this.state.storage.put("queue", queue);
        
        return new Response(JSON.stringify({ status: "queued", length: queue.length }), { 
          status: 202,
          headers: { "Content-Type": "application/json", "X-Served-From": "offline-queue" }
        });
      } catch (err) {
        return new Response("Bad Request", { status: 400 });
      }
    }

    if (request.method === "POST" && url.pathname === "/flush") {
      await this.flushQueue();
      return new Response(JSON.stringify({ status: "flushed" }), { status: 200 });
    }

    return new Response("Not Found", { status: 404 });
  }

  async flushQueue() {
    const queue = (await this.state.storage.get<QueuedMutation[]>("queue")) || [];
    if (queue.length === 0) return;

    const fetchImpl = this.env.fetch || fetch;
    const remainingQueue: QueuedMutation[] = [];

    for (const item of queue) {
      try {
        const upstreamUrl = new URL(item.path, this.env.UPSTREAM_API);
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          "X-From-Offline-Queue": "true"
        };
        // Replay the original auth token so the upstream can authenticate
        // the delayed mutation just as it would an in-session request.
        if (item.authHeader) {
          headers["Authorization"] = item.authHeader;
        }
        const response = await fetchImpl(new Request(upstreamUrl.toString(), {
          method: item.method,
          headers,
          body: JSON.stringify(item.body)
        }));

        if (!response.ok && response.status >= 500) {
          // Upstream down, keep in queue
          remainingQueue.push(item);
        } else if (!response.ok && response.status < 500) {
           // Client error (4xx) - drop it or log it to DLQ (Dead Letter Queue)
           console.error("Queue item failed permanently:", item, response.status);
        }
        // Success -> dropped from queue
      } catch (err) {
        // Network error -> keep in queue
        remainingQueue.push(item);
      }
    }

    if (remainingQueue.length === 0) {
      await this.state.storage.delete("queue");
    } else {
      await this.state.storage.put("queue", remainingQueue);
    }
  }
}

/**
 * Handle POST/PUT/DELETE requests.
 * Tries upstream first. If upstream fails (offline), enqueues JSON mutations.
 *
 * IMPORTANT: multipart/form-data and binary bodies must be forwarded as
 * ArrayBuffer (never req.text()) — UTF-8 decoding corrupts Excel/CSV uploads
 * and was returning 500 upstream then 503 from the gateway.
 */
export async function handleMutation(req: Request, env: Env, url: URL, userId: string, schoolId: string): Promise<Response> {
  const fetchImpl = env.fetch || fetch;
  const upstreamUrl = new URL(url.pathname + url.search, env.UPSTREAM_API);
  const contentType = req.headers.get("Content-Type") || "";
  const isMultipart = /multipart\/form-data/i.test(contentType);
  const isBinary =
    isMultipart ||
    /application\/octet-stream|application\/vnd\.|application\/pdf/i.test(
      contentType,
    );

  // Buffer body once for replay. Use bytes for multipart/binary; text for JSON.
  let bodyBytes: ArrayBuffer | null = null;
  let bodyText = "";
  try {
    if (req.method !== "GET" && req.method !== "HEAD") {
      if (isBinary) {
        bodyBytes = await req.arrayBuffer();
      } else {
        bodyText = await req.text();
      }
    }
  } catch {
    // empty body is fine
  }

  const forwardBody = (): BodyInit | undefined => {
    if (bodyBytes && bodyBytes.byteLength > 0) return bodyBytes;
    if (bodyText) return bodyText;
    return undefined;
  };

  try {
    const response = await fetchImpl(
      new Request(upstreamUrl.toString(), {
        method: req.method,
        headers: req.headers,
        body: forwardBody(),
      }),
    );

    if (response.ok) {
      return response;
    }

    // 4xx are real client/auth/validation errors — pass through, never queue.
    if (response.status < 500) {
      return response;
    }

    // For multipart uploads, never queue (can't store binary in DO JSON queue).
    // Pass the upstream 5xx through so the client sees the real failure.
    if (isMultipart || isBinary) {
      return response;
    }

    // 5xx JSON mutations: treat as upstream down for queueable paths.
    throw new Error(`Upstream error: ${response.status}`);
  } catch (err) {
    // Network / 5xx. Can we queue this?
    if (!isMultipart && !isBinary && isQueuableMutationPath(url.pathname) && schoolId) {
      let parsedBody: unknown = null;
      try {
        parsedBody = bodyText ? JSON.parse(bodyText) : null;
      } catch {
        parsedBody = null;
      }

      const payload: QueuedMutation = {
        id: crypto.randomUUID(),
        schoolId,
        userId,
        method: req.method,
        path: url.pathname + url.search,
        body: parsedBody,
        timestamp: Date.now(),
        authHeader: req.headers.get("Authorization") || undefined,
      };

      const id = env.SYNC_QUEUE.idFromName(schoolId);
      const obj = env.SYNC_QUEUE.get(id);

      await obj.fetch(
        new Request("http://do/enqueue", {
          method: "POST",
          body: JSON.stringify(payload),
          headers: { "Content-Type": "application/json" },
        }),
      );

      // Stable shape for clients (attendance expects data.savedCount).
      const statusCount = Array.isArray(
        (parsedBody as { statuses?: unknown[] } | null)?.statuses,
      )
        ? (parsedBody as { statuses: unknown[] }).statuses.length
        : 0;

      return new Response(
        JSON.stringify({
          success: true,
          queued: true,
          status: "queued",
          data: {
            savedCount: statusCount,
            parentsNotified: 0,
            notificationsQueued: 0,
            offline: true,
          },
        }),
        {
          status: 202,
          headers: {
            "Content-Type": "application/json",
            "X-Served-From": "offline-queue",
          },
        },
      );
    }

    // Multipart / non-queueable: prefer honest failure over fake offline queue.
    if (isMultipart || isBinary) {
      return new Response(
        JSON.stringify({
          error:
            "Upload failed to reach the app server. Try again, or use a smaller file.",
        }),
        {
          status: 503,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    return new Response(
      JSON.stringify({ error: "Offline: changes can't be saved yet." }),
      {
        status: 503,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}
