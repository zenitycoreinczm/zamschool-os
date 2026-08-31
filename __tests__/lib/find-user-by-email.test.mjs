import test from "node:test";
import assert from "node:assert/strict";

import { findUserByEmail } from "../../lib/password-reset/find-user-by-email.ts";

function makeUser(id, email, firstName) {
  return { id, email, user_metadata: firstName ? { first_name: firstName } : {} };
}

/** Fake supabase-admin client.
 *  - profileResult: row returned by profiles lookup (null = no profile)
 *  - pages: array of user arrays, one per listUsers page
 */
function fakeSupabase({ profile = null, pages = [] } = {}) {
  const calls = { listUsers: [] };
  return {
    calls,
    from(table) {
      assert.equal(table, "profiles");
      return {
        select() {
          return {
            eq(field, value) {
              assert.equal(field, "email");
              assert.equal(typeof value, "string");
              return {
                maybeSingle: async () => ({ data: profile }),
              };
            },
          };
        },
      };
    },
    auth: {
      admin: {
        listUsers: async (params) => {
          calls.listUsers.push(params);
          const page = params.page ?? 1;
          return { data: { users: pages[page - 1] ?? [] }, error: null };
        },
      },
    },
  };
}

test("returns user from profiles table when it exists", async () => {
  const client = fakeSupabase({
    profile: { id: "u-1", first_name: "Chanda" },
    pages: [[makeUser("u-9", "other@example.com")]],
  });

  const result = await findUserByEmail(client, "teacher@school.com");

  assert.deepEqual(result, { id: "u-1", firstName: "Chanda" });
  assert.equal(client.calls.listUsers.length, 0, "must not scan auth.users when profiles matched");
});

test("returns null when no profile and no auth user matches", async () => {
  const client = fakeSupabase({
    pages: [[makeUser("u-1", "someone@example.com")]],
  });

  const result = await findUserByEmail(client, "missing@school.com");

  assert.equal(result, null);
});

test("falls back to auth.users for auth-only accounts (page 1)", async () => {
  const client = fakeSupabase({
    pages: [[makeUser("u-2", "authonly@school.com", "Mulenga")]],
  });

  const result = await findUserByEmail(client, "authonly@school.com");

  assert.deepEqual(result, { id: "u-2", firstName: "Mulenga" });
});

test("matches auth users beyond the first page (regression: 50-user cap)", async () => {
  const pageOne = Array.from({ length: 1000 }, (_, i) =>
    makeUser(`u-${i}`, `user${i}@example.com`),
  );
  const client = fakeSupabase({
    pages: [pageOne, [makeUser("u-deep", "deep@school.com", "Bwalya")]],
  });

  const result = await findUserByEmail(client, "deep@school.com");

  assert.deepEqual(result, { id: "u-deep", firstName: "Bwalya" });
});

test("auth-user email matching is case-insensitive", async () => {
  const client = fakeSupabase({
    pages: [[makeUser("u-3", "Mixed.Case@School.com", "Tembo")]],
  });

  const result = await findUserByEmail(client, "mixed.case@school.com");

  assert.deepEqual(result, { id: "u-3", firstName: "Tembo" });
});

test("stops paginating once a short page is returned", async () => {
  const shortPage = [makeUser("u-a", "a@example.com")];
  const client = fakeSupabase({
    pages: [shortPage, [makeUser("u-b", "b@example.com")]],
  });

  const result = await findUserByEmail(client, "not-there@school.com");

  assert.equal(result, null);
  assert.equal(
    client.calls.listUsers.length,
    1,
    "a page shorter than perPage means there are no more pages",
  );
});

test("caps the auth.users scan so huge tenants cannot stall the request", async () => {
  const fullPage = Array.from({ length: 1000 }, (_, i) =>
    makeUser(`u-${i}`, `user${i}@example.com`),
  );
  const client = fakeSupabase({
    // endless full pages — the lookup must stop after the cap
    pages: Array.from({ length: 50 }, () => fullPage),
  });

  const result = await findUserByEmail(client, "ghost@school.com");

  assert.equal(result, null);
  assert.ok(
    client.calls.listUsers.length <= 10,
    `expected at most 10 pages scanned, got ${client.calls.listUsers.length}`,
  );
});
