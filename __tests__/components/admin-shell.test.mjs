import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const shellPath = resolve(process.cwd(), "components", "AdminShell.tsx");
const headerPath = resolve(
  process.cwd(),
  "components",
  "workspace",
  "WorkspaceShellHeader.tsx",
);

test("admin shell turns the top search field into an interactive workspace search", async () => {
  const source = await readFile(shellPath, "utf8");
  const headerSource = await readFile(headerPath, "utf8");

  assert.doesNotMatch(source, /readOnly/);
  assert.match(headerSource, /WorkspaceGlobalSearch/);
  assert.match(source, /workspacePageItems/);
  assert.match(source, /pageItems=\{workspacePageItems\}/);
});

test("admin shell wires unread message and notification counts into the header shortcuts", async () => {
  const source = await readFile(shellPath, "utf8");
  const headerSource = await readFile(headerPath, "utf8");

  assert.match(source, /useNavBadges/);
  assert.match(source, /navBadgeCounts/);
  assert.match(source, /badgeByHref/);
  assert.match(headerSource, /WorkspaceInboxCenter/);
});

test("admin shell wires the header shortcuts and overflow menu to real actions", async () => {
  const source = await readFile(shellPath, "utf8");
  const headerSource = await readFile(headerPath, "utf8");

  assert.match(source, /MobileDock/);
  assert.match(source, /badgeByHref/);
  assert.match(headerSource, /setOverflowOpen/);
  assert.match(source, /Sign out/);
});

test("admin shell targets the mounted admin and shared workspace route set", async () => {
  const navSource = await readFile(
    resolve(process.cwd(), "lib", "workspace", "nav.ts"),
    "utf8",
  );
  const shellSource = await readFile(shellPath, "utf8");

  assert.match(navSource, /href: "\/app\/dashboard", label: "Dashboard"/);
  assert.match(navSource, /href: "\/app\/admin\/users", label: "Users"/);
  assert.match(navSource, /href: "\/app\/messages", label: "Messages"/);
  assert.match(navSource, /href: "\/app\/profile", label: "Profile"/);
  assert.match(navSource, /href: "\/app\/settings", label: "Settings"/);

  assert.match(navSource, /href: "\/app\/parent", label: "Dashboard"/);

  assert.match(shellSource, /MobileDock/);
  assert.match(
    shellSource,
    /const role = normalizeWorkspaceRole\(workspace\?\.workspaceRole\);/,
  );
  assert.doesNotMatch(shellSource, /\|\| "admin"/);
  assert.match(shellSource, /pathname === "\/app\/parent"/);
  assert.match(shellSource, /pathname === "\/app\/student"/);

  assert.doesNotMatch(navSource, /href: "\/teacher\/messages"/);
  assert.doesNotMatch(shellSource, /router\.push\("\/admin\/messages"\)/);
  assert.doesNotMatch(shellSource, /router\.push\("\/admin\/notifications"\)/);
});