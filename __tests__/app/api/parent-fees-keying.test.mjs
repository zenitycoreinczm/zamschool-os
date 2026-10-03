import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Gate 6 / plan s21 "Fees" and s39 (web-mobile data disagreement is P1).
//
// `student_fees.student_id` has a foreign key to `profiles.id`, while
// `attendance.student_id` and `results.student_id` point at `students.id`. The
// parent fee read used to translate the parent's linked profile ids into
// students row ids and filter the profile-keyed column with them, so the ledger
// answered empty for every parent on web while mobile answered with rows.
//
// The bursar writer is pinned in here as well: the read and the write must stay
// in the same identity space, so a change to one side has to acknowledge the
// other.
//
// Verified against the live schema (pg_constraint) and by seeding bills inside a
// rolled-back transaction: the shipped filter returned 0 rows, this filter
// returned the family's 4 bills.

const parentFees = readFileSync("app/api/parent/fees/route.ts", "utf8");
const billingWriter = readFileSync("app/api/payments/billing/route.ts", "utf8");
const billingReader = readFileSync("app/api/payments/students/route.ts", "utf8");
const parentUtils = readFileSync("lib/parent-route-utils.ts", "utf8");

test("parent fee ledger is scoped by the profile-keyed student_id", () => {
  const feeQuery = parentFees.match(/from\("student_fees"\)[\s\S]{0,400}?\.order\(/);
  assert.ok(feeQuery, "expected a student_fees read in the parent fees route");
  assert.match(
    feeQuery[0],
    /\.in\("student_id", linked\.profileIds\)/,
    "student_fees must be filtered with the parent's linked profile ids",
  );
});

test("parent fee read never translates pupils into students row ids", () => {
  assert.doesNotMatch(
    parentFees,
    /studentRowIdByProfileId/,
    "translating profile ids to students.id is what emptied the ledger",
  );
  assert.doesNotMatch(
    parentFees,
    /scopedStudentRowIds/,
    "the students-keyed scoping variable must not come back",
  );
  assert.doesNotMatch(
    parentFees,
    /from\("students"\)/,
    "display names come from profiles, not a students indirection",
  );
});

test("pupil names are resolved from the same key the bill carries", () => {
  assert.match(
    parentFees,
    /\.in\("id", billedProfileIds\)/,
    "profiles must be fetched by the ids the bills actually hold",
  );
  assert.match(
    parentFees,
    /profileById\.get\(row\.student_id\)/,
    "each bill resolves its own pupil by that bill's student_id",
  );
});

test("a failed finance read is never rendered as an empty ledger", () => {
  // supabase-js reports read failures on `error` instead of throwing, so a
  // dropped check turns "could not load money" into "this family owes nothing".
  assert.match(parentFees, /if \(feeError\) throw feeError;/);
  assert.match(parentFees, /if \(profilesResult\.error\) throw profilesResult\.error;/);
  assert.match(parentFees, /if \(feesResult\.error\) throw feesResult\.error;/);
});

test("the bursar writer keeps billing in the profiles identity space", () => {
  assert.match(
    billingWriter,
    /from\("profiles"\)[\s\S]{0,200}?\.eq\("role", "student"\)/,
    "bills are raised against student profiles",
  );
  assert.match(
    billingWriter,
    /student_id:\s*student\.id/,
    "the writer stores that profile id as student_id",
  );
  assert.match(
    billingWriter,
    /onConflict:\s*"student_id,fee_id,billing_month"/,
    "the upsert target must stay the unique constraint, so re-running billing cannot double-bill",
  );
});

test("the bursar list view agrees with the parent read", () => {
  // payment_summaries joins student_fees to profiles.id, so both screens key on
  // the same column. This asserts the route still relies on that view rather
  // than re-deriving balances in TypeScript.
  assert.match(billingReader, /from\("payment_summaries"\)/);
  assert.match(billingReader, /overdueIds\.has\(student\.student_id\)/);
});

test("getLinkedStudents is not asked for row mappings it cannot key with", () => {
  assert.doesNotMatch(
    parentUtils,
    /student_fees/,
    "the shared parent helper must not hardcode a finance table's key space",
  );
});
