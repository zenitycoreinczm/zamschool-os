import test from "node:test";
import assert from "node:assert/strict";

import { batchFallbackUpsertResults } from "../../lib/results/fallback-upsert.ts";

function makeRow(i) {
  return {
    student_id: `s-${i}`,
    assignment_id: "a-1",
    exam_id: null,
    score: 50 + i,
    grade: "B",
    school_id: "school-1",
  };
}

/** Fake supabase admin client that records calls. */
function fakeClient({ existing = [] } = {}) {
  const calls = { select: [], insert: [], upsert: [] };
  let insertError = null;
  return {
    calls,
    setInsertError(err) {
      insertError = err;
    },
    from(table) {
      assert.equal(table, "results");
      const builder = {
        select() {
          return {
            eq: function eq() {
              return this;
            },
            in: function in_() {
              calls.select.push(true);
              return {
                then: (resolve) =>
                  resolve({
                    data: existing.map((studentId) => ({
                      id: `row-${studentId}`,
                      student_id: studentId,
                    })),
                    error: null,
                  }),
              };
            },
          };
        },
        insert(rows) {
          calls.insert.push(rows);
          return Promise.resolve({ error: insertError });
        },
        upsert(rows) {
          calls.upsert.push(rows);
          return Promise.resolve({ error: null });
        },
      };
      return builder;
    },
  };
}

test("inserts all rows in one batch when nothing exists", async () => {
  const client = fakeClient();
  const rows = [makeRow(1), makeRow(2), makeRow(3)];

  const result = await batchFallbackUpsertResults(client, "school-1", rows);

  assert.deepEqual(result, { created: 3, updated: 0 });
  assert.equal(client.calls.select.length, 1, "exactly one lookup query");
  assert.equal(client.calls.insert.length, 1, "exactly one insert call");
  assert.equal(client.calls.insert[0].length, 3);
  assert.equal(client.calls.upsert.length, 0);
});

test("updates existing rows by id and inserts only the new ones", async () => {
  const client = fakeClient({ existing: ["s-1", "s-2"] });
  const rows = [makeRow(1), makeRow(2), makeRow(3)];

  const result = await batchFallbackUpsertResults(client, "school-1", rows);

  assert.deepEqual(result, { created: 1, updated: 2 });
  assert.equal(client.calls.upsert.length, 1, "existing rows batched into one upsert");
  assert.deepEqual(
    client.calls.upsert[0].map((r) => r.id).sort(),
    ["row-s-1", "row-s-2"],
  );
  assert.equal(client.calls.insert.length, 1);
  assert.equal(client.calls.insert[0].length, 1);
  assert.equal(client.calls.insert[0][0].student_id, "s-3");
});

test("treats a concurrent-insert unique violation as updated, not an error", async () => {
  const client = fakeClient();
  client.setInsertError({ code: "23505", message: "unique violation" });
  const rows = [makeRow(1), makeRow(2)];

  const result = await batchFallbackUpsertResults(client, "school-1", rows);

  assert.deepEqual(result, { created: 0, updated: 2 });
});

test("propagates non-unique insert errors", async () => {
  const client = fakeClient();
  client.setInsertError({ code: "42501", message: "permission denied" });

  await assert.rejects(
    () => batchFallbackUpsertResults(client, "school-1", [makeRow(1)]),
    /permission denied/,
  );
});

test("handles empty row list without any query", async () => {
  const client = fakeClient();

  const result = await batchFallbackUpsertResults(client, "school-1", []);

  assert.deepEqual(result, { created: 0, updated: 0 });
  assert.equal(client.calls.select.length, 0);
  assert.equal(client.calls.insert.length, 0);
  assert.equal(client.calls.upsert.length, 0);
});
