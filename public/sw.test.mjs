import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const swPath = resolve(process.cwd(), "public", "sw.js");
const offlineHtmlPath = resolve(process.cwd(), "public", "offline.html");
const offlinePagePath = resolve(process.cwd(), "app", "offline", "page.tsx");

test("service worker uses cached fallback strategies for the curated offline core", async () => {
  const source = await readFile(swPath, "utf8");

  assert.match(source, /STATIC_CACHE/);
  assert.match(source, /ROUTE_CACHE/);
  assert.match(source, /API_CACHE/);
  assert.match(source, /offline\.html/);
  assert.match(source, /networkFirst/);
  assert.match(source, /cacheFirstStatic|staleWhileRevalidate|warmDocumentAssets/);
  assert.match(source, /warmDocumentAssets/);
  assert.match(source, /_next\/static/);
});

test("service worker precaches landing and offline shell", async () => {
  const source = await readFile(swPath, "utf8");
  assert.match(source, /PRECACHE_URLS/);
  assert.match(source, /"\/"/);
  assert.match(source, /offline\.html/);
  assert.match(source, /\/icon\.png/);
});

test("static offline.html is self-contained with inline CSS", async () => {
  const source = await readFile(offlineHtmlPath, "utf8");
  assert.match(source, /<style>/i);
  assert.match(source, /ZamSchool OS/i);
  assert.match(source, /offline/i);
  assert.doesNotMatch(source, /_next\/static/);
  assert.match(source, /viewport/i);
});

test("offline Next page uses inline styles as CSS fallback", async () => {
  const source = await readFile(offlinePagePath, "utf8");
  assert.match(source, /offline/i);
  assert.match(source, /style=\{\{/);
  assert.match(source, /Reconnect|offline/i);
});
