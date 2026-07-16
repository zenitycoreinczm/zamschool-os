import type { Env } from "./types.ts";

/**
 * D1 SYNC - INTENTIONALLY DISABLED
 * ==================================
 *
 * The D1 offline read-replica (SCHOOL_DB) is a planned feature that has
 * been **shelved for now**.  These stubs exist as a skeleton for future
 * implementation but are intentionally non-functional.
 *
 * To enable in the future:
 *   1. Run `wrangler d1 create zamschool-offline` (one-time)
 *   2. Copy the returned database_id into wrangler.toml → [[d1_databases]]
 *   3. Create tables matching the upstream API schema
 *   4. Implement real sync logic in syncToD1() and queryD1Fallback() below
 *
 * Until then, all GET requests go directly to UPSTREAM_API (no D1 read).
 * All mutation responses are forwarded as-is (no D1 write-back).
 * This is safe because the upstream is always source-of-truth.
 */

/**
 * Placeholder for D1 sync logic.
 * In a full implementation, you would:
 * 1. Read the successful JSON response from upstream.
 * 2. Parse it into D1 queries.
 * 3. Upsert into the D1 `SCHOOL_DB`.
 */
export async function syncToD1(env: Env, url: URL, response: Response) {
   // Implementation would go here:
   // const data = await response.json();
   // if (url.pathname.startsWith('/api/admin/users')) {
   //    await env.SCHOOL_DB.prepare("INSERT OR REPLACE INTO users (id, name, role) VALUES (?, ?, ?)").bind(...).run();
   // }
   return;
}

/**
 * Placeholder for D1 query fallback.
 */
export async function queryD1Fallback(env: Env, pathname: string): Promise<Response | null> {
    // Implementation would go here:
    // if (pathname.startsWith('/api/admin/users')) {
    //     const { results } = await env.SCHOOL_DB.prepare("SELECT * FROM users").all();
    //     return new Response(JSON.stringify(results), {
    //         headers: { "Content-Type": "application/json", "X-Served-From": "d1-replica" }
    //     });
    // }
    return null;
}
