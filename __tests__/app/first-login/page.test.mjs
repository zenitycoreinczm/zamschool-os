import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.cwd();
const pagePath = resolve(root, "app", "first-login", "page.tsx");
const loginPagePath = resolve(root, "app", "login", "page.tsx");

test("first-login page collects a new password and clears the managed-account flag", async () => {
  const source = await readFile(pagePath, "utf8");

  assert.match(source, /supabase\.auth\.updateUser\(\s*\{\s*password/);
  assert.match(source, /\/api\/auth\/complete-first-login/);
  assert.match(source, /supabase\.auth\.refreshSession\(/);
  assert.match(source, /New password/i);
  assert.match(source, /Confirm password/i);
});

test("login page routes managed accounts into first-login before the workspace", async () => {
  const source = await readFile(loginPagePath, "utf8");

  assert.match(source, /must_change_password|mustChangePassword/);
  assert.match(source, /resolveOnboardingPath/);
  assert.match(source, /\/first-login/);
  assert.match(source, /use a different account|switch to another account/i);
});
