import test from "node:test";
import assert from "node:assert/strict";

import { createCoalescedStore } from "../../lib/inbox/request-coalescer.ts";

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

test("concurrent forced loads issue a single request", async () => {
  const store = createCoalescedStore();
  const gate = deferred();
  let calls = 0;
  const fetcher = () => {
    calls += 1;
    return gate.promise;
  };

  const a = store.load("account", fetcher, { force: true });
  const b = store.load("account", fetcher, { force: true });
  const c = store.load("account", fetcher, { force: true });
  gate.resolve(7);

  assert.deepEqual(await Promise.all([a, b, c]), [7, 7, 7]);
  assert.equal(calls, 1, "force must bypass the TTL cache, not in-flight dedupe");
});

test("keys are isolated from each other", async () => {
  const store = createCoalescedStore();
  let calls = 0;
  const fetcher = async () => {
    calls += 1;
    return calls;
  };

  await Promise.all([
    store.load("account", fetcher, { force: true }),
    store.load("admin", fetcher, { force: true }),
  ]);
  assert.equal(calls, 2);
});

test("cached value is served without a request until TTL expires", async () => {
  const store = createCoalescedStore();
  let calls = 0;
  const fetcher = async () => {
    calls += 1;
    return calls;
  };

  assert.equal(await store.load("account", fetcher, { ttlMs: 5 }), 1);
  assert.equal(await store.load("account", fetcher, { ttlMs: 60_000 }), 1);
  assert.equal(calls, 1);

  await new Promise((resolve) => setTimeout(resolve, 15));
  assert.equal(await store.load("account", fetcher, { ttlMs: 60_000 }), 2);
  assert.equal(calls, 2);
});

test("force ignores a fresh cache entry but still joins an in-flight request", async () => {
  const store = createCoalescedStore();
  let calls = 0;
  const fetcher = async () => {
    calls += 1;
    return calls;
  };

  assert.equal(await store.load("account", fetcher, { ttlMs: 60_000 }), 1);
  assert.equal(await store.load("account", fetcher, { force: true }), 2);
  assert.equal(calls, 2);

  const a = store.load("account", fetcher, { force: true });
  const b = store.load("account", fetcher, { force: true });
  await Promise.all([a, b]);
  assert.equal(calls, 3);
});

test("a value fetched before invalidate is never observed after it", async () => {
  const store = createCoalescedStore();
  const stale = deferred();
  const fresh = deferred();
  const responses = [
    () => stale.promise,
    () => fresh.promise,
    () => Promise.reject(new Error("unexpected third request")),
  ];
  const fetcher = () => responses.shift()();

  const started = store.load("account", fetcher, { force: true, ttlMs: 60_000 });
  store.invalidate();
  stale.resolve("pre-read");

  const joiner = store.load("account", fetcher, { force: true, ttlMs: 60_000 });
  fresh.resolve("post-read");

  assert.deepEqual(await Promise.all([started, joiner]), ["post-read", "post-read"]);

  let observed;
  await store
    .load("account", () => Promise.reject(new Error("must be cached")), {
      ttlMs: 60_000,
    })
    .then((value) => {
      observed = value;
    })
    .catch(() => {
      observed = "NOT_CACHED";
    });
  assert.equal(observed, "post-read", "only post-invalidate data may be cached");
});

test("failed request is not cached and later callers retry", async () => {
  const store = createCoalescedStore();
  let calls = 0;
  const fetcher = async () => {
    calls += 1;
    if (calls === 1) throw new Error("network");
    return "ok";
  };

  await assert.rejects(() => store.load("account", fetcher, { ttlMs: 60_000 }));
  assert.equal(await store.load("account", fetcher, { ttlMs: 60_000 }), "ok");
  assert.equal(calls, 2);
});

test("concurrent callers all observe a rejection", async () => {
  const store = createCoalescedStore();
  const gate = deferred();
  let calls = 0;
  const fetcher = () => {
    calls += 1;
    return gate.promise;
  };

  const a = store.load("account", fetcher, { force: true });
  const b = store.load("account", fetcher, { force: true });
  gate.reject(new Error("boom"));

  await assert.rejects(() => a);
  await assert.rejects(() => b);
  assert.equal(calls, 1);
});
