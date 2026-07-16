import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PROJECT_REF = "jnnroitaftfmclegbeac";
const env = readFileSync(resolve(".env.local"), "utf8");
const token = env.match(/^SUPABASE_ACCESS_TOKEN=(.+)$/m)?.[1]?.trim();

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
  if (!res.ok) throw new Error(`${res.status} ${text.slice(0, 400)}`);
  return JSON.parse(text);
}

const lessons = await q(`
  SELECT id, title, teacher_id, class_id, subject_id, day_of_week, start_time, end_time
  FROM lessons
  ORDER BY created_at DESC NULLS LAST
  LIMIT 5
`);
console.log("lessons", JSON.stringify(lessons, null, 2));

const teacherId = lessons?.[0]?.teacher_id;
if (teacherId) {
  const teachers = await q(`
    SELECT id, profile_id, school_id
    FROM teachers
    WHERE id = '${teacherId}' OR profile_id = '${teacherId}'
  `);
  console.log("teachers", JSON.stringify(teachers, null, 2));
}
