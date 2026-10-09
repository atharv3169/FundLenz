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
assert.equal(prod.keep_vars, true, "Retain existing nonsecret dashboard variables during production deploy");
assert.equal(prod.d1_databases?.length, 1, "Production must have one reviewed blog database");
assert.equal(prod.d1_databases[0].binding, "BLOG_ADMIN_DB");
assert.equal(prod.d1_databases[0].database_name, "fundlenz-blog-admin-production");
assert.equal(prod.d1_databases[0].database_id, "cfdfc32d-5833-4102-889a-37889bbbb7b1");
assert.equal(stage.ratelimits?.length, 2, "Isolated staging must have two form limiters");
assert.equal(prod.ratelimits?.length, 2, "Live Worker must have two form limiters");
for (const [i, limiter] of stage.ratelimits.entries()) {
  assert.equal(limiter.name, prod.ratelimits[i].name);
  assert.deepEqual(limiter.simple, prod.ratelimits[i].simple);
  assert.notEqual(limiter.namespace_id, prod.ratelimits[i].namespace_id,
    "Staging form limits must not consume production counters");
}
assert.notEqual(prod.d1_databases[0].database_id, stage.d1_databases[0].database_id,
  "Production and staging must never share a D1 database");
const vite = readFileSync("vite.config.ts", "utf8");
assert.ok(!vite.includes("wrangler.blog-staging.jsonc"), "Protected Vite config must not select a staging Worker.");
const builder = readFileSync("scripts/build-blog-staging.mjs", "utf8");
assert.ok(builder.includes("dist/server/wrangler.json"), "Staging must rewrite only generated build artifacts.");
assert.ok(builder.includes("generated.name = staging.name"));
assert.ok(builder.includes("generated.assets.run_worker_first = true"), "All staging static assets must pass through authentication.");
assert.ok(builder.includes('generated.main = "./blog-staging-gate-entry.mjs"'), "Staging must use gated entrypoint.");
if (process.argv.includes("--built")) {
  const variants = [
    resolve("dist/server/wrangler.json"),
    resolve("dist/fundlenz-blog-staging/wrangler.json"),
  ].filter(existsSync);
  assert.ok(variants.length === 1, "Missing or ambiguous staging Wrangler build output.");
  const out = JSON.parse(readFileSync(variants[0], "utf8"));
  assert.equal(out.name, stage.name, "Build output points at the wrong Worker");
  assert.equal(out.main, "./blog-staging-gate-entry.mjs", "Generated Worker entry must be gated");
  assert.equal(out.assets?.run_worker_first, true, "Static assets must not bypass staging password");
  assert.equal(out.assets?.binding, "ASSETS", "Protected static files need a runtime binding");
  const wrapperPath = resolve("dist/server/blog-staging-gate-entry.mjs");
  const gatePath = resolve("dist/server/blog-staging-gate-core.mjs");
  assert.ok(existsSync(wrapperPath) && existsSync(gatePath), "Gate modules missing from build artifact");
  const gateEntrypoint = readFileSync(wrapperPath, "utf8");
  assert.ok(gateEntrypoint.includes("await serveStagingRequest(request, env"));
  const core = readFileSync(gatePath, "utf8");
  assert.ok(core.includes("env.ASSETS.fetch(safeRequest)"), "Authenticated static assets must be fetched explicitly");
  assert.ok(core.includes("forwardWithoutBasicHeader(request)"));
  assert.equal(Object.hasOwn(out.vars || {}, "FUNDLENZ_STAGING_GATE_PASSWORD"), false,
    "Do not store the staging password as a plain-text Wrangler variable");
  assert.equal(out.d1_databases?.[0]?.binding, "BLOG_ADMIN_DB");
  assert.equal(out.d1_databases?.[0]?.database_id, stage.d1_databases[0].database_id);
  assert.equal(out.vars?.BLOG_ADMIN_ALLOWED_HOSTNAMES, stage.vars.BLOG_ADMIN_ALLOWED_HOSTNAMES);
  assert.deepEqual(out.ratelimits, stage.ratelimits,
    "Staging must carry independent rate-limiting bindings");
  console.log("PASS: generated staging build deploys only to fundlenz-blog-staging");
} else console.log("PASS: isolated staging Wrangler config and production guardrails");
