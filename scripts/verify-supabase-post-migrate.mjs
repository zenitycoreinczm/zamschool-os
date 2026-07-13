import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvLocal() {
  const path = resolve(process.cwd(), ".env.local");
  if (!existsSync(path)) return {};
  const env = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    env[trimmed.slice(0, eq)] = trimmed.slice(eq + 1).trim();
  }
  return env;
}

const env = loadEnvLocal();
const TOKEN = env.SUPABASE_ACCESS_TOKEN || env.SUPABASE_MGMT_TOKEN;
const REF = env.SUPABASE_PROJECT_REF || "jnnroitaftfmclegbeac";
const API = `https://api.supabase.com/v1/projects/${REF}/database/query`;

async function query(sql) {
  const res = await fetch(API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  if (!res.ok) {
    throw new Error(
      typeof data === "object" && data?.message ? data.message : text,
    );
  }
  return data;
}

const grants = await query(`
  SELECT p.proname, r.rolname,
         has_function_privilege(r.oid, p.oid, 'EXECUTE') AS can_exec
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  JOIN pg_roles r ON r.rolname IN ('service_role', 'authenticated', 'anon')
  WHERE n.nspname = 'public'
    AND p.proname IN (
      'record_student_payment_transaction',
      'record_student_fee_payment_transaction'
    )
  ORDER BY 1, 2
`);
console.log("grants:", JSON.stringify(grants, null, 2));

try {
  await query(`
    SELECT public.record_student_payment_transaction(
      '00000000-0000-0000-0000-000000000001'::uuid,
      '00000000-0000-0000-0000-000000000001'::uuid,
      0,
      'tuition',
      'cash',
      null,
      '00000000-0000-0000-0000-000000000001'::uuid
    )
  `);
  console.log("rpc smoke: unexpected success");
} catch (e) {
  console.log("rpc smoke (expect amount > 0):", String(e.message).slice(0, 200));
}

const force = await query(`
  SELECT
    count(*) FILTER (WHERE c.relforcerowsecurity)::int AS force_rls,
    count(*)::int AS total
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind = 'r'
`);
console.log("force_rls:", JSON.stringify(force));
