/**
 * Run wrangler for the gateway worker using OAuth (wrangler login), not a
 * long-lived API token forced from the environment.
 *
 * Usage:
 *   node --env-file=.env.local scripts/run-wrangler-with-env.mjs -- whoami
 *   node --env-file=.env.local scripts/run-wrangler-with-env.mjs -- deploy
 *
 * Auth: run once in workers/gateway: npx wrangler login
 * Optional: CF_ACCOUNT_ID / CLOUDFLARE_ACCOUNT_ID to pin the account.
 *
 * API tokens in .env.local (CF_API_TOKEN / CLOUDFLARE_API_TOKEN) are ignored
 * so they cannot override OAuth and cause 10000 permission errors.
 */
import { spawnSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
if (args[0] === "--") args.shift();

const gatewayDir = resolve(root, "workers", "gateway");

// Prefer interactive OAuth session from `wrangler login`.
// Strip token env vars so they cannot take priority over OAuth credentials.
const {
  CLOUDFLARE_API_TOKEN: _dropToken,
  CF_API_TOKEN: _dropCfToken,
  ...restEnv
} = process.env;

const env = {
  ...restEnv,
  CLOUDFLARE_ACCOUNT_ID:
    process.env.CF_ACCOUNT_ID || process.env.CLOUDFLARE_ACCOUNT_ID || "",
};

// Avoid empty account id env confusing wrangler.
if (!env.CLOUDFLARE_ACCOUNT_ID) {
  delete env.CLOUDFLARE_ACCOUNT_ID;
}

const result = spawnSync("npx", ["wrangler", ...args], {
  cwd: gatewayDir,
  stdio: "inherit",
  shell: true,
  env,
});

if ((result.status ?? 1) !== 0 && args[0] !== "login") {
  console.error("\nIf auth failed, log in with OAuth:");
  console.error("  cd workers/gateway");
  console.error("  npx wrangler login");
  console.error("Then re-run this command.\n");
}

process.exit(result.status ?? 1);
