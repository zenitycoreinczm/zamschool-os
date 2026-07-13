import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const componentPath = resolve(process.cwd(), "components", "Announcements.tsx");

test("announcements widget resolves APIs and links from mounted workspace routes and role-aware context", async () => {
  const source = await readFile(componentPath, "utf8");

  assert.match(source, /useWorkspaceContext/);
  assert.match(
    source,
    /role === "teacher" \|\| pathname\.startsWith\("\/app\/teacher"\)/,
  );
  assert.match(
    source,
    /role === "student" \|\| pathname\.startsWith\("\/app\/student"\)/,
  );
  assert.match(
    source,
    /role === "parent" \|\| pathname\.startsWith\("\/app\/parent"\)/,
  );
  assert.match(source, /const adminShellRoles = new Set\(\[/);
  assert.match(source, /"admin"/);
  assert.match(source, /"principal"/);
  assert.match(source, /"super_admin"/);
  assert.match(source, /\/api\/teacher\/announcements\?limit=3/);
  assert.match(source, /\/api\/admin\/announcements\?limit=3/);
  assert.match(source, /\/api\/account\/announcements\?limit=3/);
  assert.match(source, /\/app\/teacher\/announcements/);
  assert.match(source, /\/app\/student\/announcements/);
  assert.match(source, /\/app\/parent\/announcements/);
});
