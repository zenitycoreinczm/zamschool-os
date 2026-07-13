import test from "node:test";
import assert from "node:assert/strict";

import {
  PublicError,
  looksLikeLeakyErrorMessage,
  publicErrorBody,
  redactSecretsInText,
  safeErrorMessage,
  sanitizePublicErrorMessage,
} from "../../lib/safe-error.ts";

test("safeErrorMessage returns fallback for non-Error values", () => {
  assert.equal(safeErrorMessage("string error"), "An unexpected error occurred");
  assert.equal(safeErrorMessage(42), "An unexpected error occurred");
  assert.equal(safeErrorMessage(null), "An unexpected error occurred");
  assert.equal(safeErrorMessage(undefined), "An unexpected error occurred");
  assert.equal(safeErrorMessage({ code: 500 }), "An unexpected error occurred");
});

test("safeErrorMessage returns fallback for Error with empty message", () => {
  const err = new Error("");
  assert.equal(safeErrorMessage(err), "An unexpected error occurred");
});

test("safeErrorMessage accepts custom fallback", () => {
  assert.equal(safeErrorMessage(null, "Payment processing failed"), "Payment processing failed");
  assert.equal(safeErrorMessage("oops", "Custom fallback"), "Custom fallback");
});

test("safeErrorMessage uses custom fallback even for Error with empty message", () => {
  assert.equal(safeErrorMessage(new Error(""), "Custom fallback"), "Custom fallback");
});

test("safeErrorMessage blocks infrastructure / SQL leak messages", () => {
  assert.equal(
    safeErrorMessage(new Error("Database connection failed"), "Request failed"),
    "Request failed",
  );
  assert.equal(
    safeErrorMessage(new Error('relation "profiles" does not exist'), "Request failed"),
    "Request failed",
  );
  assert.equal(
    safeErrorMessage(new Error("duplicate key value violates unique constraint"), "Request failed"),
    "Request failed",
  );
  assert.equal(
    safeErrorMessage(new Error("JWT expired"), "Unauthorized"),
    "Unauthorized",
  );
  assert.equal(
    safeErrorMessage(new Error("ECONNREFUSED 127.0.0.1:5432"), "Request failed"),
    "Request failed",
  );
});

test("safeErrorMessage allows intentional public validation messages", () => {
  assert.equal(
    safeErrorMessage(new Error("Select a class for this student.")),
    "Select a class for this student.",
  );
  assert.equal(
    safeErrorMessage(new PublicError("First name, last name, and email are required.")),
    "First name, last name, and email are required.",
  );
  assert.equal(
    safeErrorMessage(new Error("Password must be at least 8 characters.")),
    "Password must be at least 8 characters.",
  );
  assert.equal(
    safeErrorMessage(new Error("Invalid or expired reset token."), "Unable to reset password"),
    "Invalid or expired reset token.",
  );
});

test("looksLikeLeakyErrorMessage detects stack traces", () => {
  assert.equal(
    looksLikeLeakyErrorMessage("Error\n    at Object.<anonymous> (/app/server.js:1:1)"),
    true,
  );
});

test("redactSecretsInText strips bearer tokens and jwt", () => {
  const redacted = redactSecretsInText(
    "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.aaa.bbb password=supersecret",
  );
  assert.match(redacted, /\[REDACTED/);
  assert.doesNotMatch(redacted, /supersecret/);
});

test("publicErrorBody never returns leaky SQL", () => {
  const body = publicErrorBody(
    new Error('column "school_id" of relation "profiles" does not exist'),
    "Unable to complete request",
  );
  assert.equal(body.error, "Unable to complete request");
});

test("sanitizePublicErrorMessage strips control characters", () => {
  assert.equal(
    sanitizePublicErrorMessage("Bad\u0000input\n\nplease retry"),
    "Bad input  please retry",
  );
});
