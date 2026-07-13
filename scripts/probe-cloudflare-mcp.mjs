import { readFileSync } from "node:fs";

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
const token =
  env.CF_API_TOKEN ||
  env.CLOUDFLARE_KV_TOKEN ||
  env.CLOUDFLARE_IMAGES_TOKEN ||
  env.KV_REST_API_TOKEN;
const account = env.CF_ACCOUNT_ID || env.CLOUDFLARE_KV_ACCOUNT_ID;

const ver = await fetch(
  "https://api.cloudflare.com/client/v4/user/tokens/verify",
  { headers: { Authorization: `Bearer ${token}` } },
);
const verBody = await ver.json();
console.log(
  "token verify",
  ver.status,
  "success=",
  verBody.success,
  "msg=",
  verBody.result?.status || verBody.errors?.[0]?.message,
);

const acc = await fetch(
  `https://api.cloudflare.com/client/v4/accounts/${account}`,
  { headers: { Authorization: `Bearer ${token}` } },
);
const accBody = await acc.json();
console.log(
  "account",
  acc.status,
  "success=",
  accBody.success,
  "detail=",
  accBody.result?.name || accBody.errors?.[0]?.message,
);

// list token permissions if available
const tokList = await fetch(
  "https://api.cloudflare.com/client/v4/user/tokens",
  { headers: { Authorization: `Bearer ${token}` } },
);
console.log("tokens list status", tokList.status);

const urls = [
  "https://mcp.cloudflare.com/mcp",
  "https://mcp.cloudflare.com/mcp?codemode=false",
  "https://bindings.mcp.cloudflare.com/mcp",
  "https://docs.mcp.cloudflare.com/mcp",
  "https://observability.mcp.cloudflare.com/mcp",
];

for (const url of urls) {
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-06-18",
          capabilities: {},
          clientInfo: { name: "probe", version: "0.0.1" },
        },
      }),
    });
    const text = await r.text();
    console.log(
      "MCP",
      url,
      "->",
      r.status,
      text.slice(0, 220).replace(/\s+/g, " "),
    );
  } catch (e) {
    console.log("MCP", url, "ERR", e.message);
  }
}
