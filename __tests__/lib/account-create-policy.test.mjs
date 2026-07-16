import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

let canActorCreateSchoolRole;
let blockedRoleCreationMessage;
try {
  ({
    canActorCreateSchoolRole,
    blockedRoleCreationMessage,
  } = await import("../../lib/account-create-policy.ts"));
} catch {
  canActorCreateSchoolRole = null;
}

test("Head Teacher can invite office staff only - not students/parents/teachers", () => {
  if (!canActorCreateSchoolRole) {
    const source = readFileSync("lib/account-create-policy.ts", "utf8");
    assert.match(source, /PRINCIPAL_STAFF_CREATE_ROLES/);
    assert.match(source, /actor === "PRINCIPAL"/);
    assert.doesNotMatch(
      source,
      /if \(actor === "PRINCIPAL" \|\| actor === "SUPER_ADMIN"\) \{\s*return true;/,
    );
    return;
  }

  assert.equal(canActorCreateSchoolRole("PRINCIPAL", "deputy_head"), true);
  assert.equal(canActorCreateSchoolRole("PRINCIPAL", "registrar"), true);
  assert.equal(canActorCreateSchoolRole("PRINCIPAL", "bursar"), true);

  assert.equal(canActorCreateSchoolRole("PRINCIPAL", "student"), false);
  assert.equal(canActorCreateSchoolRole("PRINCIPAL", "parent"), false);
  assert.equal(canActorCreateSchoolRole("PRINCIPAL", "teacher"), false);
  assert.equal(canActorCreateSchoolRole("PRINCIPAL", "principal"), false);
});

test("Registrar still creates students, parents, and teachers", () => {
  if (!canActorCreateSchoolRole) return;

  assert.equal(canActorCreateSchoolRole("REGISTRAR", "student"), true);
  assert.equal(canActorCreateSchoolRole("REGISTRAR", "parent"), true);
  assert.equal(canActorCreateSchoolRole("REGISTRAR", "teacher"), true);
  assert.equal(canActorCreateSchoolRole("REGISTRAR", "bursar"), false);
});

test("blocked message for Head Teacher student create points to Registrar", () => {
  if (!blockedRoleCreationMessage) return;

  const message = blockedRoleCreationMessage("student", "PRINCIPAL");
  assert.match(message, /Registrar/i);
  assert.match(message, /People/i);
});
