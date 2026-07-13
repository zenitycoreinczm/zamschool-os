import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const sourcePath = resolve(process.cwd(), "lib", "admin-browser-api.ts");

test("admin browser api enforces CSRF injection for mutations", async () => {
  const source = await readFile(sourcePath, "utf8");

  assert.match(source, /ensureCsrfTokenAvailable/);
  assert.match(source, /X-CSRF-Token/);
  assert.match(source, /maybeRetryCsrf/);
  assert.doesNotMatch(source, /Available cookies:/);
  assert.doesNotMatch(source, /raw \|\| "\(none\)"/);
});

test("admin browser api only applies json content-type to string bodies", async () => {
  const source = await readFile(sourcePath, "utf8");

  assert.match(source, /typeof init\.body === "string"/);
  assert.match(source, /method !== "GET"/);
});
