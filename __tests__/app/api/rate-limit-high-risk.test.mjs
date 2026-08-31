import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
// __tests__/app/api -> go up 3 levels to reach project root
const rootDir = join(__dirname, "..", "..", "..");

const HIGH_RISK_ROUTES = [
  "app/api/files/delete/route.ts",
  "app/api/payments/billing/route.ts",
  "app/api/payments/fees/route.ts",
  "app/api/discipline/records/route.ts",
];

for (const routePath of HIGH_RISK_ROUTES) {
  const fullPath = join(rootDir, routePath);
  const label = routePath.replace(/\\/g, "/");

  test(`${label} imports applyPlatformRateLimit`, () => {
    const content = readFileSync(fullPath, "utf-8");
    // Match both single-line and multi-line imports
    const hasImport = /\bapplyPlatformRateLimit\b/.test(content);
    assert.ok(hasImport, `Missing import for applyPlatformRateLimit in ${label}`);
  });

  test(`${label} calls applyPlatformRateLimit in write handlers`, () => {
    const content = readFileSync(fullPath, "utf-8");
    const hasCall = /\bapplyPlatformRateLimit\s*\(/.test(content);
    assert.ok(hasCall, `applyPlatformRateLimit not called in ${label}`);
  });

  test(`${label} returns rate-limit response when exceeded`, () => {
    const content = readFileSync(fullPath, "utf-8");
    const hasResponse = /rate\.allowed|retryAfterSec|429/.test(content);
    assert.ok(hasResponse, `No rate-limit response handling in ${label}`);
  });
}
