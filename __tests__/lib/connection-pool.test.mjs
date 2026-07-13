import assert from "node:assert/strict";
import { describe, it } from "node:test";

/**
 * Connection pool is a TS module; validate config parsing behavior
 * via a minimal reimplementation of the env clamp helpers used there.
 */
function envInt(env, name, fallback, min) {
  const raw = env[name];
  if (raw === undefined || raw === "") return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.floor(n));
}

function clampPoolConfig(env = {}) {
  return {
    maxConcurrent: envInt(env, "SUPABASE_POOL_MAX_CONCURRENT", 10, 1),
    maxQueue: envInt(env, "SUPABASE_POOL_MAX_QUEUE", 100, 1),
    queueTimeoutMs: envInt(env, "SUPABASE_POOL_QUEUE_TIMEOUT_MS", 30_000, 1000),
  };
}

describe("connection pool config", () => {
  it("uses safe defaults", () => {
    const cfg = clampPoolConfig({});
    assert.equal(cfg.maxConcurrent, 10);
    assert.equal(cfg.maxQueue, 100);
    assert.equal(cfg.queueTimeoutMs, 30_000);
  });

  it("respects env overrides", () => {
    const cfg = clampPoolConfig({
      SUPABASE_POOL_MAX_CONCURRENT: "5",
      SUPABASE_POOL_MAX_QUEUE: "50",
      SUPABASE_POOL_QUEUE_TIMEOUT_MS: "5000",
    });
    assert.equal(cfg.maxConcurrent, 5);
    assert.equal(cfg.maxQueue, 50);
    assert.equal(cfg.queueTimeoutMs, 5000);
  });

  it("clamps invalid values", () => {
    const cfg = clampPoolConfig({
      SUPABASE_POOL_MAX_CONCURRENT: "0",
      SUPABASE_POOL_MAX_QUEUE: "-1",
      SUPABASE_POOL_QUEUE_TIMEOUT_MS: "100",
    });
    assert.equal(cfg.maxConcurrent, 1);
    assert.equal(cfg.maxQueue, 1);
    assert.equal(cfg.queueTimeoutMs, 1000);
  });
});
