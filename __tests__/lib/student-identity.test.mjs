import test from "node:test";
import assert from "node:assert/strict";

async function load() {
  return import("../../lib/student-identity.ts");
}

test("formats Name | Class | Number identity line", async () => {
  const { formatStudentIdentityLine } = await load();
  assert.equal(
    formatStudentIdentityLine({
      displayName: "ison mumbuna",
      className: "9A",
      classNumber: 45,
    }),
    "ison mumbuna | 9A | 45",
  );
});

test("uses placeholders when class or number missing", async () => {
  const { formatStudentIdentityLine } = await load();
  assert.equal(
    formatStudentIdentityLine({ displayName: "Ada" }),
    "Ada | — | —",
  );
});

test("parsePositiveClassNumber accepts roll-call numbers", async () => {
  const { parsePositiveClassNumber } = await load();
  assert.equal(parsePositiveClassNumber("45"), 45);
  assert.equal(parsePositiveClassNumber(12), 12);
  assert.equal(parsePositiveClassNumber("0"), null);
  assert.equal(parsePositiveClassNumber("abc"), null);
});
