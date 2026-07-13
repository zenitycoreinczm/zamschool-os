import test from "node:test";
import assert from "node:assert/strict";

test("detects DNS/network failures from nested fetch errors", async () => {
  const mod = await import("../../lib/supabase-connectivity.ts");
  mod.resetSupabaseConnectivityState();

  const error = new TypeError("fetch failed", {
    cause: Object.assign(new Error("getaddrinfo ENOTFOUND example.supabase.co"), {
      code: "ENOTFOUND",
      syscall: "getaddrinfo",
      hostname: "example.supabase.co",
    }),
  });

  assert.equal(mod.isSupabaseNetworkError(error), true);
});

test("opens a short connectivity circuit after repeated network failures", async () => {
  const mod = await import("../../lib/supabase-connectivity.ts");
  mod.resetSupabaseConnectivityState();

  const error = Object.assign(new Error("getaddrinfo ENOTFOUND example.supabase.co"), {
    code: "ENOTFOUND",
  });

  assert.equal(mod.isSupabaseCircuitOpen(), false);
  mod.openSupabaseCircuit(error);
  assert.equal(mod.isSupabaseCircuitOpen(), true);
});