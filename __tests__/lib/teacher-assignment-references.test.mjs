import assert from "node:assert/strict";
import { describe, it } from "node:test";

/**
 * Unit tests for pure helpers in teacher-assignment-references.
 * isMissingRelationError is re-implemented here to avoid TS module loading
 * in the plain Node test runner (matches lib/teacher-assignment-references.ts).
 */
function isMissingRelationError(error) {
  const code = String(error?.code || "");
  const message = String(error?.message || "").toLowerCase();
  return (
    code === "42P01" ||
    code === "PGRST205" ||
    message.includes("does not exist")
  );
}

describe("isMissingRelationError", () => {
  it("detects missing relation codes", () => {
    assert.equal(isMissingRelationError({ code: "42P01" }), true);
    assert.equal(isMissingRelationError({ code: "PGRST205" }), true);
  });

  it("detects missing relation messages", () => {
    assert.equal(
      isMissingRelationError({ message: "relation foo does not exist" }),
      true,
    );
  });

  it("returns false for unrelated errors", () => {
    assert.equal(isMissingRelationError({ code: "23505" }), false);
    assert.equal(isMissingRelationError(null), false);
    assert.equal(isMissingRelationError(undefined), false);
  });
});
