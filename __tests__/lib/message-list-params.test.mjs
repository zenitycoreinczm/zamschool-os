import test from "node:test";
import assert from "node:assert/strict";

import {
  parseMessageListLimit,
  parseMessageListOffset,
} from "../../lib/messages/list-params.ts";

test("limit defaults to 50 when absent", () => {
  assert.equal(parseMessageListLimit(null), 50);
});

test("limit accepts values inside the 1..100 range", () => {
  assert.equal(parseMessageListLimit("1"), 1);
  assert.equal(parseMessageListLimit("75"), 75);
  assert.equal(parseMessageListLimit("100"), 100);
});

test("limit clamps below 1 and above 100", () => {
  assert.equal(parseMessageListLimit("0"), 1);
  assert.equal(parseMessageListLimit("-5"), 1);
  assert.equal(parseMessageListLimit("500"), 100);
});

test("limit falls back to default for non-numeric input", () => {
  assert.equal(parseMessageListLimit("abc"), 50);
  assert.equal(parseMessageListLimit(""), 50);
  assert.equal(parseMessageListLimit("12.9"), 12);
});

test("offset defaults to 0 when absent", () => {
  assert.equal(parseMessageListOffset(null), 0);
});

test("offset accepts non-negative integers", () => {
  assert.equal(parseMessageListOffset("0"), 0);
  assert.equal(parseMessageListOffset("250"), 250);
});

test("offset rejects negative and non-numeric input", () => {
  assert.equal(parseMessageListOffset("-10"), 0);
  assert.equal(parseMessageListOffset("abc"), 0);
  assert.equal(parseMessageListOffset(""), 0);
});
