import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const cookieBackedPages = [
  "app/app/parent/absence/page.tsx",
  "app/app/parent/attendance/page.tsx",
  "app/app/parent/children/page.tsx",
  "app/app/parent/fees/page.tsx",
  "app/app/parent/reports/page.tsx",
  "app/app/parent/results/page.tsx",
  "app/app/student/assignments/page.tsx",
  "app/app/student/attendance/page.tsx",
  "app/app/student/results/page.tsx",
];

const cookieBackedAuthPages = [
  "app/register/page.tsx",
  "app/first-login/page.tsx",
  "app/verify-email/page.tsx",
];

const cookieBackedShellHelpers = ["components/OfflineStatusProvider.tsx"];

const cookieBackedClientHelpers = [
  "lib/admin-route-client.ts",
  "lib/inbox/center-client.ts",
];

test("parent and student workspace pages use same-origin cookie auth for local api calls", () => {
  for (const file of cookieBackedPages) {
    const source = readFileSync(file, "utf8");
    assert.doesNotMatch(
      source,
      /Authorization:\s*`Bearer \$\{token\}`|headers:\s*\{\s*Authorization/,
      `${file} should not attach bearer tokens to same-origin api calls`,
    );
    assert.doesNotMatch(
      source,
      /supabase\.auth\.getSession\(/,
      `${file} should not read a browser token just to call a local api route`,
    );
  }
});

test("auth onboarding pages use same-origin cookie auth for local auth api calls", () => {
  for (const file of cookieBackedAuthPages) {
    const source = readFileSync(file, "utf8");
    assert.doesNotMatch(
      source,
      /Authorization:\s*`Bearer|headers:\s*\{\s*Authorization/,
      `${file} should not attach bearer tokens to same-origin auth api calls`,
    );
    assert.doesNotMatch(
      source,
      /buildAuthApiHeaders\(/,
      `${file} should not use bearer-header auth helpers for same-origin auth api calls`,
    );
  }

  assert.doesNotMatch(
    readFileSync("app/register/page.tsx", "utf8"),
    /supabase\.auth\.getSession\(/,
    "app/register/page.tsx should not read a browser token just to call register-school",
  );

  assert.doesNotMatch(
    readFileSync("app/verify-email/page.tsx", "utf8"),
    /supabase\.auth\.getSession\(/,
    "app/verify-email/page.tsx should not read a browser token just to call send-otp or verify-otp",
  );
});

test("app shell helpers use same-origin cookie auth for local api warmups", () => {
  for (const file of cookieBackedShellHelpers) {
    const source = readFileSync(file, "utf8");
    assert.doesNotMatch(
      source,
      /Authorization:\s*`Bearer|headers:\s*\{\s*Authorization/,
      `${file} should not attach bearer tokens to same-origin api warmups`,
    );
    assert.doesNotMatch(
      source,
      /supabase\.auth\.getSession\(/,
      `${file} should not read a browser token just to warm same-origin api routes`,
    );
  }
});

test("client api helpers do not inject bearer tokens for same-origin routes", () => {
  for (const file of cookieBackedClientHelpers) {
    const source = readFileSync(file, "utf8");
    assert.doesNotMatch(
      source,
      /Authorization:\s*`Bearer|headers\.set\(\s*["']Authorization["']/,
      `${file} should not inject bearer tokens for same-origin api requests`,
    );
    assert.doesNotMatch(
      source,
      /getClientAccessToken\(|supabase\.auth\.getSession\(/,
      `${file} should not read a browser access token for same-origin api requests`,
    );
  }
});
