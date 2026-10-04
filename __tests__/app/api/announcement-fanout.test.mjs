import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Gate 7 / plan s13, s14, s22, s27, s30, s38 steps 6-9, s39 (notifications
// unreliable is P1; the client deciding recipients is P0).
//
// s13 promises one announcement record fanning out to web, mobile and push with
// the same id, permissions, content and read state. The mechanism was inverted:
// POST /api/admin/announcements inserted the row, refreshed caches and audited,
// and stopped. The phone that published then called an edge function which
// worked out the audience and wrote the notification rows. So a notice published
// from the web reached nobody, and delivery for a notice published from mobile
// depended on a client build. Two tenants of one system got two different truths
// from the same record (s30 forbids mobile-only truth).
//
// Read state was the mirror image: announcement_seen, announcement_views and
// mark_announcement_seen all existed with 0 rows and no caller, while clients
// showed every notice as unread. announcement_seen is now the single store,
// because profiles.id is auth.uid() in this schema (all 81 profiles satisfy
// profiles.id = auth.users.id, measured read-only) so the server can key the row
// itself and no client can mark another person's read state.

const route = readFileSync("app/api/admin/announcements/route.ts", "utf8");
const accountRoute = readFileSync(
  "app/api/account/announcements/route.ts",
  "utf8",
);
const delivery = readFileSync("lib/announcements/delivery.ts", "utf8");
const events = readFileSync("lib/event-notifications.ts", "utf8");
const serverRead = readFileSync("lib/announcements-server.ts", "utf8");

const postBranch = route.slice(
  route.indexOf("export async function POST"),
  route.indexOf("export async function PUT"),
);

test("publishing an announcement fans out on the server, for both clients", () => {
  assert.match(
    postBranch,
    /await notifyAnnouncementAudience\(\{/,
    "the route both clients post to must own the fan-out",
  );
  assert.match(postBranch, /schoolId,/);
  assert.match(postBranch, /publisherId:\s*userId/, "the actor comes from the session");
  assert.match(
    postBranch,
    /normalizeAnnouncementRow\(data\),\s*\n\s*delivery,/,
    "the response must carry what was actually reached so a client can report it truthfully",
  );
});

test("the fan-out reaches all three surfaces of s13", () => {
  // in-app notification row
  assert.match(delivery, /enqueueNotifications\(\s*schoolId,/);
  assert.match(delivery, /type:\s*"announcement"/);
  // lock-screen push with the deep link of s14
  assert.match(delivery, /dispatchExpoPushToUsers\(/);
  assert.match(delivery, /tab:\s*"announcements"/);
  assert.match(delivery, /announcementId/);
  // delivery tracking: delivered_count existed in the baseline with no writer
  assert.match(delivery, /delivered_count:\s*recipients\.length/);
});

test("one recipient rule for audience, not one per feature (s6)", () => {
  assert.match(
    events,
    /export async function resolveAudienceRecipients/,
    "events and announcements must resolve audiences through the same function",
  );
  assert.match(delivery, /resolveAudienceRecipients\(scope\)/);
  assert.match(delivery, /parseTargetAudience\(input\.targetAudience\)/);
  assert.doesNotMatch(
    delivery,
    /from\s+"@\/lib\/teachers"|role ===\s*"parent"/,
    "the announcement module must not grow its own role arithmetic",
  );
});

test("notification keys cannot double up across old and new builds (s27)", () => {
  assert.match(
    delivery,
    /`announcement:\$\{announcementId\}:\$\{profileId\}`/,
    "must match the key the send-push edge function writes, so an older phone cannot create a second bell row",
  );
  assert.match(delivery, /\.slice\(0,\s*250\)/);
  // the publisher is not a recipient of its own notice
  assert.match(delivery, /id !== publisher/);
});

test("a fan-out failure cannot lose the published notice (s19)", () => {
  assert.match(delivery, /catch \(error\) \{\s*console\.warn\("\[announcements\] audience resolution failed"/);
  assert.match(delivery, /\.catch\(\(error\) => \{\s*console\.warn\("\[announcements\] push fan-out failed"/);
  assert.match(delivery, /Could not work out who the notice was for/);
});

test("read state has one store and the server picks the reader (s13, s18)", () => {
  assert.match(accountRoute, /export async function POST/);
  assert.match(
    accountRoute,
    /profileId:\s*profile\.id/,
    "the reader comes from the verified account, never from the request body",
  );
  assert.match(accountRoute, /loadAnnouncementSeenIds/);
  assert.match(accountRoute, /seen:\s*seen\.has\(String\(row\.id\)\)/);
  assert.doesNotMatch(accountRoute, /profileId:\s*body\./);

  // announcement_seen is the store; the bell row is flipped with it so one fact
  // is not shown as two different states.
  assert.match(delivery, /from\("announcement_seen"\)/);
  assert.match(delivery, /onConflict:\s*"announcement_id,profile_id"/);
  assert.match(delivery, /from\("notifications"\)\s*\.update\(\{ is_read: true \}\)/);
  assert.match(delivery, /\.eq\("dedupe_key",\s*announcementNotificationKey/);
});

test("the tenancy check runs before a read state is written (s18)", () => {
  assert.match(delivery, /\.eq\("id",\s*announcementId\)\s*\.eq\("school_id",\s*schoolId\)/);
  assert.match(delivery, /not-in-school/);
  assert.match(accountRoute, /does not belong to your school/);
});

test("the school-wide announcement read keeps its audience columns (s16)", () => {
  // The account route filters by audience after loading. A fallback select that
  // dropped the audience columns would silently widen every notice to everyone.
  const rungs = serverRead.slice(
    serverRead.indexOf("const selects = ["),
    serverRead.indexOf("];", serverRead.indexOf("const selects = [")),
  );
  const lines = rungs.split("\n").filter((l) => l.includes('"id, title'));
  assert.ok(lines.length >= 3, `expected the missing-column ladder, got ${lines.length}`);
  for (const line of lines) {
    assert.ok(
      /target_audience/.test(line),
      `every select rung must carry the audience column: ${line.trim()}`,
    );
  }
});
