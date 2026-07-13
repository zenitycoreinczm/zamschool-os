import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  getRoleDisplayLabel,
  isSchoolAdministratorRole,
  isSchoolLeadershipRole,
  KNOWN_ROLES,
  normalizeRole,
  roleToStoredValue,
} from "../../lib/roles.ts";

describe("school leadership role model", () => {
  it("does not treat ADMIN as a canonical known role", () => {
    assert.equal(KNOWN_ROLES.includes("ADMIN"), false);
    assert.equal(KNOWN_ROLES.includes("PRINCIPAL"), true);
    assert.equal(KNOWN_ROLES.includes("DEPUTY_HEAD"), true);
    assert.equal(KNOWN_ROLES.includes("SUPER_ADMIN"), true);
  });

  it("collapses legacy admin / School Administrator into Head Teacher", () => {
    assert.equal(normalizeRole("admin"), "PRINCIPAL");
    assert.equal(normalizeRole("ADMIN"), "PRINCIPAL");
    assert.equal(normalizeRole("administrator"), "PRINCIPAL");
    assert.equal(normalizeRole("school_administrator"), "PRINCIPAL");
    assert.equal(roleToStoredValue("admin"), "principal");
    assert.equal(getRoleDisplayLabel("admin"), "Head Teacher");
    assert.equal(getRoleDisplayLabel("principal"), "Head Teacher");
    assert.equal(isSchoolAdministratorRole("admin"), false);
  });

  it("recognizes Head Teacher and Deputy Head as school leadership", () => {
    assert.equal(isSchoolLeadershipRole("principal"), true);
    assert.equal(isSchoolLeadershipRole("deputy_head"), true);
    assert.equal(isSchoolLeadershipRole("bursar"), false);
    assert.equal(isSchoolLeadershipRole("super_admin"), false);
  });

  it("staff invite options exclude admin and principal", () => {
    const source = readFileSync("lib/staff-invite-options.ts", "utf8");
    assert.match(source, /deputy_head/);
    assert.doesNotMatch(source, /value:\s*SCHOOL_ADMINISTRATOR_INVITE_ROLE/);
    assert.doesNotMatch(source, /value:\s*"admin"/);
    assert.doesNotMatch(source, /value:\s*"principal"/);
  });
});
