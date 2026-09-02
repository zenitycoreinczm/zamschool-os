import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

// Every role shell must satisfy the same accessibility shape. The audit
// (docs/AUDIT.md) lists these as invariants and they were re-verified on
// 2026-06-28. If any shell drops one of these, the test fails and the
// regression is caught before it ships.
//
// 2026-09: role shells were refactored to delegate their chrome to the
// shared components/workspace/WorkspaceShell.tsx. The a11y invariants now
// live there once — asserting them against the shared shell (plus a render
// delegation check per role shell) keeps the same guarantees without
// duplicating markup in five files.

const shells = [
  { name: "AdminShell", file: "components/AdminShell.tsx" },
  { name: "TeacherShell", file: "components/TeacherShell.tsx" },
  { name: "ParentShell", file: "components/ParentShell.tsx" },
  { name: "StudentShell", file: "components/StudentShell.tsx" },
  { name: "PaymentsShell", file: "components/PaymentsShell.tsx" },
];

const sharedSource = await readFile(
  resolve(process.cwd(), "components", "workspace", "WorkspaceShell.tsx"),
  "utf8",
);

for (const { name, file } of shells) {
  const source = await readFile(resolve(process.cwd(), file), "utf8");

  test(`${name} renders the shared WorkspaceShell chrome`, () => {
    assert.match(
      source,
      /WorkspaceShell/,
      `${name} must delegate its chrome to the shared WorkspaceShell`,
    );
  });

  test(`${name} exposes a skip-to-content link (shared chrome)`, () => {
    assert.match(
      sharedSource,
      /href="#main"[\s\S]{0,1500}Skip to content/,
      "WorkspaceShell must include an sr-only skip-to-content link to #main",
    );
  });

  test(`${name} marks the sidebar as a navigation region (shared chrome)`, () => {
    assert.match(
      sharedSource,
      /role="navigation"/,
      'WorkspaceShell must mark its sidebar with role="navigation"',
    );
    assert.match(
      sharedSource,
      /aria-label="Primary"/,
      'WorkspaceShell must label its sidebar aria-label="Primary"',
    );
  });

  test(`${name} uses aria-expanded on the sidebar toggle (shared chrome)`, () => {
    // Either a toggle button (aria-expanded={...}) or a labelled link group
    // counts; we just want a hint to assistive tech that the sidebar opens.
    assert.match(
      sharedSource,
      /aria-expanded=\{open\}/,
      "WorkspaceShell must expose aria-expanded tied to the sidebar open state",
    );
  });

  test(`${name} exposes role="alert" on its error/loading banner`, () => {
    // Two acceptable paths exist:
    //   1. an inline error banner with role="alert"
    //   2. a WorkspaceLoader with aria-live="polite"
    // Both make the workspace state readable to assistive tech.
    const inlineAlert = /role="alert"/.test(source) || /role="alert"/.test(sharedSource);
    const politeLoader =
      /WorkspaceLoader[\s\S]{0,400}aria-live="polite"|aria-live="polite"[\s\S]{0,400}WorkspaceLoader/.test(
        source,
      ) || /WorkspaceLoader[\s\S]{0,400}aria-live="polite"|aria-live="polite"[\s\S]{0,400}WorkspaceLoader/.test(sharedSource);
    assert.ok(
      inlineAlert || politeLoader,
      `${name} must expose either role="alert" on its error path or an aria-live="polite" WorkspaceLoader`,
    );
  });
}
