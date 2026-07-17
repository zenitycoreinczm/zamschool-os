/**
 * Push Upstash REST credentials to the Cloudflare Worker as secrets.
 * Usage: node --env-file=.env.local scripts/put-gateway-upstash-secrets.mjs
 */
import { spawnSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const gatewayDir = resolve(root, "workers", "gateway");
const token = process.env.CF_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN;
const url = String(process.env.UPSTASH_REDIS_REST_URL || "").trim();
const redisToken = String(process.env.UPSTASH_REDIS_REST_TOKEN || "").trim();

if (!token) {
  console.error("Missing CF_API_TOKEN / CLOUDFLARE_API_TOKEN");
  process.exit(1);
}
if (!url || !redisToken) {
  console.error("Missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN");
  process.exit(1);
}

const env = {
  ...process.env,
  CLOUDFLARE_API_TOKEN: token,
  CLOUDFLARE_ACCOUNT_ID:
    process.env.CF_ACCOUNT_ID || process.env.CLOUDFLARE_ACCOUNT_ID,
};

function putSecret(name, value) {
  console.log(`Putting secret ${name}...`);
  const result = spawnSync(
    "npx",
    ["wrangler", "secret", "put", name],
    {
      cwd: gatewayDir,
      shell: true,
      env,
      input: value,
      encoding: "utf8",
      stdio: ["pipe", "inherit", "inherit"],
    },
  );
  if (result.status !== 0) {
    console.error(`Failed to put secret ${name}`);
    process.exit(result.status ?? 1);
  }
}

putSecret("UPSTASH_REDIS_REST_URL", url);
putSecret("UPSTASH_REDIS_REST_TOKEN", redisToken);
console.log("Gateway Upstash secrets updated.");
