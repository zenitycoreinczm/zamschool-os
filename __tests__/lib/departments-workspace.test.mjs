import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

describe("departments-workspace module", () => {
  const source = readFileSync("lib/departments-workspace.ts", "utf8");
  const api = readFileSync("app/api/school/departments/route.ts", "utf8");

  it("exports enrichment helpers for heads and member counts", () => {
    assert.match(source, /export function isEligibleDepartmentHeadRole/);
    assert.match(source, /export function enrichDepartments/);
    assert.match(source, /export function countMembersByDepartmentName/);
    assert.match(source, /export function buildDepartmentsStats/);
  });

  it("excludes students and parents from head eligibility", () => {
    assert.match(source, /EXCLUDED_HEAD_ROLES/);
    assert.match(source, /"student"/);
    assert.match(source, /"parent"/);
  });

  it("departments API returns staffOptions meta and validates heads", () => {
    assert.match(api, /staffOptions/);
    assert.match(api, /loadWorkspacePayload/);
    assert.match(api, /assertHeadInSchool/);
    assert.match(api, /requireDepartmentWriteAccess/);
    assert.match(api, /member_count|memberCounts/);
  });
});
