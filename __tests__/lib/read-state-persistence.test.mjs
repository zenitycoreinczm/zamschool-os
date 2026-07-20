import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const clearCachesPath = resolve(
  process.cwd(),
  "lib",
  "workspace",
  "clear-client-auth-caches.ts",
);
const inboxQueriesPath = resolve(process.cwd(), "lib", "inbox", "queries.ts");
const inboxPreviewPath = resolve(
  process.cwd(),
  "app",
  "api",
  "account",
  "inbox-preview",
  "route.ts",
);

test("logout keeps feed read watermarks while clearing volatile feed caches", async () => {
  const source = await readFile(clearCachesPath, "utf8");

  assert.match(source, /invalidateAnnouncementsClientCache\(\)/);
  assert.match(source, /invalidateEventsClientCache\(\)/);
  assert.doesNotMatch(source, /zamschool:nav-seen/);
  assert.doesNotMatch(source, /zamschool:feed-read/);
});

test("notification unread counts dedupe rows across user_id and recipient_id schemas", async () => {
  const source = await readFile(inboxQueriesPath, "utf8");

  assert.match(source, /const unreadIds = new Set<string>\(\)/);
  assert.match(source, /unreadIds\.add\(String\(row\.id\)\)/);
  assert.doesNotMatch(source, /Math\.max\(\.\.\.counts\)/);
});

test("inbox preview dedupes unread message rows before rendering badges", async () => {
  const source = await readFile(inboxPreviewPath, "utf8");

  assert.match(source, /loadUnreadMessagePreviewRows/);
  assert.match(source, /const byId = new Map<string, any>\(\)/);
  assert.match(source, /if \(id && !byId\.has\(id\)\) byId\.set\(id, row\)/);
});
