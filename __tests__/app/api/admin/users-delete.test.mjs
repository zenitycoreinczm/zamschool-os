import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// ─── admin user delete scoping regression tests ────────────────────────────
//
// Verifies deleteParentRecords scopes parent_students deletion to the
// specific parent, not the entire school. The old code wiped every
// parent-child link in the school when deleting a single parent.

const source = readFileSync("app/api/admin/users/helpers.ts", "utf8");

// Extract just the deleteParentRecords function body
const fnMatch = source.match(
  /async function deleteParentRecords[\s\S]*?\n}/,
);
const fnBody = fnMatch ? fnMatch[0] : "";

test("deleteParentRecords function exists", () => {
  assert.ok(fnBody, "deleteParentRecords function should exist");
});

test("deleteParentRecords looks up the parent record by profile_id first", () => {
  assert.match(
    fnBody,
    /\.from\(["']parents["']\).*\.select\(["']id["']\).*\.eq\(["']school_id["'].*\.eq\(["']profile_id["']/s,
    "must query parents.id by profile_id before deleting links",
  );
});

test("deleteParentRecords scopes parent_students delete by parent_id", () => {
  assert.match(
    fnBody,
    /parent_students/,
    "must delete from parent_students",
  );
  assert.match(
    fnBody,
    /\.in\(["']parent_id["']/,
    "parent_students delete must be scoped by parent_id, not school_id alone",
  );
  assert.doesNotMatch(
    fnBody,
    /parent_students[^]*\.delete\(\)[^]*\.eq\(["']school_id["'][^]*\);\s*await supabaseAdmin\s*\.from\(\s*["']parents["']\)/,
    "parent_students delete must not be scoped by school_id alone",
  );
});

test("deleteParentRecords does not delete all parent_students by school_id alone", () => {
  // The old bug: .from("parent_students").delete().eq("school_id", schoolId)
  // without any parent_id filter. The fix adds .in("parent_id", parentIds).
  // We verify the parent_students delete chain includes a parent_id filter.
  const parentStudentsDeleteMatch = fnBody.match(
    /\.from\(\s*["']parent_students["']\s*\)[\s\S]*?;/,
  );
  assert.ok(
    parentStudentsDeleteMatch,
    "deleteParentRecords must delete from parent_students",
  );
  const deleteChain = parentStudentsDeleteMatch[0];
  assert.match(
    deleteChain,
    /\.in\(\s*["']parent_id["']/,
    "parent_students delete must include .in('parent_id', ...) — the old bug only filtered by school_id",
  );
});
