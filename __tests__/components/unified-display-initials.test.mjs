import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const shellFiles = [
  "components/ParentShell.tsx",
  "components/PaymentsShell.tsx",
  "components/StudentShell.tsx",
  "components/TeacherShell.tsx",
];

// 2026-09: role shells delegate their chrome to the shared
// components/workspace/WorkspaceShell.tsx. The initials invariant now holds
// via the shared workspaceShellInitials() wrapper (which itself calls
// getDisplayInitials) instead of per-shell imports.
const sharedShellSource = readFileSync(
  "components/workspace/WorkspaceShell.tsx",
  "utf8",
);

test("shells use the unified getDisplayInitials helper instead of single character slices", () => {
  // The shared shell must implement the initials via the unified helper.
  assert.match(
    sharedShellSource,
    /getDisplayInitials/,
    "WorkspaceShell must use the getDisplayInitials helper",
  );

  for (const file of shellFiles) {
    const source = readFileSync(file, "utf8");
    assert.match(
      source,
      /workspaceShellInitials/,
      `${file} should pass initials through the shared workspaceShellInitials helper`,
    );
    assert.doesNotMatch(
      source,
      /fallback=\{displayName\.slice\(0,\s*1\)\.toUpperCase\(\)\}/,
      `${file} should not use ad-hoc single-character fallback for avatar images`,
    );
    assert.doesNotMatch(
      source,
      /:\s*displayName\.slice\(0,\s*1\)\.toUpperCase\(\)/,
      `${file} should not use ad-hoc single-character fallback as direct content when avatarUrl is missing`,
    );
  }
});
