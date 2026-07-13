import test from "node:test";
import assert from "node:assert/strict";

import {
  resolveOfflineWarmupApis,
  resolveOfflineWarmupPages,
} from "../../lib/offline-support.ts";

test("platform super_admin warms no school APIs", () => {
  const apis = resolveOfflineWarmupApis({
    role: "super_admin",
    schoolId: null,
  });
  const pages = resolveOfflineWarmupPages({
    role: "super_admin",
    schoolId: null,
  });

  assert.deepEqual(apis, []);
  assert.deepEqual(pages, ["/app/super-admin"]);
});

test("incomplete profile warms nothing", () => {
  assert.deepEqual(
    resolveOfflineWarmupApis({ role: "principal", schoolId: null }),
    [],
  );
  assert.deepEqual(
    resolveOfflineWarmupPages({ role: "principal", schoolId: null }),
    [],
  );
});

test("principal with school gets admin pack, not teacher bootstrap", () => {
  const apis = resolveOfflineWarmupApis({
    role: "principal",
    schoolId: "school-1",
  });

  assert.ok(apis.includes("/api/admin/users"));
  assert.ok(apis.includes("/api/dashboard/summary"));
  assert.ok(!apis.includes("/api/teacher/bootstrap"));
  assert.ok(!apis.includes("/api/payments/billing/summary"));
});

test("teacher with school gets teacher pack only", () => {
  const apis = resolveOfflineWarmupApis({
    role: "teacher",
    schoolId: "school-1",
  });

  assert.ok(apis.includes("/api/teacher/bootstrap"));
  assert.ok(apis.includes("/api/account/workspace-context"));
  assert.ok(!apis.includes("/api/admin/users"));
  assert.ok(!apis.includes("/api/payments/billing/summary"));
});
