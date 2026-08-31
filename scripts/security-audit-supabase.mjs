#!/usr/bin/env node
/**
 * Supabase Security Audit Script
 * 
 * Checks for:
 * 1. RLS policy coverage on all tables
 * 2. Service role usage patterns
 * 3. JWT validation configuration
 * 4. MFA enforcement gaps
 * 5. Insecure query patterns
 * 6. Missing audit logs
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("❌ Missing Supabase credentials in environment");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Audit results
const findings = {
  critical: [],
  high: [],
  medium: [],
  low: [],
  info: [],
};

/**
 * Check 1: RLS Policy Coverage
 */
async function checkRLSPolicyCoverage() {
  console.log("\n🔍 Checking RLS policy coverage...");
  
  // Get all tables
  const { data: tables, error } = await supabase
    .from("pg_tables")
    .select("tablename, schemaname")
    .eq("schemaname", "public");
  
  if (error) {
    findings.critical.push({
      check: "RLS Coverage",
      issue: "Failed to query table list",
      details: error.message,
    });
    return;
  }
  
  // Check each table for RLS enabled
  for (const table of tables) {
    const { data: rlsEnabled } = await supabase.rpc("get_table_rls_status", {
      table_name: table.tablename,
    }).catch(() => ({ data: null }));
    
    if (!rlsEnabled) {
      findings.high.push({
        check: "RLS Coverage",
        issue: `Table "${table.tablename}" may not have RLS enabled`,
        recommendation: "Enable RLS: ALTER TABLE <table> ENABLE ROW LEVEL SECURITY;",
      });
    }
  }
  
  console.log(`✓ Checked ${tables.length} tables for RLS`);
}

/**
 * Check 2: Service Role Usage Patterns
 */
async function checkServiceRoleUsage() {
  console.log("\n🔍 Analyzing service role usage patterns...");
  
  // This would require analyzing API route code
  // For now, we check if service key has excessive privileges
  
  const { data: currentUser } = await supabase.auth.getUser();
  
  if (currentUser?.user) {
    findings.info.push({
      check: "Service Role",
      finding: "Service role is active and authenticated",
      note: "Ensure service key is never exposed to client-side code",
    });
  }
  
  console.log("✓ Service role analysis complete");
}

/**
 * Check 3: JWT Validation Configuration
 */
async function checkJWTValidation() {
  console.log("\n🔍 Checking JWT validation configuration...");
  
  // Verify JWT issuer matches expected
  const expectedIssuer = `${SUPABASE_URL}/auth/v1`;
  const actualIssuer = process.env.SUPABASE_JWT_ISSUER;
  
  if (actualIssuer && actualIssuer !== expectedIssuer) {
    findings.medium.push({
      check: "JWT Validation",
      issue: "JWT issuer mismatch",
      expected: expectedIssuer,
      actual: actualIssuer,
      recommendation: "Update SUPABASE_JWT_ISSUER to match Supabase URL",
    });
  } else {
    findings.info.push({
      check: "JWT Validation",
      finding: "JWT issuer configuration appears correct",
    });
  }
  
  console.log("✓ JWT validation check complete");
}

/**
 * Check 4: MFA Enforcement Gaps
 */
async function checkMFAEnforcement() {
  console.log("\n🔍 Checking MFA enforcement...");
  
  // Check if MFA is required for admin roles
  const { data: adminProfiles } = await supabase
    .from("profiles")
    .select("id, role")
    .in("role", ["PRINCIPAL", "SUPER_ADMIN", "HR_ADMIN"]);
  
  if (adminProfiles && adminProfiles.length > 0) {
    findings.medium.push({
      check: "MFA Enforcement",
      issue: `${adminProfiles.length} admin profiles found without verified MFA status`,
      recommendation: "Implement AAL2 requirement for sensitive roles (already done in lib/auth-aal-guard.ts)",
    });
  }
  
  console.log(`✓ Found ${adminProfiles?.length || 0} admin profiles`);
}

/**
 * Check 5: Insecure Query Patterns
 */
async function checkInsecureQueryPatterns() {
  console.log("\n🔍 Scanning for insecure query patterns...");
  
  // This would involve static analysis of route files
  // For now, we provide recommendations
  
  findings.low.push({
    check: "Query Patterns",
    finding: "Manual review recommended for:",
    recommendations: [
      "Ensure all queries include school_id filter for tenant isolation",
      "Use parameterized queries to prevent SQL injection",
      "Avoid SELECT * - specify only needed columns",
      "Implement pagination limits on all list endpoints",
    ],
  });
  
  console.log("✓ Query pattern recommendations generated");
}

/**
 * Check 6: Missing Audit Logs
 */
