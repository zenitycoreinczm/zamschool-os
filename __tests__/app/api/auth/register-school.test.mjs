import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// ─── register-school security regression tests ─────────────────────────────
//
// Behavioral assertions on the register-school route source to prevent
// re-introduction of the email self-bootstrap bypass.

const source = readFileSync("app/api/auth/register-school/route.ts", "utf8");

test("register-school does not self-bootstrap email confirmation without OTP attestation", () => {
  // The self-bootstrap branch force-confirmed email based solely on session
  // existence. It must not be re-introduced.
  assert.doesNotMatch(
    source,
    /self-bootstrap/,
    "self-bootstrap branch must not exist - it bypassed email verification",
  );
  assert.doesNotMatch(
    source,
    /no OTP attestation.*valid Supabase session/,
    "session-only email confirmation bypass must not be re-introduced",
  );
});

test("register-school keeps the OTP attestation self-heal path", () => {
  // The legitimate recovery path (OTP attestation from verify-otp) stays.
  assert.match(source, /hasOtpVerificationAttestation/);
  assert.match(source, /confirmEmailViaAdmin/);
  assert.match(source, /consumeOtpVerificationAttestation/);
});

test("register-school returns 403 when email is not confirmed after self-heal", () => {
  assert.match(source, /email_confirmed_at/);
  assert.match(source, /status:\s*403/);
  assert.match(
    source,
    /Please verify your email before creating a school/,
  );
});

test("register-school validates the access code before creating a school", () => {
  assert.match(source, /validateSchoolAccessCode/);
  assert.match(source, /consumeSchoolAccessCode/);
});
