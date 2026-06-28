import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const shellPath = resolve(process.cwd(), "components", "AdminShell.tsx");

test("admin shell turns the top search field into an interactive workspace search", async () => {
  const source = await readFile(shellPath, "utf8");

  assert.doesNotMatch(source, /readOnly/);
  assert.match(source, /WorkspaceGlobalSearch/);
  assert.match(source, /workspacePageItems/);
});

test("admin shell wires unread message and notification counts into the header shortcuts", async () => {
  const source = await readFile(shellPath, "utf8");

  assert.match(source, /unreadSummary/);
  assert.match(source, /formatUnreadBadgeCount/);
  assert.match(source, /WorkspaceInboxCenter/);
  assert.match(source, /initialUnread=\{unreadSummary\}/);
  assert.match(source, /onUnreadChange=\{handleUnreadChange\}/);
});

test("admin shell wires the header shortcuts and overflow menu to real actions", async () => {
  const source = await readFile(shellPath, "utf8");

  assert.match(source, /messagesHref="\/app\/messages"/);
  assert.match(source, /notificationsHref="\/app\/notifications"/);
  assert.match(source, /setOverflowOpen/);
  assert.match(source, /Sign Out/);
});

test("admin shell targets the mounted admin and shared workspace route set", async () => {
  // Navigation items were refactored from AdminShell.tsx into workspace-nav.ts
  const navSource = await readFile(
    resolve(process.cwd(), "lib", "lib/workspace/nav.ts"),
    "utf8",
  );
  const shellSource = await readFile(shellPath, "utf8");

  // Admin workspace routes (in workspace-nav.ts)
  assert.match(navSource, /href: "\/app\/dashboard", label: "Dashboard"/);
  assert.match(navSource, /href: "\/app\/admin\/users", label: "Users"/);
  assert.match(navSource, /href: "\/app\/messages", label: "Messages"/);
  assert.match(navSource, /href: "\/app\/profile", label: "Profile"/);
  assert.match(navSource, /href: "\/app\/settings", label: "Settings"/);

  // Parent workspace routes (in workspace-nav.ts)
  assert.match(navSource, /href: "\/app\/parent", label: "Dashboard"/);

  // Shell still wires header shortcuts (in AdminShell.tsx)
  assert.match(shellSource, /messagesHref="\/app\/messages"/);
  assert.match(
    shellSource,
    /const role = normalizeWorkspaceRole\(workspace\?\.workspaceRole\);/,
  );
  assert.doesNotMatch(shellSource, /\|\| "admin"/);
  assert.match(shellSource, /pathname === "\/app\/parent"/);
  assert.match(shellSource, /pathname === "\/app\/student"/);

  // Teacher-scoped routes must not leak into the admin shell
  assert.doesNotMatch(navSource, /href: "\/teacher\/messages"/);
  assert.doesNotMatch(shellSource, /router\.push\("\/admin\/messages"\)/);
  assert.doesNotMatch(shellSource, /router\.push\("\/admin\/notifications"\)/);
});
