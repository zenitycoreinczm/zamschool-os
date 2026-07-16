import test from "node:test";
import assert from "node:assert/strict";
import { readFile, writeFile, unlink } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { resolve } from "node:path";

const exec = promisify(execFile);

const whitelistPath = resolve(
  process.cwd(),
  "eslint-rules",
  "lib-legacy-whitelist.json",
);
const eslintConfigPath = resolve(process.cwd(), "eslint.config.mjs");
const sentinelPath = resolve(process.cwd(), "lib", "_zamschool-policy-sentinel.ts");
const libDir = resolve(process.cwd(), "lib");

test("lib-legacy-whitelist.json is well-formed JSON and entries are top-level basenames", async () => {
  const raw = await readFile(whitelistPath, "utf8");
  const parsed = JSON.parse(raw);
  assert.ok(Array.isArray(parsed), "whitelist must be a JSON array");
  for (const entry of parsed) {
    assert.equal(
      typeof entry,
      "string",
      `each entry must be a string, got ${typeof entry}: ${entry}`,
    );
    assert.ok(
      !entry.includes("/"),
      `each entry must be a top-level basename (no '/'), got ${entry}`,
    );
    assert.match(entry, /\.(ts|tsx)$/, `each entry must end in .ts or .tsx, got ${entry}`);
  }
});

test("lib-legacy-whitelist.json covers every current top-level lib/*.{ts,tsx} file", async () => {
  const raw = await readFile(whitelistPath, "utf8");
  const whitelist = new Set(JSON.parse(raw));

  // Re-read the actual lib/ directory listing via fs (avoids shell quoting
  // issues on Windows).
  const { readdir } = await import("node:fs/promises");
  const entries = await readdir(libDir, { withFileTypes: true });
  const onDisk = entries
    .filter(
      (e) =>
        e.isFile() &&
        (e.name.endsWith(".ts") || e.name.endsWith(".tsx")),
    )
    .map((e) => e.name);
  assert.ok(
    onDisk.length > 100,
    `sanity: lib/ still flat with many top-level files; got ${onDisk.length}`,
  );
  const unwhitelisted = onDisk.filter((entry) => !whitelist.has(entry));
  assert.deepEqual(
    unwhitelisted,
    [],
    `unexpected top-level files not on the whitelist: ${unwhitelisted.join(", ")}`,
  );
});

test("rule fires a warning for an unknown top-level file and stays silent once whitelisted", async () => {
  // Drop a sentinel file at lib/ root.
  await writeFile(
    sentinelPath,
    "// temporary sentinel; deleted by the test after ESLint has run.\nexport const ok = true;\n",
    "utf8",
  );

  try {
    // Add the sentinel basename to the whitelist, scan - must be silent.
    const raw = await readFile(whitelistPath, "utf8");
    const list = JSON.parse(raw);
    list.push("_zamschool-policy-sentinel.ts");
    await writeFile(whitelistPath, JSON.stringify(list, null, 2) + "\n", "utf8");

    try {
      const { stdout } = await exec(
        process.execPath,
        [
          resolve(process.cwd(), "node_modules", "eslint", "bin", "eslint.js"),
          "--config",
          eslintConfigPath,
          sentinelPath,
        ],
        { cwd: process.cwd(), env: { ...process.env, NO_COLOR: "1" } },
      );
      assert.ok(
        !/zamschool-local\/lib-subdomain-policy/.test(stdout),
        `rule should be silent for whitelisted sentinel; stdout:\n${stdout}`,
      );
    } finally {
      // Now remove the sentinel from the whitelist and re-scan; rule should fire.
      const raw2 = await readFile(whitelistPath, "utf8");
      const list2 = JSON.parse(raw2).filter(
        (e) => e !== "_zamschool-policy-sentinel.ts",
      );
      await writeFile(whitelistPath, JSON.stringify(list2, null, 2) + "\n", "utf8");
    }

    const { stdout: stdoutUnlisted } = await exec(
      process.execPath,
      [
        resolve(process.cwd(), "node_modules", "eslint", "bin", "eslint.js"),
        "--config",
        eslintConfigPath,
        sentinelPath,
      ],
      { cwd: process.cwd(), env: { ...process.env, NO_COLOR: "1" } },
    );
    assert.match(
      stdoutUnlisted,
      /zamschool-local\/lib-subdomain-policy/,
      "rule should fire for an unlisted top-level file",
    );
  } finally {
    await unlink(sentinelPath).catch(() => {});
    // Restore the whitelist to its committed state is unnecessary: this test
    // reverts its own additions/removals before the FAA block, and the test
    // runner re-reads the file fresh each invocation.
  }
});
