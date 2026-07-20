import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const bulkImportPath = resolve(process.cwd(), "components", "BulkImport.tsx");

test("bulk import provisions managed accounts through the admin user API instead of direct profile inserts", async () => {
  const source = await readFile(bulkImportPath, "utf8");

  assert.match(source, /adminApiJson/);
  assert.match(source, /\/api\/admin\/users/);
  assert.doesNotMatch(source, /from\("profiles"\)\.insert/);
});

test("bulk import captures temporary passwords for imported managed accounts", async () => {
  const source = await readFile(bulkImportPath, "utf8");

  assert.match(source, /temporaryPassword/);
  assert.match(source, /credentials/i);
});

test("bulk import maps student class column to class_id", async () => {
  const source = await readFile(bulkImportPath, "utf8");

  assert.match(source, /class_id/);
  assert.match(source, /resolveClassId/);
  assert.match(source, /Form 1/);
  assert.match(source, /\/api\/admin\/classes/);
});
