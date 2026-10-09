#!/usr/bin/env node
/** Production D1 binding guard. No network, Cloudflare token, or SQL execution. */
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

const prod = JSON.parse(readFileSync("wrangler.jsonc", "utf8"));
const stage = JSON.parse(readFileSync("wrangler.blog-staging.jsonc", "utf8"));
const id = "cfdfc32d-5833-4102-889a-37889bbbb7b1";

assert.equal(prod.name, "fundlenz", "Never deploy production under staging name");
assert.equal(prod.keep_vars, true, "Preserve Cloudflare dashboard runtime variables");
assert.equal(prod.workers_dev, true, "Keep pre-cutover temporary Worker hostname");
assert.equal(prod.d1_databases?.length, 1, "Require exactly one reviewed production blog D1 binding");
assert.deepEqual(prod.d1_databases[0], {
  binding: "BLOG_ADMIN_DB",
  database_name: "fundlenz-blog-admin-production",
  database_id: id,
});
assert.equal(stage.name, "fundlenz-blog-staging");
assert.equal(stage.d1_databases?.length, 1);
assert.notEqual(stage.d1_databases[0].database_id, id, "Staging and production cannot share a database");
assert.equal(prod.routes, undefined, "Domain cutover is not authorized in this PR");
assert.equal(prod.route, undefined, "Domain cutover is not authorized in this PR");
assert.equal(prod.triggers, undefined);
assert.equal(prod.vars, undefined, "Never commit production secrets or overwrite dashboard vars");
assert.equal(prod.secrets, undefined, "Configure production secrets privately in Cloudflare");
const migrations = [
  readFileSync("db/blog-admin/0001_auth.sql", "utf8"),
  readFileSync("db/blog-admin/0002_editor_drafts.sql", "utf8"),
];
for (const table of ["blog_admin_sessions", "blog_admin_attempts",
                     "blog_admin_security_events", "blog_homepage_draft", "blog_article_drafts"])
  assert.ok(migrations.some(s => s.includes("CREATE TABLE IF NOT EXISTS " + table)),
    "Missing non-destructive blog table: " + table);
for (const sql of migrations) {
  assert.ok(!/\bDROP\s+(?:TABLE|DATABASE)|\bTRUNCATE\s+TABLE|\bDELETE\s+FROM\b/i.test(sql),
    "Schema setup must not remove existing production data");
}
if (process.argv.includes("--built")) {
  const output = "dist/server/wrangler.json";
  assert.ok(existsSync(output), "Expected generated production Wrangler configuration");
  const generated = JSON.parse(readFileSync(output, "utf8"));
  assert.equal(generated.name, prod.name, "Generated build would target wrong Worker");
  assert.equal(generated.keep_vars, true, "Generated deployment must preserve dashboard variables");
  assert.deepEqual(generated.d1_databases, prod.d1_databases,
    "Build dropped or altered production D1 binding");
  assert.equal(generated.routes, undefined, "Build changed custom domains");
  assert.equal(generated.route, undefined, "Build changed custom domains");
}
console.log("PASS: production D1 config reviewed, migrations non-destructive; no writes/deployment");
