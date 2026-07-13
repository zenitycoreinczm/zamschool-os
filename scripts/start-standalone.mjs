import { createRequire } from "node:module";
import { resolve } from "node:path";

import { checkSupabaseConnectivity } from "../lib/supabase-connectivity.ts";
import { assertStandaloneReady, syncStandaloneAssets } from "./prepare-standalone.mjs";

const projectRoot = process.cwd();
const prepareOnly = process.argv.includes("--prepare-only");

const result = await syncStandaloneAssets(projectRoot);
await assertStandaloneReady(projectRoot);

if (result.copied.length > 0) {
  console.log(`Prepared standalone assets: ${result.copied.join(", ")}`);
}

if (prepareOnly) {
  process.exit(0);
}

const connectivity = await checkSupabaseConnectivity();
if (!connectivity.ok) {
  console.error(
    `[start] Supabase is unreachable (${connectivity.hostname ?? "unknown"}): ${connectivity.error}`,
  );
  console.error(
    "[start] Fix network/DNS or .env.local, then restart. Use: npm run supabase:check",
  );
  process.exit(1);
}

console.log(
  `[start] Supabase reachable (${connectivity.hostname}, HTTP ${connectivity.status})`,
);

const require = createRequire(import.meta.url);
const serverEntry = resolve(projectRoot, ".next", "standalone", "server.js");

require(serverEntry);
