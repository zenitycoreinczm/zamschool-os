import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const globalsPath = resolve(process.cwd(), "app", "globals.css");
const designPath = resolve(process.cwd(), "lib", "workspace/design.ts");

test("workspace shell CSS elevates header popovers above scrolling page content", async () => {
  const css = await readFile(globalsPath, "utf8");

  assert.match(css, /\.zamschool-workspace-shell__header/);
  assert.match(css, /z-index:\s*60/);
  assert.match(css, /\.zamschool-workspace-popover/);
  assert.match(css, /z-index:\s*70/);
});

test("workspace design tokens expose header and popover layer classes", async () => {
  const source = await readFile(designPath, "utf8");

  assert.match(source, /zamschool-workspace-shell__header/);
  assert.match(source, /zamschool-workspace-popover/);
  assert.match(source, /headerActions/);
});