import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const bursarSource = readFileSync("app/api/bursar/payments/route.ts", "utf8");
const idempotencySource = readFileSync("lib/idempotency.ts", "utf8");
const resultsSaveSource = readFileSync(
  "app/api/teacher/results/save/route.ts",
  "utf8",
);
const resultsExtractSource = readFileSync(
  "app/api/teacher/results/extract/route.ts",
  "utf8",
);

test("bursar payments route requires financial write roles and feature create", () => {
  assert.match(bursarSource, /requirePaymentsContext/);
  assert.match(
    bursarSource,
    /requireFeatureAccess\([\s\S]*"payments",[\s\S]*"create"/,
  );
});

test("bursar payments mints server receipt and uses transactional rpc", () => {
  assert.match(bursarSource, /mintReceiptNumber/);
  assert.match(
    bursarSource,
    /record_student_payment_transaction/,
  );
  assert.match(bursarSource, /auditDomainWrite/);
});

test("bursar payments supports idempotency key replay", () => {
  assert.match(bursarSource, /extractIdempotencyKey/);
  assert.match(bursarSource, /loadIdempotentResponse/);
  assert.match(bursarSource, /storeIdempotentResponse/);
});

test("idempotency helper mints CSPRNG receipt numbers", () => {
  assert.match(idempotencySource, /crypto\.getRandomValues/);
  assert.match(idempotencySource, /RCP-/);
  assert.doesNotMatch(idempotencySource, /Math\.random/);
});

test("teacher results save enforces assignment scope and publish lock", () => {
  assert.match(resultsSaveSource, /requireTeacherContext/);
  assert.match(resultsSaveSource, /loadTeacherAssignmentScope/);
  assert.match(resultsSaveSource, /published_at/);
  assert.match(resultsSaveSource, /status: 409/);
  assert.match(resultsSaveSource, /onConflict:\s*"student_id,assignment_id"/);
});

test("teacher results extract requires teacher context and parses spreadsheets", () => {
  assert.match(resultsExtractSource, /requireTeacherContext/);
  assert.match(resultsExtractSource, /parseCsv|parseExcel/);
  assert.match(resultsExtractSource, /does not save|parse only|Confirm/i);
});
