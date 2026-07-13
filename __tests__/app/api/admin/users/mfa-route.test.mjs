import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const routePath = "app/api/admin/users/mfa/route.ts";

test("admin MFA recovery route restricts ICT / principal / super_admin", async () => {
  const source = await readFile(resolve(process.cwd(), routePath), "utf8");
  assert.match(source, /ICT_ADMIN/);
  assert.match(source, /PRINCIPAL/);
  assert.match(source, /SUPER_ADMIN/);
  assert.match(source, /export async function GET/);
  assert.match(source, /export async function POST/);
  assert.match(source, /auth\.admin\.mfa\.listFactors/);
  assert.match(source, /auth\.admin\.mfa\.deleteFactor/);
  assert.match(source, /users\.mfa_disabled/);
  assert.match(source, /school_id/);
});

test("admin MFA recovery requires profileId and school scope", async () => {
  const source = await readFile(resolve(process.cwd(), routePath), "utf8");
  assert.match(source, /profileId/);
  assert.match(source, /eq\("school_id"/);
  assert.match(source, /applyRateLimit/);
});

test("MfaSetup is embedded in AccountSettingsPage for all roles", async () => {
  const settings = await readFile(
    resolve(process.cwd(), "components/account/AccountSettingsPage.tsx"),
    "utf8",
  );
  assert.match(settings, /MfaSetup/);
  assert.match(settings, /from "\.\/MfaSetup"/);

  const mfa = await readFile(
    resolve(process.cwd(), "components/account/MfaSetup.tsx"),
    "utf8",
  );
  assert.match(mfa, /ICT admin/i);
  assert.match(mfa, /authenticator app/i);
  assert.match(mfa, /Scan/);
});

test("login MFA challenge page directs users to school ICT admin", async () => {
  const source = await readFile(
    resolve(process.cwd(), "app/login/mfa/page.tsx"),
    "utf8",
  );
  assert.match(source, /ICT admin/i);
  assert.match(source, /email[\s\S]{0,40}password/i);
});
