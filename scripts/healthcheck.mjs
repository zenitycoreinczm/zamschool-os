const BASE = process.env.HEALTHCHECK_BASE || "http://127.0.0.1:3001";

async function main() {
  const routes = ["/", "/login", "/register", "/forgot-password", "/app/principal", "/app/principal/staff"];

  for (const route of routes) {
    const res = await fetch(`${BASE}${route}`, { redirect: "manual" });
    const ok = [200, 302, 307].includes(res.status);
    if (!ok) {
      throw new Error(`Route health check failed: ${route} -> ${res.status}`);
    }
    console.log(`${route} -> ${res.status}`);
  }

  const loginHtml = await fetch(`${BASE}/login`).then((r) => r.text());
  const cssMatch = loginHtml.match(/\/_next\/static\/css\/[^"']+/);
  if (!cssMatch) {
    throw new Error("Could not find CSS chunk in /login HTML");
  }

  const cssPath = cssMatch[0];
  const cssRes = await fetch(`${BASE}${cssPath}`);
  if (cssRes.status !== 200) {
    throw new Error(`CSS chunk health check failed: ${cssPath} -> ${cssRes.status}`);
  }

  console.log(`CSS -> ${cssPath} -> ${cssRes.status}`);
  console.log("Healthcheck OK");
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
