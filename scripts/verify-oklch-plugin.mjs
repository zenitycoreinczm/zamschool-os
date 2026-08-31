// Standalone verification of the oklch-compat PostCSS plugin.
// Usage: node scripts/verify-oklch-plugin.mjs
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import postcss from "postcss";
import plugin from "./postcss-oklch-compat.cjs";

const fixture = `
:root {
  --color-amber-100: oklch(96.2% .059 95.617);
  --color-sky-500: oklch(68.5% .122 236.8);
  --brand: oklch(0.55 0.18 250 / 40%);
  --lab: oklab(54% 0.1 -0.05);
}
.a { color: oklch(70% 0.1 130); }
.b { background: linear-gradient(oklch(60% .12 200), oklch(90% .04 80 / 0.5)); }
.c { border-color: var(--color-amber-100); }
.d { color: oklch(var(--x) 0.1 100); }
`;

const result = await postcss([plugin]).process(fixture, { from: "fixture.css" });
const css = result.css;

let failures = 0;
const check = (name, cond) => {
  console.log((cond ? "PASS" : "FAIL") + " " + name);
  if (!cond) failures++;
};

check("oklch percentage form converted", css.includes("--color-amber-100: rgb("));
check("oklch raw form converted", css.includes("--color-sky-500: rgb("));
check("oklch with alpha -> rgba", /--brand:\s*rgba\(/.test(css));
check("oklab converted", /--lab:\s*rgb\(/.test(css));
check("var() passthrough preserved", css.includes("var(--color-amber-100)"));
check("var() inside oklch left untouched", css.includes("oklch(var(--x)"));
check("no oklch remains except var() case", !/oklch\((?!var)/.test(css));

// Sanity: conversion must be deterministic & identical across runs.
const second = await postcss([plugin]).process(fixture, { from: "fixture.css" });
check("deterministic output", second.css === css);

// Also verify against the previously deployed production CSS if cached.
const liveCssPath = join(process.env.TEMP || ".", "opencode", "main.css");
try {
  const live = readFileSync(liveCssPath, "utf8");
  const before = (live.match(/oklch\(/g) || []).length;
  const converted = await postcss([plugin]).process(live, { from: "live.css" });
  const after = (converted.css.match(/oklch\(/g) || []).length;
  console.log("live css: oklch before=" + before + " after=" + after);
  check("live production css fully converted", after === 0);
} catch {
  console.log("live css not cached - skipping live check");
}

if (failures > 0) {
  console.error(failures + " check(s) failed");
  process.exit(1);
}
console.log("ALL CHECKS PASSED");
