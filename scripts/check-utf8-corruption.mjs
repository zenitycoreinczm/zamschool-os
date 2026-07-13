import fs from "node:fs";
import path from "node:path";

const roots = ["components", "app", "lib"];
const bad = [];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".next") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.(tsx?|jsx?|mjs|cjs)$/.test(entry.name)) check(full);
  }
}

function check(file) {
  const raw = fs.readFileSync(file);
  if (raw.includes(0)) {
    bad.push([file, "null-bytes"]);
    return;
  }
  let text;
  try {
    text = raw.toString("utf8");
  } catch {
    bad.push([file, "decode-fail"]);
    return;
  }
  if (text.includes("\uFFFD")) bad.push([file, "replacement-char"]);
  if (text.includes("â€") || text.includes("Ã¢") || text.includes("â€™")) {
    bad.push([file, "mojibake"]);
  }
  // Unmatched template/string heuristics: file ending mid-string unlikely
  // Look for common PowerShell corruption of accent props
  if (/accent=""\s*[a-z]/.test(text) || /accent="slate""/.test(text)) {
    bad.push([file, "broken-accent"]);
  }
}

for (const root of roots) {
  if (fs.existsSync(root)) walk(root);
}

console.log("issues:", bad.length);
for (const [f, kind] of bad.slice(0, 80)) {
  console.log(kind, f);
}
