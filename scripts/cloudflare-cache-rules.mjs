/**
 * Prints ZamSchool OS Cache Rules + Rate Limit hints for Cloudflare dashboard.
 * Usage: node scripts/cloudflare-cache-rules.mjs
 *        npm run cloudflare:cache-rules
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const originRaw = (
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.NEXT_PUBLIC_WEBAPP_ORIGIN ||
  "https://your-app.example.com"
).replace(/\/+$/, "");

let host = "your-app.example.com";
try {
  host = new URL(originRaw).host;
} catch {
  console.warn(`Invalid origin "${originRaw}" - using placeholder host in expressions.\n`);
}

const pathExpr = (p) =>
  `(http.host eq "${host}" and ${p})`;

const cacheRules = [
  {
    name: "ZamSchool - cache private dashboard reads",
    expression: pathExpr('starts_with(http.request.uri.path, "/api/dashboard")'),
    settings: { cache: true, edge_ttl: "respect_origin", browser_ttl: "respect_origin" },
    notes: "Origin sends private, max-age=30 via lib/edge-cache.ts. Vary: Authorization.",
  },
  {
    name: "ZamSchool - cache workspace context",
    expression: pathExpr('http.request.uri.path eq "/api/account/workspace-context"'),
    settings: { cache: true, edge_ttl: "respect_origin", browser_ttl: "respect_origin" },
  },
  {
    name: "ZamSchool - bypass inbox polling",
    expression: pathExpr(
      '(http.request.uri.path eq "/api/account/unread-summary" or http.request.uri.path eq "/api/account/inbox-preview")'
    ),
    settings: { cache: false },
  },
  {
    name: "ZamSchool - bypass auth APIs",
    expression: pathExpr('starts_with(http.request.uri.path, "/api/auth/")'),
    settings: { cache: false },
  },
  {
    name: "ZamSchool - static Next assets",
    expression: pathExpr('starts_with(http.request.uri.path, "/_next/static/")'),
    settings: { cache: true, edge_ttl: 86400, browser_ttl: 86400 },
  },
];

const rateLimitRules = [
  {
    name: "ZamSchool - auth brute-force guard",
    expression: pathExpr(
      'http.request.method eq "POST" and starts_with(http.request.uri.path, "/api/auth/")'
    ),
    characteristics: ["ip.src"],
    period: 60,
    requests_per_period: 10,
  },
  {
    name: "ZamSchool - login page POST",
    expression: pathExpr('http.request.method eq "POST" and http.request.uri.path eq "/login"'),
    characteristics: ["ip.src"],
    period: 60,
    requests_per_period: 15,
  },
];

const payload = {
  generatedAt: new Date().toISOString(),
  origin: originRaw,
  host,
  cacheRules,
  rateLimitRules,
};

const outDir = resolve(dirname(fileURLToPath(import.meta.url)), "output");
const outFile = resolve(outDir, "cloudflare-cache-rules.json");

try {
  mkdirSync(outDir, { recursive: true });
  writeFileSync(outFile, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  console.log(`Wrote ${outFile}\n`);
} catch (e) {
  console.warn(`Could not write ${outFile}:`, e instanceof Error ? e.message : e);
  console.log("");
}

console.log("=== ZamSchool Cloudflare cache rules ===\n");
for (const rule of cacheRules) {
  console.log(`• ${rule.name}`);
  console.log(`  Expression: ${rule.expression}`);
  console.log(`  ${rule.notes || JSON.stringify(rule.settings)}`);
  console.log("");
}

console.log("=== Rate limiting (WAF) ===\n");
for (const rule of rateLimitRules) {
  console.log(`• ${rule.name}`);
  console.log(`  Expression: ${rule.expression}`);
  console.log(`  ${rule.requests_per_period} requests / ${rule.period}s per ${rule.characteristics.join(", ")}`);
  console.log("");
}

console.log("Origin headers: lib/edge-cache.ts (applyEdgeCacheHeaders).");
console.log("Actor cache invalidation: lib/invalidate-actor-caches.ts");