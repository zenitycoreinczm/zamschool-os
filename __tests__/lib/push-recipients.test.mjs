import test from "node:test";
import assert from "node:assert/strict";

import { filterOwnedTokens, MAX_PUSH_USER_IDS, capUserIds } from "../../lib/notifications/push-recipients.ts";

test("only tokens registered to the caller are kept", () => {
  const requested = ["ExponentPushToken[mine]", "ExponentPushToken[victim]"];
  const owned = ["ExponentPushToken[mine]"];

  assert.deepEqual(filterOwnedTokens(requested, owned), ["ExponentPushToken[mine]"]);
});

test("deduplicates and preserves request order", () => {
  const requested = ["b", "a", "b", "c"];
  const owned = ["a", "b", "c"];

  assert.deepEqual(filterOwnedTokens(requested, owned), ["b", "a", "c"]);
});

test("empty request yields empty result", () => {
  assert.deepEqual(filterOwnedTokens([], ["a", "b"]), []);
});

test("whitespace and non-string entries are normalized away", () => {
  const requested = ["  a  ", "", null, "b"];
  const owned = ["a", "b"];

  assert.deepEqual(filterOwnedTokens(requested, owned), ["a", "b"]);
});

test("user id fan-out is capped to prevent payload amplification", () => {
  const huge = Array.from({ length: MAX_PUSH_USER_IDS + 500 }, (_, i) => `u-${i}`);

  const capped = capUserIds(huge);

  assert.equal(capped.length, MAX_PUSH_USER_IDS);
});

test("capUserIds deduplicates and trims", () => {
  assert.deepEqual(capUserIds([" a ", "a", "b", ""]), ["a", "b"]);
});
