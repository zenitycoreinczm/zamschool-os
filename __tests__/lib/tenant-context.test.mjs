import test from "node:test";
import assert from "node:assert/strict";

import { importTsModule } from "../../scripts/test-ts-module.mjs";

// Genuine runtime tests (not static-grep): these execute the real
// tenant-isolation helpers against fakes, proving the behavioral invariant
// the audit called out as missing - that unscoped queries and cross-tenant
// rate-limit key collisions are structurally impossible, not just
// grep-matched in the source.
const {
  requireTenantId,
  tenantRateLimitScope,
  tenantActorRateLimitKey,
  withTenantFilter,
} = await importTsModule("../../lib/tenant/tenant-context.ts", import.meta.url);

function buildRequest(headers = {}) {
  return new Request("https://app.test/api/example", { headers });
}

/** Minimal chainable query fake that records every `.eq()` call. */
function buildFakeQuery() {
  const calls = [];
  const query = {
    calls,
    eq(column, value) {
      calls.push([column, value]);
      return query;
    },
  };
  return query;
}

test("requireTenantId returns the trimmed school id for valid input", () => {
  assert.equal(requireTenantId("school-1"), "school-1");
  assert.equal(requireTenantId("  school-2  "), "school-2");
});

for (const invalid of [null, undefined, "", "   "]) {
  test(`requireTenantId fails closed for invalid input: ${JSON.stringify(invalid)}`, () => {
    assert.throws(() => requireTenantId(invalid), /Missing tenant school_id/);
  });
}

test("tenantRateLimitScope embeds the tenant id in the key", () => {
  assert.equal(
    tenantRateLimitScope("admin-users", "school-1"),
    "tenant:school-1:admin-users",
  );
});

test("tenantRateLimitScope isolates identical scopes across different schools", () => {
  const schoolA = tenantRateLimitScope("admin-users", "school-a");
  const schoolB = tenantRateLimitScope("admin-users", "school-b");

  // Same feature scope, different tenant - the resulting rate-limit bucket
  // keys must never collide, or one school's traffic could exhaust another
  // school's quota.
  assert.notEqual(schoolA, schoolB);
});

test("tenantRateLimitScope fails closed when the school id is missing", () => {
  assert.throws(() => tenantRateLimitScope("admin-users", ""), /Missing tenant school_id/);
});

test("tenantActorRateLimitKey scopes by tenant + user when a userId is present", () => {
  const key = tenantActorRateLimitKey({
    scope: "admin-users",
    schoolId: "school-1",
    userId: "user-42",
    req: buildRequest(),
  });

  assert.equal(key, "tenant:school-1:admin-users:user:user-42");
});

test("tenantActorRateLimitKey isolates the same user id across different schools", () => {
  // A duplicate/re-used auth user id across tenants (or a bug that leaks a
  // user id across schools) must still resolve to distinct rate-limit
  // buckets. If this ever collides, one school's abusive user could throttle
  // an unrelated user in another school.
  const keyForSchoolA = tenantActorRateLimitKey({
    scope: "admin-users",
    schoolId: "school-a",
    userId: "user-shared",
    req: buildRequest(),
  });
  const keyForSchoolB = tenantActorRateLimitKey({
    scope: "admin-users",
    schoolId: "school-b",
    userId: "user-shared",
    req: buildRequest(),
  });

  assert.notEqual(keyForSchoolA, keyForSchoolB);
});

test("tenantActorRateLimitKey falls back to a tenant-scoped IP key when no userId is present", () => {
  const key = tenantActorRateLimitKey({
    scope: "admin-users",
    schoolId: "school-1",
    userId: null,
    req: buildRequest({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" }),
  });

  assert.equal(key, "tenant:school-1:admin-users:ip:203.0.113.7");
});

test("tenantActorRateLimitKey fails closed when schoolId is missing, even with a userId", () => {
  assert.throws(
    () =>
      tenantActorRateLimitKey({
        scope: "admin-users",
        schoolId: null,
        userId: "user-42",
        req: buildRequest(),
      }),
    /Missing tenant school_id/,
  );
});

test("withTenantFilter applies exactly one school_id filter to the query", () => {
  const query = buildFakeQuery();
  const result = withTenantFilter(query, "school-1");

  assert.equal(result, query, "withTenantFilter must return the chained query");
  assert.deepEqual(query.calls, [["school_id", "school-1"]]);
});

test("withTenantFilter never issues a query when the tenant id is invalid", () => {
  const query = buildFakeQuery();

  assert.throws(() => withTenantFilter(query, ""), /Missing tenant school_id/);
  // The critical isolation guarantee: an invalid tenant id must prevent the
  // query from running at all, not silently fall through to an unscoped read.
  assert.deepEqual(query.calls, []);
});
