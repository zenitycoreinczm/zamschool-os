import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const pagePath = resolve(process.cwd(), "app", "app", "admin", "timetable", "page.tsx");
const workspacePath = resolve(
  process.cwd(),
  "components",
  "timetable",
  "TimetableWorkspace.tsx",
);

test("admin timetable page orchestrates role routing into TimetableWorkspace", async () => {
  const source = await readFile(pagePath, "utf8");

  assert.match(source, /TimetableWorkspace/);
  assert.match(source, /viewMode="self"/);
  assert.match(source, /\/app\/admin\/timetable\/classes/);
  assert.match(source, /useWorkspaceContext/);
});

test("admin timetable page exposes flexible time suggestions instead of a restrictive native picker", async () => {
  const source = await readFile(workspacePath, "utf8");

  assert.match(source, /buildTimeChoices/);
  assert.match(source, /function TimeField/);
  assert.match(source, /07:00/);
  // Flexible text + datalist suggestions, not a restrictive native time input.
  assert.match(source, /type="text"/);
  assert.match(source, /datalist/);
  assert.doesNotMatch(source, /type="time"/);
});
