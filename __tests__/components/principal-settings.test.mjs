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
  // The accent must match the principal workspace accent (indigo) so that a
  // head teacher does not see the emerald accent of the fallback
  // app/app/settings page.
  assert.match(
    source,
    /accent="indigo"/,
    "principal settings must use accent=\"indigo\" to match PrincipalWorkspace",
  );
  // The session label must be specific to the head-teacher role so the
  // session card on the page reads correctly.
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
  // The catch block must call console.error in non-prod so the cause
  // is reproducible from server logs.
  assert.match(
    source,
    /process\.env\.NODE_ENV\s*!==\s*"production"[\s\S]{0,200}console\.error/,
    "/api/account/session must log to the server in non-prod",
  );
  // The response body in non-prod must include a `cause` field so the
  // client can show the real reason in its toast.
  assert.match(
    source,
    /body\.cause\s*=|cause:\s*safeErrorMessage/,
    "/api/account/session must populate `cause` for non-prod responses",
  );
});

test("accountApiJson prefers `cause` over `error` when reporting non-OK responses", async () => {
  const source = await readFile(apiClientPath, "utf8");
  // The thrown Error must read `cause` first, then fall back to `error`.
  assert.match(
    source,
    /errBody\.cause\s*\|\|\s*errBody\.error/,
    "accountApiJson must prefer cause over error",
  );
});
