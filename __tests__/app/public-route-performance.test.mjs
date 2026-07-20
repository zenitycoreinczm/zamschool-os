import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const rootLayoutPath = resolve(process.cwd(), "app", "layout.tsx");
const workspaceLayoutPath = resolve(process.cwd(), "app", "app", "layout.tsx");
const landingPagePath = resolve(process.cwd(), "app", "page.tsx");

test("root layout stays public while workspace layout owns auth gating", async () => {
  const [rootLayout, workspaceLayout] = await Promise.all([
    readFile(rootLayoutPath, "utf8"),
    readFile(workspaceLayoutPath, "utf8"),
  ]);

  assert.doesNotMatch(rootLayout, /import AuthProvider from ['"]@\/components\/AuthProvider['"]/);
  assert.doesNotMatch(rootLayout, /<AuthProvider>/);

  assert.match(workspaceLayout, /import AuthProvider from ['"]@\/components\/AuthProvider['"]/);
  assert.match(workspaceLayout, /<AuthProvider>/);
});

test("landing route entry is server-rendered", async () => {
  const landingPage = await readFile(landingPagePath, "utf8");
  const firstLine = landingPage.split(/\r?\n/, 1)[0]?.trim() ?? "";

  assert.notEqual(firstLine, '"use client"');
  assert.notEqual(firstLine, "'use client'");
});

test("landing route ships server-rendered above-the-fold content instead of client-only composition", async () => {
  const landingPage = await readFile(landingPagePath, "utf8");

  assert.match(landingPage, /Start a School \(Free Setup\)/);
  assert.match(landingPage, /Run your entire school from your phone/);
  assert.doesNotMatch(landingPage, /import HeroSection from/);
  assert.doesNotMatch(landingPage, /import ScrollIndicator from/);
});
