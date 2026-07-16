import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const pagePath = resolve(
  process.cwd(),
  "app",
  "app",
  "principal",
  "settings",
  "page.tsx",
);
const navPath = resolve(process.cwd(), "lib", "workspace/nav.ts");
const routePath = resolve(
  process.cwd(),
  "app",
  "api",
  "account",
  "session",
  "route.ts",
);
const apiClientPath = resolve(
  process.cwd(),
  "lib",
  "account-portal-api.ts",
);

test("principal has a dedicated /app/principal/settings page that re-uses AccountSettingsPage", async () => {
  const source = await readFile(pagePath, "utf8");
  // The page must use AccountSettingsPage so the password / MFA / preferences
  // surfaces stay parity with the teacher and student settings pages.
  assert.match(source, /AccountSettingsPage/, "principal settings must import AccountSettingsPage");
  // Account settings use a neutral slate accent across all roles so the
  // settings surface stays visually consistent between desks.
  assert.match(
    source,
    /accent="slate"/,
    "principal settings must use accent=\"slate\" for shared account settings chrome",
  );
  // The account card label must be specific to the head-teacher role.
  assert.match(
    source,
    /sessionTitle="[^"]*[Hh]ead [Tt]eacher/,
    "principal settings sessionTitle should mention \"Head Teacher\"",
  );
});

test("workspace-nav.ts routes the principal Settings nav to /app/principal/settings", async () => {
  const source = await readFile(navPath, "utf8");
  // After the fix, the principal nav should point to its own settings page.
  // We accept at least one occurrence of the new path inside the principal
  // sections block. We check for a complete route shape so we are not
  // matching comments.
  assert.match(
    source,
    /href:\s*"\/app\/principal\/settings"/,
    "workspace-nav.ts must route principal Settings to /app/principal/settings",
  );
});

test("/api/account/session logs the underlying error before returning 500", async () => {
  const source = await readFile(routePath, "utf8");
  // Errors must be logged server-side (never raw on the client).
  assert.match(
    source,
    /logServerError\s*\(\s*["']account\.session["']/,
    "/api/account/session must log errors with logServerError",
  );
  // Client body must use sanitized publicErrorBody - no raw cause/stack.
  assert.match(
    source,
    /publicErrorBody\s*\(/,
    "/api/account/session must return publicErrorBody to the client",
  );
  assert.doesNotMatch(
    source,
    /body\.cause\s*=/,
    "/api/account/session must not attach raw `cause` to client responses",
  );
});

test("accountApiJson surfaces sanitized error text from API bodies", async () => {
  const source = await readFile(apiClientPath, "utf8");
  // Client only surfaces the public `error` field - never raw stacks.
  assert.match(
    source,
    /error\?:\s*string[\s\S]{0,80}\?\.error|body as \{ error\?: string \}/,
    "accountApiJson must read the public error field from API JSON",
  );
  assert.doesNotMatch(
    source,
    /stack|details|hint/,
    "accountApiJson must not read internal stack/details/hint from API bodies",
  );
});
