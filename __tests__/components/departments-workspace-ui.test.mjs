import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

describe("DepartmentsWorkspace UI", () => {
  const source = readFileSync(
    "components/admin/departments/DepartmentsWorkspace.tsx",
    "utf8",
  );

  it("uses AdminPageHero and filters for HR structure work", () => {
    assert.match(source, /AdminPageHero/);
    assert.match(source, /needs_head/);
    assert.match(source, /quickAssignHead/);
    assert.match(source, /staffOptions/);
    assert.match(source, /member_count/);
  });

  it("wires departments page to the workspace component", () => {
    const page = readFileSync("app/app/admin/departments/page.tsx", "utf8");
    assert.match(page, /DepartmentsWorkspace/);
  });
});
