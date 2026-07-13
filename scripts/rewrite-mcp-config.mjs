import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { spawnSync } from "node:child_process";

function loadEnvLocal(path = ".env.local") {
  const env = {};
  for (const raw of readFileSync(path, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const i = line.indexOf("=");
    let v = line.slice(i + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    env[line.slice(0, i).trim()] = v;
  }
  return env;
}

const env = loadEnvLocal();
const configPath = join(homedir(), ".grok", "config.toml");
const existing = existsSync(configPath)
  ? readFileSync(configPath, "utf8")
  : "";

// Preserve non-MCP sections from the start of the file
const firstMcp = existing.search(/\n\[mcp_servers\./);
const head =
  firstMcp >= 0
    ? existing.slice(0, firstMcp).trimEnd()
    : existing.trimEnd() ||
      `[cli]
installer = "internal"
`;

const supabaseToken =
  env.SUPABASE_ACCESS_TOKEN || env.SUPABASE_MGMT_TOKEN || "";
const projectRef = env.SUPABASE_PROJECT_REF || "jnnroitaftfmclegbeac";
const cfToken =
  env.CF_API_TOKEN ||
  env.CLOUDFLARE_KV_TOKEN ||
  env.CLOUDFLARE_IMAGES_TOKEN ||
  env.KV_REST_API_TOKEN ||
  "";

const supabaseUrl = `https://mcp.supabase.com/mcp?project_ref=${projectRef}&features=docs%2Caccount%2Cdatabase%2Cdebugging%2Cdevelopment%2Cfunctions%2Cbranching%2Cstorage`;

let mcp = `

[mcp_servers.supabase]
url = ${JSON.stringify(supabaseUrl)}
enabled = true

[mcp_servers.supabase.headers]
Authorization = ${JSON.stringify(`Bearer ${supabaseToken}`)}

[mcp_servers.cloudflare_docs]
url = "https://docs.mcp.cloudflare.com/mcp"
enabled = true
`;

// Full Cloudflare API MCP is registered but disabled until the API token
// allows this client IP and has sufficient scope.
if (cfToken) {
  mcp += `
[mcp_servers.cloudflare]
url = "https://mcp.cloudflare.com/mcp"
enabled = false

[mcp_servers.cloudflare.headers]
Authorization = ${JSON.stringify(`Bearer ${cfToken}`)}
`;
}

writeFileSync(configPath, head + mcp + "\n");
console.log("Rewrote", configPath);

const list = spawnSync("grok", ["mcp", "list"], { encoding: "utf8" });
process.stdout.write(list.stdout || "");
process.stderr.write(list.stderr || "");

const doctor = spawnSync("grok", ["mcp", "doctor"], { encoding: "utf8" });
process.stdout.write(doctor.stdout || "");
process.stderr.write(doctor.stderr || "");
process.exit(doctor.status ?? 0);
