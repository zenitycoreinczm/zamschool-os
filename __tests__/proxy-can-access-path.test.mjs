import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

// Load via tsx-compatible path when run under the project's test runner.
async function loadCanAccessPath() {
  try {
    const mod = await import("../lib/middleware-path-access.ts");
    return mod.canAccessPath;
  } catch {
    // Fallback for plain node --test with experimental TS loaders
    const mod = require("../lib/middleware-path-access.ts");
    return mod.canAccessPath;
  }
}

test("students can open their canonical /app/student workspace", async () => {
  const canAccessPath = await loadCanAccessPath();
  assert.equal(canAccessPath("STUDENT", "/app/student"), true);
  assert.equal(canAccessPath("STUDENT", "/app/student/assignments"), true);
  assert.equal(canAccessPath("STUDENT", "/student"), true);
});

test("teachers and parents can open their /app/* portals", async () => {
  const canAccessPath = await loadCanAccessPath();
  assert.equal(canAccessPath("TEACHER", "/app/teacher"), true);
  assert.equal(canAccessPath("TEACHER", "/app/teacher/attendance"), true);
  assert.equal(canAccessPath("PARENT", "/app/parent"), true);
  assert.equal(canAccessPath("PARENT", "/app/parent/children"), true);
});

test("students cannot open staff /app/admin surfaces", async () => {
  const canAccessPath = await loadCanAccessPath();
  assert.equal(canAccessPath("STUDENT", "/app/admin/users"), false);
  assert.equal(canAccessPath("STUDENT", "/app/principal"), false);
  assert.equal(canAccessPath("STUDENT", "/app/registrar"), false);
});

test("staff cannot open the student portal", async () => {
  const canAccessPath = await loadCanAccessPath();
  assert.equal(canAccessPath("PRINCIPAL", "/app/student"), false);
  assert.equal(canAccessPath("REGISTRAR", "/app/student"), false);
  assert.equal(canAccessPath("TEACHER", "/app/student"), false);
});

test("discipline admin and guidance can open conduct desk", async () => {
  const canAccessPath = await loadCanAccessPath();
  assert.equal(canAccessPath("DISCIPLINE_ADMIN", "/app/discipline-admin"), true);
  assert.equal(canAccessPath("GUIDANCE_OFFICE", "/app/discipline-admin"), true);
  assert.equal(canAccessPath("TEACHER", "/app/discipline-admin"), false);
  assert.equal(canAccessPath("STUDENT", "/app/discipline-admin"), false);
});

test("deputy head can open quality hub and shared feed", async () => {
  const canAccessPath = await loadCanAccessPath();
  assert.equal(canAccessPath("DEPUTY_HEAD", "/app/deputy-head"), true);
  assert.equal(canAccessPath("DEPUTY_HEAD", "/app/messages"), true);
  assert.equal(canAccessPath("DEPUTY_HEAD", "/app/events"), true);
  assert.equal(canAccessPath("DEPUTY_HEAD", "/app/admin/timetable"), true);
});
