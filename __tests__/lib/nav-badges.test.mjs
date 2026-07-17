import test from "node:test";
import assert from "node:assert/strict";

import {
  badgeKeyForHref,
  buildBadgeByHref,
  countNewSinceSeen,
  formatNavBadgeCount,
} from "../../lib/workspace/nav-badges.ts";

test("badgeKeyForHref maps portal paths to badge keys", () => {
  assert.equal(badgeKeyForHref("/app/messages"), "messages");
  assert.equal(badgeKeyForHref("/app/teacher/inbox"), "messages");
  assert.equal(badgeKeyForHref("/app/student/messages"), "messages");
  assert.equal(badgeKeyForHref("/app/parent/messages"), "messages");
  assert.equal(badgeKeyForHref("/app/notifications"), "notifications");
  assert.equal(badgeKeyForHref("/app/announcements"), "announcements");
  assert.equal(badgeKeyForHref("/app/student/announcements"), "announcements");
  assert.equal(badgeKeyForHref("/app/events"), "events");
  assert.equal(badgeKeyForHref("/app/dashboard"), null);
});

test("formatNavBadgeCount caps high counts", () => {
  assert.equal(formatNavBadgeCount(0), "");
  assert.equal(formatNavBadgeCount(3), "3");
  assert.equal(formatNavBadgeCount(99), "99");
  assert.equal(formatNavBadgeCount(120), "99+");
});

test("buildBadgeByHref only includes positive counts", () => {
  const map = buildBadgeByHref(
    {
      messages: 4,
      notifications: 0,
      announcements: 2,
      events: 1,
    },
    [
      "/app/messages",
      "/app/notifications",
      "/app/announcements",
      "/app/events",
      "/app/dashboard",
    ],
  );

  assert.deepEqual(map, {
    "/app/messages": 4,
    "/app/announcements": 2,
    "/app/events": 1,
  });
});

test("countNewSinceSeen counts items after last visit", () => {
  const items = [
    { created_at: "2026-07-10T10:00:00.000Z" },
    { created_at: "2026-07-09T10:00:00.000Z" },
    { created_at: "2026-07-01T10:00:00.000Z" },
  ];

  assert.equal(
    countNewSinceSeen(items, "2026-07-09T12:00:00.000Z"),
    1,
  );
  assert.equal(
    countNewSinceSeen(items, "2026-07-11T00:00:00.000Z"),
    0,
  );
});

test("countNewSinceSeen uses published_at when present", () => {
  const items = [
    {
      created_at: "2026-01-01T00:00:00.000Z",
      published_at: "2026-07-10T08:00:00.000Z",
    },
  ];
  assert.equal(
    countNewSinceSeen(items, "2026-07-09T00:00:00.000Z"),
    1,
  );
});

test("countNewSinceSeen skips individually read items", () => {
  const items = [
    { id: "a1", created_at: "2026-07-10T10:00:00.000Z" },
    { id: "a2", created_at: "2026-07-10T11:00:00.000Z" },
  ];
  const readIds = new Set(["a1"]);
  assert.equal(
    countNewSinceSeen(items, "2026-07-01T00:00:00.000Z", readIds),
    1,
  );
});
