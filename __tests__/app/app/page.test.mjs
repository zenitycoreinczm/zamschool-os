import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const pagePath = resolve(process.cwd(), "app", "app", "settings", "page.tsx");
const componentPath = resolve(
  process.cwd(),
  "components",
  "account",
  "AccountSettingsPage.tsx"
);

test("generic settings page uses a shared account settings component with a generic storage key", async () => {
  const [pageSource, componentSource] = await Promise.all([
    readFile(pagePath, "utf8"),
    readFile(componentPath, "utf8"),
  ]);

  assert.match(pageSource, /AccountSettingsPage/);
  assert.match(pageSource, /pageTitle="Account settings"/);
  assert.match(pageSource, /preferencesStorageKey="workspace-account-settings"/);
  assert.doesNotMatch(pageSource, /Teacher Settings/);
  assert.doesNotMatch(pageSource, /teacher-workspace-settings/);

  assert.match(componentSource, /fetchAccountProfile/);
  assert.match(componentSource, /Workspace preferences/);
  assert.match(componentSource, /Save notification settings/);
  assert.match(componentSource, /Temporary password/);
});
