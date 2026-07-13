import test from "node:test";
import assert from "node:assert/strict";

import {
  formatKwacha,
  isValidZambianPhone,
  normalizeZambianPhone,
  zambianPhoneValidationError,
  getECZGrade,
} from "../../lib/zambia-localization.ts";

test("accepts common Zambian mobile formats", () => {
  // Airtel 097 and 077 (including newer 0770… blocks)
  assert.equal(isValidZambianPhone("0977123456"), true);
  assert.equal(isValidZambianPhone("0770234564"), true);
  assert.equal(isValidZambianPhone("0770 234 564"), true);
  assert.equal(isValidZambianPhone("+260770234564"), true);
  assert.equal(isValidZambianPhone("+260 77 023 4564"), true);
  assert.equal(isValidZambianPhone("260977123456"), true);
  // MTN / Zamtel both 09x and 07x
  assert.equal(isValidZambianPhone("0966123456"), true);
  assert.equal(isValidZambianPhone("0766123456"), true);
  assert.equal(isValidZambianPhone("0955123456"), true);
  assert.equal(isValidZambianPhone("0755123456"), true);
  // National form without leading 0
  assert.equal(isValidZambianPhone("770234564"), true);
});

test("rejects invalid phone numbers", () => {
  assert.equal(isValidZambianPhone("12345"), false);
  assert.equal(isValidZambianPhone("0911123456"), false); // not a known operator
  assert.equal(isValidZambianPhone("0711123456"), false);
  assert.equal(isValidZambianPhone(""), false);
  assert.equal(isValidZambianPhone(null), false);
  assert.equal(isValidZambianPhone("077023456"), false); // too short
});

test("normalizes phones to +260", () => {
  assert.equal(normalizeZambianPhone("0977 123 456"), "+260977123456");
  assert.equal(normalizeZambianPhone("0770234564"), "+260770234564");
  assert.equal(normalizeZambianPhone("+260 96 6123456"), "+260966123456");
  assert.equal(normalizeZambianPhone("bad"), null);
});

test("phone validation error is null for empty or valid", () => {
  assert.equal(zambianPhoneValidationError(""), null);
  assert.equal(zambianPhoneValidationError("0977123456"), null);
  assert.equal(zambianPhoneValidationError("0770234564"), null);
  assert.match(zambianPhoneValidationError("123"), /Airtel 097\/077/i);
  assert.match(zambianPhoneValidationError("", { required: true }), /required/i);
});

test("formatKwacha uses en-ZM grouping", () => {
  assert.equal(formatKwacha(1500.5), "ZMW 1,500.50");
  assert.equal(formatKwacha(1500.5, { symbol: "K" }), "K1,500.50");
  assert.equal(formatKwacha(null), "ZMW 0.00");
  assert.equal(formatKwacha(1200, { decimals: 0 }), "ZMW 1,200");
});

test("ECZ grade scale maps marks correctly", () => {
  assert.equal(getECZGrade(80).grade, "One");
  assert.equal(getECZGrade(50).grade, "Six");
  assert.equal(getECZGrade(20).grade, "Nine");
});
