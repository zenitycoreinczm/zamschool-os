import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const root = "components/admin/users";

function read(name) {
  return readFileSync(`${root}/${name}`, "utf8");
}

describe("admin users UI polish", () => {
  it("uses a shared modal shell with dialog a11y", () => {
    const shell = read("UsersModalShell.tsx");
    assert.match(shell, /role="dialog"/);
    assert.match(shell, /aria-modal="true"/);
    assert.match(shell, /aria-labelledby/);
    assert.match(shell, /Escape/);
    assert.match(shell, /aria-label="Close dialog"/);
  });

  it("directory table has empty state and table a11y", () => {
    const table = read("UsersDirectoryTable.tsx");
    assert.match(table, /EmptyState/);
    assert.match(table, /scope="col"/);
    assert.match(table, /aria-label=\{`\$\{meta\.plural\} directory`\}/);
    assert.match(table, /focus-visible:ring-2/);
  });

  it("tabs expose tablist semantics", () => {
    const tabs = read("UsersTabBar.tsx");
    assert.match(tabs, /role="tablist"/);
    assert.match(tabs, /role="tab"/);
    assert.match(tabs, /aria-selected=\{active\}/);
  });

  it("modals consume UsersModalShell", () => {
    for (const file of [
      "UserFormModal.tsx",
      "UserDetailModal.tsx",
      "ParentLinkModal.tsx",
      "NewCredentialsModal.tsx",
    ]) {
      const source = read(file);
      assert.match(source, /UsersModalShell/, `${file} should use UsersModalShell`);
    }
  });

  it("page loader announces status", () => {
    const page = read("AdminUsersPage.tsx");
    assert.match(page, /role="status"/);
    assert.match(page, /role="tabpanel"/);
    assert.match(page, /hasSearch=/);
  });

  it("splits useAdminUsers into focused hooks", () => {
    const composer = read("useAdminUsers.ts");
    assert.match(composer, /useUsersDirectory/);
    assert.match(composer, /useUserForm/);
    assert.match(composer, /useUserDetail/);
    assert.match(composer, /useParentLinks/);
    assert.ok(
      composer.split("\n").length < 200,
      "composer hook should stay thin",
    );

    for (const file of [
      "useUsersDirectory.ts",
      "useUserForm.ts",
      "useUserDetail.ts",
      "useParentLinks.ts",
    ]) {
      assert.ok(read(file).length > 100, `${file} should exist and have body`);
    }
  });

  it("soft-fails class and subject option loads so limited roles still open directory", () => {
    const directory = read("useUsersDirectory.ts");
    assert.match(directory, /fetchClassOptions/);
    assert.match(directory, /fetchSubjectOptions/);
    // Both helpers must catch errors - HR lacks classes:read on many schools
    // and a hard throw previously aborted the whole directory load.
    assert.match(
      directory,
      /fetchClassOptions[\s\S]*?catch\s*\{[\s\S]*?setClassOptions\(\[\]\)/,
    );
    assert.match(
      directory,
      /fetchSubjectOptions[\s\S]*?catch\s*\{[\s\S]*?setSubjectOptions\(\[\]\)/,
    );
  });

  it("defines typed DirectoryUser instead of bare any row", () => {
    const types = read("types.ts");
    assert.match(types, /export type DirectoryUser/);
    assert.match(types, /export type UserDetailData/);
    assert.match(types, /export type ParentMeta/);
    assert.match(read("helpers.ts"), /export function validateUserForm/);
  });
});
