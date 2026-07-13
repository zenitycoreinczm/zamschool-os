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

function escapeTomlString(s) {
  return JSON.stringify(s);
}

function stripServer(text, name) {
  const sectionRe = new RegExp(
    `\\n?\\[mcp_servers\\.${name}\\][\\s\\S]*?(?=\\n\\[|$)`,
    "g",
  );
  const nestedRe = new RegExp(
    `\\n?\\[mcp_servers\\.${name}\\.[^\\]]+\\][\\s\\S]*?(?=\\n\\[|$)`,
    "g",
  );
  return text.replace(nestedRe, "").replace(sectionRe, "");
}

const env = loadEnvLocal();
const configPath = join(homedir(), ".grok", "config.toml");
let text = existsSync(configPath) ? readFileSync(configPath, "utf8") : "";

const cfToken =
  env.CF_API_TOKEN ||
  env.CLOUDFLARE_KV_TOKEN ||
  env.CLOUDFLARE_IMAGES_TOKEN ||
  env.KV_REST_API_TOKEN ||
  "";

// Keep main cloudflare API MCP (may fail if token has IP allowlist)
text = stripServer(text, "cloudflare");
text = stripServer(text, "cloudflare_docs");
text = stripServer(text, "cloudflare_bindings");
text = text.trimEnd() + "\n";

// Docs server works without account token scopes
text += `
[mcp_servers.cloudflare_docs]
url = "https://docs.mcp.cloudflare.com/mcp"
enabled = true
`;

// Full API MCP — requires unrestricted API token (no client IP filter)
if (cfToken) {
  text += `
[mcp_servers.cloudflare]
url = "https://mcp.cloudflare.com/mcp"
enabled = true

[mcp_servers.cloudflare.headers]
Authorization = ${escapeTomlString(`Bearer ${cfToken}`)}
`;
}

writeFileSync(configPath, text);
console.log("Updated", configPath);

const doctor = spawnSync("grok", ["mcp", "doctor"], { encoding: "utf8" });
process.stdout.write(doctor.stdout || "");
process.stderr.write(doctor.stderr || "");
process.exit(doctor.status ?? 0);
