import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const routePath = resolve(process.cwd(), "app", "api", "parent", "results", "route.ts");
const utilsPath = resolve(process.cwd(), "lib", "parent-route-utils.ts");
const attendancePath = resolve(
  process.cwd(),
  "app",
  "api",
  "parent",
  "attendance",
  "route.ts",
);

test("parent results route requires parent auth and filters to published linked-child results", async () => {
  const source = await readFile(routePath, "utf8");
  const utilsSource = await readFile(utilsPath, "utf8");

  assert.match(source, /requireParentContext/);
  assert.match(utilsSource, /parent_students/);
  assert.match(source, /published_at/);
  assert.match(source, /\.not\("published_at",\s*"is",\s*null\)/);
  assert.match(source, /applyEdgeCacheHeaders/);
  assert.match(source, /jsonResponse/);
});

test("parent linked-student loader does not query non-existent profiles.parent_id", async () => {
  const utilsSource = await readFile(utilsPath, "utf8");
  // Legacy fallback used .eq("parent_id", ...) on profiles, which 500s.
  assert.doesNotMatch(
    utilsSource,
    /\.from\(\s*["']profiles["']\s*\)[\s\S]{0,200}\.eq\(\s*["']parent_id["']/,
  );
  assert.match(utilsSource, /emptyLinkedStudents/);
  assert.match(utilsSource, /profile_id/);
});

test("parent attendance skips empty student-row in\(\) filters", async () => {
  const source = await readFile(attendancePath, "utf8");
  assert.match(source, /scopedStudentRowIds\.length > 0/);
});
