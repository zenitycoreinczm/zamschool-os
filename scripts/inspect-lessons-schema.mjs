import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PROJECT_REF = "jnnroitaftfmclegbeac";
const env = readFileSync(resolve(".env.local"), "utf8");
const token = env.match(/^SUPABASE_ACCESS_TOKEN=(.+)$/m)?.[1]?.trim();
if (!token) {
  console.error("No token");
  process.exit(1);
}

async function q(query) {
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query }),
    },
  );
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status} ${text.slice(0, 500)}`);
  return JSON.parse(text);
}

const cols = await q(`
  SELECT column_name, data_type, is_nullable, column_default
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'lessons'
  ORDER BY ordinal_position
`);
console.log("COLUMNS:", JSON.stringify(cols, null, 2));

const fks = await q(`
  SELECT
    tc.constraint_name,
    kcu.column_name,
    ccu.table_name AS foreign_table,
    ccu.column_name AS foreign_column
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
  JOIN information_schema.constraint_column_usage ccu
    ON ccu.constraint_name = tc.constraint_name
  WHERE tc.table_name = 'lessons' AND tc.constraint_type = 'FOREIGN KEY'
`);
console.log("FKS:", JSON.stringify(fks, null, 2));

const triggers = await q(`
  SELECT tgname, pg_get_triggerdef(oid) AS def
  FROM pg_trigger
  WHERE tgrelid = 'public.lessons'::regclass AND NOT tgisinternal
`);
console.log("TRIGGERS:", JSON.stringify(triggers, null, 2));
