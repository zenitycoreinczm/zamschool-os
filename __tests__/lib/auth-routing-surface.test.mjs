import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const authRoutingPath = resolve(process.cwd(), "lib", "auth-routing.ts");
const profileUtilsPath = resolve(process.cwd(), "lib", "profile-utils.ts");
const teacherShellPath = resolve(process.cwd(), "components", "TeacherShell.tsx");

test("auth routing and teacher shell use mounted workspace paths for teacher student and parent roles", async () => {
  const [authRouting, profileUtils, teacherShell, workspaceShell] =
    await Promise.all([
      readFile(authRoutingPath, "utf8"),
      readFile(profileUtilsPath, "utf8"),
      readFile(teacherShellPath, "utf8"),
      readFile(
        resolve(process.cwd(), "components", "workspace", "WorkspaceShell.tsx"),
        "utf8",
      ),
    ]);

  assert.match(authRouting, /if \(normalized === "TEACHER"\) return "\/app\/teacher";/);
  assert.match(authRouting, /if \(normalized === "STUDENT"\) return "\/app\/student";/);
  assert.match(authRouting, /if \(normalized === "PARENT"\) return "\/app\/parent";/);

  assert.match(profileUtils, /if \(stored === "teacher"\) return "\/app\/teacher";/);
  assert.match(profileUtils, /if \(stored === "student"\) return "\/app\/student";/);
  assert.match(profileUtils, /if \(stored === "parent"\) return "\/app\/parent";/);

  // Role shells delegate nav to the shared WorkspaceShell via navItems
  // (lib/workspace/nav.ts owns the mounted /app/* hrefs).
  assert.match(teacherShell, /navItems=\{teacherNavItems\}/);
  assert.match(teacherShell, /teacherNavItems/);
  assert.match(workspaceShell, /href=\{homeHref\}/);
  // No unmounted legacy /teacher root links anywhere in the shells.
  assert.doesNotMatch(teacherShell, /href="\/teacher"/);
  assert.doesNotMatch(workspaceShell, /href="\/teacher"/);
});
