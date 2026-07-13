import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const authRoutingPath = resolve(process.cwd(), "lib", "auth-routing.ts");
const profileUtilsPath = resolve(process.cwd(), "lib", "profile-utils.ts");
const teacherShellPath = resolve(process.cwd(), "components", "TeacherShell.tsx");

test("auth routing and teacher shell use mounted workspace paths for teacher student and parent roles", async () => {
  const [authRouting, profileUtils, teacherShell] = await Promise.all([
    readFile(authRoutingPath, "utf8"),
    readFile(profileUtilsPath, "utf8"),
    readFile(teacherShellPath, "utf8"),
  ]);

  assert.match(authRouting, /if \(normalized === "TEACHER"\) return "\/app\/teacher";/);
  assert.match(authRouting, /if \(normalized === "STUDENT"\) return "\/app\/student";/);
  assert.match(authRouting, /if \(normalized === "PARENT"\) return "\/app\/parent";/);

  assert.match(profileUtils, /if \(stored === "teacher"\) return "\/app\/teacher";/);
  assert.match(profileUtils, /if \(stored === "student"\) return "\/app\/student";/);
  assert.match(profileUtils, /if \(stored === "parent"\) return "\/app\/parent";/);

  assert.match(teacherShell, /<Link[\s\S]*?href="\/app\/teacher"/);
  assert.doesNotMatch(teacherShell, /<Link[\s\S]*?href="\/teacher"/);
});
