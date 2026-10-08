#!/usr/bin/env node
/**
 * Build the protected, reviewed FundLenz source as-is. Only AFTER the build,
 * replace the GENERATED Wrangler deploy target with the isolated staging config.
 *
 * Never modify package.json, vite.config.ts, wrangler.jsonc, or financial data.
 * Never deploy from this script.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const staging = JSON.parse(readFileSync(resolve("wrangler.blog-staging.jsonc"), "utf8"));
const production = JSON.parse(readFileSync(resolve("wrangler.jsonc"), "utf8"));
const expectedHost = "fundlenz-blog-staging.atharvsahu711.workers.dev";
const expectedDB = "7849f805-0efa-49d3-b5bb-26c2527e4cfd";
if (production.name !== "fundlenz" || staging.name !== "fundlenz-blog-staging" ||
    !staging.keep_vars || staging.preview_urls !== false ||
    staging.d1_databases?.length !== 1 ||
    staging.d1_databases[0].binding !== "BLOG_ADMIN_DB" ||
    staging.d1_databases[0].database_id !== expectedDB ||
    staging.vars?.BLOG_ADMIN_ALLOWED_HOSTNAMES !== expectedHost ||
    staging.routes || staging.route || staging.triggers) {
  throw new Error("Staging resources do not match the owner-reviewed configuration.");
}

const command = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const result = spawnSync(command, ["run", "build"], { stdio: "inherit", env: process.env });
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status || 1);

const outputPath = resolve("dist/server/wrangler.json");
if (!existsSync(outputPath)) throw new Error("The normal Vinext build did not generate a Wrangler deploy config.");
const generated = JSON.parse(readFileSync(outputPath, "utf8"));
console.log("Safe staging build diagnostics:", JSON.stringify({
  generatedName: generated.name,
  hasRoute: Boolean(generated.route),
  routesCount: Array.isArray(generated.routes) ? generated.routes.length : -1,
  hasTriggers: Boolean(generated.triggers),
  d1Count: Array.isArray(generated.d1_databases) ? generated.d1_databases.length : -1,
  environmentsCount: generated.env && typeof generated.env === "object" ? Object.keys(generated.env).length : -1,
  hasAdminHostnameVar: Boolean(generated.vars?.BLOG_ADMIN_ALLOWED_HOSTNAMES),
  // Do not print any environment variables, tokens or confidential values.
}));
if (generated.name !== production.name || generated.routes || generated.route || generated.triggers ||
    (generated.d1_databases && generated.d1_databases.length) ||
    (generated.env && Object.keys(generated.env).length) ||
    (generated.vars && Object.keys(generated.vars).some(key => key === "BLOG_ADMIN_ALLOWED_HOSTNAMES"))) {
  throw new Error("Unexpected production-generated deployment settings; refusing staging conversion.");
}

// Rewrite only the generated, ignored build artifact. It is NOT a tracked repository file.
generated.name = staging.name;
generated.workers_dev = true;
generated.preview_urls = false;
generated.keep_vars = true;
generated.d1_databases = staging.d1_databases;
generated.vars = { ...(generated.vars || {}), ...staging.vars };
generated.observability = staging.observability;

writeFileSync(outputPath, JSON.stringify(generated, null, 2) + "\n", "utf8");
console.log("Staging artifact prepared for " + staging.name + " with D1 binding " + expectedDB);
console.log("PASS: original source configuration left unchanged; NO deployment occurred.");
