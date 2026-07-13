import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { homedir } from "node:os";
import { join } from "node:path";

function loadEnvLocal(path = ".env.local") {
  if (!existsSync(path)) throw new Error(`${path} not found`);
  const env = {};
  for (const raw of readFileSync(path, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const i = line.indexOf("=");
    const key = line.slice(0, i).trim();
    let val = line.slice(i + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    env[key] = val;
  }
  return env;
}

function mask(v) {
  if (!v) return "MISSING";
  return `set len=${v.length} prefix=${v.slice(0, 8)}`;
}

function escapeTomlString(s) {
  return JSON.stringify(s);
}

function upsertMcpHttpServer(configPath, name, url, headers = {}) {
  let text = existsSync(configPath) ? readFileSync(configPath, "utf8") : "";

  // Drop existing sections for this server (main + headers)
  const sectionRe = new RegExp(
    `\\n?\\[mcp_servers\\.${name}\\][\\s\\S]*?(?=\\n\\[|$)`,
    "g",
  );
  const headersRe = new RegExp(
    `\\n?\\[mcp_servers\\.${name}\\.headers\\][\\s\\S]*?(?=\\n\\[|$)`,
    "g",
  );
  text = text.replace(headersRe, "").replace(sectionRe, "").trimEnd() + "\n";

  let block = `\n[mcp_servers.${name}]\nurl = ${escapeTomlString(url)}\nenabled = true\n`;
  if (Object.keys(headers).length > 0) {
    block += `\n[mcp_servers.${name}.headers]\n`;
    for (const [k, v] of Object.entries(headers)) {
      block += `${k} = ${escapeTomlString(v)}\n`;
    }
  }

  writeFileSync(configPath, text + block);
  console.log(`Wrote [mcp_servers.${name}] to ${configPath}`);
}

function upsertMcpStdioServer(configPath, name, command, args, envVars = {}) {
  let text = existsSync(configPath) ? readFileSync(configPath, "utf8") : "";
  const sectionRe = new RegExp(
    `\\n?\\[mcp_servers\\.${name}\\][\\s\\S]*?(?=\\n\\[|$)`,
    "g",
  );
  // also remove nested tables if any
  const nestedRe = new RegExp(
    `\\n?\\[mcp_servers\\.${name}\\.[^\\]]+\\][\\s\\S]*?(?=\\n\\[|$)`,
    "g",
  );
  text = text.replace(nestedRe, "").replace(sectionRe, "").trimEnd() + "\n";

  let block = `\n[mcp_servers.${name}]\ncommand = ${escapeTomlString(command)}\nargs = [${args
    .map(escapeTomlString)
    .join(", ")}]\nenabled = true\nstartup_timeout_sec = 60\n`;
  if (Object.keys(envVars).length > 0) {
    block += `\n[mcp_servers.${name}.env]\n`;
    for (const [k, v] of Object.entries(envVars)) {
      block += `${k} = ${escapeTomlString(v)}\n`;
    }
  }
  writeFileSync(configPath, text + block);
  console.log(`Wrote [mcp_servers.${name}] (stdio) to ${configPath}`);
}

function run(cmd, args) {
  console.log(`\n> ${cmd} ${args.join(" ")}`);
  const res = spawnSync(cmd, args, { encoding: "utf8", shell: false });
  if (res.stdout) process.stdout.write(res.stdout);
  if (res.stderr) process.stderr.write(res.stderr);
  return res.status ?? 1;
}

const env = loadEnvLocal();
const configPath = join(homedir(), ".grok", "config.toml");

const cfToken =
  env.CF_API_TOKEN ||
  env.CLOUDFLARE_KV_TOKEN ||
  env.CLOUDFLARE_IMAGES_TOKEN ||
  env.KV_REST_API_TOKEN ||
  "";
const cfAccount = env.CF_ACCOUNT_ID || env.CLOUDFLARE_KV_ACCOUNT_ID || "";

const upstashEmail = env.UPSTASH_EMAIL || env.SMTP_USER || "";
const upstashApiKey = env.UPSTASH_API_KEY || "";
const upstashRedisUrl = env.UPSTASH_REDIS_REST_URL || "";
const upstashRedisToken = env.UPSTASH_REDIS_REST_TOKEN || "";

console.log("Env discovery:");
console.log("  CF_ACCOUNT_ID:", mask(cfAccount));
console.log("  CF_API_TOKEN:", mask(cfToken));
console.log("  UPSTASH_EMAIL:", mask(upstashEmail));
console.log("  UPSTASH_API_KEY:", mask(upstashApiKey));
console.log("  UPSTASH_REDIS_REST_URL:", mask(upstashRedisUrl));
console.log("  UPSTASH_REDIS_REST_TOKEN:", mask(upstashRedisToken));
console.log("  config:", configPath);

if (cfToken) {
  upsertMcpHttpServer(configPath, "cloudflare", "https://mcp.cloudflare.com/mcp", {
    Authorization: `Bearer ${cfToken}`,
  });
} else {
  console.error("No Cloudflare API token found; skipping cloudflare MCP");
}

if (upstashEmail && upstashApiKey) {
  upsertMcpStdioServer(
    configPath,
    "upstash",
    "npx",
    [
      "-y",
      "@upstash/mcp-server@latest",
      "--email",
      upstashEmail,
      "--api-key",
      upstashApiKey,
    ],
  );
} else {
  console.warn(
    "\nUpstash management MCP needs UPSTASH_EMAIL + UPSTASH_API_KEY.",
  );
  console.warn(
    "Redis REST URL/token alone cannot authenticate @upstash/mcp-server.",
  );
  console.warn("Add to .env.local:");
  console.warn("  UPSTASH_EMAIL=your-upstash-login-email");
  console.warn("  UPSTASH_API_KEY=<from https://console.upstash.com/account/api>");
  console.warn("Then re-run: node scripts/setup-mcp-from-env.mjs");

  writeFileSync(
    "scripts/upstash-mcp-needed.env.example",
    [
      "# Required for Upstash management MCP (@upstash/mcp-server)",
      "# These are NOT the same as UPSTASH_REDIS_REST_URL / TOKEN",
      "UPSTASH_EMAIL=your-upstash-account-email@example.com",
      "UPSTASH_API_KEY=your-console-api-key",
      "",
    ].join("\n"),
  );
}

console.log("\n--- grok mcp list ---");
run("grok", ["mcp", "list"]);

console.log("\n--- grok mcp doctor ---");
run("grok", ["mcp", "doctor"]);
