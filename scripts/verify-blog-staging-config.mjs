#!/usr/bin/env node
/** Guardrail for build output: never allow a staging command to select the live Worker. */
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const prod = JSON.parse(readFileSync("wrangler.jsonc", "utf8"));
const stage = JSON.parse(readFileSync("wrangler.blog-staging.jsonc", "utf8"));
assert.equal(prod.name, "fundlenz");
assert.equal(stage.name, "fundlenz-blog-staging");
assert.notEqual(stage.name, prod.name);
assert.equal(stage.workers_dev, true);
assert.equal(stage.preview_urls, false);
assert.equal(stage.keep_vars, true);
assert.equal(stage.d1_databases.length, 1);
assert.equal(stage.d1_databases[0].binding, "BLOG_ADMIN_DB");
assert.equal(stage.d1_databases[0].database_name, "fundlenz-blog-admin-staging");
assert.equal(stage.d1_databases[0].database_id, "7849f805-0efa-49d3-b5bb-26c2527e4cfd");
assert.equal(stage.vars.BLOG_ADMIN_ALLOWED_HOSTNAMES, "fundlenz-blog-staging.atharvsahu711.workers.dev");
assert.equal(stage.routes, undefined, "Staging must never modify the live custom domain");
assert.equal(stage.route, undefined);
assert.equal(stage.triggers, undefined);
assert.equal(prod.d1_databases, undefined, "Staging D1 must not be bound to production");
const vite = readFileSync("vite.config.ts", "utf8");
assert.ok(vite.includes('FUNDLENZ_BUILD_TARGET === "blog-staging"'));
assert.ok(vite.includes("wrangler.blog-staging.jsonc"));
if (process.argv.includes("--built")) {
  const variants = [
    resolve("dist/server/wrangler.json"),
    resolve("dist/fundlenz-blog-staging/wrangler.json"),
  ].filter(existsSync);
  assert.ok(variants.length === 1, "Missing or ambiguous staging Wrangler build output.");
  const out = JSON.parse(readFileSync(variants[0], "utf8"));
  assert.equal(out.name, stage.name, "Build output points at the wrong Worker");
  assert.equal(out.d1_databases?.[0]?.binding, "BLOG_ADMIN_DB");
  assert.equal(out.d1_databases?.[0]?.database_id, stage.d1_databases[0].database_id);
  assert.equal(out.vars?.BLOG_ADMIN_ALLOWED_HOSTNAMES, stage.vars.BLOG_ADMIN_ALLOWED_HOSTNAMES);
  console.log("PASS: generated staging build deploys only to fundlenz-blog-staging");
} else console.log("PASS: isolated staging Wrangler config and production guardrails");
