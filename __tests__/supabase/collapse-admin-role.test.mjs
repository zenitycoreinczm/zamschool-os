import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { describe, it } from "node:test";

const migrationPath =
  "supabase/migrations/20260709140000_collapse_admin_into_principal.sql";

describe("collapse admin into principal migration", () => {
  it("ships the migration file", () => {
    assert.equal(existsSync(migrationPath), true);
  });

  it("rewrites profile admin roles to principal", () => {
    const sql = readFileSync(migrationPath, "utf8");
    assert.match(sql, /UPDATE public\.profiles/i);
    assert.match(sql, /role = 'principal'/);
    assert.match(sql, /'admin'/);
  });

  it("removes admin from profiles and invitation constraints", () => {
    const sql = readFileSync(migrationPath, "utf8");
    assert.match(sql, /profiles_role_check/);
    assert.match(sql, /staff_invitations_role_check/);
    assert.match(sql, /permission_group_roles_role_check/);
    // After rewrite, constraints should not re-allow bare admin as a profile role
    // in the new profiles_role_check list. Detect by ensuring principal is present
    // and the dedicated "School Administrator" group is deleted.
    assert.match(sql, /'principal'::text/);
    assert.match(sql, /DELETE FROM public\.permission_groups/i);
    assert.match(sql, /School Administrator/);
  });

  it("updates financial helper to exclude admin", () => {
    const sql = readFileSync(migrationPath, "utf8");
    assert.match(sql, /is_financial_context_role/);
    assert.match(sql, /'principal'/);
    assert.doesNotMatch(
      sql,
      /is_financial_context_role[\s\S]*'admin'[\s\S]*\$function\$/,
    );
  });
});
