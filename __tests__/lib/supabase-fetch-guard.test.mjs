import test from "node:test";
import assert from "node:assert/strict";

// ─── Supabase fetch guard behavioral tests ─────────────────────────────────
//
// Verifies the guard actually tracks requests (the old per-call Date.now()
// device ID silently disabled tracking) and that the device bucket stays
// stable across calls on the server.

async function loadGuardModule() {
  return import("../../lib/supabase-fetch-guard.ts");
}

test("guard telemetry shows requests are tracked after install", async () => {
  const mod = await loadGuardModule();
  mod.resetFetchGuard();

  // Save and replace fetch with a mock that responds to supabase.co URLs.
  const originalFetch = globalThis.fetch;
  let callCount = 0;
  const mockFetch = async (input) => {
    callCount++;
    return new Response("{}", { status: 200 });
  };
  globalThis.fetch = mockFetch;

  try {
    mod.installSupabaseFetchGuard();
    assert.ok(mod.isGuardInstalled(), "guard should be installed");

    // Make a few fake Supabase requests
    await fetch("https://fake-project.supabase.co/rest/v1/profiles?select=id");
    await fetch("https://fake-project.supabase.co/rest/v1/schools?select=id");
    await fetch("https://fake-project.supabase.co/auth/v1/token");

    const telemetry = mod.getFetchGuardTelemetry();
    assert.ok(telemetry.installed, "telemetry should report installed");
    assert.ok(
      telemetry.currentRps > 0,
      `currentRps should be > 0 after requests (got: ${telemetry.currentRps})`,
    );
    assert.equal(callCount, 3, "mock fetch should have been called 3 times");
  } finally {
    mod.uninstallSupabaseFetchGuard();
    globalThis.fetch = originalFetch;
    mod.resetFetchGuard();
  }
});

test("server device bucket stays stable across calls (not per-call)", async () => {
  const mod = await loadGuardModule();
  mod.resetFetchGuard();

  const originalFetch = globalThis.fetch;
  const mockFetch = async () => new Response("{}", { status: 200 });
  globalThis.fetch = mockFetch;

  try {
    mod.installSupabaseFetchGuard();

    // Make multiple requests - old code created a new device ID per call,
    // so activeDevices would grow. New code uses a stable server-pid bucket.
    for (let i = 0; i < 5; i++) {
      await fetch(`https://fake-project.supabase.co/rest/v1/call-${i}`);
    }

    const telemetry = mod.getFetchGuardTelemetry();
    assert.equal(
      telemetry.activeDevices,
      1,
      `activeDevices should be 1 (stable server bucket), got ${telemetry.activeDevices}`,
    );
  } finally {
    mod.uninstallSupabaseFetchGuard();
    globalThis.fetch = originalFetch;
    mod.resetFetchGuard();
  }
});

test("non-supabase requests pass through untracked", async () => {
  const mod = await loadGuardModule();
  mod.resetFetchGuard();

  const originalFetch = globalThis.fetch;
  const mockFetch = async () => new Response("ok", { status: 200 });
  globalThis.fetch = mockFetch;

  try {
    mod.installSupabaseFetchGuard();

    await fetch("https://example.com/api/data");
    await fetch("https://example.com/api/other");

    const telemetry = mod.getFetchGuardTelemetry();
    assert.equal(
      telemetry.currentRps,
      0,
      "non-supabase requests should not be tracked in the budget",
    );
  } finally {
    mod.uninstallSupabaseFetchGuard();
    globalThis.fetch = originalFetch;
    mod.resetFetchGuard();
  }
});
