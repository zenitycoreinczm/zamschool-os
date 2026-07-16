/**
 * Provision Cloudflare resources for ZamSchool Gateway Worker.
 *
 * Creates KV namespaces (SESSION_CACHE, RATE_LIMITS) if they don't exist,
 * patches wrangler.toml with real IDs, and sets the SUPABASE_JWT_SECRET.
 *
 * Usage:
 *   node scripts/provision-cloudflare.mjs                    # create KV + patch wrangler.toml
 *   node scripts/provision-cloudflare.mjs --set-jwt-secret   # also set the JWT secret
 *   node scripts/provision-cloudflare.mjs --dry-run          # show what would happen
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const gatewayDir = resolve(root, "workers", "gateway");
const wranglerPath = resolve(gatewayDir, "wrangler.toml");

const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has("--dry-run");
const SET_JWT_SECRET = args.has("--set-jwt-secret");

const accountId = process.env.CF_ACCOUNT_ID || process.env.CLOUDFLARE_ACCOUNT_ID;
const apiToken = process.env.CF_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN;

if (!accountId || !apiToken) {
  console.error("Missing CF_ACCOUNT_ID or CF_API_TOKEN in environment. Source .env.local first:");
  console.error("  node --env-file=.env.local scripts/provision-cloudflare.mjs");
  process.exit(1);
}

function cfApi(method, path, body) {
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}${path}`;
  const headers = { Authorization: `Bearer ${apiToken}`, "Content-Type": "application/json" };
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);

  const result = spawnSync("node", [
    "-e",
    `fetch("${url}", ${JSON.stringify(opts)}).then(r => r.json()).then(d => process.stdout.write(JSON.stringify(d))).catch(e => { console.error(e); process.exit(1); })`,
  ], { encoding: "utf-8", timeout: 30_000 });

  if (result.error) throw result.error;
  return JSON.parse(result.stdout);
}

async function findOrCreateNamespace(title) {
  console.log(`\n  Looking up KV namespace "${title}"...`);
  const list = cfApi("GET", "/storage/kv/namespaces");
  if (!list.success) {
    console.error("  Failed to list KV namespaces:", list.errors);
    process.exit(1);
  }

  const existing = list.result.find((ns) => ns.title === title);
  if (existing) {
    console.log(`  Found: ${title} → ${existing.id}`);
    return existing.id;
  }

  if (DRY_RUN) {
    console.log(`  Would create: ${title}`);
    return `<dry-run-${title}>`;
  }

  console.log(`  Creating "${title}"...`);
  const created = cfApi("POST", "/storage/kv/namespaces", { title });
  if (!created.success) {
    console.error(`  Failed to create "${title}":`, created.errors);
    process.exit(1);
  }
  console.log(`  Created: ${title} → ${created.result.id}`);
  return created.result.id;
}

async function main() {
  console.log("=== ZamSchool Cloudflare Provisioning ===");
  console.log(`Account: ${accountId}`);
  console.log(`Dry run: ${DRY_RUN}`);

  // 1. Find or create KV namespaces
  const sessionCacheId = await findOrCreateNamespace("SESSION_CACHE");
  const rateLimitsId = await findOrCreateNamespace("RATE_LIMITS");

  // 2. Patch wrangler.toml
  console.log("\n  Patching wrangler.toml...");
  let toml = readFileSync(wranglerPath, "utf-8");

  const replacements = [
    { from: /id = "SESSION_CACHE_NAMESPACE_ID".*/, to: `id = "${sessionCacheId}"` },
    { from: /id = "RATE_LIMITS_NAMESPACE_ID".*/, to: `id = "${rateLimitsId}"` },
  ];

  for (const { from, to } of replacements) {
    if (from.test(toml)) {
      toml = toml.replace(from, to);
      console.log(`    ${to}`);
    } else {
      console.log(`    (already patched or pattern not found)`);
    }
  }

  if (!DRY_RUN) {
    writeFileSync(wranglerPath, toml, "utf-8");
    console.log("  wrangler.toml updated.");
  } else {
    console.log("  Would write wrangler.toml (dry run).");
  }

  // 3. Optionally set SUPABASE_JWT_SECRET
  if (SET_JWT_SECRET) {
    const secret = process.env.SUPABASE_JWT_SECRET;
    if (!secret) {
      console.log("\n  SUPABASE_JWT_SECRET not in environment - skipping secret set.");
      console.log("  Run manually: echo '<secret>' | wrangler secret put SUPABASE_JWT_SECRET");
    } else if (!DRY_RUN) {
      console.log("\n  Setting SUPABASE_JWT_SECRET...");
      const result = spawnSync("npx", ["wrangler", "secret", "put", "SUPABASE_JWT_SECRET"], {
        cwd: gatewayDir,
        input: secret,
        encoding: "utf-8",
        timeout: 30_000,
        env: { ...process.env, CLOUDFLARE_API_TOKEN: apiToken, CLOUDFLARE_ACCOUNT_ID: accountId },
      });
      if (result.status === 0) {
        console.log("  Secret set successfully.");
      } else {
        console.error("  Failed to set secret:", result.stderr || result.stdout);
      }
    } else {
      console.log("\n  Would set SUPABASE_JWT_SECRET (dry run).");
    }
  }

  // 4. Print summary
  console.log("\n=== Summary ===");
  console.log(`SESSION_CACHE KV: ${sessionCacheId}`);
  console.log(`RATE_LIMITS KV:   ${rateLimitsId}`);
  console.log(`wrangler.toml:    ${DRY_RUN ? "(not written - dry run)" : "patched"}`);
  console.log("\nNext steps:");
  console.log("  1. Run: node --env-file=.env.local scripts/run-wrangler-with-env.mjs -- deploy");
  console.log("  2. Set NEXT_PUBLIC_GATEWAY_URL in Vercel to the deployed worker URL");
  console.log("  3. Get CLOUDFLARE_IMAGES_ACCOUNT_HASH from Cloudflare Dashboard → Images");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
