import test from "node:test";
import assert from "node:assert/strict";

const {
  filterWorkspacePageItems,
  mergeWorkspaceSearchResults,
  navItemsToWorkspacePages,
  sanitizeWorkspaceSearchQuery,
} = await import("../../lib/workspace/search.ts");

test("sanitizeWorkspaceSearchQuery trims and strips unsafe characters", () => {
  assert.equal(sanitizeWorkspaceSearchQuery("  john@school.com  "), "john@school.com");
  assert.equal(sanitizeWorkspaceSearchQuery("bad<script>term"), "badscriptterm");
});

test("navItemsToWorkspacePages maps sidebar routes into page results", () => {
  const pages = navItemsToWorkspacePages([
    { href: "/app/registrar/people", label: "Users" },
  ]);

  assert.equal(pages.length, 1);
  assert.equal(pages[0].kind, "page");
  assert.equal(pages[0].href, "/app/registrar/people");
});

test("mergeWorkspaceSearchResults prioritizes page matches and dedupes", () => {
  const merged = mergeWorkspaceSearchResults(
    [
      {
        id: "page:users",
        kind: "page",
        label: "Users",
        hint: "app / admin / users",
        href: "/app/registrar/people",
      },
    ],
    [
      {
        id: "person:1",
        kind: "person",
        label: "John Users",
        hint: "Student",
        href: "/app/registrar/people?q=John%20Users",
      },
    ],
    "users"
  );

  assert.equal(merged.length, 2);
  assert.equal(merged[0].kind, "page");
});

test("filterWorkspacePageItems returns suggestions when query is empty", () => {
  const pages = navItemsToWorkspacePages([
    { href: "/app/dashboard", label: "Dashboard" },
    { href: "/app/registrar/people", label: "Users" },
  ]);

  assert.equal(filterWorkspacePageItems(pages, "").length, 2);
  assert.equal(filterWorkspacePageItems(pages, "users").length, 1);
});