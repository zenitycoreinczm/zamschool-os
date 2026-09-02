import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const routePath = resolve(
  process.cwd(),
  "app",
  "api",
  "account",
  "unread-summary",
  "route.ts",
);
const accountPortalAuthPath = resolve(
  process.cwd(),
  "lib",
  "account-portal-auth.ts",
);
const accountSessionRoutePath = resolve(
  process.cwd(),
  "app",
  "api",
  "account",
  "session",
  "route.ts",
);
const accountShellRoutePath = resolve(
  process.cwd(),
  "app",
  "api",
  "account",
  "shell",
  "route.ts",
);
const accountAnnouncementsRoutePath = resolve(
  process.cwd(),
  "app",
  "api",
  "account",
  "announcements",
  "route.ts",
);
const accountChangePasswordRoutePath = resolve(
  process.cwd(),
  "app",
  "api",
  "account",
  "change-password",
  "route.ts",
);
const accountAvatarRoutePath = resolve(
  process.cwd(),
  "app",
  "api",
  "account",
  "avatar",
  "route.ts",
);
const avatarUrlLibPath = resolve(process.cwd(), "lib", "avatar-url.ts");

test("account unread summary route returns compact unread counts for the signed-in user", async () => {
  const source = await readFile(routePath, "utf8");

  assert.match(source, /export async function GET/);
  assert.match(source, /requireActorContext/);
  assert.match(source, /getUnreadCountsForUser/);
  assert.match(source, /inbox\/read-cache/);
  assert.match(source, /applyPlatformRateLimit/);
  assert.match(source, /notifications/);
  assert.match(source, /messages/);
});

test("account portal auth supports same-origin cookie sessions for settings", async () => {
  const source = await readFile(accountPortalAuthPath, "utf8");

  assert.match(source, /resolveVerifiedBearerUser/);
  assert.match(source, /resolveVerifiedAuthUser/);
  assert.match(source, /createClient/);
  assert.match(source, /resolveAccountPortalUser/);
});

test("account session route resolves managed profiles for settings", async () => {
  const authSource = await readFile(accountPortalAuthPath, "utf8");
  const routeSource = await readFile(accountSessionRoutePath, "utf8");

  assert.match(authSource, /profileId/);
  assert.match(routeSource, /actor\.profileId/);
  assert.match(routeSource, /fetchProfileByIdentity/);
});

test("account shell route tenant-scopes student class lookups", async () => {
  const source = await readFile(accountShellRoutePath, "utf8");

  assert.match(
    source,
    /\.from\("classes"\)[\s\S]*\.eq\("id", classId\)[\s\S]*\.eq\("school_id", schoolId\)/,
  );
});

test("account announcements route tenant-scopes student class resolution", async () => {
  const source = await readFile(accountAnnouncementsRoutePath, "utf8");

  assert.match(
    source,
    /\.from\("students"\)[\s\S]*\.eq\("profile_id", profile\.id\)[\s\S]*\.eq\("school_id", schoolId\)/,
  );
});

test("account change-password route resolves managed profiles safely", async () => {
  const source = await readFile(accountChangePasswordRoutePath, "utf8");

  assert.match(source, /actor\.profileId/);
  assert.match(source, /fetchProfileByIdentity/);
  assert.match(
    source,
    /\.from\("profiles"\)[\s\S]*\.eq\("id", actor\.profileId\)[\s\S]*\.eq\("school_id", actor\.schoolId\)/,
  );
});

test("account avatar route allows school-less uploads and tenant-scopes persistence", async () => {
  const source = await readFile(accountAvatarRoutePath, "utf8");

  // Avatars no longer require a school: school-less actors upload under the
  // "global" scope instead of being rejected.
  assert.match(source, /requireSchool:\s*false/);
  assert.match(source, /access\.context\.schoolId \|\| "global"/);
  // Persistence stays tenant-scoped whenever a school context exists.
  assert.match(
    source,
    /\.from\("profiles"\)[\s\S]*\.eq\("id", input\.profileId\)/,
  );
  assert.match(source, /if \(input\.schoolId\) \{[\s\S]*\.eq\("school_id", input\.schoolId\)/);
  assert.match(
    source,
    /\.from\("profiles"\)[\s\S]*\.eq\("auth_user_id", input\.authUserId\)/,
  );
});

test("avatar url helpers no longer fall back to a shared default tenant", async () => {
  const source = await readFile(avatarUrlLibPath, "utf8");

  assert.doesNotMatch(source, /schoolId \|\| "default"/);
  assert.doesNotMatch(source, /String\(schoolId \|\| "default"\)/);
  assert.match(source, /if \(!resolved\.schoolId \|\| !resolved\.userId\) \{/);
});