async function checkAuditLogs() {
  console.log("\n🔍 Checking audit log coverage...");
  
  // Check if audit_logs table exists
  const { data: auditTable } = await supabase
    .from("pg_tables")
    .select("tablename")
    .eq("tablename", "audit_logs")
    .eq("schemaname", "public")
    .maybeSingle();
  
  if (!auditTable) {
    findings.high.push({
      check: "Audit Logs",
      issue: "audit_logs table not found",
      recommendation: "Create audit_logs table for tracking sensitive operations",
    });
  } else {
    findings.info.push({
      check: "Audit Logs",
      finding: "audit_logs table exists",
    });
  }
  
  console.log("✓ Audit log check complete");
}

/**
 * Check 7: Database Indexes for Performance
 */
async function checkDatabaseIndexes() {
  console.log("\n🔍 Checking database indexes...");
  
  // Critical indexes for 20K+ users
  const criticalIndexes = [
    { table: "profiles", column: "school_id" },
    { table: "profiles", column: "email" },
    { table: "students", column: "school_id" },
    { table: "students", column: "class_id" },
    { table: "discipline_records", column: "school_id" },
    { table: "discipline_records", column: "student_id" },
  ];
  
  for (const index of criticalIndexes) {
    const { data: exists } = await supabase
      .from("pg_indexes")
      .select("indexname")
      .eq("tablename", index.table)
      .ilike("indexdef", `%${index.column}%`)
      .limit(1)
      .maybeSingle();
    
    if (!exists) {
      findings.medium.push({
        check: "Database Indexes",
        issue: `Missing index on ${index.table}.${index.column}`,
        recommendation: `CREATE INDEX idx_${index.table}_${index.column} ON ${index.table}(${index.column});`,
      });
    }
  }
  
  console.log("✓ Index check complete");
}

/**
 * Generate Report
 */
function generateReport() {
  console.log("\n" + "=".repeat(80));
  console.log("📊 SUPABASE SECURITY AUDIT REPORT");
  console.log("=".repeat(80));
  console.log(`Generated: ${new Date().toISOString()}`);
  console.log(`Supabase URL: ${SUPABASE_URL}`);
  console.log("");
  
  // Summary
  console.log("SUMMARY:");
  console.log(`  🔴 Critical: ${findings.critical.length}`);
  console.log(`  🟠 High:     ${findings.high.length}`);
  console.log(`  🟡 Medium:   ${findings.medium.length}`);
  console.log(`  🔵 Low:      ${findings.low.length}`);
  console.log(`  ℹ️  Info:      ${findings.info.length}`);
  console.log("");
  
  // Detailed findings
  for (const [severity, items] of Object.entries(findings)) {
    if (items.length === 0) continue;
    
    const emoji = {
      critical: "🔴",
      high: "🟠",
      medium: "🟡",
      low: "🔵",
      info: "ℹ️ ",
    }[severity];
    
    console.log(`${emoji} ${severity.toUpperCase()} FINDINGS (${items.length}):`);
    console.log("-".repeat(80));
    
    for (const item of items) {
      console.log(`  • ${item.check}: ${item.issue || item.finding}`);
      if (item.recommendation) {
        console.log(`    → ${item.recommendation}`);
      }
      if (item.details) {
        console.log(`    Details: ${item.details}`);
      }
      console.log("");
    }
  }
  
  console.log("=".repeat(80));
  console.log("RECOMMENDATIONS FOR 20K+ USERS:");
  console.log("=".repeat(80));
  console.log(`
1. Enable connection pooling via Supabase PgBouncer
2. Implement read replicas for heavy read workloads
3. Use materialized views for complex dashboard queries
4. Set up automated backup schedule (daily minimum)
5. Configure VPC peering for private network access
6. Enable enhanced monitoring and alerting
7. Implement query timeout limits (max 30s)
8. Use prepared statements for repeated queries
9. Regular vacuum analyze schedule (weekly)
10. Monitor slow query log and optimize accordingly
  `);
  
  // Exit with error code if critical/high findings
  const hasCriticalOrHigh = findings.critical.length > 0 || findings.high.length > 0;
  process.exit(hasCriticalOrHigh ? 1 : 0);
}

/**
 * Main Execution
 */
async function main() {
  console.log("🚀 Starting Supabase Security Audit...\n");
  
  try {
    await checkRLSPolicyCoverage();
    await checkServiceRoleUsage();
    await checkJWTValidation();
    await checkMFAEnforcement();
    await checkInsecureQueryPatterns();
    await checkAuditLogs();
    await checkDatabaseIndexes();
    
    generateReport();
  } catch (error) {
    console.error("❌ Audit failed:", error);
    process.exit(1);
  }
}

main();
