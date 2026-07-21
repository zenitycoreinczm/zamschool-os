#!/usr/bin/env node
/**
 * Print July-style MTD AWS usage, credits applied, and net spend.
 * Remaining promotional credit balance is NOT available via Cost Explorer —
 * open https://console.aws.amazon.com/billing/home#/credits for remaining.
 *
 * Requires AWS CLI credentials (env or profile) with ce:GetCostAndUsage.
 */
import { execFileSync } from "node:child_process";

function awsJson(args) {
  const out = execFileSync("aws", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    env: process.env,
  });
  return JSON.parse(out);
}

function todayUtc() {
  return new Date().toISOString().slice(0, 10);
}

function monthStartUtc(d = new Date()) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

function endExclusiveTomorrow() {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

function money(n) {
  return `$${Number(n).toFixed(4)}`;
}

function main() {
  const start = monthStartUtc();
  const end = endExclusiveTomorrow();

  console.log(`AWS cost snapshot (UTC) ${start} → ${end} (end exclusive)\n`);

  const byType = awsJson([
    "ce",
    "get-cost-and-usage",
    "--time-period",
    `Start=${start},End=${end}`,
    "--granularity",
    "MONTHLY",
    "--metrics",
    "UnblendedCost",
    "--group-by",
    "Type=DIMENSION,Key=RECORD_TYPE",
    "--region",
    "us-east-1",
    "--output",
    "json",
  ]);

  const groups = byType?.ResultsByTime?.[0]?.Groups ?? [];
  let usage = 0;
  let credit = 0;
  let refund = 0;
  let discount = 0;
  let tax = 0;
  let other = 0;

  for (const g of groups) {
    const key = g.Keys?.[0] ?? "Unknown";
    const amount = Number(g.Metrics?.UnblendedCost?.Amount ?? 0);
    if (key === "Usage") usage += amount;
    else if (key === "Credit") credit += amount;
    else if (key === "Refund") refund += amount;
    else if (key === "Tax") tax += amount;
    else if (key.toLowerCase().includes("discount")) discount += amount;
    else other += amount;
  }

  const net = usage + credit + refund + discount + tax + other;

  console.log("Record type breakdown:");
  console.log(`  Usage (gross):     ${money(usage)}`);
  console.log(`  Credits applied:   ${money(credit)}  (negative = money saved)`);
  console.log(`  Discounts:         ${money(discount)}`);
  console.log(`  Refunds:           ${money(refund)}`);
  console.log(`  Tax:               ${money(tax)}`);
  if (Math.abs(other) > 1e-9) console.log(`  Other:             ${money(other)}`);
  console.log(`  Net (approx bill): ${money(net)}`);
  console.log("");
  console.log("Credits remaining (promotional balance):");
  console.log("  Not available via API. Check the console:");
  console.log("  https://console.aws.amazon.com/billing/home#/credits");
  console.log("");
  console.log("Re-run: node scripts/check-aws-credits.mjs");
}

try {
  main();
} catch (err) {
  console.error("Failed to load Cost Explorer data.");
  console.error(String(err?.stderr || err?.message || err));
  console.error("Ensure AWS credentials work: aws sts get-caller-identity");
  process.exit(1);
}
